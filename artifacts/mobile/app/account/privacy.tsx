import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";

export default function PrivacyScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    account,
    updateAccount,
    resetAll,
    goals,
    activeTaskHistory,
    activeReflections,
    activeBehavioralProfile,
  } = useAtlas();

  const onExport = async () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      goalCount: goals.length,
      activeGoals: goals.map((g) => ({
        id: g.id,
        title: g.profile.customGoalTitle ?? g.profile.goalStatement,
        type: g.profile.goalType,
      })),
      taskHistory: activeTaskHistory,
      reflections: activeReflections,
      behavioralProfile: activeBehavioralProfile,
    };
    const json = JSON.stringify(payload, null, 2);
    if (Platform.OS === "web") {
      try {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `rubai-patterns-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        if (typeof window !== "undefined") window.alert("Export failed.");
      }
      return;
    }
    try {
      await Share.share({
        message: json,
        title: "rubai patterns export",
      });
    } catch {
      Alert.alert("Export failed", "Please try again.");
    }
  };

  const onReset = () => {
    const doReset = async () => {
      await resetAll();
      router.replace("/welcome");
    };
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm("Erase ALL goals, history and progress?")
      ) {
        void doReset();
      }
    } else {
      Alert.alert(
        "Reset everything?",
        "This permanently deletes every goal, roadmap, history entry and preference.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Reset", style: "destructive", onPress: doReset },
        ],
      );
    }
  };

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
        <SubHeader title="Privacy & data" onBack={() => router.back()} />

        <Group>
          <Row
            icon="shield"
            title="Privacy Shield"
            subtitle={
              account.privacyShield
                ? "Biometric lock enabled"
                : "Biometric lock off"
            }
            trailing={
              <Switch
                value={account.privacyShield}
                onValueChange={(v) => {
                  void updateAccount({ privacyShield: v });
                  if (v && Platform.OS !== "web") {
                    Alert.alert(
                      "Privacy Shield",
                      "Biometric lock will activate the next time you open rubai.",
                    );
                  }
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.primaryForeground}
              />
            }
          />
          <Divider />
          <Row
            icon="download"
            title="Export My Patterns"
            subtitle="Download your data as JSON"
            chevron
            onPress={onExport}
          />
          <Divider />
          <Row
            icon="trash-2"
            title="Reset All Data"
            subtitle="Erase every goal, roadmap, and reflection"
            chevron
            destructive
            onPress={onReset}
          />
        </Group>
      </ScrollView>
    </View>
  );
}

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

function Row({
  icon,
  title,
  subtitle,
  trailing,
  chevron,
  onPress,
  destructive,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  destructive?: boolean;
}) {
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
