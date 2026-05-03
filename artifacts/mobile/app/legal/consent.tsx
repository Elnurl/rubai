import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getLegalMyAcceptancesQueryKey,
  useLegalAccept,
  useLegalCurrentVersions,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { useLegalLocale } from "@/hooks/useLegalLocale";
import {
  LEGAL_LOCALES,
  LEGAL_UI,
  RTL_LOCALES,
  type LegalLocaleCode,
} from "@/lib/legalUi";

export default function LegalConsentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromUpdate = params.from === "update";

  const { locale, setLocale, hydrated } = useLegalLocale();
  const ui = LEGAL_UI[locale];
  const isRtl = RTL_LOCALES.includes(locale);

  const { data: current, isLoading: currentLoading } = useLegalCurrentVersions();
  const acceptMutation = useLegalAccept();

  const [agreed, setAgreed] = useState(false);

  const versions = useMemo(() => {
    const map: Record<string, string> = {};
    current?.documents.forEach((d) => {
      map[d.type] = d.version;
    });
    return map;
  }, [current]);

  const canSubmit =
    hydrated &&
    !!current &&
    agreed &&
    !!versions.privacy_policy &&
    !!versions.terms_of_service &&
    !acceptMutation.isPending;

  const onContinue = async () => {
    if (!canSubmit) return;
    try {
      await acceptMutation.mutateAsync({
        data: {
          locale,
          documents: [
            { type: "privacy_policy", version: versions.privacy_policy! },
            { type: "terms_of_service", version: versions.terms_of_service! },
          ],
        },
      });
      // Bust the /legal/me cache so AuthGate re-evaluates immediately.
      await queryClient.invalidateQueries({
        queryKey: getLegalMyAcceptancesQueryKey(),
      });
      // Navigate forward — AuthGate will route correctly from "/" based on
      // whether the user already has goals.
      router.replace("/");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(`${ui.errorTitle}\n\n${ui.errorBody}\n\n${message}`);
      } else {
        Alert.alert(ui.errorTitle, `${ui.errorBody}\n\n${message}`);
      }
    }
  };

  const onOpenDoc = (type: "privacy_policy" | "terms_of_service") => {
    router.push({
      pathname: "/legal/document",
      params: { type, locale },
    });
  };

  const onSignOut = async () => {
    try {
      await signOut();
    } catch {
      /* ignore */
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 22,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Language selector — top of screen so users see their language
            choice before reading anything. */}
        <View style={styles.langRow}>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_500Medium",
              fontSize: 11,
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            {ui.languageLabel}
          </Text>
          <View style={styles.langChips}>
            {LEGAL_LOCALES.map((l) => {
              const active = l.code === locale;
              return (
                <Pressable
                  key={l.code}
                  onPress={() => setLocale(l.code as LegalLocaleCode)}
                  style={({ pressed }) => [
                    styles.langChip,
                    {
                      backgroundColor: active ? colors.primary : "transparent",
                      borderColor: active ? colors.primary : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active
                        ? colors.primaryForeground
                        : colors.foreground,
                      fontFamily: "Inter_500Medium",
                      fontSize: 12.5,
                    }}
                  >
                    {l.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text
            style={{
              color: colors.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 24,
              letterSpacing: -0.4,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {ui.consentTitle}
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 14.5,
              lineHeight: 21,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {ui.consentSubtitle}
          </Text>
          {fromUpdate && (
            <Text
              style={{
                color: colors.primary,
                fontFamily: "Inter_500Medium",
                fontSize: 12.5,
                marginTop: 4,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {ui.reAcceptNotice}
            </Text>
          )}
        </View>

        {currentLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: colors.radius,
              overflow: "hidden",
            }}
          >
            <DocLink
              icon="shield"
              label={ui.privacyLabel}
              cta={ui.readPrivacy}
              version={versions.privacy_policy}
              onPress={() => onOpenDoc("privacy_policy")}
              isRtl={isRtl}
            />
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: colors.border,
              }}
            />
            <DocLink
              icon="file-text"
              label={ui.termsLabel}
              cta={ui.readTerms}
              version={versions.terms_of_service}
              onPress={() => onOpenDoc("terms_of_service")}
              isRtl={isRtl}
            />
          </View>
        )}

        <Pressable
          onPress={() => setAgreed((v) => !v)}
          style={({ pressed }) => [
            styles.agreeRow,
            {
              borderColor: agreed ? colors.primary : colors.border,
              backgroundColor: agreed
                ? colors.primary + "12"
                : colors.card,
              opacity: pressed ? 0.9 : 1,
              flexDirection: isRtl ? "row-reverse" : "row",
            },
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: agreed ? colors.primary : colors.border,
                backgroundColor: agreed ? colors.primary : "transparent",
              },
            ]}
          >
            {agreed && (
              <Feather
                name="check"
                size={14}
                color={colors.primaryForeground}
              />
            )}
          </View>
          <Text
            style={{
              flex: 1,
              color: colors.foreground,
              fontFamily: "Inter_500Medium",
              fontSize: 13.5,
              lineHeight: 19,
              textAlign: isRtl ? "right" : "left",
            }}
          >
            {ui.agreeBoth}
          </Text>
        </Pressable>

        <Pressable
          onPress={onContinue}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.continueBtn,
            {
              backgroundColor: canSubmit
                ? colors.primary
                : colors.muted,
              opacity: pressed && canSubmit ? 0.9 : 1,
            },
          ]}
        >
          {acceptMutation.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text
              style={{
                color: canSubmit
                  ? colors.primaryForeground
                  : colors.mutedForeground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
              }}
            >
              {ui.continue}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={onSignOut}
          hitSlop={12}
          style={({ pressed }) => [
            { alignSelf: "center", padding: 8, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              textDecorationLine: "underline",
            }}
          >
            {ui.signOut}
          </Text>
        </Pressable>
      </ScrollView>
      {I18nManager.isRTL !== isRtl && Platform.OS === "web" ? null : null}
    </View>
  );
}

function DocLink({
  icon,
  label,
  cta,
  version,
  onPress,
  isRtl,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  cta: string;
  version?: string;
  onPress: () => void;
  isRtl: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.muted }}
      style={({ pressed }) => [
        styles.docRow,
        {
          opacity: pressed ? 0.85 : 1,
          flexDirection: isRtl ? "row-reverse" : "row",
        },
      ]}
    >
      <View
        style={[
          styles.docIcon,
          { backgroundColor: colors.primary + "14" },
        ]}
      >
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            color: colors.foreground,
            fontFamily: "Inter_600SemiBold",
            fontSize: 14.5,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {label}
          {version ? ` · v${version}` : ""}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: colors.primary,
            fontFamily: "Inter_500Medium",
            fontSize: 12.5,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {cta}
        </Text>
      </View>
      <Feather
        name={isRtl ? "chevron-left" : "chevron-right"}
        size={18}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  langRow: { gap: 8 },
  langChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  docRow: {
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 64,
  },
  docIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  agreeRow: {
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  continueBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    minHeight: 52,
  },
});
