import { createHash } from "node:crypto";

import type { Request } from "express";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

import { db, embeddingsTable, usersTable } from "@workspace/db";

import { EMBEDDING_MODEL, embedTexts } from "./embeddings";
import { logger } from "./logger";

/**
 * Bump this when the chunking logic, content types, or fingerprint
 * canonicalisation changes. The version is mixed into the fingerprint
 * so a deploy with new logic invalidates every cached fingerprint and
 * forces a one-time full re-index.
 */
const EMBEDDING_INDEX_VERSION = "v2";

/**
 * Per-batch upsert size. The transaction wrapping the upserts runs in
 * groups of this size so a 200-chunk re-index commits four small
 * transactions (one per ~50 rows) instead of one giant one — cheaper
 * locks, partial progress on failure, and bounded memory.
 */
const UPSERT_BATCH_SIZE = 50;

/**
 * Content types this indexer owns. Pruning is scoped to these so that
 * future content types written by other indexers are never accidentally
 * deleted.
 */
const INDEXABLE_TYPES = [
  "learned_profile",
  "reflection",
  "coach_memory",
  "evolution",
  "plan",
  "message",
] as const;

/**
 * Chat-turn indexing limits. We index USER turns only (the assistant's
 * replies are derivative of context we already index) and only turns long
 * enough to carry real signal. Capped per goal so a chatty user doesn't
 * balloon the corpus — the most recent turns win.
 */
const MIN_MESSAGE_CHARS = 30;
const MAX_MESSAGES_PER_GOAL = 100;

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
  // Phase 3 perf: short-circuit the whole pipeline when the indexable
  // chunk set is unchanged from the last successful pass. We compare
  // against `computeChunkFingerprint(chunks)` below, after extracting
  // chunks, so the fingerprint only invalidates on changes that would
  // actually affect what gets embedded.
  let cachedFingerprint: string | null = null;
  try {
    const [row] = await db
      .select({ fp: usersTable.embeddingFingerprint })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    cachedFingerprint = row?.fp ?? null;
  } catch (err) {
    // Fingerprint lookup is best-effort. On failure, fall through and
    // do the normal indexing pass so we never silently stop indexing.
    logger.warn({ err, userId }, "Embedding fingerprint lookup failed");
  }

  const chunks = extractIndexableChunks(goals);

  // Recompute fingerprint from the actual indexable projection of the
  // chunks (sorted by stable contentId). This is the precise input to
  // the indexing pipeline — any change here is the *only* thing that
  // can affect what gets embedded. Compared to a coarse subtree hash
  // this avoids false invalidations from sibling-field churn (e.g. UI
  // flags inside learnedProfile that we don't index).
  const chunkFingerprint = computeChunkFingerprint(chunks);
  if (cachedFingerprint && cachedFingerprint === chunkFingerprint) {
    return;
  }

  // -- Prune stale rows BEFORE embedding so a deletion (e.g. a
  // reflection the user removed) is reflected in retrieval even if all
  // remaining chunks are unchanged and we'd otherwise short-circuit.
  // Scoped per contentType so future indexers writing other types are
  // unaffected.
  await pruneStaleChunks(userId, chunks);

  if (chunks.length === 0) {
    // Empty after prune: stamp the fingerprint so a subsequent call
    // with the same (still-empty) state can short-circuit before the
    // prune query.
    await persistFingerprint(userId, chunkFingerprint);
    return;
  }

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
  if (toIndex.length === 0) {
    // Nothing to embed but the prune step may have touched rows; still
    // record the fingerprint so the next call can short-circuit.
    await persistFingerprint(userId, chunkFingerprint);
    return;
  }

  const vectors = await embedTexts(
    req,
    toIndex.map((c) => c.sourceText),
  );

  // Upsert in bounded batches. Each transaction commits ~UPSERT_BATCH_SIZE
  // rows so a large re-index produces several small commits instead of
  // one long-running transaction holding row locks. If a batch throws
  // we propagate after letting earlier batches commit — the next pass
  // will re-attempt only the still-stale chunks (text_hash compare).
  let anyVectorPersisted = false;
  let anyVectorMissing = false;
  for (let start = 0; start < toIndex.length; start += UPSERT_BATCH_SIZE) {
    const sliceEnd = Math.min(start + UPSERT_BATCH_SIZE, toIndex.length);
    await db.transaction(async (tx) => {
      for (let i = start; i < sliceEnd; i++) {
        const c = toIndex[i]!;
        const v = vectors[i];
        if (!v) {
          anyVectorMissing = true;
          continue; // failed embedding batch — try again next pass
        }
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
        anyVectorPersisted = true;
      }
    });
  }

  // Only stamp the fingerprint when every chunk that needed an
  // embedding actually got one. If embedding failures left holes we
  // want the next pass to retry those chunks.
  if (anyVectorPersisted && !anyVectorMissing) {
    await persistFingerprint(userId, chunkFingerprint);
  }
}

