import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/**
 * Deeper readiness check for hosted deploys: can this API verify Supabase JWTs?
 * Mobile sync fails with opaque "couldn't reach cloud" when JWKS/issuer is misconfigured.
 */
router.get("/healthz/auth", async (_req, res) => {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/$/, "");
  const hasJwtSecret = Boolean(process.env.SUPABASE_JWT_SECRET?.trim());

  if (!supabaseUrl && !hasJwtSecret) {
    res.status(503).json({
      status: "error",
      supabaseUrlConfigured: false,
      jwksOk: false,
      hasJwtSecret: false,
      detail: "Neither SUPABASE_URL nor SUPABASE_JWT_SECRET is set",
    });
    return;
  }

  let jwksOk = false;
  let jwksDetail: string | null = null;
  if (supabaseUrl) {
    try {
      const r = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`, {
        signal: AbortSignal.timeout(8_000),
      });
      jwksOk = r.ok;
      if (!r.ok) jwksDetail = `JWKS HTTP ${r.status}`;
    } catch (err) {
      jwksDetail = err instanceof Error ? err.message : String(err);
    }
  }

  const ok = jwksOk || hasJwtSecret;
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "error",
    supabaseUrlConfigured: Boolean(supabaseUrl),
    supabaseHost: supabaseUrl
      ? supabaseUrl.replace(/^https?:\/\//, "")
      : null,
    jwksOk,
    hasJwtSecret,
    detail: jwksDetail,
  });
});

export default router;
