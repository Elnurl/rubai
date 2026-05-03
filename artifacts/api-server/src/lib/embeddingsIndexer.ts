import { createHash } from "node:crypto";

import type { Request } from "express";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

import { db, embeddingsTable } from "@workspace/db";

import { EMBEDDING_MODEL, embedTexts } from "./embeddings";
import { logger } from "./logger";

/**
 * Content types this indexer owns. Pruning is scoped to these so that
 * future content types written by other indexers (e.g. 'message') are
 * never accidentally deleted.
 */
const INDEXABLE_TYPES = [
  "learned_profile",
  "reflection",
  "coach_memory",
  "evolution",
  "plan",
] as const;

/**
 * RAG indexer for `user_state.goals` JSONB.
 *
 * The mobile client owns the canonical shape of a Goal; on the server
 * it's an opaque blob. The indexer therefore *defensively* walks
 * predictable subtrees (`learnedProfile`, `reflections`, `coachMemory`,
 * `evolutions`, `plans`) and pulls out any string fields it recognises
 * as indexable. Unknown shapes are skipped, never thrown on.
 *
 * Idempotency: the unique constraint on
 * (user_id, content_type, content_id) makes upsert safe. We additionally
 * skip work for chunks whose `source_text` already matches what's stored
 * (compared via a SHA-256 hash kept in `metadata.text_hash`), so
 * re-indexing on every `/me/state` PUT does not re-embed unchanged text.
 *
 * Phase 1 uses a single-shot, on-demand index call from `/me/state`.
 * Phase 2 will add debouncing and a background queue.
 */

type Chunk = {
  contentType: string;
  contentId: string;
  goalId: string | null;
  sourceText: string;
  metadata: Record<string, unknown>;
};

const MIN_CHUNK_CHARS = 16;

export async function indexUserGoals(
  req: Request,
  userId: number,
  goals: unknown,
): Promise<void> {
  const chunks = extractIndexableChunks(goals);

  // -- Prune stale rows BEFORE embedding so a deletion (e.g. a
  // reflection the user removed) is reflected in retrieval even if all
  // remaining chunks are unchanged and we'd otherwise short-circuit.
  // Scoped per contentType so future indexers writing other types are
  // unaffected.
  await pruneStaleChunks(userId, chunks);

  if (chunks.length === 0) return;

  // Compare against existing rows so we only embed new/changed chunks.
  const contentIds = chunks.map((c) => c.contentId);
  const existing = await db
    .select({
      contentId: embeddingsTable.contentId,
      contentType: embeddingsTable.contentType,
      metadata: embeddingsTable.metadata,
    })
    .from(embeddingsTable)
    .where(
      and(
        eq(embeddingsTable.userId, userId),
        inArray(embeddingsTable.contentId, contentIds),
      ),
    );
  const existingHash = new Map<string, string>();
  for (const row of existing) {
    const meta = (row.metadata as { text_hash?: string } | null) ?? {};
    if (meta.text_hash) {
      existingHash.set(`${row.contentType}::${row.contentId}`, meta.text_hash);
    }
  }

  const toIndex = chunks.filter((c) => {
    const hash = sha256(c.sourceText);
    const prev = existingHash.get(`${c.contentType}::${c.contentId}`);
    return prev !== hash;
  });
  if (toIndex.length === 0) return;

  const vectors = await embedTexts(
    req,
    toIndex.map((c) => c.sourceText),
  );

  // Upsert one row per chunk. We do this inside a transaction so a
  // partial failure rolls back; embeddings are much smaller than the
  // user_state row so the txn stays cheap.
  await db.transaction(async (tx) => {
    for (let i = 0; i < toIndex.length; i++) {
      const c = toIndex[i]!;
      const v = vectors[i];
      if (!v) continue; // failed batch — try again next pass
      const hash = sha256(c.sourceText);
      await tx
        .insert(embeddingsTable)
        .values({
          userId,
          goalId: c.goalId,
          contentType: c.contentType,
          contentId: c.contentId,
          sourceText: c.sourceText,
          embedding: v,
          metadata: { ...c.metadata, text_hash: hash },
          model: EMBEDDING_MODEL,
        })
        .onConflictDoUpdate({
          target: [
            embeddingsTable.userId,
            embeddingsTable.contentType,
            embeddingsTable.contentId,
          ],
          set: {
            sourceText: c.sourceText,
            embedding: v,
            metadata: { ...c.metadata, text_hash: hash },
            model: EMBEDDING_MODEL,
            goalId: c.goalId,
            updatedAt: sql`now()`,
          },
        });
    }
  });
}

