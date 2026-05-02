import { useSignIn, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Link, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import { GoogleGIcon } from "@/components/GoogleGIcon";
import { friendlyAuthError } from "@/lib/authErrors";

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

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!signIn) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      debug("password attempt", { email: emailAddress });
      const { error } = await signIn.password({ emailAddress, password });
      if (error) {
        debug("password error", error);
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

      // Replit-managed Clerk doesn't support MFA today, but if Clerk ever
      // returns `needs_second_factor` (e.g. TOTP/SMS configured externally)
      // we route to the verify screen with a sensible default strategy.
      if (signIn.status === "needs_second_factor") {
        const factors = signIn.supportedSecondFactors ?? [];
        const preferred =
          factors.find((f) => f.strategy === "totp")?.strategy ??
          factors.find((f) => f.strategy === "phone_code")?.strategy ??
          factors.find((f) => f.strategy === "backup_code")?.strategy ??
          "totp";
        router.push({ pathname: "/verify", params: { strategy: preferred } });
        return;
      }

      // Clerk's "client trust" path — fired when signing in from a new
      // device/browser. Clerk sends a 6-digit code by email; we ask for
      // it on the verify screen. THIS is the path users see most often
      // and is what people commonly call "the 2FA / 6-digit step".
      // The verify screen owns the actual sendEmailCode call (single
      // source of truth) — we just route there with the right strategy.
      if (signIn.status === "needs_client_trust") {
        debug("needs_client_trust — routing to verify");
        router.push({
          pathname: "/verify",
          params: { strategy: "email_code", email: emailAddress },
        });
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

  const isFetching = fetchStatus === "fetching" || submitting;
  const disabled = !emailAddress || !password || isFetching;

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
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={BRAND.muted}
            secureTextEntry
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            editable={!isFetching}
          />
          {errors?.fields?.password?.message && (
            <Text style={styles.errorText} maxFontSizeMultiplier={1.3}>
              {errors.fields.password.message}
            </Text>
          )}

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
});
