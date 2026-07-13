import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import React, { useCallback, useState } from "react";
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
import { friendlyAuthError } from "@/lib/authErrors";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";

const BRAND = {
  primary: "#0E7C5A",
  bg: "#FAF6EE",
  fg: "#1B1812",
  muted: "#807763",
  border: "#E1D9C5",
  card: "#FFFFFF",
  destructive: "#B43E3E",
};

type Step = "request" | "done";

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { requestPasswordReset } = useAuth();

  const [step, setStep] = useState<Step>("request");
  const [emailAddress, setEmailAddress] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleRequest = useCallback(async () => {
    setSubmitError(null);
    setInfo(null);
    if (!emailAddress.trim()) {
      setSubmitError(
        t("forgotPassword.enterEmailError", "Enter the email on your account."),
      );
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(emailAddress.trim());
      setInfo(
        t(
          "forgotPassword.linkSent",
          "We emailed a reset link to {{email}}. Open it on this device, then set a new password below.",
          { email: emailAddress.trim() },
        ),
      );
      setStep("done");
    } catch (err) {
      setSubmitError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }, [requestPasswordReset, emailAddress, t]);

  const handleSetPassword = useCallback(async () => {
    setSubmitError(null);
    if (newPassword.length < 8) {
      setSubmitError(
        t(
          "forgotPassword.passwordTooShort",
          "Password must be at least 8 characters.",
        ),
      );
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      router.replace("/(auth)/sign-in");
    } catch (err) {
      setSubmitError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }, [newPassword, router, t]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <AtlasLogo size="lg" />
            <Text style={styles.title}>
              {t("forgotPassword.title", "Reset password")}
            </Text>
            <Text style={styles.subtitle}>
              {t(
                "forgotPassword.subtitle",
                "We'll email you a link to choose a new password.",
              )}
            </Text>
          </View>

          {step === "request" ? (
            <>
              <Text style={styles.label}>{t("forgotPassword.email", "Email")}</Text>
              <TextInput
                style={styles.input}
                value={emailAddress}
                onChangeText={setEmailAddress}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={BRAND.muted}
                editable={!busy}
              />
              {submitError ? (
                <Text style={styles.errorText}>{submitError}</Text>
              ) : null}
              <Pressable
                style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
                onPress={() => void handleRequest()}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#FAF6EE" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {t("forgotPassword.sendLink", "Send reset link")}
                  </Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              {info ? <Text style={styles.infoText}>{info}</Text> : null}
              <Text style={[styles.label, { marginTop: 16 }]}>
                {t("forgotPassword.newPassword", "New password")}
              </Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholderTextColor={BRAND.muted}
                editable={!busy}
              />
              {submitError ? (
                <Text style={styles.errorText}>{submitError}</Text>
              ) : null}
              <Pressable
                style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
                onPress={() => void handleSetPassword()}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#FAF6EE" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {t("forgotPassword.savePassword", "Save password")}
                  </Text>
                )}
              </Pressable>
            </>
          )}

          <Pressable
            onPress={() => router.replace("/(auth)/sign-in")}
            style={styles.backRow}
          >
            <Text style={styles.backText}>
              {t("forgotPassword.backToSignIn", "Back to sign in")}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.bg },
  container: { padding: 24, paddingTop: 32 },
  header: { marginBottom: 24, gap: 6 },
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
  errorText: {
    fontFamily: "Inter_500Medium",
    color: BRAND.destructive,
    fontSize: 13,
    marginTop: 6,
  },
  infoText: {
    fontFamily: "Inter_500Medium",
    color: BRAND.primary,
    fontSize: 13,
    lineHeight: 20,
  },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: BRAND.primary,
    borderRadius: 14,
    paddingVertical: 15,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    color: BRAND.bg,
    fontSize: 16,
  },
  backRow: { marginTop: 20, alignItems: "center" },
  backText: {
    fontFamily: "Inter_500Medium",
    color: BRAND.primary,
    fontSize: 14,
  },
});
