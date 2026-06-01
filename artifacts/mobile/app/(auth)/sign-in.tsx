import { useAuth, useSignIn, useSSO } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Link, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { AtlasLogo } from "@/components/AtlasLogo";
import { GoogleGIcon } from "@/components/GoogleGIcon";
import { friendlyAuthError } from "@/lib/authErrors";

// Remembers the last email the user signed in with on this device, so
// repeat sign-ins are one tap + password. Storing the email itself is
// industry-standard "remember me" UX. We never store the password.
const REMEMBER_EMAIL_KEY = "atlas:v2:auth:rememberEmail";
const REMEMBER_FLAG_KEY = "atlas:v2:auth:rememberFlag";

WebBrowser.maybeCompleteAuthSession();

// Detects when the web build is being rendered inside another window's iframe
// (e.g. Replit's workspace preview). In that case, popup-based OAuth flows
// frequently fail silently because third-party cookies / popups / postMessage
// to the grandparent window are blocked. We surface a hint to the user.
function isWebInIframe(): boolean {
  if (Platform.OS !== "web") return false;
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    // Cross-origin access threw — that means we're definitely framed.
    return true;
  }
}

const BRAND = {
  primary: "#0E7C5A",
  bg: "#FAF6EE",
  fg: "#1B1812",
  accent: "#C68A12",
  muted: "#807763",
  border: "#E1D9C5",
  card: "#FFFFFF",
  destructive: "#B43E3E",
};

