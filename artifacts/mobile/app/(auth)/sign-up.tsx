import { Ionicons } from "@expo/vector-icons";
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
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    try {
      const { error } = await signUp.password({ emailAddress, password });
      if (error) {
        setSubmitError(error.message ?? "Sign-up failed.");
        return;
      }
      await signUp.verifications.sendEmailCode();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Sign-up failed.");
    }
  }, [signUp, emailAddress, password]);

  const handleVerify = useCallback(async () => {
    setSubmitError(null);
    try {
      await signUp.verifications.verifyEmailCode({ code });
      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: ({ session }) => {
            if (session?.currentTask) return;
            router.replace("/");
          },
        });
      } else {
        setSubmitError(`Verification not complete (${signUp.status ?? "unknown"}).`);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Verification failed.");
    }
  }, [signUp, code, router]);

  const handleGoogle = useCallback(async () => {
    setSubmitError(null);
    setOauthLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
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
      setSubmitError(
        err instanceof Error ? err.message : "Google sign-up failed.",
      );
    } finally {
      setOauthLoading(false);
    }
  }, [startSSOFlow, router]);

  if (signUp.status === "complete" || isSignedIn) {
    return null;
  }

  const isFetching = fetchStatus === "fetching";
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
            <Text style={styles.title}>
              {needsVerification ? "Check your email" : "Create your account"}
            </Text>
            <Text style={styles.subtitle}>
              {needsVerification
                ? `We sent a verification code to ${emailAddress}.`
                : "Start your AI-coached journey toward your biggest goal."}
            </Text>
          </View>

          {needsVerification ? (
            <>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={BRAND.muted}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                returnKeyType="go"
                onSubmitEditing={handleVerify}
              />
              {errors?.fields?.code?.message && (
                <Text style={styles.errorText}>
                  {errors.fields.code.message}
                </Text>
              )}
              {submitError && (
                <Text style={styles.errorText}>{submitError}</Text>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  verifyDisabled && styles.primaryBtnDisabled,
                  pressed && !verifyDisabled && { opacity: 0.9 },
                ]}
                onPress={handleVerify}
                disabled={verifyDisabled}
              >
                {isFetching ? (
                  <ActivityIndicator color="#FAF6EE" />
                ) : (
                  <Text style={styles.primaryBtnText}>Verify and continue</Text>
                )}
              </Pressable>

              <Pressable
                hitSlop={8}
                onPress={() => signUp.verifications.sendEmailCode()}
                style={{ alignSelf: "center", marginTop: 16 }}
              >
                <Text style={styles.linkText}>Resend code</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.googleBtn,
                  pressed && { opacity: 0.85 },
                  oauthLoading && { opacity: 0.6 },
                ]}
                onPress={handleGoogle}
                disabled={oauthLoading}
              >
                {oauthLoading ? (
                  <ActivityIndicator color={BRAND.fg} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={18} color={BRAND.fg} />
                    <Text style={styles.googleBtnText}>
                      Sign up with Google
                    </Text>
                  </>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.divider} />
              </View>

              <Text style={styles.label}>Email</Text>
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
              />
              {errors?.fields?.emailAddress?.message && (
                <Text style={styles.errorText}>
                  {errors.fields.emailAddress.message}
                </Text>
              )}

              <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
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
              />
              {errors?.fields?.password?.message && (
                <Text style={styles.errorText}>
                  {errors.fields.password.message}
                </Text>
              )}

              {submitError && (
                <Text style={styles.errorText}>{submitError}</Text>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  disabled && styles.primaryBtnDisabled,
                  pressed && !disabled && { opacity: 0.9 },
                ]}
                onPress={handleSubmit}
                disabled={disabled}
              >
                {isFetching ? (
                  <ActivityIndicator color="#FAF6EE" />
                ) : (
                  <Text style={styles.primaryBtnText}>Create account</Text>
                )}
              </Pressable>

              {/* Required for sign-up flows. Clerk's bot sign-up protection is enabled by default */}
              <View nativeID="clerk-captcha" />

              <View style={styles.linkRow}>
                <Text style={styles.linkRowText}>
                  Already have an account?
                </Text>
                <Link href="/(auth)/sign-in" asChild>
                  <Pressable hitSlop={8}>
                    <Text style={styles.linkText}>Sign in</Text>
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
  brandWrap: {
    marginBottom: 4,
  },
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
    gap: 10,
    backgroundColor: BRAND.card,
    borderColor: BRAND.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
  },
  googleBtnText: {
    fontFamily: "Inter_600SemiBold",
    color: BRAND.fg,
    fontSize: 15,
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
    paddingVertical: 12,
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
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    color: BRAND.bg,
    fontSize: 16,
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
