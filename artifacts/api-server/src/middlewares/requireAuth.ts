import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { db, usersTable, analyticsEventsTable } from "@workspace/db";
import { replayWebhookEventsForUser } from "../lib/webhookRecovery";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      authUserId?: string;
    }
  }
}

type VerifiedClaims = JWTPayload & {
  email?: string;
  user_metadata?: { email?: string };
};

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL is not set");
  return url.replace(/\/$/, "");
}

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`${getSupabaseUrl()}/auth/v1/.well-known/jwks.json`),
    );
  }
  return jwks;
}

async function verifyAccessToken(token: string): Promise<VerifiedClaims> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  const issuer = `${getSupabaseUrl()}/auth/v1`;

  // Prefer JWKS (ECC/RSA) — new Supabase projects sign with asymmetric keys.
  // Fall back to legacy HS256 shared secret when JWKS fails or is unavailable.
  try {
    const { payload } = await jwtVerify(token, getJwks(), { issuer });
    return payload as VerifiedClaims;
  } catch (jwksErr) {
    if (!secret) throw jwksErr;
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, {
      issuer,
      algorithms: ["HS256"],
    });
    return payload as VerifiedClaims;
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const claims = await verifyAccessToken(token);
    const authUserId = typeof claims.sub === "string" ? claims.sub : null;
    if (!authUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const email =
      (typeof claims.email === "string" ? claims.email : null) ??
      (typeof claims.user_metadata?.email === "string"
        ? claims.user_metadata.email
        : null);

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.authUserId, authUserId));

    let row = existing;
    if (!row) {
      const [created] = await db
        .insert(usersTable)
        .values({ authUserId, email: email ?? null })
        .returning();
      row = created;
      req.log.info({ authUserId, userId: row.id }, "Provisioned new user");
      void db
        .insert(analyticsEventsTable)
        .values({
          userId: row.id,
          eventType: "user.signed_up",
          payload: { authUserId, email: email ?? null },
        })
        .catch((err) =>
          req.log.warn({ err }, "Failed to record user.signed_up event"),
        );
      void replayWebhookEventsForUser(authUserId).catch((err) =>
        req.log.warn(
          { err },
          "Failed to replay webhook events after user creation",
        ),
      );
    } else if (email && email !== row.email) {
      const [updated] = await db
        .update(usersTable)
        .set({ email })
        .where(eq(usersTable.id, row.id))
        .returning();
      row = updated;
    }

    req.userId = row.id;
    req.authUserId = authUserId;
    next();
  } catch (err) {
    req.log.warn({ err }, "requireAuth token verification failed");
    res.status(401).json({ error: "Unauthorized" });
  }
}
