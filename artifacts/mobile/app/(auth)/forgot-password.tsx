import { useSignIn } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
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
  card: "#FFFFFF",
  destructive: "#B43E3E",
};

function debug(...args: unknown[]) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[auth/forgot]", ...args);
  }
}

type Step = "request" | "reset";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { signIn, fetchStatus } = useSignIn();
  const isFetching = fetchStatus === "fetching";

  const [step, setStep] = useState<Step>("request");
  const [emailAddress, setEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleRequest = useCallback(async () => {
    if (!signIn) return;
    setSubmitError(null);
    setInfo(null);
    if (!emailAddress) {
      setSubmitError("Enter the email on your account.");
      return;
    }
    setBusy(true);
    try {
      // The Future API password-reset flow is two phone calls:
      //   1. signIn.create({ identifier }) — anchors the sign-in to this user
      //   2. signIn.resetPasswordEmailCode.sendCode() — emails a 6-digit code
      debug("create signIn for reset", emailAddress);
      const created = await signIn.create({ identifier: emailAddress });
      if (created.error) {
        debug("create error", created.error);
        setSubmitError(friendlyAuthError(created.error));
        return;
      }
      debug("sendCode (reset)");
      const sent = await signIn.resetPasswordEmailCode.sendCode();
      if (sent.error) {
        debug("sendCode error", sent.error);
        setSubmitError(friendlyAuthError(sent.error));
        return;
      }
      setInfo(`We just emailed a 6-digit reset code to ${emailAddress}.`);
      setStep("reset");
    } catch (err) {
      debug("request threw", err);
      setSubmitError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }, [signIn, emailAddress]);

  const handleReset = useCallback(async () => {
    if (!signIn) return;
    setSubmitError(null);
    setInfo(null);
    const trimmedCode = code.trim().replace(/\s+/g, "");
    if (trimmedCode.length === 0) {
      setSubmitError("Enter the 6-digit code we emailed you.");
      return;
    }
    if (newPassword.length < 8) {
      setSubmitError("New password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      // Two-step submit per the Future API:
      //   verifyCode → status becomes 'needs_new_password'
      //   submitPassword → status becomes 'complete'
      debug("verifyCode");
      const verified = await signIn.resetPasswordEmailCode.verifyCode({
        code: trimmedCode,
      });
      if (verified.error) {
        debug("verifyCode error", verified.error);
        setSubmitError(friendlyAuthError(verified.error));
        return;
      }
      debug("submitPassword");
      const submitted = await signIn.resetPasswordEmailCode.submitPassword({
        password: newPassword,
      });
      if (submitted.error) {
        debug("submitPassword error", submitted.error);
        setSubmitError(friendlyAuthError(submitted.error));
        return;
      }
      debug("reset ok, status =", signIn.status);
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
        `Couldn't finish reset (${signIn.status ?? "unknown"}). Try again.`,
      );
    } catch (err) {
      debug("reset threw", err);
      setSubmitError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }, [signIn, code, newPassword, router]);

  const isWorking = busy || isFetching;

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
              {step === "request" ? "Reset your password" : "Choose a new password"}
            </Text>
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
              {step === "request"
                ? "Enter the email on your account and we'll send you a 6-digit code."
                : `Enter the code we emailed to ${emailAddress} and pick a new password.`}
            </Text>
          </View>

          {step === "request" ? (
            <>
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
                returnKeyType="go"
                onSubmitEditing={handleRequest}
                editable={!isWorking}
              />
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
                  (!emailAddress || isWorking) && styles.primaryBtnDisabled,
                  pressed &&
                    !!emailAddress &&
                    !isWorking &&
                    Platform.OS === "ios" && { opacity: 0.9 },
                ]}
                android_ripple={{ color: "#FFFFFF22" }}
                onPress={handleRequest}
                disabled={!emailAddress || isWorking}
                accessibilityRole="button"
              >
                {isWorking ? (
                  <ActivityIndicator color="#FAF6EE" />
                ) : (
                  <Text
                    style={styles.primaryBtnText}
                    maxFontSizeMultiplier={1.3}
                  >
                    Send reset code
                  </Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.label} maxFontSizeMultiplier={1.3}>
                Reset code
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
                maxLength={6}
                returnKeyType="next"
                editable={!isWorking}
              />

              <Text
                style={[styles.label, { marginTop: 12 }]}
                maxFontSizeMultiplier={1.3}
              >
                New password
              </Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={BRAND.muted}
                secureTextEntry
                autoComplete="password-new"
                returnKeyType="go"
                onSubmitEditing={handleReset}
                editable={!isWorking}
              />

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
                  (!code || !newPassword || isWorking) && styles.primaryBtnDisabled,
                  pressed &&
                    !!code &&
                    !!newPassword &&
                    !isWorking &&
                    Platform.OS === "ios" && { opacity: 0.9 },
                ]}
                android_ripple={{ color: "#FFFFFF22" }}
                onPress={handleReset}
                disabled={!code || !newPassword || isWorking}
                accessibilityRole="button"
              >
                {isWorking ? (
                  <ActivityIndicator color="#FAF6EE" />
                ) : (
                  <Text
                    style={styles.primaryBtnText}
                    maxFontSizeMultiplier={1.3}
                  >
                    Set new password
                  </Text>
                )}
              </Pressable>

              <Pressable
                hitSlop={8}
                onPress={handleRequest}
                disabled={isWorking}
                style={{ alignSelf: "center", marginTop: 14 }}
              >
                <Text style={styles.linkText} maxFontSizeMultiplier={1.3}>
                  Resend code
                </Text>
              </Pressable>
            </>
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
  linkText: {
    fontFamily: "Inter_600SemiBold",
    color: BRAND.primary,
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
