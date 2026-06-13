import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, subscriptionsTable } from "@workspace/db";

const router: IRouter = Router();

const PRO_ENTITLEMENT = "pro";
const PREMIUM_ENTITLEMENT = "premium";

type ActiveTier = "free" | "pro" | "premium";

function tierFromProductId(productId: string): ActiveTier {
  const lower = productId.toLowerCase();
  if (lower.includes("premium")) return "premium";
  if (lower.includes("pro")) return "pro";
  return "free";
}

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
  if (webhookSecret) {
    const authHeader = req.headers["authorization"] ?? "";
    if (authHeader !== webhookSecret) {
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

      const entitlements = event.entitlement_ids ?? [];
      let newTier: ActiveTier = "free";
      if (isActive) {
        if (entitlements.includes(PREMIUM_ENTITLEMENT)) newTier = "premium";
        else if (entitlements.includes(PRO_ENTITLEMENT)) newTier = "pro";
        else newTier = tierFromProductId(productId);
      }

      await tx
        .update(usersTable)
        .set({
          tier: newTier,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, user.id));
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    req.log?.error({ err, clerkUserId }, "RC webhook processing failed");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