/**
 * Canonical SHA-256 over the precise list of chunks we'd write. Two
 * passes producing the same `(contentType, contentId, sourceText)`
 * triples — in any order — produce the same fingerprint. This is the
 * tightest possible cache key: nothing that doesn't change the chunk
 * set can invalidate it, and any change that does will invalidate it.
 * The version prefix lets us bump indexing logic without a data
 * migration.
 */
export function computeChunkFingerprint(chunks: Chunk[]): string {
  const sorted = [...chunks]
    .map((c) => ({
      t: c.contentType,
      i: c.contentId,
      s: c.sourceText,
    }))
    .sort((a, b) => {
      if (a.t !== b.t) return a.t < b.t ? -1 : 1;
      if (a.i !== b.i) return a.i < b.i ? -1 : 1;
      return a.s < b.s ? -1 : a.s > b.s ? 1 : 0;
    });
  const canonical = stableStringify(sorted);
  return createHash("sha256")
    .update(`${EMBEDDING_INDEX_VERSION}\n${canonical}`)
    .digest("hex");
}

async function persistFingerprint(
  userId: number,
  fingerprint: string,
): Promise<void> {
  try {
    await db
      .update(usersTable)
      .set({ embeddingFingerprint: fingerprint })
      .where(eq(usersTable.id, userId));
  } catch (err) {
    logger.warn({ err, userId }, "Embedding fingerprint persist failed");
  }
}

/**
 * Deterministic JSON stringify with sorted object keys. JSON.stringify
 * preserves insertion order which is brittle across goal-shape edits;
 * sorting keys keeps the fingerprint stable as long as the *values*
 * are unchanged.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
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

    // -- chat turns: coachSessions[].messages[] (fallback: legacy
    // coachHistory[]). USER turns only — assistant replies restate context
    // we already index. contentId is a hash of the text so identical turns
    // dedupe and reorders don't re-embed.
    const userTurns: string[] = [];
    const collectTurns = (messages: unknown) => {
      if (!Array.isArray(messages)) return;
      for (const m of messages) {
        if (!m || typeof m !== "object") continue;
        const rec = m as Record<string, unknown>;
        if (rec.role !== "user") continue;
        const content =
          typeof rec.content === "string" ? rec.content.trim() : "";
        if (content.length < MIN_MESSAGE_CHARS) continue;
        userTurns.push(content);
      }
    };
    if (Array.isArray(g.coachSessions)) {
      for (const session of g.coachSessions) {
        if (!session || typeof session !== "object") continue;
        collectTurns((session as Record<string, unknown>).messages);
      }
    } else {
      collectTurns(g.coachHistory);
    }
    const seenTurnHashes = new Set<string>();
    for (const content of userTurns.slice(-MAX_MESSAGES_PER_GOAL)) {
      const hash = sha256(content).slice(0, 16);
      if (seenTurnHashes.has(hash)) continue;
      seenTurnHashes.add(hash);
      out.push({
        contentType: "message",
        contentId: `goal:${goalId}:message:${hash}`,
        goalId,
        sourceText: content,
        metadata: { role: "user" },
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
