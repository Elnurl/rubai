import { useSignIn } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AtlasLogo } from "@/components/AtlasLogo";
import { friendlyAuthError } from "@/lib/authErrors";

const BRAND = {
  primary: "#0E7C5A",
  bg: "#FAF6EE",
  fg: "#1B1812",
  muted: "#807763",
  border: "#E1D9C5",
  danger: "#B43E3E",
};

type Strategy = "email_code" | "totp" | "phone_code" | "backup_code";

const STRATEGY_COPY: Record<
  Strategy,
  { title: string; subtitle: (email?: string) => string; placeholder: string }
> = {
  email_code: {
    title: "Verify it's you",
    subtitle: (email) =>
      email
        ? `We just emailed a 6-digit code to ${email}. Enter it below to finish signing in.`
        : "We just emailed you a 6-digit code. Enter it below to finish signing in.",
    placeholder: "123456",
  },
  totp: {
    title: "Enter your 6-digit code",
    subtitle: () =>
      "Open your authenticator app (Google Authenticator, 1Password, Authy…) and type the current code.",
    placeholder: "123 456",
  },
  phone_code: {
    title: "Enter the SMS code",
    subtitle: () =>
      "We sent a 6-digit code to your phone. Enter it below to finish signing in.",
    placeholder: "123 456",
  },
  backup_code: {
    title: "Enter a backup code",
    subtitle: () =>
      "Use one of the backup codes you saved when you set up two-factor auth. Each code works once.",
    placeholder: "abcd-efgh",
  },
};

function debug(...args: unknown[]) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[auth/verify]", ...args);
  }
}

function isStrategy(value: unknown): value is Strategy {
  return (
    value === "email_code" ||
    value === "totp" ||
    value === "phone_code" ||
    value === "backup_code"
  );
}

