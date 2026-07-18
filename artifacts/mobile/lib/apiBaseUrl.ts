/**
 * Helpers for resolving / validating the API base URL baked into the app.
 * Preview/production APKs must never call a PC LAN address.
 */

export function isPrivateLanHost(hostname: string): boolean {
  const h = (hostname || "").toLowerCase();
  if (!h || h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") {
    return true;
  }
  if (h.endsWith(".local")) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(h)) return true;
  return false;
}

/** True if URL is http://LAN or any private host (not suitable for standalone APK). */
export function isPrivateLanApiUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return isPrivateLanHost(url.hostname);
  } catch {
    return false;
  }
}

export function isPublicHttpsApiUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !isPrivateLanHost(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Prefer a public HTTPS env URL over a stale AsyncStorage LAN cache
 * left over from Metro / development builds (same package name).
 */
export function preferPublicApiBase(
  envBase: string | null | undefined,
  storedBase: string | null | undefined,
): string {
  const env = envBase?.replace(/\/$/, "") || "";
  const stored = storedBase?.replace(/\/$/, "") || "";

  if (env && isPublicHttpsApiUrl(env)) {
    if (stored && isPrivateLanApiUrl(stored)) {
      return env;
    }
    return env;
  }
  if (stored) return stored;
  return env;
}
