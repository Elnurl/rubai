/**
 * RevenueCat entitlement identifier constants.
 *
 * IMPORTANT: These strings must exactly match the entitlement identifiers
 * configured in the RevenueCat dashboard under "Entitlements". If you rename
 * an entitlement in the dashboard you must update these constants to match,
 * otherwise both the webhook handler and the GET /me tier fallback will stop
 * granting the correct tier.
 *
 * Current dashboard entitlements:
 *   "pro"     → Pro tier monthly/annual subscription
 *   "premium" → Premium tier monthly/annual subscription
 */
export const RC_ENTITLEMENT_PRO = "pro";
export const RC_ENTITLEMENT_PREMIUM = "premium";

export type ActiveTier = "free" | "pro" | "premium";

/**
 * Derive the tier granted by a set of active entitlement IDs.
 * Premium takes priority over Pro.
 */
export function tierFromEntitlements(entitlementIds: string[]): ActiveTier {
  if (entitlementIds.includes(RC_ENTITLEMENT_PREMIUM)) return "premium";
  if (entitlementIds.includes(RC_ENTITLEMENT_PRO)) return "pro";
  return "free";
}

/**
 * Fallback: derive tier from a product_id string when entitlement_ids are
 * absent from the webhook payload (older RC SDK versions may omit them).
 */
export function tierFromProductId(productId: string): ActiveTier {
  const lower = productId.toLowerCase();
  if (lower.includes("premium")) return "premium";
  if (lower.includes("pro")) return "pro";
  return "free";
}
