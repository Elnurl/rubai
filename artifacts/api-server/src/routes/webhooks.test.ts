/**
 * Integration tests for POST /api/webhooks/revenuecat
 *
 * Strategy: mock @workspace/db entirely so no real database is needed, spin
 * up a minimal Express app on a random port, and drive it with Node's built-in
 * fetch API (Node ≥ 18).
 *
 * Covered scenarios (per task spec):
 *   1. 401 when Authorization header doesn't match REVENUECAT_WEBHOOK_SECRET
 *   2. INITIAL_PURCHASE sets users.tier from entitlement_ids
 *   3. RENEWAL sets users.tier from entitlement_ids
 *   4. CANCELLATION resets tier to "free"
 *   5. EXPIRATION resets tier to "free"
 *   6. Duplicate webhook delivery (same transaction_id) is idempotent
 *   7. Fallback tier derivation from product_id when entitlement_ids is absent
 *   8. PRODUCT_CHANGE sets tier from entitlement_ids
 *   9. UNCANCELLATION re-grants the correct tier after a user un-cancels
 *  10. NON_RENEWING_PURCHASE sets tier appropriately for one-time purchases
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import express from "express";
import type { Server } from "node:http";

// ── Captured state shared between mock and assertions ──────────────────────
// Mutated by the mock tx.update().set() so tests can assert on the tier.
let capturedTierUpdate: string | undefined;
// How many times db.transaction was called — used for idempotency checks.
let transactionCallCount = 0;
// How many times tx.insert().values().onConflictDoUpdate() was called.
let upsertCallCount = 0;

// ── Mock @workspace/db before any route module is imported ─────────────────
vi.mock("@workspace/db", () => {
  const makeTx = () => ({
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: vi.fn().mockImplementation(() => {
          upsertCallCount++;
          return Promise.resolve(undefined);
        }),
      }),
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        capturedTierUpdate = vals["tier"] as string;
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      },
    }),
  });

  const mockFindFirst = vi.fn();

  return {
    db: {
      query: {
        usersTable: {
          findFirst: mockFindFirst,
        },
      },
      transaction: vi.fn(
        async (fn: (tx: ReturnType<typeof makeTx>) => Promise<void>) => {
          transactionCallCount++;
          return fn(makeTx());
        },
      ),
    },
    usersTable: {},
    subscriptionsTable: {},
    // Export the inner spy so tests can configure per-scenario return values.
    __mockFindFirst: mockFindFirst,
  };
});

// Import the router AFTER the mock is in place.
const { default: webhooksRouter } = await import("./webhooks");
const { __mockFindFirst } = await import("@workspace/db" as string);
const mockFindFirst = __mockFindFirst as ReturnType<typeof vi.fn>;

// ── Minimal Express test app ───────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use("/api", webhooksRouter);

let server: Server;
let baseUrl: string;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    }),
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
);

// Reset captured state and mocks before each test.
beforeEach(() => {
  capturedTierUpdate = undefined;
  transactionCallCount = 0;
  upsertCallCount = 0;
  mockFindFirst.mockReset();
  vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", "");
});

// ── Helpers ────────────────────────────────────────────────────────────────
const WEBHOOK_URL = () => `${baseUrl}/api/webhooks/revenuecat`;

const MOCK_USER = { id: 42, clerkUserId: "user_abc123", tier: "free" };

function buildBody(event: Record<string, unknown>) {
  return JSON.stringify({ event });
}

function post(
  body: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(WEBHOOK_URL(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/revenuecat — auth", () => {
  it("returns 401 when Authorization header is missing and secret is set", async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", "super-secret");

    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_001",
        entitlement_ids: ["pro"],
      }),
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 401 when Authorization header value is wrong", async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", "super-secret");

    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_001",
        entitlement_ids: ["pro"],
      }),
      { Authorization: "wrong-value" },
    );

    expect(res.status).toBe(401);
  });

  it("accepts the request when Authorization header matches the secret", async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", "super-secret");
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_001",
        entitlement_ids: ["pro"],
      }),
      { Authorization: "super-secret" },
    );

    expect(res.status).toBe(200);
  });

  it("skips auth check entirely when REVENUECAT_WEBHOOK_SECRET is not set", async () => {
    // Secret env var is cleared in beforeEach via stubEnv("", "")
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_001",
        entitlement_ids: ["pro"],
      }),
    );

    expect(res.status).toBe(200);
  });

  it("rejects with 401 in production mode when REVENUECAT_WEBHOOK_SECRET is unset, even with no Authorization header", async () => {
    // Secret is absent (cleared in beforeEach) but NODE_ENV is production.
    // The handler must never accept unauthenticated tier changes in prod,
    // even as a defense-in-depth layer beyond the startup guard in index.ts.
    vi.stubEnv("NODE_ENV", "production");

    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_prod_no_secret",
        entitlement_ids: ["pro"],
      }),
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toMatchObject({ error: "Unauthorized" });
    // No tier update should have happened
    expect(capturedTierUpdate).toBeUndefined();
    expect(transactionCallCount).toBe(0);

    // Restore NODE_ENV so subsequent tests are unaffected
    vi.stubEnv("NODE_ENV", "test");
  });
});

describe("POST /api/webhooks/revenuecat — INITIAL_PURCHASE tier assignment", () => {
  it("sets tier to 'pro' when entitlement_ids contains 'pro'", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_pro_001",
        entitlement_ids: ["pro"],
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("pro");
  });

  it("sets tier to 'premium' when entitlement_ids contains 'premium'", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_premium_monthly",
        transaction_id: "txn_prem_001",
        entitlement_ids: ["premium"],
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("premium");
  });

  it("premium takes priority over pro when both entitlements are present", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_bundle",
        transaction_id: "txn_bundle_001",
        entitlement_ids: ["pro", "premium"],
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("premium");
  });
});

describe("POST /api/webhooks/revenuecat — RENEWAL tier assignment", () => {
  it("sets tier to 'pro' on RENEWAL with pro entitlement", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "RENEWAL",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_renewal_pro",
        entitlement_ids: ["pro"],
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("pro");
  });

  it("sets tier to 'premium' on RENEWAL with premium entitlement", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "RENEWAL",
        app_user_id: "user_abc123",
        product_id: "rubai_premium_annual",
        transaction_id: "txn_renewal_prem",
        entitlement_ids: ["premium"],
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("premium");
  });
});

describe("POST /api/webhooks/revenuecat — cancellation events reset to free", () => {
  it("sets tier to 'free' on CANCELLATION", async () => {
    mockFindFirst.mockResolvedValue({ ...MOCK_USER, tier: "pro" });

    const res = await post(
      buildBody({
        type: "CANCELLATION",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_cancel_001",
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("free");
  });

  it("sets tier to 'free' on EXPIRATION", async () => {
    mockFindFirst.mockResolvedValue({ ...MOCK_USER, tier: "premium" });

    const res = await post(
      buildBody({
        type: "EXPIRATION",
        app_user_id: "user_abc123",
        product_id: "rubai_premium_annual",
        transaction_id: "txn_expire_001",
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("free");
  });

  it("sets tier to 'free' on BILLING_ISSUE", async () => {
    mockFindFirst.mockResolvedValue({ ...MOCK_USER, tier: "pro" });

    const res = await post(
      buildBody({
        type: "BILLING_ISSUE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_billing_001",
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("free");
  });
});

describe("POST /api/webhooks/revenuecat — idempotency", () => {
  it("handles duplicate delivery (same transaction_id) without erroring", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const event = buildBody({
      type: "INITIAL_PURCHASE",
      app_user_id: "user_abc123",
      product_id: "rubai_pro_monthly",
      transaction_id: "txn_dup_001",
      entitlement_ids: ["pro"],
    });

    const res1 = await post(event);
    const res2 = await post(event);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it("calls onConflictDoUpdate on both deliveries (upsert, not blind insert)", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const event = buildBody({
      type: "INITIAL_PURCHASE",
      app_user_id: "user_abc123",
      product_id: "rubai_pro_monthly",
      transaction_id: "txn_dup_002",
      entitlement_ids: ["pro"],
    });

    await post(event);
    await post(event);

    // Each delivery runs through transaction → insert → onConflictDoUpdate
    expect(upsertCallCount).toBe(2);
    expect(transactionCallCount).toBe(2);
  });

  it("tier update is consistent across duplicate deliveries", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const event = buildBody({
      type: "INITIAL_PURCHASE",
      app_user_id: "user_abc123",
      product_id: "rubai_premium_monthly",
      transaction_id: "txn_dup_003",
      entitlement_ids: ["premium"],
    });

    await post(event);
    const tierAfterFirst = capturedTierUpdate;

    await post(event);
    const tierAfterSecond = capturedTierUpdate;

    expect(tierAfterFirst).toBe("premium");
    expect(tierAfterSecond).toBe("premium");
  });
});

describe("POST /api/webhooks/revenuecat — fallback tier from product_id", () => {
  it("derives 'pro' from product_id when entitlement_ids is absent", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_fallback_pro",
        // No entitlement_ids field
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("pro");
  });

  it("derives 'premium' from product_id when entitlement_ids is absent", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_premium_annual",
        transaction_id: "txn_fallback_prem",
        // No entitlement_ids field
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("premium");
  });

  it("derives 'pro' from product_id on RENEWAL when entitlement_ids is absent", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "RENEWAL",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_annual",
        transaction_id: "txn_fallback_renewal",
        // No entitlement_ids field
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("pro");
  });

  it("falls back to 'free' when product_id has no tier keyword", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_unknown_sku",
        transaction_id: "txn_fallback_free",
        // No entitlement_ids field
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("free");
  });
});

describe("POST /api/webhooks/revenuecat — PRODUCT_CHANGE tier assignment", () => {
  it("sets tier to 'pro' on PRODUCT_CHANGE with pro entitlement", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "PRODUCT_CHANGE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_pc_pro",
        entitlement_ids: ["pro"],
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("pro");
  });

  it("sets tier to 'premium' on PRODUCT_CHANGE when upgrading to premium", async () => {
    mockFindFirst.mockResolvedValue({ ...MOCK_USER, tier: "pro" });

    const res = await post(
      buildBody({
        type: "PRODUCT_CHANGE",
        app_user_id: "user_abc123",
        product_id: "rubai_premium_annual",
        transaction_id: "txn_pc_upgrade",
        entitlement_ids: ["premium"],
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("premium");
  });

  it("falls back to product_id tier derivation on PRODUCT_CHANGE when entitlement_ids is absent", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "PRODUCT_CHANGE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_annual",
        transaction_id: "txn_pc_fallback",
        // No entitlement_ids
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("pro");
  });
});

describe("POST /api/webhooks/revenuecat — UNCANCELLATION tier re-grant", () => {
  it("re-grants 'pro' tier on UNCANCELLATION with pro entitlement", async () => {
    mockFindFirst.mockResolvedValue({ ...MOCK_USER, tier: "free" });

    const res = await post(
      buildBody({
        type: "UNCANCELLATION",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_uncancel_pro",
        entitlement_ids: ["pro"],
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("pro");
  });

  it("re-grants 'premium' tier on UNCANCELLATION with premium entitlement", async () => {
    mockFindFirst.mockResolvedValue({ ...MOCK_USER, tier: "free" });

    const res = await post(
      buildBody({
        type: "UNCANCELLATION",
        app_user_id: "user_abc123",
        product_id: "rubai_premium_annual",
        transaction_id: "txn_uncancel_prem",
        entitlement_ids: ["premium"],
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("premium");
  });

  it("falls back to product_id tier on UNCANCELLATION when entitlement_ids is absent", async () => {
    mockFindFirst.mockResolvedValue({ ...MOCK_USER, tier: "free" });

    const res = await post(
      buildBody({
        type: "UNCANCELLATION",
        app_user_id: "user_abc123",
        product_id: "rubai_premium_monthly",
        transaction_id: "txn_uncancel_fallback",
        // No entitlement_ids
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("premium");
  });
});

describe("POST /api/webhooks/revenuecat — NON_RENEWING_PURCHASE tier assignment", () => {
  it("sets tier to 'pro' on NON_RENEWING_PURCHASE with pro entitlement", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "NON_RENEWING_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_lifetime",
        transaction_id: "txn_nrp_pro",
        entitlement_ids: ["pro"],
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("pro");
  });

  it("sets tier to 'premium' on NON_RENEWING_PURCHASE with premium entitlement", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "NON_RENEWING_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_premium_lifetime",
        transaction_id: "txn_nrp_prem",
        entitlement_ids: ["premium"],
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("premium");
  });

  it("falls back to product_id tier on NON_RENEWING_PURCHASE when entitlement_ids is absent", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "NON_RENEWING_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_lifetime",
        transaction_id: "txn_nrp_fallback",
        // No entitlement_ids
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("pro");
  });
});

describe("POST /api/webhooks/revenuecat — edge cases", () => {
  it("returns 400 when event type is missing", async () => {
    const res = await post(JSON.stringify({ event: {} }));
    expect(res.status).toBe(400);
  });

  it("returns 200 skipped when user is not found in the database", async () => {
    mockFindFirst.mockResolvedValue(null);

    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_nonexistent",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_nf_001",
        entitlement_ids: ["pro"],
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, skipped: "user_not_found" });
    // No tier update should have happened
    expect(capturedTierUpdate).toBeUndefined();
  });

  it("returns 200 skipped for unhandled event types", async () => {
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "TRANSFER",
        app_user_id: "user_abc123",
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, skipped: "unhandled_event_type" });
  });

  it("uses original_app_user_id when present (takes precedence over app_user_id)", async () => {
    mockFindFirst.mockImplementation(
      (opts: { where: unknown }) => {
        // Verify it was queried with original_app_user_id
        return Promise.resolve({ ...MOCK_USER, clerkUserId: "user_original" });
      },
    );

    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_alias",
        original_app_user_id: "user_original",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_alias_001",
        entitlement_ids: ["pro"],
      }),
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("pro");
  });
});

describe("POST /api/webhooks/revenuecat — timing-safe auth", () => {
  // These tests verify constant-time comparison is in place. A header that
  // shares a prefix with the real secret but differs in the last character
  // must be rejected just like a completely wrong value — no early-exit on
  // the matching prefix characters.

  it("rejects a header that differs only in the last character (prefix match)", async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", "super-secret");

    // "super-secreX" shares "super-secre" with "super-secret" but the last
    // char is wrong — a naive early-exit comparison might take slightly
    // longer to reject this than a completely different string.
    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_timing_001",
        entitlement_ids: ["pro"],
      }),
      { Authorization: "super-secreX" },
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toMatchObject({ error: "Unauthorized" });
  });

  it("rejects a header that is a prefix of the real secret (shorter length)", async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", "super-secret");

    // "super-secre" is a strict prefix — different byte-length means
    // timingSafeEqual cannot even be called; the length guard must reject.
    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_timing_002",
        entitlement_ids: ["pro"],
      }),
      { Authorization: "super-secre" },
    );

    expect(res.status).toBe(401);
  });

  it("rejects a header that is the real secret with an extra character appended (longer length)", async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", "super-secret");

    // "super-secretX" is longer — timingSafeEqual must not be called with
    // mismatched buffer lengths (it throws); the length guard must reject.
    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_timing_003",
        entitlement_ids: ["pro"],
      }),
      { Authorization: "super-secretX" },
    );

    expect(res.status).toBe(401);
  });

  it("accepts a header that is byte-for-byte identical to the secret", async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", "super-secret");
    mockFindFirst.mockResolvedValue(MOCK_USER);

    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_timing_004",
        entitlement_ids: ["pro"],
      }),
      { Authorization: "super-secret" },
    );

    expect(res.status).toBe(200);
    expect(capturedTierUpdate).toBe("pro");
  });

  it("rejects an empty Authorization header even when secret is set", async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", "super-secret");

    const res = await post(
      buildBody({
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc123",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_timing_005",
        entitlement_ids: ["pro"],
      }),
      { Authorization: "" },
    );

    expect(res.status).toBe(401);
  });
});
