import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";

const PERSONAS = [
  "Empathetic & Direct",
  "Strict & Tactical",
  "Playful & Curious",
  "Analytical & Calm",
];

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { account, updateAccount, syncStatus, syncMessage, activeCoachMemory } = useAtlas();

  const comingSoon = (label: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.alert(t("settings.comingSoonWeb", "{{label}} is on the way.", { label }));
      }
      return;
    }
    Alert.alert(t("settings.comingSoonTitle", "{{label}} — coming soon", { label }), t("settings.comingSoonBody", "We're building this for the next release."));
  };

  const cyclePersona = () => {
    const idx = PERSONAS.indexOf(account.coachPersona);
    const next = PERSONAS[(idx + 1) % PERSONAS.length];
    void updateAccount({ coachPersona: next });
  };

  const syncSubtitle =
    syncStatus === "error"
      ? t("settings.syncError", "Sync error — tap to retry")
      : syncStatus === "syncing"
        ? t("settings.syncing", "Syncing now…")
        : syncMessage ?? t("settings.syncedJustNow", "Last synced just now");

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 40,
          paddingHorizontal: 22,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        <SubHeader title={t("settings.headerTitle", "Settings")} onBack={() => router.back()} />

        <Group>
          <Row
            icon="refresh-cw"
            title={t("settings.realtimeSync", "Real-time Sync")}
            subtitle={syncSubtitle}
            trailing={
              <Switch
                value={account.realtimeSync}
                onValueChange={(v) => void updateAccount({ realtimeSync: v })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.primaryForeground}
              />
            }
          />
          <Divider />
          <Row
            icon="smartphone"
            title={t("settings.connectedDevices", "Connected Devices")}
            subtitle={t("settings.connectedDevicesSubtitle", "iPhone, Web")}
            chevron
            onPress={() => comingSoon(t("settings.connectedDevices", "Connected Devices"))}
          />
          <Divider />
          <Row
            icon="cloud"
            title={t("settings.coachMemory", "Coach Memory")}
            subtitle={
              activeCoachMemory
                ? activeCoachMemory.facts.length === 1
                  ? t("settings.factRemembered", "{{count}} fact remembered", { count: activeCoachMemory.facts.length })
                  : t("settings.factsRemembered", "{{count}} facts remembered", { count: activeCoachMemory.facts.length })
                : t("settings.noMemoryYet", "No memory yet")
            }
            chevron
            onPress={() => router.push("/account/coach-memory")}
          />
          <Divider />
          <Row
            icon="bell"
            title={t("settings.smartNudges", "Smart Nudges")}
            subtitle={t("settings.smartNudgesSubtitle", "AI-timed reminders at {{time}}", { time: account.reminderTime })}
            trailing={
              <Switch
                value={account.notificationsEnabled}
                onValueChange={(v) =>
                  void updateAccount({ notificationsEnabled: v })
                }
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.primaryForeground}
              />
            }
          />
          <Divider />
          <Row
            icon="message-circle"
            title={t("settings.coachPersona", "Coach Persona")}
            subtitle={account.coachPersona}
            chevron
            onPress={cyclePersona}
          />
        </Group>
      </ScrollView>
    </View>
  );
}

/* ---------- shared blocks (kept inline so each sub-screen is self-contained) */

function SubHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.headerRow}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
      >
        <Feather name="chevron-left" size={24} color={colors.foreground} />
      </Pressable>
      <Text
        style={{
          flex: 1,
          textAlign: "center",
          color: colors.foreground,
          fontFamily: "Inter_600SemiBold",
          fontSize: 16,
          letterSpacing: -0.2,
          marginRight: 24,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderRadius: colors.radius,
        borderWidth: 1,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

function Divider() {
  const colors = useColors();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginLeft: 62,
      }}
    />
  );
}

type RowProps = {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  destructive?: boolean;
};

function Row({
  icon,
  title,
  subtitle,
  trailing,
  chevron,
  onPress,
  destructive,
}: RowProps) {
  const colors = useColors();
  const titleColor = destructive ? colors.destructive : colors.foreground;
  const iconBg = destructive
    ? colors.destructive + "1A"
    : colors.primary + "14";
  const iconColor = destructive ? colors.destructive : colors.primary;

  const Inner = (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={15} color={iconColor} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            color: titleColor,
            fontFamily: "Inter_600SemiBold",
            fontSize: 14.5,
            letterSpacing: -0.1,
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            numberOfLines={1}
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              lineHeight: 16,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {trailing
        ? trailing
        : chevron && (
            <Feather
              name="chevron-right"
              size={18}
              color={colors.mutedForeground}
            />
          )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{ color: colors.muted }}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
      >
        {Inner}
      </Pressable>
    );
  }
  return Inner;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 64,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