/**
 * Delete embedding rows for indexable content types whose content_id no
 * longer appears in the current goals snapshot. Runs one DELETE per
 * type to keep the WHERE clauses small and per-type safe (so a future
 * collision on contentId across types could never wipe the wrong
 * rows). When a type has *no* current chunks, all of that user's rows
 * for that type are cleared.
 */
async function pruneStaleChunks(
  userId: number,
  chunks: Chunk[],
): Promise<void> {
  const byType = new Map<string, string[]>();
  for (const c of chunks) {
    const arr = byType.get(c.contentType) ?? [];
    arr.push(c.contentId);
    byType.set(c.contentType, arr);
  }
  for (const type of INDEXABLE_TYPES) {
    const ids = byType.get(type);
    if (!ids || ids.length === 0) {
      await db
        .delete(embeddingsTable)
        .where(
          and(
            eq(embeddingsTable.userId, userId),
            eq(embeddingsTable.contentType, type),
          ),
        );
    } else {
      await db
        .delete(embeddingsTable)
        .where(
          and(
            eq(embeddingsTable.userId, userId),
            eq(embeddingsTable.contentType, type),
            notInArray(embeddingsTable.contentId, ids),
          ),
        );
    }
  }
}

/**
 * Walk a `goals` array and emit indexable chunks. Defensive against
 * unknown shapes — anything that doesn't look like a known field is
 * skipped silently. Each contentId is stable across calls so upserts
 * line up.
 */
