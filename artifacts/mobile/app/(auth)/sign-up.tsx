import { Feather } from "@expo/vector-icons";
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
import { useAuth } from "@/providers/AuthProvider";

WebBrowser.maybeCompleteAuthSession();

const BRAND = {
  primary: "#0E7C5A",
  bg: "#FAF6EE",
  fg: "#1B1812",
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
  const { t } = useTranslation();
  useWarmUpBrowser();
  const router = useRouter();
  const { isSignedIn, signUpWithPassword, signInWithGoogle } = useAuth();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isSignedIn) router.replace("/");
  }, [isSignedIn, router]);

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    setInfo(null);
    if (password.length < 8) {
      setSubmitError(
        t(
          "signUp.passwordTooShort",
          "Password must be at least 8 characters long.",
        ),
      );
      return;
    }
    setSubmitting(true);
    try {
      await signUpWithPassword(emailAddress.trim(), password);
      router.replace("/");
    } catch (err) {
      const msg = friendlyAuthError(err);
      if (/check your email/i.test(msg)) {
        setInfo(msg);
      } else {
        setSubmitError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }, [signUpWithPassword, emailAddress, password, router, t]);

  const handleGoogle = useCallback(async () => {
    setSubmitError(null);
    setOauthLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (err) {
      setSubmitError(friendlyAuthError(err));
    } finally {
      setOauthLoading(false);
    }
  }, [signInWithGoogle, router]);

  const disabled = !emailAddress || !password || submitting;

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
            <Text style={styles.title}>
              {t("signUp.title", "Create your account")}
            </Text>
            <Text style={styles.subtitle}>
              {t(
                "signUp.subtitle",
                "Start your AI-coached journey toward your biggest goal.",
              )}
            </Text>
          </View>

          <Pressable
            style={[styles.googleBtn, oauthLoading && { opacity: 0.6 }]}
            onPress={() => void handleGoogle()}
            disabled={oauthLoading}
          >
            {oauthLoading ? (
              <ActivityIndicator color={BRAND.fg} />
            ) : (
              <>
                <GoogleGIcon size={20} />
                <Text style={styles.googleBtnText}>
                  {t("signUp.signUpWithGoogle", "Sign up with Google")}
                </Text>
              </>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>{t("signUp.or", "or")}</Text>
            <View style={styles.divider} />
          </View>

          <Text style={styles.label}>{t("signUp.email", "Email")}</Text>
          <TextInput
            style={styles.input}
            value={emailAddress}
            onChangeText={setEmailAddress}
            placeholder="you@example.com"
            placeholderTextColor={BRAND.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!submitting}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>
            {t("signUp.password", "Password")}
          </Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder={t(
                "signUp.passwordPlaceholder",
                "At least 8 characters",
              )}
              placeholderTextColor={BRAND.muted}
              secureTextEntry={!showPassword}
              editable={!submitting}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={styles.eyeBtn}
            >
              <Feather
                name={showPassword ? "eye-off" : "eye"}
                size={18}
                color={BRAND.muted}
              />
            </Pressable>
          </View>

          {info ? <Text style={styles.infoText}>{info}</Text> : null}
          {submitError ? (
            <Text style={styles.errorText}>{submitError}</Text>
          ) : null}

          <Pressable
            style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled]}
            onPress={() => void handleSubmit()}
            disabled={disabled}
          >
            {submitting ? (
              <ActivityIndicator color="#FAF6EE" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {t("signUp.signUpBtn", "Create account")}
              </Text>
            )}
          </Pressable>

          <View style={styles.linkRow}>
            <Text style={styles.linkRowText}>
              {t("signUp.hasAccount", "Already have an account?")}
            </Text>
            <Link href="/(auth)/sign-in" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.linkText}>
                  {t("signUp.signInLink", "Sign in")}
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
  passwordRow: { position: "relative" },
  passwordInput: { paddingRight: 44 },
  eyeBtn: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
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
