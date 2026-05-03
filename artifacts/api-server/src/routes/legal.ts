import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  db,
  legalAcceptancesTable,
  usersTable,
} from "@workspace/db";
import {
  LegalCurrentVersionsResponse,
  LegalGetDocumentResponse,
  LegalMyAcceptancesResponse,
  LegalAcceptBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import {
  DOCUMENT_TYPES,
  DOCUMENT_VERSIONS,
  FALLBACK_LOCALE,
  SUPPORTED_LOCALES,
  authoritativeNotice,
  getDocument,
  isDocumentType,
  isLocale,
  type DocumentType,
  type Locale,
} from "../lib/legal";

const router: IRouter = Router();

// Public: anyone can fetch the current versions and document text. /me and
// /accept require auth so we mount requireAuth on those individually.
router.get("/legal/current", (_req, res): void => {
  res.json(
    LegalCurrentVersionsResponse.parse({
      documents: DOCUMENT_TYPES.map((type) => ({
        type,
        version: DOCUMENT_VERSIONS[type],
      })),
      supportedLocales: [...SUPPORTED_LOCALES],
      fallbackLocale: FALLBACK_LOCALE,
    }),
  );
});

router.get("/legal/document", (req, res): void => {
  const typeParam = String(req.query.type ?? "");
  const localeParam = String(req.query.locale ?? FALLBACK_LOCALE);
  if (!isDocumentType(typeParam)) {
    res.status(400).json({ error: "Invalid document type" });
    return;
  }
  const locale: Locale = isLocale(localeParam) ? localeParam : FALLBACK_LOCALE;
  const doc = getDocument(typeParam, locale);
  res.json(
    LegalGetDocumentResponse.parse({
      type: typeParam,
      version: DOCUMENT_VERSIONS[typeParam],
      locale,
      title: doc.title,
      body: doc.body,
      authoritativeNotice: authoritativeNotice(locale),
    }),
  );
});

async function buildMyAcceptances(userId: number) {
  const rows = await db
    .select()
    .from(legalAcceptancesTable)
    .where(eq(legalAcceptancesTable.userId, userId))
    .orderBy(desc(legalAcceptancesTable.acceptedAt));

  // Latest acceptance per document type wins.
  const latest = new Map<DocumentType, (typeof rows)[number]>();
  for (const row of rows) {
    if (!isDocumentType(row.document)) continue;
    if (!latest.has(row.document)) latest.set(row.document, row);
  }

  const documents = DOCUMENT_TYPES.map((type) => {
    const row = latest.get(type);
    const currentVersion = DOCUMENT_VERSIONS[type];
    return {
      type,
      acceptedVersion: row?.version ?? null,
      currentVersion,
      acceptedAt: row ? row.acceptedAt.toISOString() : null,
      locale: row?.locale ?? null,
      upToDate: row ? row.version === currentVersion : false,
    };
  });

  return {
    documents,
    allUpToDate: documents.every((d) => d.upToDate),
  };
}

router.get("/legal/me", requireAuth, async (req, res): Promise<void> => {
  const payload = await buildMyAcceptances(req.userId!);
  res.json(LegalMyAcceptancesResponse.parse(payload));
});

function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

router.post("/legal/accept", requireAuth, async (req, res): Promise<void> => {
  const parsed = LegalAcceptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { locale, documents } = parsed.data;

  // Reject any acceptance that doesn't match the *current* version on the
  // server — prevents replaying a stale "I accepted" once we've bumped.
  for (const doc of documents) {
    if (DOCUMENT_VERSIONS[doc.type] !== doc.version) {
      res.status(400).json({
        error: `Version mismatch for ${doc.type}: client sent ${doc.version}, current is ${DOCUMENT_VERSIONS[doc.type]}`,
      });
      return;
    }
  }

  // Resolve internal user id from the Clerk-bound row.
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const ipHash = hashIp(
    (req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()) ||
      req.ip,
  );
  const userAgent = req.headers["user-agent"]?.toString().slice(0, 512) ?? null;

  for (const doc of documents) {
    // Idempotent: if this exact (user, type, version) is already accepted,
    // skip — we keep the original timestamp.
    const [existing] = await db
      .select({ id: legalAcceptancesTable.id })
      .from(legalAcceptancesTable)
      .where(
        and(
          eq(legalAcceptancesTable.userId, user.id),
          eq(legalAcceptancesTable.document, doc.type),
          eq(legalAcceptancesTable.version, doc.version),
        ),
      );
    if (existing) continue;
    await db.insert(legalAcceptancesTable).values({
      userId: user.id,
      document: doc.type,
      version: doc.version,
      locale,
      ipHash,
      userAgent,
    });
  }

  const payload = await buildMyAcceptances(user.id);
  res.json(LegalMyAcceptancesResponse.parse(payload));
});

export default router;
