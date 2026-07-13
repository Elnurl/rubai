import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const REMEMBER_EMAIL_KEY = "atlas:v2:auth:rememberEmail";
const REMEMBER_FLAG_KEY = "atlas:v2:auth:rememberFlag";

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

export default function SignInScreen() {
  const { t } = useTranslation();
  useWarmUpBrowser();
  const router = useRouter();
  const {
    isLoaded: authLoaded,
    isSignedIn,
    signInWithPassword,
    signInWithGoogle,
  } = useAuth();

  useEffect(() => {
    if (authLoaded && isSignedIn) router.replace("/");
  }, [authLoaded, isSignedIn, router]);

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(REMEMBER_FLAG_KEY, rememberMe ? "1" : "0");
    if (!rememberMe) {
      void AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
    } else if (emailAddress.trim().length > 0) {
      void AsyncStorage.setItem(REMEMBER_EMAIL_KEY, emailAddress.trim());
    }
  }, [rememberMe, emailAddress]);

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      if (isSignedIn) {
        router.replace("/");
        return;
      }
      await signInWithPassword(emailAddress.trim(), password);
      router.replace("/");
    } catch (err) {
      setSubmitError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }, [signInWithPassword, emailAddress, password, router, isSignedIn]);

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
            <Text style={styles.title} maxFontSizeMultiplier={1.4}>
              {t("signIn.title", "Welcome back")}
            </Text>
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
              {t(
                "signIn.subtitle",
                "Sign in to continue with your AI goal coach.",
              )}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.googleBtn,
              pressed && Platform.OS === "ios" && { opacity: 0.85 },
              oauthLoading && { opacity: 0.6 },
            ]}
            android_ripple={{ color: "#0000000D" }}
            onPress={() => void handleGoogle()}
            disabled={oauthLoading}
            accessibilityRole="button"
          >
            {oauthLoading ? (
              <ActivityIndicator color={BRAND.fg} />
            ) : (
              <>
                <GoogleGIcon size={20} />
                <Text style={styles.googleBtnText} maxFontSizeMultiplier={1.3}>
                  {t("signIn.continueWithGoogle", "Continue with Google")}
                </Text>
              </>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>{t("signIn.or", "or")}</Text>
            <View style={styles.divider} />
          </View>

          <Text style={styles.label}>{t("signIn.email", "Email")}</Text>
          <TextInput
            style={styles.input}
            value={emailAddress}
            onChangeText={setEmailAddress}
            placeholder="you@example.com"
            placeholderTextColor={BRAND.muted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            editable={!submitting}
          />

          <View style={styles.passwordHeaderRow}>
            <Text style={styles.label}>{t("signIn.password", "Password")}</Text>
            <Link href="/(auth)/forgot-password" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.forgotText}>
                  {t("signIn.forgot", "Forgot?")}
                </Text>
              </Pressable>
            </Link>
          </View>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder={t("signIn.passwordPlaceholder", "Your password")}
              placeholderTextColor={BRAND.muted}
              secureTextEntry={!showPassword}
              autoComplete="password"
              onSubmitEditing={() => void handleSubmit()}
              editable={!submitting}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={10}
              style={styles.eyeBtn}
            >
              <Feather
                name={showPassword ? "eye-off" : "eye"}
                size={18}
                color={BRAND.muted}
              />
            </Pressable>
          </View>

          <Pressable
            onPress={() => setRememberMe((v) => !v)}
            style={styles.rememberRow}
          >
            <View
              style={[styles.checkbox, rememberMe && styles.checkboxChecked]}
            >
              {rememberMe && <Feather name="check" size={14} color="#FAF6EE" />}
            </View>
            <Text style={styles.rememberText}>
              {t("signIn.rememberMe", "Remember me on this device")}
            </Text>
          </Pressable>

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
                {t("signIn.signInBtn", "Sign in")}
              </Text>
            )}
          </Pressable>

          <View style={styles.linkRow}>
            <Text style={styles.linkRowText}>
              {t("signIn.noAccount", "Don't have an account?")}
            </Text>
            <Link href="/(auth)/sign-up" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.linkText}>
                  {t("signIn.signUpLink", "Sign up")}
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
  passwordRow: { position: "relative", justifyContent: "center" },
  passwordInput: { paddingRight: 44 },
  eyeBtn: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
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
