import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLegalGetDocument } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { useLegalLocale } from "@/hooks/useLegalLocale";
import {
  LEGAL_LOCALES,
  LEGAL_UI,
  RTL_LOCALES,
  isLegalLocaleCode,
  type LegalLocaleCode,
} from "@/lib/legalUi";

type DocType = "privacy_policy" | "terms_of_service";

function isDocType(v: string | undefined): v is DocType {
  return v === "privacy_policy" || v === "terms_of_service";
}

export default function LegalDocumentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string; locale?: string }>();

  const type: DocType = isDocType(params.type) ? params.type : "privacy_policy";
  const { locale: storedLocale, setLocale } = useLegalLocale();
  const initialLocale: LegalLocaleCode =
    typeof params.locale === "string" && isLegalLocaleCode(params.locale)
      ? params.locale
      : storedLocale;

  // Use stored locale as the source of truth; param only seeds the screen.
  const locale = isLegalLocaleCode(storedLocale) ? storedLocale : initialLocale;
  const ui = LEGAL_UI[locale];
  const isRtl = RTL_LOCALES.includes(locale);

  const { data, isLoading, isError, refetch } = useLegalGetDocument({
    type,
    locale,
  });

  const headerTitle = useMemo(
    () => (type === "privacy_policy" ? ui.privacyTitle : ui.termsTitle),
    [type, ui],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.headerRow,
          {
            paddingTop: insets.top + 8,
            flexDirection: isRtl ? "row-reverse" : "row",
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather
            name={isRtl ? "chevron-right" : "chevron-left"}
            size={24}
            color={colors.foreground}
          />
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: "center",
            color: colors.foreground,
            fontFamily: "Inter_600SemiBold",
            fontSize: 16,
            letterSpacing: -0.2,
            marginHorizontal: 12,
          }}
        >
          {headerTitle}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingBottom: insets.bottom + 32,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
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
                    fontSize: 12,
                  }}
                >
                  {l.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : isError || !data ? (
          <View style={{ gap: 12, alignItems: "center", paddingTop: 32 }}>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 14,
              }}
            >
              {ui.errorBody}
            </Text>
            <Pressable
              onPress={() => refetch()}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: "Inter_500Medium",
                  fontSize: 13.5,
                }}
              >
                {ui.retry}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text
              style={{
                color: colors.foreground,
                fontFamily: "Inter_700Bold",
                fontSize: 22,
                letterSpacing: -0.3,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {data.title}
            </Text>
            {data.authoritativeNotice && (
              <View
                style={{
                  backgroundColor: colors.muted,
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    lineHeight: 17,
                    textAlign: isRtl ? "right" : "left",
                  }}
                >
                  {data.authoritativeNotice}
                </Text>
              </View>
            )}
            <Text
              style={{
                color: colors.foreground,
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                lineHeight: 22,
                textAlign: isRtl ? "right" : "left",
                writingDirection: isRtl ? "rtl" : "ltr",
              }}
              selectable
            >
              {data.body}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    alignItems: "center",
    paddingHorizontal: 22,
    paddingBottom: 12,
  },
  langChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  langChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
});
