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
  const { account, updateAccount, syncStatus, syncMessage } = useAtlas();

  const comingSoon = (label: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.alert(`${label} is on the way.`);
      }
      return;
    }
    Alert.alert(`${label} — coming soon`, "We're building this for the next release.");
  };

  const cyclePersona = () => {
    const idx = PERSONAS.indexOf(account.coachPersona);
    const next = PERSONAS[(idx + 1) % PERSONAS.length];
    void updateAccount({ coachPersona: next });
  };

  const syncSubtitle =
    syncStatus === "error"
      ? "Sync error — tap to retry"
      : syncStatus === "syncing"
        ? "Syncing now…"
        : syncMessage ?? "Last synced just now";

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
        <SubHeader title="Settings" onBack={() => router.back()} />

        <Group>
          <Row
            icon="refresh-cw"
            title="Real-time Sync"
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
            title="Connected Devices"
            subtitle="iPhone, Web"
            chevron
            onPress={() => comingSoon("Connected Devices")}
          />
          <Divider />
          <Row
            icon="cloud"
            title="Coach Memory"
            subtitle="Securely backed up to rubai Cloud"
            chevron
            onPress={() => comingSoon("Coach Memory")}
          />
          <Divider />
          <Row
            icon="bell"
            title="Smart Nudges"
            subtitle={`AI-timed reminders at ${account.reminderTime}`}
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
            title="Coach Persona"
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
