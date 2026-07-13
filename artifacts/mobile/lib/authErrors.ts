/**
 * Map Supabase / network auth errors into short, friendly user-facing strings.
 */

type AuthLikeError = {
  code?: string;
  message?: string;
  status?: number;
  name?: string;
};

export function friendlyAuthError(input: unknown): string {
  const err = extractAuthError(input);
  if (!err) {
    if (input instanceof Error && input.message) return input.message;
    return "Something went wrong. Please try again.";
  }

  const code = (err.code ?? "").toLowerCase();
  const message = (err.message ?? "").toLowerCase();

  if (
    code === "invalid_credentials" ||
    message.includes("invalid login credentials")
  ) {
    return "That email or password isn't right. Try again or reset it.";
  }
  if (code === "user_already_registered" || message.includes("already registered")) {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed")
  ) {
    return "Confirm your email first, then sign in.";
  }
  if (
    code === "weak_password" ||
    message.includes("password should be at least")
  ) {
    return "Password is too short — use at least 8 characters.";
  }
  if (
    code === "otp_expired" ||
    code === "token_expired" ||
    message.includes("expired")
  ) {
    return "That code didn't work or has expired. Request a new one.";
  }
  if (
    code === "otp_disabled" ||
    message.includes("token has expired") ||
    (message.includes("invalid") && message.includes("otp"))
  ) {
    return "That verification code isn't right. Try again.";
  }
  if (code === "over_request_rate_limit" || err.status === 429) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (
    message.includes("network") ||
    code === "network_error" ||
    err.name === "AuthRetryableFetchError"
  ) {
    return "Network problem. Check your connection and try again.";
  }
  if (message.includes("phone") && message.includes("provider")) {
    return "Phone verification isn't enabled yet. Use email for now.";
  }

  return err.message || "Something went wrong.";
}

function extractAuthError(input: unknown): AuthLikeError | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as AuthLikeError;
  if (obj.code || obj.message || obj.name) return obj;
  return null;
}
