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

const BRAND = {
  primary: "#0E7C5A",
  bg: "#FAF6EE",
  fg: "#1B1812",
  muted: "#807763",
  border: "#E1D9C5",
  danger: "#B43E3E",
};

type Strategy = "totp" | "phone_code" | "backup_code";

const STRATEGY_COPY: Record<
  Strategy,
  { title: string; subtitle: string; placeholder: string }
> = {
  totp: {
    title: "Enter your 6-digit code",
    subtitle:
      "Open your authenticator app (Google Authenticator, 1Password, Authy…) and type the current code.",
    placeholder: "123 456",
  },
  phone_code: {
    title: "Enter the SMS code",
    subtitle:
      "We sent a 6-digit code to your phone. Enter it below to finish signing in.",
    placeholder: "123 456",
  },
  backup_code: {
    title: "Enter a backup code",
    subtitle:
      "Use one of the backup codes you saved when you set up two-factor auth. Each code works once.",
    placeholder: "abcd-efgh",
  },
};

function isStrategy(value: unknown): value is Strategy {
  return value === "totp" || value === "phone_code" || value === "backup_code";
}

export default function VerifyScreen() {
  const router = useRouter();
  const { signIn, fetchStatus } = useSignIn();
  const isLoaded = fetchStatus !== "fetching";
  const params = useLocalSearchParams<{ strategy?: string }>();

  // Pick a sensible default strategy. If we already have a valid strategy in
  // the URL, use it. Otherwise prefer whatever the server reports as
  // supported in this order: totp -> phone_code -> backup_code.
  const supported = useMemo<Strategy[]>(() => {
    if (!signIn?.supportedSecondFactors) return [];
    return signIn.supportedSecondFactors
      .map((f) => f.strategy)
      .filter(isStrategy) as Strategy[];
  }, [signIn?.supportedSecondFactors]);

  const initialStrategy: Strategy = useMemo(() => {
    if (isStrategy(params.strategy)) return params.strategy;
    if (supported.includes("totp")) return "totp";
    if (supported.includes("phone_code")) return "phone_code";
    if (supported.includes("backup_code")) return "backup_code";
    return "totp";
  }, [params.strategy, supported]);

  const [strategy, setStrategy] = useState<Strategy>(initialStrategy);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Guard: if the user lands on /verify outside of a real 2FA flow
  // (e.g. via deep link, hard refresh, or back button after signing
  // in), bounce them back to the sign-in screen so they don't get
  // stuck on a screen that can't make progress.
  useEffect(() => {
    if (!isLoaded || !signIn) return;
    if (signIn.status && signIn.status !== "needs_second_factor") {
      router.replace("/sign-in");
    }
  }, [isLoaded, signIn, router]);

  // Reconcile selected strategy with what the account actually supports.
  // This matters when the URL hint (initialStrategy) was missing or
  // incorrect — e.g. account only has SMS configured but we defaulted
  // to TOTP. Without this the user could be stuck on a tab that has no
  // valid path forward.
  useEffect(() => {
    if (supported.length === 0) return;
    if (!supported.includes(strategy)) {
      setStrategy(supported[0]);
      setCode("");
      setSubmitError(null);
      setInfo(null);
    }
  }, [supported, strategy]);

  // For phone_code we ask Clerk to send the SMS as soon as the user
  // lands on this strategy — without sending, there's nothing for them
  // to type. The Future API returns `{ error }` instead of throwing.
  useEffect(() => {
    if (!isLoaded || !signIn) return;
    if (strategy !== "phone_code") return;

    let cancelled = false;
    setPreparing(true);
    setSubmitError(null);
    setInfo(null);
    void (async () => {
      try {
        const { error } = await signIn.mfa.sendPhoneCode();
        if (cancelled) return;
        if (error) {
          setSubmitError(
            error.message ??
              "We couldn't send the SMS code. Try again in a moment.",
          );
          return;
        }
        setInfo("We just texted you a code.");
      } catch (err) {
        if (cancelled) return;
        setSubmitError(
          err instanceof Error
            ? err.message
            : "We couldn't send the SMS code. Try again.",
        );
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, signIn, strategy]);

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
      // Pick the right verify call for the chosen strategy. The Future
      // API resolves with `{ error }` rather than throwing, so we
      // surface that as the user-visible error string.
      const { error } =
        strategy === "totp"
          ? await signIn.mfa.verifyTOTP({ code: trimmed })
          : strategy === "phone_code"
            ? await signIn.mfa.verifyPhoneCode({ code: trimmed })
            : await signIn.mfa.verifyBackupCode({ code: trimmed });

      if (error) {
        setSubmitError(
          error.message ??
            "That code didn't work. Double-check and try again.",
        );
        return;
      }

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
      setSubmitError(
        err instanceof Error
          ? err.message
          : "That code didn't work. Double-check and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [signIn, code, strategy, router]);

  const copy = STRATEGY_COPY[strategy];
  const disabled = submitting || preparing || code.trim().length === 0;

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
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>
          </View>

          {supported.length > 1 && (
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
                        : "Backup code"}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.label}>Code</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder={copy.placeholder}
            placeholderTextColor={BRAND.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={strategy === "backup_code" ? "default" : "number-pad"}
            editable={!submitting && !preparing}
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
          />

          {info && !submitError && (
            <Text style={styles.info}>{info}</Text>
          )}
          {submitError && <Text style={styles.errorText}>{submitError}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.submit,
              disabled && { opacity: 0.5 },
              pressed && !disabled && { opacity: 0.85 },
            ]}
            onPress={handleSubmit}
            disabled={disabled}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Verify and sign in</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.replace("/sign-in")}
            style={styles.backRow}
            accessibilityRole="button"
          >
            <Text style={styles.backText}>Back to sign in</Text>
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
  tabTextActive: {
    color: "#fff",
  },
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
    paddingVertical: 12,
    fontFamily: "Inter_500Medium",
    color: BRAND.fg,
    fontSize: 16,
    backgroundColor: "#fff",
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
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
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
