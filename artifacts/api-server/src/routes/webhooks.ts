import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, subscriptionsTable, tierTransitionsTable } from "@workspace/db";
import {
  RC_ENTITLEMENT_PRO,
  RC_ENTITLEMENT_PREMIUM,
  tierFromEntitlements,
  tierFromProductId,
  type ActiveTier,
} from "../lib/rcEntitlements";
import { sendTierChangedPushTo } from "../lib/pushScheduler";

const router: IRouter = Router();

// How long after an ACTIVE event's own timestamp we will still return 404
// (triggering a RevenueCat retry) when the user row doesn't exist yet.
// Within this window the missing row is most likely a sign-up race;
// outside it the clerkUserId is genuinely unknown and we stop retrying.
// Configurable via env so tests and ops can override without code changes.
const WEBHOOK_RACE_WINDOW_MS =
  Number(process.env["WEBHOOK_RACE_WINDOW_MS"] ?? "") || 5 * 60 * 1000; // 5 min

const ACTIVE_STATUSES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "NON_RENEWING_PURCHASE",
  "UNCANCELLATION",
]);

const INACTIVE_STATUSES = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
  "SUBSCRIBER_ALIAS",
]);

interface RcWebhookEvent {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  store?: string;
  transaction_id?: string;
  expiration_at_ms?: number | null;
  entitlement_ids?: string[];
  /** Unix timestamp (ms) when RevenueCat generated the event. */
  event_timestamp_ms?: number | null;
}

interface RcWebhookBody {
  event?: RcWebhookEvent;
}