export function extractIndexableChunks(goals: unknown): Chunk[] {
  const out: Chunk[] = [];
  if (!Array.isArray(goals)) return out;

  for (const goal of goals) {
    if (!goal || typeof goal !== "object") continue;
    const g = goal as Record<string, unknown>;
    const goalId = typeof g.id === "string" ? g.id : null;

    // -- learnedProfile: narrative summary fields
    const lp = g.learnedProfile;
    if (lp && typeof lp === "object") {
      const lpRec = lp as Record<string, unknown>;
      const fields = [
        "consistency",
        "focusStyle",
        "peakHours",
        "strengths",
        "failurePatterns",
        "summary",
        "narrative",
      ];
      for (const field of fields) {
        const txt = stringifyField(lpRec[field]);
        if (txt && txt.length >= MIN_CHUNK_CHARS) {
          out.push({
            contentType: "learned_profile",
            contentId: `goal:${goalId}:learned_profile:${field}`,
            goalId,
            sourceText: txt,
            metadata: { field },
          });
        }
      }
    }

    // -- reflections: array of {id?, taskId?, note, reasonTags?, createdAt?}
    if (Array.isArray(g.reflections)) {
      g.reflections.forEach((r, idx) => {
        if (!r || typeof r !== "object") return;
        const rec = r as Record<string, unknown>;
        const note = typeof rec.note === "string" ? rec.note.trim() : "";
        if (note.length < MIN_CHUNK_CHARS) return;
        const id =
          (typeof rec.id === "string" && rec.id) ||
          (typeof rec.taskId === "string" && rec.taskId) ||
          String(idx);
        const tags = Array.isArray(rec.reasonTags)
          ? rec.reasonTags.filter((t) => typeof t === "string").join(", ")
          : "";
        const sourceText = tags ? `[${tags}] ${note}` : note;
        out.push({
          contentType: "reflection",
          contentId: `goal:${goalId}:reflection:${id}`,
          goalId,
          sourceText,
          metadata: {
            reasonTags: rec.reasonTags ?? null,
            createdAt: rec.createdAt ?? null,
            taskId: rec.taskId ?? null,
          },
        });
      });
    }

    // -- coachMemory: { facts: string[]|object[], summaries: string[] }
    const cm = g.coachMemory;
    if (cm && typeof cm === "object") {
      const cmRec = cm as Record<string, unknown>;
      const facts = cmRec.facts;
      if (Array.isArray(facts)) {
        facts.forEach((f, idx) => {
          const txt = stringifyField(f);
          if (!txt || txt.length < MIN_CHUNK_CHARS) return;
          out.push({
            contentType: "coach_memory",
            contentId: `goal:${goalId}:coach_memory:fact:${idx}`,
            goalId,
            sourceText: txt,
            metadata: { kind: "fact", idx },
          });
        });
      }
      const summaries = cmRec.summaries;
      if (Array.isArray(summaries)) {
        summaries.forEach((s, idx) => {
          const txt = stringifyField(s);
          if (!txt || txt.length < MIN_CHUNK_CHARS) return;
          out.push({
            contentType: "coach_memory",
            contentId: `goal:${goalId}:coach_memory:summary:${idx}`,
            goalId,
            sourceText: txt,
            metadata: { kind: "summary", idx },
          });
        });
      }
    }

    // -- evolutions: array of {trigger, summary, ...}
    if (Array.isArray(g.evolutions)) {
      g.evolutions.forEach((e, idx) => {
        if (!e || typeof e !== "object") return;
        const rec = e as Record<string, unknown>;
        const trigger = typeof rec.trigger === "string" ? rec.trigger : "";
        const summary = typeof rec.summary === "string" ? rec.summary : "";
        const sourceText = [trigger, summary].filter(Boolean).join("\n").trim();
        if (sourceText.length < MIN_CHUNK_CHARS) return;
        out.push({
          contentType: "evolution",
          contentId: `goal:${goalId}:evolution:${idx}`,
          goalId,
          sourceText,
          metadata: { createdAt: rec.createdAt ?? null },
        });
      });
    }

    // -- plans: array of {date, tasks: [{id,title,description,coachNote?}]}
    if (Array.isArray(g.plans)) {
      g.plans.forEach((p) => {
        if (!p || typeof p !== "object") return;
        const rec = p as Record<string, unknown>;
        const date =
          typeof rec.date === "string" ? rec.date : String(rec.date ?? "?");
        const tasks = Array.isArray(rec.tasks) ? rec.tasks : [];
        tasks.forEach((t, tidx) => {
          if (!t || typeof t !== "object") return;
          const tRec = t as Record<string, unknown>;
          const title = typeof tRec.title === "string" ? tRec.title : "";
          const desc =
            typeof tRec.description === "string" ? tRec.description : "";
          const note =
            typeof tRec.coachNote === "string" ? tRec.coachNote : "";
          const sourceText = [title, desc, note]
            .filter(Boolean)
            .join("\n")
            .trim();
          if (sourceText.length < MIN_CHUNK_CHARS) return;
          const taskId =
            (typeof tRec.id === "string" && tRec.id) || String(tidx);
          out.push({
            contentType: "plan",
            contentId: `goal:${goalId}:plan:${date}:${taskId}`,
            goalId,
            sourceText,
            metadata: { date, taskId },
          });
        });
      });
    }
  }
  return out;
}

function stringifyField(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) {
    return v
      .map((x) =>
        typeof x === "string" ? x : x && typeof x === "object" ? "" : String(x),
      )
      .filter(Boolean)
      .join("; ")
      .trim();
  }
  if (v && typeof v === "object") {
    // Common pattern: { text: "..."} or { value: "..." }
    const o = v as Record<string, unknown>;
    if (typeof o.text === "string") return o.text.trim();
    if (typeof o.value === "string") return o.value.trim();
    return "";
  }
  return "";
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Fire-and-forget wrapper. Logs failures, never throws. Intended for
 * use from request handlers where a slow/failed embedding pass must not
 * affect the user-facing response.
 */
export function indexUserGoalsAsync(
  req: Request,
  userId: number,
  goals: unknown,
): void {
  void indexUserGoals(req, userId, goals).catch((err) => {
    logger.warn({ err, userId }, "RAG indexing failed (background)");
  });
}
