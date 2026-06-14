/**
 * One-time backfill script: seeds an initial row into `tier_transitions` for
 * every user who has no transition history yet.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run backfill-tier-history
 *
 * Safe to re-run: uses a LEFT JOIN / IS NULL guard so users who already have
 * at least one transition row are skipped entirely.
 *
 * What it inserts (per qualifying user):
 *   from_tier    = "free"          (everyone's starting tier)
 *   to_tier      = users.tier      (their current tier at time of backfill)
 *   triggered_by = "backfill"
 *   event_type   = null
 *   metadata     = { "note": "backfill" }
 *   created_at   = users.created_at  (anchored to account creation)
 */

import { db, pool } from "@workspace/db";
import {
  usersTable,
  tierTransitionsTable,
} from "@workspace/db/schema";
import { isNull, sql } from "drizzle-orm";

async function backfillTierHistory() {
  console.log("Starting tier history backfill…");

  // Find every user who has zero rows in tier_transitions.
  const usersToBackfill = await db
    .select({
      id: usersTable.id,
      tier: usersTable.tier,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(
      tierTransitionsTable,
      sql`${tierTransitionsTable.userId} = ${usersTable.id}`,
    )
    .where(isNull(tierTransitionsTable.id));

  if (usersToBackfill.length === 0) {
    console.log("No users need backfilling — all users already have tier history.");
    await pool.end();
    return;
  }

  console.log(`Found ${usersToBackfill.length} user(s) without tier history. Inserting…`);

  const rows = usersToBackfill.map((u) => ({
    userId: u.id,
    fromTier: "free",
    toTier: u.tier,
    triggeredBy: "backfill",
    eventType: null as string | null,
    metadata: { note: "backfill" } as Record<string, string>,
    createdAt: u.createdAt,
  }));

  // Insert in a single statement; all-or-nothing.
  await db.insert(tierTransitionsTable).values(rows);

  const nonFreeCount = rows.filter((r) => r.toTier !== "free").length;
  console.log(
    `Done. Inserted ${rows.length} row(s) ` +
    `(${nonFreeCount} non-free, ${rows.length - nonFreeCount} free).`,
  );

  await pool.end();
}

backfillTierHistory().catch((err) => {
  console.error("Backfill failed:", err);
  pool.end().finally(() => process.exit(1));
});
