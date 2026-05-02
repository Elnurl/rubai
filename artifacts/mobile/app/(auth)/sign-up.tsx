import { useAuth, useSignUp, useSSO } from "@clerk/expo";
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
  useWarmUpBrowser();
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!signUp) return;
    setSubmitError(null);
    setInfo(null);
    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters long.");
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
      debug("password ok, sending email code; status =", signUp.status);
      const { error: sendErr } = await signUp.verifications.sendEmailCode();
      if (sendErr) {
        debug("sendEmailCode error", sendErr);
        setSubmitError(friendlyAuthError(sendErr));
        return;
      }
      setInfo(`We just emailed a 6-digit code to ${emailAddress}.`);
    } catch (err) {
      debug("submit threw", err);
      setSubmitError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }, [signUp, emailAddress, password]);

  const handleVerify = useCallback(async () => {
    if (!signUp) return;
    setSubmitError(null);
    setInfo(null);
    const trimmed = code.trim().replace(/\s+/g, "");
    if (trimmed.length === 0) {
      setSubmitError("Enter the 6-digit code we emailed you.");
      return;
    }
    setSubmitting(true);
    try {
      debug("verify attempt");
      const { error } = await signUp.verifications.verifyEmailCode({
        code: trimmed,
      });
      if (error) {
        debug("verify error", error);
        setSubmitError(friendlyAuthError(error));
        return;
      }
      debug("verify ok, status =", signUp.status);
      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: ({ session }) => {
            if (session?.currentTask) return;
            router.replace("/");
          },
        });
      } else {
        setSubmitError(
          "We couldn't finish creating your account. Tap 'Resend code' and try again.",
        );
      }
    } catch (err) {
      debug("verify threw", err);
      setSubmitError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }, [signUp, code, router]);

  const handleResend = useCallback(async () => {
    if (!signUp) return;
    setSubmitError(null);
    setInfo(null);
    setResending(true);
    try {
      const { error } = await signUp.verifications.sendEmailCode();
      if (error) {
        setSubmitError(friendlyAuthError(error));
        return;
      }
      setInfo(`A new code is on its way to ${emailAddress}.`);
    } catch (err) {
      setSubmitError(friendlyAuthError(err));
    } finally {
      setResending(false);
    }
  }, [signUp, emailAddress]);

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
  const verifyDisabled = !code || isFetching;

  const needsVerification =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields?.includes("email_address") &&
    (signUp.missingFields?.length ?? 0) === 0;

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
              {needsVerification ? "Check your email" : "Create your account"}
            </Text>
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
              {needsVerification
                ? `We sent a 6-digit code to ${emailAddress}. Enter it below to finish setting up your account.`
                : "Start your AI-coached journey toward your biggest goal."}
            </Text>
          </View>

          {needsVerification ? (
            <>
              <Text style={styles.label} maxFontSizeMultiplier={1.3}>
                Verification code
              </Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={BRAND.muted}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                returnKeyType="go"
                maxLength={6}
                onSubmitEditing={handleVerify}
                editable={!isFetching}
              />
              {errors?.fields?.code?.message && (
                <Text style={styles.errorText} maxFontSizeMultiplier={1.3}>
                  {errors.fields.code.message}
                </Text>
              )}
              {info && !submitError && (
                <Text style={styles.infoText} maxFontSizeMultiplier={1.3}>
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
                  styles.primaryBtn,
                  verifyDisabled && styles.primaryBtnDisabled,
                  pressed &&
                    !verifyDisabled &&
                    Platform.OS === "ios" && { opacity: 0.9 },
                ]}
                android_ripple={{ color: "#FFFFFF22" }}
                onPress={handleVerify}
                disabled={verifyDisabled}
                accessibilityRole="button"
              >
                {isFetching ? (
                  <ActivityIndicator color="#FAF6EE" />
                ) : (
                  <Text
                    style={styles.primaryBtnText}
                    maxFontSizeMultiplier={1.3}
                  >
                    Verify and continue
                  </Text>
                )}
              </Pressable>

              <Pressable
                hitSlop={8}
                onPress={handleResend}
                disabled={resending}
                style={{
                  alignSelf: "center",
                  marginTop: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
                accessibilityRole="button"
              >
                {resending && <ActivityIndicator size="small" color={BRAND.primary} />}
                <Text style={styles.linkText} maxFontSizeMultiplier={1.3}>
                  {resending ? "Sending…" : "Resend code"}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
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
                accessibilityLabel="Sign up with Google"
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
                      Sign up with Google
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
              {errors?.fields?.emailAddress?.message && (
                <Text style={styles.errorText} maxFontSizeMultiplier={1.3}>
                  {errors.fields.emailAddress.message}
                </Text>
              )}

              <Text
                style={[styles.label, { marginTop: 12 }]}
                maxFontSizeMultiplier={1.3}
              >
                Password
              </Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={BRAND.muted}
                secureTextEntry
                autoComplete="password-new"
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
                    Create account
                  </Text>
                )}
              </Pressable>

              {/* Required for sign-up flows. Clerk's bot sign-up protection is enabled by default */}
              <View nativeID="clerk-captcha" />

              <View style={styles.linkRow}>
                <Text style={styles.linkRowText} maxFontSizeMultiplier={1.3}>
                  Already have an account?
                </Text>
                <Link href="/(auth)/sign-in" asChild>
                  <Pressable hitSlop={8} accessibilityRole="link">
                    <Text style={styles.linkText} maxFontSizeMultiplier={1.3}>
                      Sign in
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
  codeInput: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    letterSpacing: 6,
    textAlign: "center",
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