router.get("/webhooks/revenuecat/health", (req, res) => {
  const webhookSecret = process.env["REVENUECAT_WEBHOOK_SECRET"];
  const isProduction = process.env["NODE_ENV"] === "production";
  const secretConfigured = Boolean(webhookSecret?.trim());

  if (isProduction) {
    if (!secretConfigured) {
      req.log?.error(
        "REVENUECAT_WEBHOOK_SECRET is unset in production — health check rejected",
      );
      res.status(503).json({ ok: false, error: "secret_not_configured" });
      return;
    }

    const authHeader = req.headers["authorization"] ?? "";
    const trimmedSecret = webhookSecret!.trim();
    const secretBuf = Buffer.from(trimmedSecret, "utf8");
    const headerBuf = Buffer.from(authHeader, "utf8");
    const valid =
      headerBuf.byteLength === secretBuf.byteLength &&
      timingSafeEqual(headerBuf, secretBuf);

    if (!valid) {
      req.log?.warn(
        { headerByteLength: headerBuf.byteLength },
        "RC webhook health: Authorization header does not match REVENUECAT_WEBHOOK_SECRET",
      );
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  req.log?.info({ secretConfigured }, "RC webhook health check OK");
  res.status(200).json({ ok: true, secretConfigured });
});

router.post("/webhooks/revenuecat", async (req, res) => {
  const webhookSecret = process.env["REVENUECAT_WEBHOOK_SECRET"];
  const isProduction = process.env["NODE_ENV"] === "production";

  if (isProduction && !webhookSecret) {
    // Startup guard in index.ts should have prevented this, but defend in
    // depth: never process unauthenticated tier changes in production.
    // Return 401 (not 500) so callers cannot distinguish misconfiguration
    // from a deliberate auth rejection — avoids leaking server state.
    req.log?.error(
      "REVENUECAT_WEBHOOK_SECRET is unset in production — rejecting request",
    );
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (webhookSecret) {
    // RevenueCat sends the shared secret verbatim in the Authorization header
    // (no "Bearer " prefix). Example: Authorization: <your-webhook-secret>
    // We use timingSafeEqual to prevent timing-based brute-force attacks; an
    // attacker cannot deduce the secret one character at a time by measuring
    // response latency. Both buffers must be the same byte-length for
    // timingSafeEqual to work — a length mismatch is an instant rejection.
    //
    // Trim the stored secret to guard against accidental leading/trailing
    // whitespace introduced when copy-pasting into the secrets manager (a
    // common source of "right value, wrong bytes" mismatches).
    const authHeader = req.headers["authorization"] ?? "";
    const trimmedSecret = webhookSecret.trim();
    const secretBuf = Buffer.from(trimmedSecret, "utf8");
    const headerBuf = Buffer.from(authHeader, "utf8");
    const valid =
      headerBuf.byteLength === secretBuf.byteLength &&
      timingSafeEqual(headerBuf, secretBuf);
    if (!valid) {
      req.log?.warn(
        {
          headerByteLength: headerBuf.byteLength,
          secretByteLength: secretBuf.byteLength,
          headerPrefix: authHeader.slice(0, 8) || "(empty)",
        },
        "RC webhook: Authorization header does not match REVENUECAT_WEBHOOK_SECRET — check that the secret in Replit matches the value shown in RevenueCat Project Settings → Integrations → Webhooks",
      );
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const body = req.body as RcWebhookBody;
  const event = body?.event;

  if (!event?.type) {
    res.status(400).json({ error: "Missing event type" });
    return;
  }

  const clerkUserId =
    event.original_app_user_id ?? event.app_user_id ?? null;

  if (!clerkUserId) {
    res.status(200).json({ ok: true, skipped: "no_user_id" });
    return;
  }

  const productId = event.product_id ?? "";
  const storeTransactionId = event.transaction_id ?? null;
  const provider = event.store?.toLowerCase() ?? "revenuecat";

  const isActive = ACTIVE_STATUSES.has(event.type);
  const isInactive = INACTIVE_STATUSES.has(event.type);

  if (!isActive && !isInactive) {
    res.status(200).json({ ok: true, skipped: "unhandled_event_type" });
    return;
  }

  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkUserId, clerkUserId),
    });

    if (!user) {
      if (isActive) {
        // Determine whether this looks like a sign-up race or a genuinely
        // unknown user (e.g. test purchase from a deleted account).
        //
        // Strategy: use the event's own timestamp (`event_timestamp_ms`)
        // as the reference. If the event was generated within the race
        // window, the user row probably just hasn't been created yet
        // (Clerk post-sign-up hook hasn't fired), so we return 404 to
        // cause RevenueCat to retry. If the event is older than the race
        // window — meaning RC has already been retrying for a while — the
        // clerkUserId is genuinely unknown and we return 200 so RC stops
        // retrying, preventing an indefinite retry loop.
        //
        // Fall-through when `event_timestamp_ms` is absent: we assume the
        // event is recent to err on the side of applying the subscription.
        const eventAgeMs =
          event.event_timestamp_ms != null
            ? Date.now() - event.event_timestamp_ms
            : 0;

        if (eventAgeMs <= WEBHOOK_RACE_WINDOW_MS) {
          req.log?.warn(
            { clerkUserId, eventType: event.type, eventAgeMs },
            "RC webhook: user not found for recent active event — returning 404 to trigger RC retry",
          );
          res.status(404).json({ error: "user_not_found" });
        } else {
          req.log?.warn(
            {
              clerkUserId,
              eventType: event.type,
              eventAgeMs,
              windowMs: WEBHOOK_RACE_WINDOW_MS,
            },
            "RC webhook: user not found and event is older than race window — skipping to stop RC retries",
          );
          res.status(200).json({ ok: true, skipped: "user_not_found" });
        }
      } else {
        // For inactive events (cancellation, expiration, billing issues) the
        // user's tier is already "free" by default, so there is nothing to
        // apply. Returning 200 is safe — we don't want RC to retry forever
        // for a user that may have been deleted after cancelling.
        req.log?.warn(
          { clerkUserId, eventType: event.type },
          "RC webhook: user not found for inactive event — skipping",
        );
        res.status(200).json({ ok: true, skipped: "user_not_found" });
      }
      return;
    }

    const status = isActive ? "active" : "canceled";
    const currentPeriodEnd = event.expiration_at_ms
      ? new Date(event.expiration_at_ms)
      : null;

    // Compute the new tier before the transaction so we can use it after.
    let newTier: ActiveTier = "free";
    if (isActive) {
      const entitlements = event.entitlement_ids ?? [];
      newTier =
        entitlements.length > 0
          ? tierFromEntitlements(entitlements)
          : tierFromProductId(productId);
    }

    const tierChanged = user.tier !== newTier;

    await db.transaction(async (tx) => {
      if (productId && storeTransactionId) {
        await tx
          .insert(subscriptionsTable)
          .values({
            userId: user.id,
            provider,
            productId,
            status,
            currentPeriodEnd,
            storeTransactionId,
            raw: event as unknown as Record<string, unknown>,
          })
          .onConflictDoUpdate({
            target: [
              subscriptionsTable.provider,
              subscriptionsTable.storeTransactionId,
            ],
            set: {
              status,
              currentPeriodEnd,
              raw: event as unknown as Record<string, unknown>,
              updatedAt: new Date(),
            },
          });
      }

      await tx
        .update(usersTable)
        .set({
          tier: newTier,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, user.id));

      if (tierChanged) {
        await tx.insert(tierTransitionsTable).values({
          userId: user.id,
          fromTier: user.tier,
          toTier: newTier,
          triggeredBy: "webhook",
          eventType: event.type,
          metadata: {
            provider,
            productId: productId || null,
            storeTransactionId: storeTransactionId || null,
          },
        });
      }
    });

    req.log?.info(
      { clerkUserId, eventType: event.type, provider, newTier, tierChanged },
      "RC webhook processed",
    );

    // Fire-and-forget: poke the user's device so the tier change surfaces
    // immediately without requiring an app restart. Errors are swallowed so
    // a missing / invalid push token never causes the webhook to return 5xx.
    if (user.expoPushToken) {
      void sendTierChangedPushTo(user.expoPushToken, newTier).catch(() => {});
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    req.log?.error({ err, clerkUserId }, "RC webhook processing failed");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