function debug(...args: unknown[]) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[auth/sign-in]", ...args);
  }
}

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export default function SignInScreen() {
  useWarmUpBrowser();
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();

  // If a session already exists (e.g. user navigated back to /sign-in after a
  // prior successful login, or restored a cached Clerk session), Clerk will
  // reject any new sign-in attempt with "You're already signed in." Send
  // them straight to the app instead of letting them re-enter credentials.
  useEffect(() => {
    if (authLoaded && isSignedIn) {
      router.replace("/");
    }
  }, [authLoaded, isSignedIn, router]);

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Two-factor step — shown when Clerk returns needs_second_factor / needs_client_trust
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  // Which status triggered the 2FA step (affects which Clerk method to call)
  const [twoFactorKind, setTwoFactorKind] = useState<"second_factor" | "client_trust">("second_factor");
  // Separate loading flag so Clerk's fetchStatus doesn't lock the code input
  const [twoFactorSubmitting, setTwoFactorSubmitting] = useState(false);

  // Hydrate "remember me" choice + last-used email from local storage on
  // first mount. Defaults: flag = true (remember), email = empty.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [flagRaw, savedEmail] = await Promise.all([
          AsyncStorage.getItem(REMEMBER_FLAG_KEY),
          AsyncStorage.getItem(REMEMBER_EMAIL_KEY),
        ]);
        if (cancelled) return;
        const remembered = flagRaw !== "0";
        setRememberMe(remembered);
        if (remembered && savedEmail) setEmailAddress(savedEmail);
      } catch {
        // ignore — remembering email is best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist remember preference + saved email each time the toggle flips
  // or the email field changes. Only the email is stored; never the password.
  useEffect(() => {
    void AsyncStorage.setItem(REMEMBER_FLAG_KEY, rememberMe ? "1" : "0");
    if (!rememberMe) {
      void AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
    } else if (emailAddress.trim().length > 0) {
      void AsyncStorage.setItem(REMEMBER_EMAIL_KEY, emailAddress.trim());
    }
  }, [rememberMe, emailAddress]);

  const handleSubmit = useCallback(async () => {
    if (!signIn) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      // Defensive: if a session already exists (Clerk hydrated late or the
      // user navigated back here from inside the app), don't even attempt
      // signIn.password — it will fail with "You're already signed in."
      // Just route them into the app.
      if (isSignedIn) {
        router.replace("/");
        return;
      }
      debug("password attempt", { email: emailAddress });
      const { error } = await signIn.password({ emailAddress, password });
      if (error) {
        debug("password error", error);
        // Clerk surfaces this as `session_exists` in error.code. If we
        // somehow got here despite the guards above (race), still recover
        // gracefully instead of dead-ending the user on the sign-in form.
        const code = (error as { code?: string }).code;
        const msg = (error as { message?: string }).message ?? "";
        if (code === "session_exists" || /already signed in/i.test(msg)) {
          router.replace("/");
          return;
        }
        setSubmitError(friendlyAuthError(error));
        return;
      }

      debug("password ok, status =", signIn.status);

      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: ({ session }) => {
            if (session?.currentTask) return;
            router.replace("/");
          },
        });
        return;
      }

      // Account requires TOTP / SMS second factor — switch to the code
      // input step. No email is sent for TOTP; code comes from the
      // authenticator app.
      if (signIn.status === "needs_second_factor") {
        debug("needs_second_factor — showing 2FA step");
        setTwoFactorKind("second_factor");
        setTwoFactorStep(true);
        return;
      }

      // needs_client_trust means Clerk wants an email OTP to trust this
      // device. We must call prepareFirstFactor to actually send the email,
      // then show the code input.
      if (signIn.status === "needs_client_trust") {
        debug("needs_client_trust — preparing email code");
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const si = signIn as any;
          // Find the email address id on the sign-in resource so Clerk
          // knows where to send the code.
          const emailAddrId: string | undefined =
            si.supportedFirstFactors?.find(
              (f: { strategy: string; emailAddressId?: string }) =>
                f.strategy === "email_code",
            )?.emailAddressId;
          await si.prepareFirstFactor({
            strategy: "email_code",
            ...(emailAddrId ? { emailAddressId: emailAddrId } : {}),
          });
          debug("needs_client_trust — email code sent");
        } catch (prepErr) {
          debug("prepareFirstFactor failed", prepErr);
          // Non-fatal: show the input anyway — maybe Clerk sent it already.
        }
        setTwoFactorKind("client_trust");
        setTwoFactorStep(true);
        return;
      }

      // Catch-all: surface the actual status code so we never silently
      // dead-end the user.
      setSubmitError(
        `Sign-in didn't complete (${signIn.status ?? "unknown"}). Please try again.`,
      );
    } catch (err) {
      debug("password threw", err);
      setSubmitError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }, [signIn, emailAddress, password, router]);

  const handleGoogle = useCallback(async () => {
    setSubmitError(null);
    setOauthLoading(true);
    try {
      debug("google sso start");
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      debug("google sso result", { createdSessionId: !!createdSessionId });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: async ({ session }) => {
            if (session?.currentTask) return;
            router.replace("/");
          },
        });
      } else {
        // No session was created and no error was thrown. Two real causes:
        //   1. The user closed the OAuth sheet — that's fine.
        //   2. The OAuth popup was blocked or the redirect callback couldn't
        //      reach the app (very common inside the workspace preview iframe).
        // Either way, give the user actionable feedback rather than silence.
        debug("google sso cancelled or missing requirements");
        if (isWebInIframe()) {
          setSubmitError(
            "Google sign-in didn't complete. Inside the workspace preview, OAuth popups can be blocked — open this page in a new browser tab and try again.",
          );
        } else {
          setSubmitError(
            "Google sign-in didn't complete. Please try again.",
          );
        }
      }
    } catch (err) {
      debug("google sso threw", err);
      setSubmitError(friendlyAuthError(err));
    } finally {
      setOauthLoading(false);
    }
  }, [startSSOFlow, router]);

  // Submit the 2FA verification code.
  // Clerk exposes attemptSecondFactor on the SignIn resource for TOTP/SMS;
  // after success we reuse the same finalize() path as normal sign-in.
  const handleTwoFactor = useCallback(async () => {
    if (!signIn) return;
    setSubmitError(null);
    setTwoFactorSubmitting(true);
    try {
      // Determine the strategy from what Clerk told us it supports.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const si = signIn as any;

      let result: { status?: string };
      if (twoFactorKind === "client_trust") {
        // Email OTP device-trust flow — use attemptFirstFactor
        debug("2FA client_trust attempt with email_code");
        result = await si.attemptFirstFactor({
          strategy: "email_code",
          code: twoFactorCode.trim(),
        });
      } else {
        // TOTP / SMS second-factor flow
        const supported: Array<{ strategy: string }> =
          si.supportedSecondFactors ?? [];
        const strategy =
          supported.find((f) => f.strategy === "totp")?.strategy ??
          supported.find((f) => f.strategy === "phone_code")?.strategy ??
          supported.find((f) => f.strategy === "email_code")?.strategy ??
          "totp";
        debug("2FA attempt with strategy", strategy);
        result = await si.attemptSecondFactor({
          strategy,
          code: twoFactorCode.trim(),
        });
      }
      debug("2FA result status", result?.status);
      if (result?.status === "complete") {
        await si.finalize({
          navigate: ({ session }: { session?: { currentTask?: unknown } }) => {
            if (session?.currentTask) return;
            router.replace("/");
          },
        });
        return;
      }
      setSubmitError(
        `Verification didn't complete (${result?.status ?? "unknown"}). Please try again.`,
      );
    } catch (err) {
      debug("2FA threw", err);
      setSubmitError(friendlyAuthError(err));
    } finally {
      setTwoFactorSubmitting(false);
    }
  }, [signIn, twoFactorCode, twoFactorKind, router]);

  const isFetching = fetchStatus === "fetching" || submitting;
  const disabled = !emailAddress || !password || isFetching;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.brandWrap}>
              <AtlasLogo size="lg" />
            </View>
            <Text style={styles.title} maxFontSizeMultiplier={1.4}>
              Welcome back
            </Text>
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
              Sign in to continue with your AI goal coach.
            </Text>
          </View>

          {isWebInIframe() && (
            <View style={styles.iframeNotice}>
              <Text style={styles.iframeNoticeText} maxFontSizeMultiplier={1.3}>
                Tip: Google sign-in opens a popup. To use it from the workspace
                preview, open this page in a new browser tab first.
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.googleBtn,
              pressed && Platform.OS === "ios" && { opacity: 0.85 },
              oauthLoading && { opacity: 0.6 },
            ]}
            android_ripple={{ color: "#0000000D" }}
            onPress={handleGoogle}
            disabled={oauthLoading}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{ disabled: oauthLoading }}
          >
            {oauthLoading ? (
              <ActivityIndicator color={BRAND.fg} />
            ) : (
              <>
                <GoogleGIcon size={20} />
                <Text
                  style={styles.googleBtnText}
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                >
                  Continue with Google
                </Text>
              </>
            )}
          </Pressable>

          {twoFactorStep ? (
            /* ── Two-factor verification step ── */
            <>
              <View style={styles.twoFactorInfo}>
                <Text style={styles.twoFactorTitle} maxFontSizeMultiplier={1.3}>
                  {twoFactorKind === "client_trust"
                    ? "Check your email"
                    : "Two-factor verification"}
                </Text>
                <Text style={styles.twoFactorSubtitle} maxFontSizeMultiplier={1.3}>
                  {twoFactorKind === "client_trust"
                    ? "We sent a 6-digit code to your email address. Enter it below."
                    : "Enter the 6-digit code from your authenticator app (e.g. Google Authenticator, Authy)."}
                </Text>
              </View>

              <Text style={styles.label} maxFontSizeMultiplier={1.3}>
                Verification code
              </Text>
              <TextInput
                style={styles.input}
                value={twoFactorCode}
                onChangeText={setTwoFactorCode}
                placeholder="000000"
                placeholderTextColor={BRAND.muted}
                keyboardType="number-pad"
                returnKeyType="go"
                maxLength={8}
                autoFocus
                onSubmitEditing={handleTwoFactor}
                editable={!twoFactorSubmitting}
              />

              {submitError && (
                <Text style={styles.errorText} maxFontSizeMultiplier={1.3}>
                  {submitError}
                </Text>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (!twoFactorCode.trim() || twoFactorSubmitting) && styles.primaryBtnDisabled,
                  pressed && !!twoFactorCode.trim() && !twoFactorSubmitting && Platform.OS === "ios" && { opacity: 0.9 },
                ]}
                android_ripple={{ color: "#FFFFFF22" }}
                onPress={handleTwoFactor}
                disabled={!twoFactorCode.trim() || twoFactorSubmitting}
                accessibilityRole="button"
              >
                {twoFactorSubmitting ? (
                  <ActivityIndicator color="#FAF6EE" />
                ) : (
                  <Text style={styles.primaryBtnText} maxFontSizeMultiplier={1.3}>
                    Verify
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  setTwoFactorStep(false);
                  setTwoFactorCode("");
                  setSubmitError(null);
                }}
                style={styles.backRow}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Feather name="arrow-left" size={14} color={BRAND.primary} />
                <Text style={styles.backText} maxFontSizeMultiplier={1.3}>
                  Back to sign in
                </Text>
              </Pressable>
            </>
          ) : (
            /* ── Normal email / password form ── */
            <>
              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText} maxFontSizeMultiplier={1.2}>
                  or
                </Text>
                <View style={styles.divider} />
              </View>

              <Text style={styles.label} maxFontSizeMultiplier={1.3}>
                Email
              </Text>
              <TextInput
                style={styles.input}
                value={emailAddress}
                onChangeText={setEmailAddress}
                placeholder="you@example.com"
                placeholderTextColor={BRAND.muted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="next"
                editable={!isFetching}
              />
              {errors?.fields?.identifier?.message && (
                <Text style={styles.errorText} maxFontSizeMultiplier={1.3}>
                  {errors.fields.identifier.message}
                </Text>
              )}

              <View style={styles.passwordHeaderRow}>
                <Text style={styles.label} maxFontSizeMultiplier={1.3}>
                  Password
                </Text>
                <Link href="/(auth)/forgot-password" asChild>
                  <Pressable hitSlop={8} accessibilityRole="link">
                    <Text style={styles.forgotText} maxFontSizeMultiplier={1.3}>
                      Forgot?
                    </Text>
                  </Pressable>
                </Link>
              </View>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  placeholderTextColor={BRAND.muted}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  editable={!isFetching}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  style={styles.eyeBtn}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={18}
                    color={BRAND.muted}
                  />
                </Pressable>
              </View>
              {errors?.fields?.password?.message && (
                <Text style={styles.errorText} maxFontSizeMultiplier={1.3}>
                  {errors.fields.password.message}
                </Text>
              )}

              <Pressable
                onPress={() => setRememberMe((v) => !v)}
                style={styles.rememberRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
                hitSlop={6}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxChecked,
                  ]}
                >
                  {rememberMe && (
                    <Feather name="check" size={14} color="#FAF6EE" />
                  )}
                </View>
                <Text style={styles.rememberText} maxFontSizeMultiplier={1.3}>
                  Remember me on this device
                </Text>
              </Pressable>

              {submitError && (
                <Text style={styles.errorText} maxFontSizeMultiplier={1.3}>
                  {submitError}
                </Text>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  disabled && styles.primaryBtnDisabled,
                  pressed && !disabled && Platform.OS === "ios" && { opacity: 0.9 },
                ]}
                android_ripple={{ color: "#FFFFFF22" }}
                onPress={handleSubmit}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
              >
                {isFetching ? (
                  <ActivityIndicator color="#FAF6EE" />
                ) : (
                  <Text style={styles.primaryBtnText} maxFontSizeMultiplier={1.3}>
                    Sign in
                  </Text>
                )}
              </Pressable>

              <View style={styles.linkRow}>
                <Text style={styles.linkRowText} maxFontSizeMultiplier={1.3}>
                  Don&apos;t have an account?
                </Text>
                <Link href="/(auth)/sign-up" asChild>
                  <Pressable hitSlop={8} accessibilityRole="link">
                    <Text style={styles.linkText} maxFontSizeMultiplier={1.3}>
                      Sign up
                    </Text>
                  </Pressable>
                </Link>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.bg },
  container: { padding: 24, paddingTop: 32, gap: 4 },
  header: { marginBottom: 24, gap: 6 },
  brandWrap: { marginBottom: 4 },
  title: {
    fontFamily: "Inter_700Bold",
    color: BRAND.fg,
    fontSize: 28,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    color: BRAND.muted,
    fontSize: 15,
    lineHeight: 21,
  },
  iframeNotice: {
    backgroundColor: "#FFF6E0",
    borderColor: "#E8D08A",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  iframeNoticeText: {
    color: "#6B4F1A",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 17,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: BRAND.card,
    borderColor: BRAND.border,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: "hidden",
  },
  googleBtnText: {
    fontFamily: "Inter_600SemiBold",
    color: BRAND.fg,
    fontSize: 15,
    includeFontPadding: false,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 18,
  },
  divider: { flex: 1, height: 1, backgroundColor: BRAND.border },
  dividerText: {
    fontFamily: "Inter_500Medium",
    color: BRAND.muted,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  label: {
    fontFamily: "Inter_500Medium",
    color: BRAND.fg,
    fontSize: 13,
    marginBottom: 6,
  },
  passwordHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  forgotText: {
    fontFamily: "Inter_600SemiBold",
    color: BRAND.primary,
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    backgroundColor: BRAND.card,
    borderColor: BRAND.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "android" ? 10 : 12,
    minHeight: 48,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: BRAND.fg,
  },
  passwordRow: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: BRAND.card,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: BRAND.primary,
    borderColor: BRAND.primary,
  },
  rememberText: {
    fontFamily: "Inter_500Medium",
    color: BRAND.fg,
    fontSize: 14,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    color: BRAND.destructive,
    fontSize: 13,
    marginTop: 6,
  },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: BRAND.primary,
    borderRadius: 14,
    paddingVertical: 15,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    color: BRAND.bg,
    fontSize: 16,
    includeFontPadding: false,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
  },
  linkRowText: {
    fontFamily: "Inter_400Regular",
    color: BRAND.muted,
    fontSize: 14,
  },
  linkText: {
    fontFamily: "Inter_600SemiBold",
    color: BRAND.primary,
    fontSize: 14,
  },
  twoFactorInfo: {
    marginTop: 4,
    marginBottom: 20,
    gap: 6,
  },
  twoFactorTitle: {
    fontFamily: "Inter_700Bold",
    color: BRAND.fg,
    fontSize: 20,
  },
  twoFactorSubtitle: {
    fontFamily: "Inter_400Regular",
    color: BRAND.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 4,
  },
  backText: {
    fontFamily: "Inter_500Medium",
    color: BRAND.primary,
    fontSize: 14,
  },
});