export default function VerifyScreen() {
  const router = useRouter();
  const { signIn, fetchStatus } = useSignIn();
  const isLoaded = fetchStatus !== "fetching";
  const params = useLocalSearchParams<{ strategy?: string; email?: string }>();
  const emailHint = typeof params.email === "string" ? params.email : undefined;

  // For sign-in 2FA we look at supportedSecondFactors. For the
  // "needs_client_trust" flow there's no factor list — Clerk just expects
  // an email_code. We treat email_code as available whenever the parent
  // route navigated us here with that strategy.
  const supported = useMemo<Strategy[]>(() => {
    const fromServer = (signIn?.supportedSecondFactors ?? [])
      .map((f) => f.strategy)
      .filter(isStrategy) as Strategy[];
    if (params.strategy === "email_code" && !fromServer.includes("email_code")) {
      return ["email_code", ...fromServer];
    }
    return fromServer;
  }, [signIn?.supportedSecondFactors, params.strategy]);

  const initialStrategy: Strategy = useMemo(() => {
    if (isStrategy(params.strategy)) return params.strategy;
    if (supported.includes("email_code")) return "email_code";
    if (supported.includes("totp")) return "totp";
    if (supported.includes("phone_code")) return "phone_code";
    if (supported.includes("backup_code")) return "backup_code";
    return "email_code";
  }, [params.strategy, supported]);

  const [strategy, setStrategy] = useState<Strategy>(initialStrategy);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Bumping this re-runs the auto-send effect — used by the "Resend code"
  // button without having to round-trip through state changes that don't
  // actually change the strategy.
  const [sendNonce, setSendNonce] = useState(0);

  // Guard: if the user lands on /verify outside of a real verification flow
  // (e.g. via deep link, hard refresh, or back button after signing in),
  // bounce them back so they don't get stuck on a screen with no path
  // forward. Both `needs_second_factor` AND `needs_client_trust` are valid
  // here — the latter is what Replit-managed Clerk emits for new-device
  // verification. We require an EXPLICIT valid status before letting the
  // user stay (and before the auto-send effect below fires) — otherwise
  // we could end up calling sendEmailCode against a stale/uninitialized
  // SignIn instance and 401-ing the user.
  useEffect(() => {
    if (!isLoaded || !signIn) return;
    const ok =
      signIn.status === "needs_second_factor" ||
      signIn.status === "needs_client_trust";
    if (!ok) {
      debug("guard bounce — status =", signIn.status);
      router.replace("/sign-in");
    }
  }, [isLoaded, signIn, router]);

  // If we routed here for a tab the account doesn't actually support, fall
  // back to whatever IS available. Skips for email_code which is always
  // available for client-trust verification.
  useEffect(() => {
    if (strategy === "email_code") return;
    if (supported.length === 0) return;
    if (!supported.includes(strategy)) {
      setStrategy(supported[0]);
      setCode("");
      setSubmitError(null);
      setInfo(null);
    }
  }, [supported, strategy]);

  // Auto-send the code when the user lands on a strategy that requires
  // server-side delivery (phone_code, email_code). TOTP/backup codes are
  // generated on the user's side and don't need a send step.
  // Status-gated so we never fire against a stale SignIn instance that
  // got here via deep link / refresh — the guard effect above will be
  // bouncing the user back in that case.
  useEffect(() => {
    if (!isLoaded || !signIn) return;
    if (strategy !== "phone_code" && strategy !== "email_code") return;
    if (strategy === "email_code" && signIn.status !== "needs_client_trust")
      return;
    if (strategy === "phone_code" && signIn.status !== "needs_second_factor")
      return;

    let cancelled = false;
    setPreparing(true);
    setSubmitError(null);
    setInfo(null);
    void (async () => {
      try {
        debug("sending", strategy);
        const { error } =
          strategy === "phone_code"
            ? await signIn.mfa.sendPhoneCode()
            : await signIn.mfa.sendEmailCode();
        if (cancelled) return;
        if (error) {
          debug("send error", error);
          setSubmitError(friendlyAuthError(error));
          return;
        }
        setInfo(
          strategy === "phone_code"
            ? "We just texted you a code."
            : emailHint
              ? `We just emailed a code to ${emailHint}.`
              : "We just emailed you a code.",
        );
      } catch (err) {
        if (cancelled) return;
        debug("send threw", err);
        setSubmitError(friendlyAuthError(err));
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, signIn, strategy, emailHint, sendNonce]);

  const handleSubmit = useCallback(async () => {
    if (!signIn) return;
    setSubmitError(null);
    const trimmed = code.trim().replace(/\s+/g, "");
    if (trimmed.length === 0) {
      setSubmitError("Enter the code first.");
      return;
    }
    setSubmitting(true);
    try {
      debug("verify attempt", { strategy });
      const { error } =
        strategy === "totp"
          ? await signIn.mfa.verifyTOTP({ code: trimmed })
          : strategy === "phone_code"
            ? await signIn.mfa.verifyPhoneCode({ code: trimmed })
            : strategy === "backup_code"
              ? await signIn.mfa.verifyBackupCode({ code: trimmed })
              : await signIn.mfa.verifyEmailCode({ code: trimmed });

      if (error) {
        debug("verify error", error);
        setSubmitError(friendlyAuthError(error));
        return;
      }

      debug("verify ok, status =", signIn.status);
      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: ({ session }) => {
            if (session?.currentTask) return;
            router.replace("/");
          },
        });
        return;
      }

      setSubmitError(
        signIn.status
          ? `Verification not complete (${signIn.status}). Try again.`
          : "Verification didn't complete. Try again.",
      );
    } catch (err) {
      debug("verify threw", err);
      setSubmitError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }, [signIn, code, strategy, router]);

  const copy = STRATEGY_COPY[strategy];
  const disabled = submitting || preparing || code.trim().length === 0;
  // Only show the strategy switcher when the user has more than one
  // real second-factor option configured. For client-trust email_code
  // there's nothing to switch between.
  const showTabs = supported.length > 1 && strategy !== "email_code";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.brandWrap}>
              <AtlasLogo size="lg" />
            </View>
            <Text style={styles.title} maxFontSizeMultiplier={1.4}>
              {copy.title}
            </Text>
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
              {copy.subtitle(emailHint)}
            </Text>
          </View>

          {showTabs && (
            <View style={styles.tabs}>
              {supported.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => {
                    setStrategy(s);
                    setCode("");
                    setSubmitError(null);
                    setInfo(null);
                  }}
                  style={[styles.tab, strategy === s && styles.tabActive]}
                  android_ripple={{ color: "#0000000D" }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      strategy === s && styles.tabTextActive,
                    ]}
                  >
                    {s === "totp"
                      ? "Authenticator app"
                      : s === "phone_code"
                        ? "Text message"
                        : s === "email_code"
                          ? "Email"
                          : "Backup code"}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.label} maxFontSizeMultiplier={1.3}>
            Code
          </Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={setCode}
            placeholder={copy.placeholder}
            placeholderTextColor={BRAND.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={strategy === "backup_code" ? "default" : "number-pad"}
            autoComplete={
              strategy === "email_code" || strategy === "phone_code"
                ? "one-time-code"
                : undefined
            }
            textContentType={
              strategy === "email_code" || strategy === "phone_code"
                ? "oneTimeCode"
                : undefined
            }
            maxLength={strategy === "backup_code" ? 32 : 8}
            editable={!submitting && !preparing}
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
          />

          {info && !submitError && (
            <Text style={styles.info} maxFontSizeMultiplier={1.3}>
              {info}
            </Text>
          )}
          {submitError && (
            <Text style={styles.errorText} maxFontSizeMultiplier={1.3}>
              {submitError}
            </Text>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.submit,
              disabled && { opacity: 0.5 },
              pressed && !disabled && Platform.OS === "ios" && { opacity: 0.85 },
            ]}
            android_ripple={{ color: "#FFFFFF22" }}
            onPress={handleSubmit}
            disabled={disabled}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText} maxFontSizeMultiplier={1.3}>
                Verify and sign in
              </Text>
            )}
          </Pressable>

          {(strategy === "email_code" || strategy === "phone_code") && (
            <Pressable
              hitSlop={8}
              onPress={() => {
                setCode("");
                setSubmitError(null);
                setSendNonce((n) => n + 1);
              }}
              disabled={preparing}
              style={{ alignSelf: "center", marginTop: 12 }}
              accessibilityRole="button"
            >
              <Text style={styles.linkText} maxFontSizeMultiplier={1.3}>
                {preparing ? "Sending…" : "Resend code"}
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => router.replace("/sign-in")}
            style={styles.backRow}
            accessibilityRole="button"
          >
            <Text style={styles.backText} maxFontSizeMultiplier={1.3}>
              Back to sign in
            </Text>
          </Pressable>
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
  tabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  tabActive: {
    backgroundColor: BRAND.primary,
    borderColor: BRAND.primary,
  },
  tabText: {
    fontFamily: "Inter_500Medium",
    color: BRAND.fg,
    fontSize: 13,
  },
  tabTextActive: { color: "#fff" },
  label: {
    fontFamily: "Inter_600SemiBold",
    color: BRAND.fg,
    fontSize: 13,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "android" ? 10 : 12,
    minHeight: 48,
    fontFamily: "Inter_500Medium",
    color: BRAND.fg,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  codeInput: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    letterSpacing: 6,
    textAlign: "center",
  },
  info: {
    color: BRAND.fg,
    marginTop: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  errorText: {
    color: BRAND.danger,
    marginTop: 10,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  submit: {
    marginTop: 20,
    backgroundColor: BRAND.primary,
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  submitText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    includeFontPadding: false,
  },
  linkText: {
    color: BRAND.primary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  backRow: {
    alignSelf: "center",
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backText: {
    color: BRAND.muted,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
