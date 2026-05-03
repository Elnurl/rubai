import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AtlasLogo } from "@/components/AtlasLogo";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import { TIER_INFO, type SubscriptionTier } from "@/types/atlas";

// Local-only visual toggles for sync/privacy features that don't have a
// backend yet. They persist in component state for this session — when the
// real services land, swap them onto `account` fields the same way Smart
// Nudges already wires to `account.notificationsEnabled`.
type LocalPrefs = {
  realtimeSync: boolean;
  privacyShield: boolean;
};

const APP_VERSION = "rubai v2.4.0-stable";
const APP_TAGLINE = "Evolving with you since 2023";

export default function AccountScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomTab = isWeb ? 100 : 110;

  const {
    tier,
    goals,
    goalLimit,
    account,
    activeBehavioral,
    syncStatus,
    syncMessage,
    updateAccount,
    resetAll,
    signOut,
    dismissSyncMessage,
  } = useAtlas();
  const { user } = useUser();

  const [localPrefs, setLocalPrefs] = useState<LocalPrefs>({
    realtimeSync: true,
    privacyShield: false,
  });

  const tierInfo =
    TIER_INFO[(tier as SubscriptionTier) in TIER_INFO ? (tier as SubscriptionTier) : "free"];
  const accountEmail = user?.primaryEmailAddress?.emailAddress ?? "Signed in";
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    accountEmail.split("@")[0] ||
    "Your account";
  const initials =
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") ||
    fullName.slice(0, 2);
  const avatarUrl = user?.imageUrl ?? null;
  const streakDays = activeBehavioral.currentStreakDays;

  const syncSubtitle =
    syncStatus === "error"
      ? "Sync error — tap to retry"
      : syncStatus === "syncing"
        ? "Syncing now…"
        : syncMessage
          ? syncMessage
          : "Last synced just now";

  const comingSoon = (label: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.alert(`${label} is on the way. We're building it for the next release.`);
      }
      return;
    }
    Alert.alert(`${label} — coming soon`, "We're building this for the next release.", [
      { text: "OK" },
    ]);
  };

  const onReset = () => {
    const doReset = async () => {
      await resetAll();
      router.replace("/welcome");
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Erase ALL goals, history and progress?")) {
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

  const onSignOut = () => {
    const doSignOut = async () => {
      await signOut();
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Sign out of rubai?")) {
        void doSignOut();
      }
    } else {
      Alert.alert("Sign out?", "You can sign back in any time.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", onPress: doSignOut },
      ]);
    }
  };

  const onKnowledgeBase = () => {
    const url = "https://rubai.app/help";
    Linking.openURL(url).catch(() => comingSoon("Knowledge Base & Support"));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomTab },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — matches Today/Coach: AtlasLogo on left, centered title */}
        <View style={styles.headerRow}>
          <AtlasLogo size="sm" />
          <Text
            style={[
              styles.headerTitle,
              { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            System & Sync
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {syncMessage ? (
          <Pressable
            onPress={dismissSyncMessage}
            style={[
              styles.syncBanner,
              {
                backgroundColor:
                  syncStatus === "error"
                    ? colors.destructive + "14"
                    : colors.primary + "14",
                borderColor:
                  syncStatus === "error" ? colors.destructive : colors.primary,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather
              name={syncStatus === "error" ? "alert-circle" : "cloud"}
              size={14}
              color={syncStatus === "error" ? colors.destructive : colors.primary}
            />
            <Text
              style={[
                styles.syncBannerText,
                {
                  color:
                    syncStatus === "error" ? colors.destructive : colors.primary,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {syncMessage}
            </Text>
          </Pressable>
        ) : null}

        {/* Profile card */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              <Text
                style={{
                  color: colors.primaryForeground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 18,
                  textTransform: "uppercase",
                }}
              >
                {initials.slice(0, 2)}
              </Text>
            </View>
          )}
          <View style={styles.profileBody}>
            <Text
              numberOfLines={1}
              style={[
                styles.profileName,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              {fullName}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.profileEmail,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {accountEmail}
            </Text>
            <View
              style={[
                styles.streakChip,
                {
                  backgroundColor: colors.primary + "1A",
                  borderColor: colors.primary + "40",
                },
              ]}
            >
              <Feather name="zap" size={11} color={colors.primary} />
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 11.5,
                  letterSpacing: 0.2,
                }}
              >
                {streakDays} Day Growth Streak
              </Text>
            </View>
          </View>
        </View>

        {/* CLOUD & DEVICES */}
        <SettingsGroup label="CLOUD & DEVICES">
          <SettingsRow
            icon="refresh-cw"
            title="Real-time Sync"
            subtitle={syncSubtitle}
            trailing={
              <Switch
                value={localPrefs.realtimeSync}
                onValueChange={(v) =>
                  setLocalPrefs((p) => ({ ...p, realtimeSync: v }))
                }
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.primaryForeground}
              />
            }
          />
          <Divider />
          <SettingsRow
            icon="smartphone"
            title="Connected Devices"
            subtitle="iPhone, Web"
            chevron
            onPress={() => comingSoon("Connected Devices")}
          />
          <Divider />
          <SettingsRow
            icon="cloud"
            title="Coach Memory Backup"
            subtitle="Securely encrypted in rubai Cloud"
            chevron
            onPress={() => comingSoon("Coach Memory Backup")}
          />
        </SettingsGroup>

        {/* ADAPTIVE PREFERENCES */}
        <SettingsGroup label="ADAPTIVE PREFERENCES">
          <SettingsRow
            icon="bell"
            title="Smart Nudges"
            subtitle={`AI-timed behavioral reminders at ${account.reminderTime}`}
            trailing={
              <Switch
                value={account.notificationsEnabled}
                onValueChange={(v) => void updateAccount({ notificationsEnabled: v })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.primaryForeground}
              />
            }
          />
          <Divider />
          <SettingsRow
            icon="activity"
            title="Behavioral Insights"
            subtitle="Focus intensity, peak hours, and rhythm trends"
            chevron
            onPress={() => router.push("/behavioral-insights")}
          />
          <Divider />
          <SettingsRow
            icon="message-circle"
            title="Coach Persona"
            subtitle="Empathetic & Direct"
            chevron
            onPress={() => comingSoon("Coach Persona")}
          />
          <Divider />
          <SettingsRow
            icon="moon"
            title="Appearance"
            subtitle="Soft Organic (System)"
            chevron
            onPress={() => comingSoon("Appearance")}
          />
        </SettingsGroup>

        {/* DATA SOVEREIGNTY */}
        <SettingsGroup label="DATA SOVEREIGNTY">
          <SettingsRow
            icon="shield"
            title="Privacy Shield"
            subtitle={localPrefs.privacyShield ? "Biometric lock enabled" : "Biometric lock off"}
            trailing={
              <Switch
                value={localPrefs.privacyShield}
                onValueChange={(v) => {
                  setLocalPrefs((p) => ({ ...p, privacyShield: v }));
                  if (v) comingSoon("Privacy Shield");
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.primaryForeground}
              />
            }
          />
          <Divider />
          <SettingsRow
            icon="download"
            title="Export My Patterns"
            subtitle="Download CSV/JSON data"
            chevron
            onPress={() => comingSoon("Export My Patterns")}
          />
          <Divider />
          <SettingsRow
            icon="award"
            title="Manage Plan"
            subtitle={`${tierInfo.label} • ${goals.length}/${goalLimit} goals`}
            chevron
            onPress={() => router.push("/plans")}
          />
          <Divider />
          <SettingsRow
            icon="trash-2"
            title="Reset All Data"
            subtitle="Erase every goal, roadmap, and reflection"
            chevron
            destructive
            onPress={onReset}
          />
        </SettingsGroup>

        {/* Knowledge Base button */}
        <Pressable
          onPress={onKnowledgeBase}
          style={({ pressed }) => [
            styles.kbButton,
            {
              borderColor: colors.border,
              borderRadius: colors.radius,
              backgroundColor: colors.card,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="book-open" size={15} color={colors.foreground} />
          <Text
            style={[
              styles.kbText,
              { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            Knowledge Base & Support
          </Text>
        </Pressable>

        {/* Sign Out link */}
        <Pressable
          onPress={onSignOut}
          style={({ pressed }) => [
            styles.signOutLink,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text
            style={[
              styles.signOutText,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_500Medium",
              },
            ]}
          >
            Sign Out of rubai
          </Text>
        </Pressable>

        {/* Version footer */}
        <View style={styles.footer}>
          <Text
            style={[
              styles.footerVersion,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_600SemiBold",
              },
            ]}
          >
            {APP_VERSION}
          </Text>
          <Text
            style={[
              styles.footerTagline,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
              },
            ]}
          >
            {APP_TAGLINE}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Settings building blocks                                                  */
/* -------------------------------------------------------------------------- */

function SettingsGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.group}>
      <Text
        style={[
          styles.groupLabel,
          { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.groupCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function Divider() {
  const colors = useColors();
  return (
    <View
      style={[
        styles.divider,
        { backgroundColor: colors.border },
      ]}
    />
  );
}

type SettingsRowProps = {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  destructive?: boolean;
};

function SettingsRow({
  icon,
  title,
  subtitle,
  trailing,
  chevron,
  onPress,
  destructive,
}: SettingsRowProps) {
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
      <View style={styles.rowBody}>
        <Text
          numberOfLines={1}
          style={[
            styles.rowTitle,
            { color: titleColor, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            numberOfLines={1}
            style={[
              styles.rowSubtitle,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
              },
            ]}
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

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 22,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 48,
  },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  syncBannerText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderWidth: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  profileBody: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 17,
    letterSpacing: -0.3,
  },
  profileEmail: {
    fontSize: 12.5,
  },
  streakChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 4,
  },
  group: {
    gap: 10,
  },
  groupLabel: {
    fontSize: 10.5,
    letterSpacing: 1.6,
    paddingHorizontal: 4,
  },
  groupCard: {
    borderWidth: 1,
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
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
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14.5,
    letterSpacing: -0.1,
  },
  rowSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  kbButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1,
  },
  kbText: {
    fontSize: 13.5,
    letterSpacing: 0.2,
  },
  signOutLink: {
    alignItems: "center",
    paddingVertical: 6,
  },
  signOutText: {
    fontSize: 13,
    letterSpacing: 0.3,
  },
  footer: {
    alignItems: "center",
    gap: 4,
    paddingTop: 8,
    paddingBottom: 4,
  },
  footerVersion: {
    fontSize: 11.5,
    letterSpacing: 0.4,
  },
  footerTagline: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
