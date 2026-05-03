import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// One row per (user, document, version) acceptance. We keep history rather
// than a single per-user row so we can prove which exact version a user
// agreed to, and audit consent in case of a later GDPR request or dispute.
export const legalAcceptancesTable = pgTable(
  "legal_acceptances",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // "privacy_policy" | "terms_of_service"
    document: text("document").notNull(),
    version: text("version").notNull(),
    // Two-letter ISO 639-1 code the user was viewing when they accepted.
    locale: text("locale").notNull(),
    // SHA-256 of remote IP at acceptance time. Hashed (not raw) so the audit
    // trail can prove "someone accepted from this address" without us
    // storing PII beyond what GDPR justifies for fraud / dispute defence.
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDocVersionIdx: uniqueIndex("legal_user_doc_version_idx").on(
      t.userId,
      t.document,
      t.version,
    ),
    userIdx: index("legal_user_idx").on(t.userId),
  }),
);

export type LegalAcceptance = typeof legalAcceptancesTable.$inferSelect;
export type InsertLegalAcceptance = typeof legalAcceptancesTable.$inferInsert;
