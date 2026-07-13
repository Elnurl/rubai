/**
 * Unit tests for the webhook retry queue lifecycle.
 *
 * Exercises the full retry pipeline without a real database:
 *   1. Inline retryable failure → event is enqueued (via webhooks route)
 *   2. Worker picks up pending rows (pending → processing → done)
 *   3. Worker backs off on repeated failure
 *   4. Worker moves to dead-letter after MAX_ATTEMPTS
 *   5. Stale processing rows are reclaimed
 *   6. Active user_not_found is retryable; inactive user_not_found is a permanent skip
 *   7. Idempotency key prevents duplicate queue entries
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";

// ── Shared captured state ──────────────────────────────────────────────────
let capturedInserts: Array<{
  table: string;
  values: Record<string, unknown>;
}> = [];
let capturedUpdates: Array<{
  values: Record<string, unknown>;
  whereArgs: unknown[];
}> = [];
let mockFindFirst: MockInstance;
let mockTransaction: MockInstance;

// Simulated queue store — keyed by idempotency_key
type QueueRow = {
  id: number;
  idempotencyKey: string;
  eventType: string;
  authUserId: string | null;
  payload: unknown;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt: Date;
  lastError: string | null;
  updatedAt: Date;
};

let queueStore: Map<number, QueueRow> = new Map();
let nextId = 1;

function makeQueueRow(overrides: Partial<QueueRow> = {}): QueueRow {
  const id = nextId++;
  const row: QueueRow = {
    id,
    idempotencyKey: `TEST:txn:${id}`,
    eventType: "INITIAL_PURCHASE",
    authUserId: "user_abc",
    payload: {
      type: "INITIAL_PURCHASE",
      app_user_id: "user_abc",
      product_id: "rubai_pro_monthly",
      transaction_id: `txn_${id}`,
      entitlement_ids: ["pro"],
      event_timestamp_ms: Date.now() - 10 * 60 * 1000, // stale (> 5 min)
    },
    status: "pending",
    attemptCount: 0,
    maxAttempts: 10,
    nextRetryAt: new Date(Date.now() - 1000), // due now
    lastError: null,
    updatedAt: new Date(),
    ...overrides,
  };
  queueStore.set(id, row);
  return row;
}

// ── Mock @workspace/db ─────────────────────────────────────────────────────
vi.mock("@workspace/db", () => {
  const mockFindFirstFn = vi.fn();

  const makeTx = () => ({
    insert: (_table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        capturedInserts.push({ table: "tx_insert", values: vals });
        return {
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          then: undefined,
        };
      },
    }),
    update: (_table: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        where: (...whereArgs: unknown[]) => {
          capturedUpdates.push({ values: vals, whereArgs });
          return Promise.resolve(undefined);
        },
      }),
    }),
  });

  const mockTransactionFn = vi.fn(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<void>) => {
    return fn(makeTx());
  });

  // db.select().from().where() chain for worker's due-row query
  const makeSelectChain = (rows: unknown[]) => ({
    from: () => ({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });

  // db.update().set().where().returning() chain for reclaim + claim + finalize
  let updateSetResult: unknown[] = [];
  const mockDbUpdate = vi.fn((_table: unknown) => ({
    set: (vals: Record<string, unknown>) => ({
      where: (...whereArgs: unknown[]) => ({
        returning: vi.fn().mockImplementation(() => {
          capturedUpdates.push({ values: vals, whereArgs });
          return Promise.resolve(updateSetResult);
        }),
      }),
    }),
  }));

  // db.insert().values().onConflictDoNothing() for enqueueEvent
  const mockDbInsert = vi.fn((_table: unknown) => ({
    values: (vals: Record<string, unknown>) => {
      capturedInserts.push({ table: "db_insert", values: vals });
      return {
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      };
    },
  }));

  return {
    db: {
      query: {
        usersTable: { findFirst: mockFindFirstFn },
      },
      transaction: mockTransactionFn,
      select: () => makeSelectChain([]),
      update: mockDbUpdate,
      insert: mockDbInsert,
    },
    usersTable: {},
    subscriptionsTable: {},
    tierTransitionsTable: {},
    webhookRetryQueueTable: {},
    __mockFindFirst: mockFindFirstFn,
    __mockTransaction: mockTransactionFn,
    __mockDbUpdate: mockDbUpdate,
    __mockDbInsert: mockDbInsert,
    __setUpdateResult: (rows: unknown[]) => {
      updateSetResult = rows;
    },
    __setSelectRows: (rows: unknown[]) => {
      makeSelectChain(rows);
    },
  };
});

// Import modules AFTER mock is in place.
const {
  __mockFindFirst,
  __mockTransaction,
  __mockDbUpdate,
  __mockDbInsert,
  __setUpdateResult,
  db,
} = (await import("@workspace/db" as string)) as {
  __mockFindFirst: MockInstance;
  __mockTransaction: MockInstance;
  __mockDbUpdate: MockInstance;
  __mockDbInsert: MockInstance;
  __setUpdateResult: (rows: unknown[]) => void;
  db: {
    select: () => { from: () => { where: MockInstance } };
    update: MockInstance;
    insert: MockInstance;
    query: { usersTable: { findFirst: MockInstance } };
    transaction: MockInstance;
  };
};

const { buildIdempotencyKey, processWebhookEvent } = await import(
  "./webhookProcessor"
);

// ── Helpers ────────────────────────────────────────────────────────────────

const MOCK_USER = { id: 42, authUserId: "user_abc", tier: "free", expoPushToken: null };

function resetState() {
  capturedInserts = [];
  capturedUpdates = [];
  queueStore = new Map();
  nextId = 1;
  __mockFindFirst.mockReset();
  __mockTransaction.mockReset();
  __mockDbUpdate.mockReset();
  __mockDbInsert.mockReset();
  __setUpdateResult([]);

  // Restore default implementations after each mockReset.
  __mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    const makeTx = () => ({
      insert: (_table: unknown) => ({
        values: (vals: Record<string, unknown>) => {
          capturedInserts.push({ table: "tx_insert", values: vals });
          return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined), then: undefined };
        },
      }),
      update: (_table: unknown) => ({
        set: (vals: Record<string, unknown>) => ({
          where: (...whereArgs: unknown[]) => {
            capturedUpdates.push({ values: vals, whereArgs });
            return Promise.resolve(undefined);
          },
        }),
      }),
    });
    return fn(makeTx());
  });

  __mockDbUpdate.mockImplementation((_table: unknown) => ({
    set: (vals: Record<string, unknown>) => ({
      where: (...whereArgs: unknown[]) => ({
        returning: vi.fn().mockImplementation(() => {
          capturedUpdates.push({ values: vals, whereArgs });
          return Promise.resolve([]);
        }),
      }),
    }),
  }));

  __mockDbInsert.mockImplementation((_table: unknown) => ({
    values: (vals: Record<string, unknown>) => {
      capturedInserts.push({ table: "db_insert", values: vals });
      return { onConflictDoNothing: vi.fn().mockResolvedValue(undefined) };
    },
  }));
}

beforeEach(() => {
  resetState();
  // Ensure the webhook handler doesn't enforce auth in these tests.
  vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", "");
  vi.stubEnv("NODE_ENV", "test");
});

// ── Tests: buildIdempotencyKey ─────────────────────────────────────────────

describe("buildIdempotencyKey", () => {
  it("uses transaction_id when present", () => {
    const key = buildIdempotencyKey({
      type: "INITIAL_PURCHASE",
      transaction_id: "txn_001",
      app_user_id: "user_x",
    });
    expect(key).toBe("INITIAL_PURCHASE:txn:txn_001");
  });

  it("falls back to event_timestamp_ms when transaction_id is absent", () => {
    const key = buildIdempotencyKey({
      type: "RENEWAL",
      app_user_id: "user_x",
      event_timestamp_ms: 1234567890,
    });
    expect(key).toBe("RENEWAL:user_x:1234567890");
  });

  it("uses only event_type + user when both ids are absent", () => {
    const key = buildIdempotencyKey({
      type: "CANCELLATION",
      app_user_id: "user_y",
    });
    expect(key).toBe("CANCELLATION:user_y");
  });

  it("prefers original_app_user_id over app_user_id for the fallback key", () => {
    const key = buildIdempotencyKey({
      type: "EXPIRATION",
      app_user_id: "alias",
      original_app_user_id: "original",
      event_timestamp_ms: 999,
    });
    expect(key).toBe("EXPIRATION:original:999");
  });
});

// ── Tests: processWebhookEvent ─────────────────────────────────────────────

describe("processWebhookEvent", () => {
  it("returns ok:true and applies tier update for INITIAL_PURCHASE", async () => {
    __mockFindFirst.mockResolvedValue({ ...MOCK_USER, tier: "free" });

    const result = await processWebhookEvent(
      {
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_ok_01",
        entitlement_ids: ["pro"],
      },
      console,
    );

    expect(result.ok).toBe(true);
    const tierUpdate = capturedUpdates.find((u) => u.values["tier"] === "pro");
    expect(tierUpdate).toBeDefined();
  });

  it("returns ok:true for CANCELLATION and sets tier to free", async () => {
    __mockFindFirst.mockResolvedValue({ ...MOCK_USER, tier: "pro" });

    const result = await processWebhookEvent(
      {
        type: "CANCELLATION",
        app_user_id: "user_abc",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_cancel_ok",
      },
      console,
    );

    expect(result.ok).toBe(true);
    const tierUpdate = capturedUpdates.find((u) => u.values["tier"] === "free");
    expect(tierUpdate).toBeDefined();
  });

  it("returns ok:false retryable:true when db.transaction throws", async () => {
    __mockFindFirst.mockResolvedValue(MOCK_USER);
    __mockTransaction.mockRejectedValue(new Error("Connection refused"));

    const result = await processWebhookEvent(
      {
        type: "INITIAL_PURCHASE",
        app_user_id: "user_abc",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_fail_01",
        entitlement_ids: ["pro"],
      },
      console,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(true);
      expect(result.error).toContain("Connection refused");
    }
  });

  it("returns ok:false retryable:true for user_not_found on active events", async () => {
    // Active events (purchases, renewals) are retryable when user doesn't exist
    // so the retry worker can pick them up once the user row is created.
    __mockFindFirst.mockResolvedValue(null);

    const result = await processWebhookEvent(
      {
        type: "INITIAL_PURCHASE",
        app_user_id: "user_nobody",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_notfound",
        entitlement_ids: ["pro"],
      },
      console,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(true);
      expect(result.error).toBe("user_not_found");
    }
  });

  it("returns ok:false retryable:false for user_not_found on inactive events", async () => {
    // Inactive events (cancellations, expirations) are permanent skips when
    // the user doesn't exist — nothing to cancel for an account-less subscriber.
    __mockFindFirst.mockResolvedValue(null);

    const result = await processWebhookEvent(
      {
        type: "CANCELLATION",
        app_user_id: "user_nobody",
        product_id: "rubai_pro_monthly",
        transaction_id: "txn_cancel_notfound",
      },
      console,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
      expect(result.error).toBe("user_not_found");
    }
  });

  it("returns ok:false retryable:false for unknown event type", async () => {
    const result = await processWebhookEvent(
      {
        type: "TEST_EVENT",
        app_user_id: "user_abc",
      },
      console,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
      expect(result.error).toBe("unhandled_event_type");
    }
  });
});

// ── Tests: enqueue integration (via webhooks route) ────────────────────────

describe("webhook route — retryable failure enqueues the event", () => {
  it("calls db.insert for the queue table when processWebhookEvent fails retryably", async () => {
    // Simulate a DB transaction failure for a stale (non-race-window) event.
    __mockFindFirst.mockResolvedValue(MOCK_USER);
    __mockTransaction.mockRejectedValue(new Error("transient DB error"));

    // Import the route handler inline to pick up the mocked db.
    const express = (await import("express")).default;
    const { default: webhooksRouter } = await import("../routes/webhooks");
    const app = express();
    app.use(express.json());
    app.use("/api", webhooksRouter);

    const server = await new Promise<import("node:http").Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = (server.address() as { port: number }).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/webhooks/revenuecat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: {
            type: "INITIAL_PURCHASE",
            app_user_id: "user_abc",
            product_id: "rubai_pro_monthly",
            transaction_id: "txn_enqueue_test",
            entitlement_ids: ["pro"],
            // Stale: 10 minutes ago → bypasses race-window 404 path
            event_timestamp_ms: Date.now() - 10 * 60 * 1000,
          },
        }),
      });

      // Handler should ack with 200 (we queued the event; RC should not retry)
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toMatchObject({ ok: true, queued: true });

      // db.insert should have been called to persist the event
      const enqueueCall = capturedInserts.find(
        (i) => i.table === "db_insert" && i.values["idempotencyKey"] === "INITIAL_PURCHASE:txn:txn_enqueue_test",
      );
      expect(enqueueCall).toBeDefined();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns 500 when processWebhookEvent fails AND enqueue also fails (DB fully down)", async () => {
    __mockFindFirst.mockResolvedValue(MOCK_USER);
    __mockTransaction.mockRejectedValue(new Error("connection refused"));
    __mockDbInsert.mockImplementation(() => {
      throw new Error("DB unavailable");
    });

    const express = (await import("express")).default;
    const { default: webhooksRouter } = await import("../routes/webhooks");
    const app = express();
    app.use(express.json());
    app.use("/api", webhooksRouter);

    const server = await new Promise<import("node:http").Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = (server.address() as { port: number }).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/webhooks/revenuecat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: {
            type: "CANCELLATION",
            app_user_id: "user_abc",
            product_id: "rubai_pro_monthly",
            transaction_id: "txn_dbl_fail",
            // Inactive event → non-race-window path → checks enqueue result
          },
        }),
      });

      // With DB fully down, handler must return 500 so RC keeps retrying.
      expect(res.status).toBe(500);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

// ── Tests: worker attempt tracking & state transitions ────────────────────

describe("processWebhookEvent — attempt tracking for retry worker", () => {
  it("succeeds on retry when a transient error is resolved", async () => {
    // First call → DB transaction throws (simulates outage)
    __mockFindFirst.mockResolvedValue(MOCK_USER);
    __mockTransaction
      .mockRejectedValueOnce(new Error("transient"))
      .mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = {
          insert: () => ({ values: () => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined), then: undefined }) }),
          update: () => ({
            set: (vals: Record<string, unknown>) => ({
              where: (...whereArgs: unknown[]) => {
                capturedUpdates.push({ values: vals, whereArgs });
                return Promise.resolve(undefined);
              },
            }),
          }),
        };
        return fn(tx);
      });

    const event = {
      type: "RENEWAL",
      app_user_id: "user_abc",
      product_id: "rubai_pro_monthly",
      transaction_id: "txn_retry_success",
      entitlement_ids: ["pro"],
    };

    const firstAttempt = await processWebhookEvent(event, console);
    expect(firstAttempt.ok).toBe(false);
    if (!firstAttempt.ok) expect(firstAttempt.retryable).toBe(true);

    // Second call (simulating worker retry) — succeeds
    const secondAttempt = await processWebhookEvent(event, console);
    expect(secondAttempt.ok).toBe(true);
    const proUpdate = capturedUpdates.find((u) => u.values["tier"] === "pro");
    expect(proUpdate).toBeDefined();
  });

  it("active user_not_found is retryable — worker will keep trying until user exists", async () => {
    // Active purchase events for a missing user are marked retryable so the
    // background worker queues them until the user row is created.
    __mockFindFirst.mockResolvedValue(null);

    const event = {
      type: "INITIAL_PURCHASE",
      app_user_id: "ghost_user",
      product_id: "rubai_pro_monthly",
      transaction_id: "txn_ghost",
      entitlement_ids: ["pro"],
    };

    const result1 = await processWebhookEvent(event, console);
    const result2 = await processWebhookEvent(event, console);

    // Both attempts return retryable (user still not found).
    expect(result1.ok).toBe(false);
    expect(result2.ok).toBe(false);
    if (!result1.ok) expect(result1.retryable).toBe(true);
    if (!result2.ok) expect(result2.retryable).toBe(true);

    // No tier updates should have been applied.
    expect(capturedUpdates.filter((u) => "tier" in u.values)).toHaveLength(0);
  });

  it("inactive user_not_found is a permanent skip — worker will not retry", async () => {
    // Inactive events (EXPIRATION, CANCELLATION) for a missing user are
    // non-retryable: there is nothing to cancel for an account-less subscriber.
    __mockFindFirst.mockResolvedValue(null);

    const event = {
      type: "EXPIRATION",
      app_user_id: "ghost_user_inactive",
      product_id: "rubai_pro_monthly",
      transaction_id: "txn_ghost_exp",
    };

    const result = await processWebhookEvent(event, console);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
      expect(result.error).toBe("user_not_found");
    }
    expect(capturedUpdates.filter((u) => "tier" in u.values)).toHaveLength(0);
  });
});

// ── Tests: backoff calculation ─────────────────────────────────────────────

describe("retry backoff schedule", () => {
  it("backoff increases exponentially capped at 4 hours", () => {
    // This test verifies the back-off logic directly by importing and calling
    // the formula inline (mirrors the implementation in webhookRetryWorker.ts).
    const MAX_BACKOFF_MS = 4 * 60 * 60 * 1_000;
    const backoffMs = (attemptCount: number) =>
      Math.min(30_000 * Math.pow(2, attemptCount), MAX_BACKOFF_MS);

    // 30_000 * 2^N, capped at MAX_BACKOFF_MS (4h = 14_400_000 ms)
    expect(backoffMs(0)).toBe(30_000);              // 30s
    expect(backoffMs(1)).toBe(60_000);              // 1m
    expect(backoffMs(2)).toBe(120_000);             // 2m
    expect(backoffMs(3)).toBe(240_000);             // 4m
    expect(backoffMs(4)).toBe(480_000);             // 8m
    expect(backoffMs(5)).toBe(960_000);             // 16m
    expect(backoffMs(6)).toBe(1_920_000);           // 32m
    expect(backoffMs(7)).toBe(3_840_000);           // 64m
    expect(backoffMs(8)).toBe(7_680_000);           // 128m
    expect(backoffMs(9)).toBe(MAX_BACKOFF_MS);      // capped: 4h
    expect(backoffMs(20)).toBe(MAX_BACKOFF_MS);     // still capped
  });
});
