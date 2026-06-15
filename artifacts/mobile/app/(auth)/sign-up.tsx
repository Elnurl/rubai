import { useAuth, useSignUp, useSSO } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
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
    console.log("[auth/sign-up]", ...args);
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

export default function SignUpScreen() {
  const { t } = useTranslation();
  useWarmUpBrowser();
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!signUp) return;
    setSubmitError(null);
    if (password.length < 8) {
      setSubmitError(t("signUp.passwordTooShort", "Password must be at least 8 characters long."));
      return;
    }
    setSubmitting(true);
    try {
      debug("password attempt", { email: emailAddress });
      const { error } = await signUp.password({ emailAddress, password });
      if (error) {
        debug("password error", error);
        setSubmitError(friendlyAuthError(error));
        return;
      }
      debug("password ok, status =", signUp.status, {
        unverified: signUp.unverifiedFields,
        missing: signUp.missingFields,
      });
      // The 6-digit email verification step has been removed for now.
      // If Clerk's instance is configured to require email verification,
      // status will stay at "missing_requirements" — surface a clear
      // error rather than rendering the (deleted) verify UI.
      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: ({ session }) => {
            if (session?.currentTask) return;
            router.replace("/");
          },
        });
        return;
      }
      setSubmitError(
        t("signUp.verificationRequired", "We couldn't finish creating your account. Email verification appears to still be required on the server. Please contact support."),
      );
    } catch (err) {
      debug("submit threw", err);
      setSubmitError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }, [signUp, emailAddress, password, router]);

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
        // No session created and no error thrown. Common in the workspace
        // preview iframe where OAuth popups / postMessage callbacks are
        // blocked. Tell the user what to do instead of failing silently.
        debug("google sso cancelled or missing requirements");
        if (isWebInIframe()) {
          setSubmitError(
            t("signUp.googleIncompleteIframe", "Google sign-up didn't complete. Inside the workspace preview, OAuth popups can be blocked — open this page in a new browser tab and try again."),
          );
        } else {
          setSubmitError(
            t("signUp.googleIncomplete", "Google sign-up didn't complete. Please try again."),
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

  if (signUp.status === "complete" || isSignedIn) {
    return null;
  }

  const isFetching = fetchStatus === "fetching" || submitting;
  const disabled = !emailAddress || !password || isFetching;

  // Surface any global Clerk errors (captcha rejection, bot protection,
  // rate-limits, network problems) that aren't returned via the .password()
  // promise but show up in the hook's `errors` object.
  const globalClerkError =
    !submitError && errors?.global && errors.global.length > 0
      ? friendlyAuthError(errors.global[0])
      : null;

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
              {t("signUp.title", "Create your account")}
            </Text>
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
              {t("signUp.subtitle", "Start your AI-coached journey toward your biggest goal.")}
            </Text>
          </View>

          {(
            <>
              {isWebInIframe() && (
                <View style={styles.iframeNotice}>
                  <Text
                    style={styles.iframeNoticeText}
                    maxFontSizeMultiplier={1.3}
                  >
                    {t("signUp.iframeNotice", "Tip: Google sign-up opens a popup. To use it from the workspace preview, open this page in a new browser tab first.")}
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
                accessibilityLabel={t("signUp.signUpWithGoogle", "Sign up with Google")}
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
                      {t("signUp.signUpWithGoogle", "Sign up with Google")}
                    </Text>
                  </>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText} maxFontSizeMultiplier={1.2}>
                  {t("signUp.or", "or")}
                </Text>
                <View style={styles.divider} />
              </View>

              <Text style={styles.label} maxFontSizeMultiplier={1.3}>
                {t("signUp.email", "Email")}
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
              {errors?.fields?.emailAddress?.message && (
                <Text style={styles.errorText} maxFontSizeMultiplier={1.3}>
                  {errors.fields.emailAddress.message}
                </Text>
              )}

              <Text
                style={[styles.label, { marginTop: 12 }]}
                maxFontSizeMultiplier={1.3}
              >
                {t("signUp.password", "Password")}
              </Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t("signUp.passwordPlaceholder", "At least 8 characters")}
                  placeholderTextColor={BRAND.muted}
                  secureTextEntry={!showPassword}
                  autoComplete="password-new"
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  editable={!isFetching}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? t("signUp.hidePassword", "Hide password") : t("signUp.showPassword", "Show password")
                  }
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

              {submitError && (
                <Text style={styles.errorText} maxFontSizeMultiplier={1.3}>
                  {submitError}
                </Text>
              )}
              {globalClerkError && (
                <Text style={styles.errorText} maxFontSizeMultiplier={1.3}>
                  {globalClerkError}
                </Text>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  disabled && styles.primaryBtnDisabled,
                  pressed &&
                    !disabled &&
                    Platform.OS === "ios" && { opacity: 0.9 },
                ]}
                android_ripple={{ color: "#FFFFFF22" }}
                onPress={handleSubmit}
                disabled={disabled}
                accessibilityRole="button"
              >
                {isFetching ? (
                  <ActivityIndicator color="#FAF6EE" />
                ) : (
                  <Text
                    style={styles.primaryBtnText}
                    maxFontSizeMultiplier={1.3}
                  >
                    {t("signUp.createAccount", "Create account")}
                  </Text>
                )}
              </Pressable>

              {/* Required for sign-up flows. Clerk's bot sign-up protection is enabled by default */}
              <View nativeID="clerk-captcha" />

              <View style={styles.linkRow}>
                <Text style={styles.linkRowText} maxFontSizeMultiplier={1.3}>
                  {t("signUp.haveAccount", "Already have an account?")}
                </Text>
                <Link href="/(auth)/sign-in" asChild>
                  <Pressable hitSlop={8} accessibilityRole="link">
                    <Text style={styles.linkText} maxFontSizeMultiplier={1.3}>
                      {t("signUp.signInLink", "Sign in")}
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
  errorText: {
    fontFamily: "Inter_500Medium",
    color: BRAND.destructive,
    fontSize: 13,
    marginTop: 6,
  },
  infoText: {
    fontFamily: "Inter_500Medium",
    color: BRAND.fg,
    fontSize: 13,
    marginTop: 6,
  },
  hintText: {
    fontFamily: "Inter_400Regular",
    color: BRAND.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
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
