/**
 * Map raw Clerk / network errors into short, friendly user-facing strings.
 *
 * Clerk error objects look like:
 *   { code: "form_password_incorrect", message: "Password is incorrect." }
 * but plain JS errors and unknown shapes also flow through here, so we are
 * defensive about reading them.
 */

type ClerkLikeError = {
  code?: string;
  message?: string;
  longMessage?: string;
  errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
};

export function friendlyAuthError(input: unknown): string {
  const err = extractClerkError(input);
  if (!err) {
    if (input instanceof Error && input.message) return input.message;
    return "Something went wrong. Please try again.";
  }

  switch (err.code) {
    case "form_identifier_not_found":
      return "We couldn't find an account with that email.";
    case "form_password_incorrect":
    case "form_password_pwned":
      return "That password isn't right. Try again or reset it.";
    case "form_param_format_invalid":
    case "form_param_nil":
      return "Please check the email and password fields.";
    case "form_password_length_too_short":
      return "Password is too short — use at least 8 characters.";
    case "form_identifier_exists":
      return "An account with that email already exists. Try signing in instead.";
    case "verification_failed":
    case "verification_expired":
      return "That code didn't work or has expired. Request a new one.";
    case "form_code_incorrect":
      return "That verification code isn't right. Try again.";
    case "too_many_requests":
      return "Too many attempts. Please wait a minute and try again.";
    case "session_exists":
      return "You're already signed in.";
    case "network_error":
      return "Network problem. Check your connection and try again.";
    default:
      return err.longMessage || err.message || "Something went wrong.";
  }
}

function extractClerkError(input: unknown): ClerkLikeError | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as ClerkLikeError;
  if (Array.isArray(obj.errors) && obj.errors[0]) {
    return obj.errors[0];
  }
  if (obj.code || obj.message || obj.longMessage) {
    return obj;
  }
  return null;
}
