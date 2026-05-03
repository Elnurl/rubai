import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import { AskCoachPill } from "@/components/AskCoachPill";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import { TIER_INFO, type SubscriptionTier } from "@/types/atlas";

const APP_VERSION = "rubai · v1.0 · designed for execution";

export default function AccountScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomTab = isWeb ? 100 : 110;
  const systemScheme = useColorScheme();

  const {
    tier,
    account,
    activeBehavioral,
    syncStatus,
    syncMessage,
    updateAccount,
    signOut,
    dismissSyncMessage,
  } = useAtlas();
  const { user } = useUser();

  const tierKey = (tier as SubscriptionTier) in TIER_INFO ? (tier as SubscriptionTier) : "free";
  const tierInfo = TIER_INFO[tierKey];

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

  // Effective scheme for the appearance toggle subtitle
  const effectiveScheme =
    account.themeOverride === "system"
      ? systemScheme ?? "light"
      : account.themeOverride;
  const isDark = effectiveScheme === "dark";

  const onAppearanceToggle = (nextDark: boolean) => {
    // Tapping the toggle always sets a manual override (light/dark). Long
    // press / tap-and-hold path is a stretch goal; users can return to system
    // by tapping the row label below.
    void updateAccount({ themeOverride: nextDark ? "dark" : "light" });
  };

  const onAppearanceLongPress = () => {
    void updateAccount({ themeOverride: "system" });
    if (Platform.OS !== "web") {
      Alert.alert("Appearance", "Following system setting.");
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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomTab },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — same pattern as Today/Coach */}
        <View style={styles.headerRow}>
          <AskCoachPill />
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

        {/* Compact identity strip (avatar + name + streak chip) */}
        <View
          style={[
            styles.identityStrip,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.identityAvatar} />
          ) : (
            <View
              style={[
                styles.identityAvatar,
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
                  fontSize: 14,
                  textTransform: "uppercase",
                }}
              >
                {initials.slice(0, 2)}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.foreground,
                fontFamily: "Inter_700Bold",
                fontSize: 15,
                letterSpacing: -0.2,
              }}
            >
              {fullName}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 11.5,
                marginTop: 2,
              }}
            >
              {accountEmail}
            </Text>
          </View>
          <View
            style={[
              styles.streakChip,
              {
                backgroundColor: colors.primary + "1A",
                borderColor: colors.primary + "40",
              },
            ]}
          >
            <Feather name="zap" size={10} color={colors.primary} />
            <Text
              style={{
                color: colors.primary,
                fontFamily: "Inter_600SemiBold",
                fontSize: 10.5,
                letterSpacing: 0.2,
              }}
            >
              {streakDays}d streak
            </Text>
          </View>
        </View>

        {/* Top navigation card — Profile / Behavioral memory / Settings / Privacy */}
        <Group>
          <NavRow
            icon="user"
            title="Profile"
            subtitle="Name, avatar, language"
            onPress={() => router.push("/account/profile")}
          />
          <Divider />
          <NavRow
            icon="zap"
            title="Behavioral memory"
            subtitle="What rubai remembers about you"
            onPress={() => router.push("/behavioral-insights")}
          />
          <Divider />
          <NavRow
            icon="settings"
            title="Settings"
            subtitle="Sync, devices, persona, nudges"
            onPress={() => router.push("/account/settings")}
          />
          <Divider />
          <NavRow
            icon="shield"
            title="Privacy & data"
            subtitle="Control what's stored"
            onPress={() => router.push("/account/privacy")}
          />
          <Divider />
          <NavRow
            icon="file-text"
            title="Legal"
            subtitle="Privacy Policy & Terms of Service"
            onPress={() => router.push("/legal/document?type=privacy_policy")}
          />
        </Group>

        {/* EXPERIENCE */}
        <SectionLabel>EXPERIENCE</SectionLabel>
        <Group>
          <Pressable
            onLongPress={onAppearanceLongPress}
            android_ripple={{ color: colors.muted }}
            style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
          >
            <View style={styles.row}>
              <View
                style={[styles.rowIcon, { backgroundColor: colors.primary + "14" }]}
              >
                <Feather
                  name={isDark ? "moon" : "sun"}
                  size={15}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14.5,
                  }}
                >
                  Appearance
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                  }}
                >
                  {account.themeOverride === "system"
                    ? `System (${isDark ? "Dark" : "Light"})`
                    : isDark
                      ? "Dark"
                      : "Light"}
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={onAppearanceToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.primaryForeground}
              />
            </View>
          </Pressable>
          <Divider />
          <NavRow
            icon="bell"
            title="Notifications"
            subtitle="Smart timing for nudges"
            onPress={() => router.push("/account/notifications")}
          />
          <Divider />
          <NavRow
            icon="calendar"
            title="Calendar sync"
            subtitle={
              account.calendarSync.enabled && account.calendarSync.calendarTitle
                ? `On · ${account.calendarSync.calendarTitle}`
                : account.calendarSync.enabled
                  ? "On · pick a calendar"
                  : "Off"
            }
            onPress={() => router.push("/account/calendar")}
          />
          <Divider />
          <NavRow
            icon="credit-card"
            title="Subscription"
            subtitle={`${tierInfo.label} · ${tierInfo.price}`}
            onPress={() => router.push("/plans")}
          />
        </Group>

        {/* SESSION */}
        <SectionLabel>SESSION</SectionLabel>
        <Group>
          <NavRow
            icon="log-out"
            title="Sign out"
            onPress={onSignOut}
          />
        </Group>

        {/* Footer */}
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 11.5,
            textAlign: "center",
            paddingTop: 14,
            paddingBottom: 4,
            letterSpacing: 0.2,
          }}
        >
          {APP_VERSION}
        </Text>
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Building blocks                                                            */
/* -------------------------------------------------------------------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text
      style={{
        color: colors.primary,
        fontFamily: "Inter_600SemiBold",
        fontSize: 11,
        letterSpacing: 1.8,
        paddingHorizontal: 4,
        marginTop: 4,
      }}
    >
      {children}
    </Text>
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

function NavRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.muted }}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.row}>
        <View
          style={[styles.rowIcon, { backgroundColor: colors.primary + "14" }]}
        >
          <Feather name={icon} size={15} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors.foreground,
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
        <Feather
          name="chevron-right"
          size={18}
          color={colors.mutedForeground}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 22,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 4,
  },
  headerSpacer: { flex: 1 },
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
  identityStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
  },
  identityAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
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
