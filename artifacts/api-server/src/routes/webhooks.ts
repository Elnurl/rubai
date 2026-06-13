import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, subscriptionsTable } from "@workspace/db";
import {
  RC_ENTITLEMENT_PRO,
  RC_ENTITLEMENT_PREMIUM,
  tierFromEntitlements,
  tierFromProductId,
  type ActiveTier,
} from "../lib/rcEntitlements";

const router: IRouter = Router();

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
}

interface RcWebhookBody {
  event?: RcWebhookEvent;
}

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
    const authHeader = req.headers["authorization"] ?? "";
    const secretBuf = Buffer.from(webhookSecret, "utf8");
    const headerBuf = Buffer.from(authHeader, "utf8");
    const valid =
      headerBuf.byteLength === secretBuf.byteLength &&
      timingSafeEqual(headerBuf, secretBuf);
    if (!valid) {
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
      req.log?.warn({ clerkUserId }, "RC webhook: user not found");
      res.status(200).json({ ok: true, skipped: "user_not_found" });
      return;
    }

    const status = isActive ? "active" : "canceled";
    const currentPeriodEnd = event.expiration_at_ms
      ? new Date(event.expiration_at_ms)
      : null;

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

      let newTier: ActiveTier = "free";
      if (isActive) {
        const entitlements = event.entitlement_ids ?? [];
        if (entitlements.length > 0) {
          newTier = tierFromEntitlements(entitlements);
        } else {
          newTier = tierFromProductId(productId);
        }
      }

      await tx
        .update(usersTable)
        .set({
          tier: newTier,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, user.id));
    });

    req.log?.info(
      { clerkUserId, eventType: event.type, provider },
      "RC webhook processed",
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    req.log?.error({ err, clerkUserId }, "RC webhook processing failed");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
