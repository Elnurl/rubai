import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import { friendlyAuthError } from "@/lib/authErrors";
import { TIER_INFO, type SubscriptionTier } from "@/types/atlas";
import {
  useGetMeTierHistory,
  type TierTransitionEntry,
} from "@workspace/api-client-react";

const LANGUAGES = [
  "English",
  "Azərbaycan",
  "Español",
  "Português",
  "Deutsch",
  "Français",
];

type EditField = "name" | "email" | "phone" | "password" | null;

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoaded } = useUser();
  const { account, updateAccount, tier, signOut } = useAtlas();
  const systemScheme = useColorScheme();
  const effectiveScheme =
    account.themeOverride === "system"
      ? systemScheme ?? "light"
      : account.themeOverride;
  const isDark = effectiveScheme === "dark";

  const onAppearanceToggle = (nextDark: boolean) => {
    void updateAccount({ themeOverride: nextDark ? "dark" : "light" });
  };
  const onAppearanceLongPress = () => {
    void updateAccount({ themeOverride: "system" });
    if (Platform.OS !== "web") Alert.alert("Appearance", "Following system setting.");
  };
  const onSignOut = () => {
    const doSignOut = async () => { await signOut(); };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Sign out of rubai?")) void doSignOut();
    } else {
      Alert.alert("Sign out?", "You can sign back in any time.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", onPress: doSignOut },
      ]);
    }
  };

  const tierKey =
    (tier as SubscriptionTier) in TIER_INFO ? (tier as SubscriptionTier) : "free";
  const tierInfo = TIER_INFO[tierKey];
  const { data: tierHistoryData, isLoading: tierHistoryLoading } =
    useGetMeTierHistory({ limit: 20 });

  const [field, setField] = useState<EditField>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const email = user?.primaryEmailAddress?.emailAddress ?? "—";
  const phone = user?.primaryPhoneNumber?.phoneNumber ?? "—";
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    (user?.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "Your account");
  const avatarUrl = user?.imageUrl ?? null;
  const initials =
    ((user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")).trim() ||
    fullName.slice(0, 2);

  const cycleLanguage = () => {
    const idx = LANGUAGES.indexOf(account.preferredLanguage);
    const next = LANGUAGES[(idx + 1) % LANGUAGES.length];
    void updateAccount({ preferredLanguage: next });
  };

  // ---- Avatar: action sheet (iOS) / Alert (Android) ----
  const onAvatarPress = useCallback(() => {
    if (!user) return;
    const hasPhoto = !!user.imageUrl && !user.imageUrl.includes("/default");
    const options = hasPhoto
      ? ["Choose from library", "Remove photo", "Cancel"]
      : ["Choose from library", "Cancel"];
    const cancelIdx = options.length - 1;
    const destructiveIdx = hasPhoto ? 1 : -1;

    const handle = (idx: number) => {
      if (idx === 0) void pickAndUpload();
      else if (idx === 1 && hasPhoto) void removeAvatar();
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIdx,
          destructiveButtonIndex: destructiveIdx === -1 ? undefined : destructiveIdx,
        },
        handle,
      );
    } else {
      Alert.alert("Profile photo", undefined, [
        { text: "Choose from library", onPress: () => handle(0) },
        ...(hasPhoto
          ? [{ text: "Remove photo", style: "destructive" as const, onPress: () => handle(1) }]
          : []),
        { text: "Cancel", style: "cancel" as const },
      ]);
    }
  }, [user]);

  const pickAndUpload = useCallback(async () => {
    if (!user) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photos", "Allow photo access to change your picture.");
        return;
      }
      // Set busy BEFORE the picker so the camera badge shows a spinner during
      // the system image-picker + base64 encode pipeline (which can take a
      // noticeable beat for large photos).
      setAvatarBusy(true);
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (res.canceled || !res.assets?.[0]?.base64) return;
      const asset = res.assets[0];
      const mime = asset.mimeType || "image/jpeg";
      const dataUrl = `data:${mime};base64,${asset.base64}`;
      await user.setProfileImage({ file: dataUrl });
    } catch (err) {
      Alert.alert("Couldn't update photo", friendlyAuthError(err));
    } finally {
      setAvatarBusy(false);
    }
  }, [user]);

  const removeAvatar = useCallback(async () => {
    if (!user) return;
    try {
      setAvatarBusy(true);
      await user.setProfileImage({ file: null });
    } catch (err) {
      Alert.alert("Couldn't remove photo", friendlyAuthError(err));
    } finally {
      setAvatarBusy(false);
    }
  }, [user]);

  if (!isLoaded) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 40,
          paddingHorizontal: 22,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        <SubHeader title="Profile" onBack={() => router.back()} />

        {/* Identity card with tappable avatar */}
        <View
          style={[
            styles.identityCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
              marginBottom: 8,
            },
          ]}
        >
          <Pressable
            onPress={onAvatarPress}
            hitSlop={8}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <View>
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
                      fontSize: 26,
                      textTransform: "uppercase",
                    }}
                  >
                    {initials.slice(0, 2)}
                  </Text>
                </View>
              )}
              {/* Camera badge overlay */}
              <View
                style={[
                  styles.cameraBadge,
                  { backgroundColor: colors.primary, borderColor: colors.card },
                ]}
              >
                {avatarBusy ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather name="camera" size={13} color={colors.primaryForeground} />
                )}
              </View>
            </View>
          </Pressable>
          <Text
            numberOfLines={1}
            style={{
              color: colors.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 20,
              letterSpacing: -0.3,
              marginTop: 14,
            }}
          >
            {fullName}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              marginTop: 2,
            }}
          >
            {email}
          </Text>
        </View>

        <EditableRow
          icon="user"
          label="Display Name"
          value={fullName}
          onPress={() => setField("name")}
        />
        <EditableRow
          icon="mail"
          label="Email"
          value={email}
          onPress={() => setField("email")}
        />
        <EditableRow
          icon="phone"
          label="Phone"
          value={phone}
          onPress={() => setField("phone")}
        />
        <Pressable
          onPress={cycleLanguage}
          style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        >
          <DetailRow
            icon="globe"
            label="Language"
            value={account.preferredLanguage}
            colors={colors}
            chevron
          />
        </Pressable>

        <SectionLabel text="SECURITY" />
        <EditableRow
          icon="lock"
          label={user?.passwordEnabled ? "Update password" : "Set password"}
          value={user?.passwordEnabled ? "••••••••" : "Not set"}
          onPress={() => setField("password")}
        />

        {/* ── PREFERENCES ── */}
        <SectionLabel text="PREFERENCES" />
        <SettingsGroup>
          <Pressable
            onLongPress={onAppearanceLongPress}
            android_ripple={{ color: colors.muted }}
            style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
          >
            <View style={pStyles.settingsRow}>
              <View style={[pStyles.settingsIcon, { backgroundColor: colors.primary + "14" }]}>
                <Feather name={isDark ? "moon" : "sun"} size={15} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[pStyles.settingsTitle, { color: colors.foreground }]}>
                  Appearance
                </Text>
                <Text style={[pStyles.settingsSubtitle, { color: colors.mutedForeground }]}>
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
          <SettingsDivider />
          <SettingsNavRow
            icon="bell"
            title="Notifications"
            subtitle="Smart timing for nudges"
            onPress={() => router.push("/account/notifications")}
            colors={colors}
          />
        </SettingsGroup>

        {/* ── ACCOUNT ── */}
        <SectionLabel text="ACCOUNT" />
        <SettingsGroup>
          <SettingsNavRow
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
            colors={colors}
          />
          <SettingsDivider />
          <SettingsNavRow
            icon="zap"
            title="Behavioral memory"
            subtitle="What rubai remembers about you"
            onPress={() => router.push("/behavioral-insights")}
            colors={colors}
          />
          <SettingsDivider />
          <SettingsNavRow
            icon="shield"
            title="Privacy & data"
            subtitle="Control what's stored"
            onPress={() => router.push("/account/privacy")}
            colors={colors}
          />
          <SettingsDivider />
          <SettingsNavRow
            icon="file-text"
            title="Legal"
            subtitle="Privacy Policy & Terms of Service"
            onPress={() => router.push("/legal/document?type=privacy_policy")}
            colors={colors}
          />
        </SettingsGroup>

        {/* ── SUBSCRIPTION ── */}
        <SectionLabel text="SUBSCRIPTION" />
        <SettingsGroup>
          <View style={pStyles.subscriptionHeader}>
            <View style={[pStyles.settingsIcon, { backgroundColor: colors.primary + "14" }]}>
              <Feather name="credit-card" size={15} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[pStyles.settingsTitle, { color: colors.foreground }]}>
                {tierInfo.label} plan
              </Text>
              <Text style={[pStyles.settingsSubtitle, { color: colors.mutedForeground }]}>
                {tierInfo.price} · {tierInfo.tagline}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/plans")}
              style={({ pressed }) => [
                pStyles.manageBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                Manage
              </Text>
            </Pressable>
          </View>

          {/* Subscription history inline */}
          <SettingsDivider />
          <View style={pStyles.historyLabelRow}>
            <Text style={[pStyles.historyLabel, { color: colors.mutedForeground }]}>
              HISTORY
            </Text>
          </View>
          {tierHistoryLoading ? (
            <View style={pStyles.historyPlaceholder}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : !tierHistoryData?.transitions?.length ? (
            <View style={pStyles.historyPlaceholder}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                No subscription changes yet.
              </Text>
            </View>
          ) : (
            tierHistoryData.transitions.map((entry, idx) => (
              <React.Fragment key={entry.id}>
                {idx > 0 && <SettingsDivider />}
                <HistoryRow entry={entry} colors={colors} />
              </React.Fragment>
            ))
          )}
        </SettingsGroup>

        {/* ── SESSION ── */}
        <SectionLabel text="SESSION" />
        <Pressable
          onPress={onSignOut}
          android_ripple={{ color: colors.destructive + "20" }}
          style={({ pressed }) => [
            pStyles.signOutRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={[pStyles.settingsIcon, { backgroundColor: colors.destructive + "14" }]}>
            <Feather name="log-out" size={15} color={colors.destructive} />
          </View>
          <Text style={{ color: colors.destructive, fontFamily: "Inter_600SemiBold", fontSize: 14.5 }}>
            Sign out
          </Text>
        </Pressable>
      </ScrollView>

      {/* Edit modals */}
      <NameModal
        visible={field === "name"}
        onClose={() => setField(null)}
        firstName={user?.firstName ?? ""}
        lastName={user?.lastName ?? ""}
        onSave={async (firstName, lastName) => {
          await user?.update({ firstName, lastName });
        }}
      />
      <VerifyModal
        key={`email-${field === "email"}`}
        visible={field === "email"}
        onClose={() => setField(null)}
        kind="email"
        currentValue={email}
      />
      <VerifyModal
        key={`phone-${field === "phone"}`}
        visible={field === "phone"}
        onClose={() => setField(null)}
        kind="phone"
        currentValue={phone}
      />
      <PasswordModal
        visible={field === "password"}
        onClose={() => setField(null)}
        passwordEnabled={!!user?.passwordEnabled}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Settings group helpers (used by the appended sections)
// ---------------------------------------------------------------------------

function SettingsGroup({ children }: { children: React.ReactNode }) {
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

function SettingsDivider() {
  const colors = useColors();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginLeft: 54,
      }}
    />
  );
}

function SettingsNavRow({
  icon,
  title,
  subtitle,
  onPress,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle?: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.muted }}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={pStyles.settingsRow}>
        <View style={[pStyles.settingsIcon, { backgroundColor: colors.primary + "14" }]}>
          <Feather name={icon} size={15} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[pStyles.settingsTitle, { color: colors.foreground }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[pStyles.settingsSubtitle, { color: colors.mutedForeground }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

const TIER_RANK: Record<string, number> = { free: 0, pro: 1, premium: 2 };
function transitionDir(from: string, to: string) {
  const f = TIER_RANK[from] ?? 0;
  const t = TIER_RANK[to] ?? 0;
  if (t > f) return { label: "Upgraded", icon: "arrow-up-circle" as const, positive: true };
  if (t < f) return { label: "Downgraded", icon: "arrow-down-circle" as const, positive: false };
  return { label: "Changed", icon: "refresh-cw" as const, positive: true };
}
function tierName(t: string): string {
  const k = t as SubscriptionTier;
  return TIER_INFO[k]?.label ?? (t.charAt(0).toUpperCase() + t.slice(1));
}
function historyTrigger(triggeredBy: string, eventType: string | null): string {
  if (triggeredBy === "sync-tier") return "App sync";
  if (!eventType) return "Purchase";
  const m: Record<string, string> = {
    INITIAL_PURCHASE: "Purchase", RENEWAL: "Renewal", CANCELLATION: "Cancelled",
    EXPIRATION: "Expired", BILLING_ISSUE: "Billing issue", PRODUCT_CHANGE: "Plan change",
    TRANSFER: "Transfer", SUBSCRIBER_ALIAS: "Account merge",
  };
  return m[eventType] ?? "Purchase";
}
function historyDate(raw: Date | string): string {
  const d = typeof raw === "string" ? new Date(raw) : raw;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function HistoryRow({
  entry,
  colors,
}: {
  entry: TierTransitionEntry;
  colors: ReturnType<typeof useColors>;
}) {
  const dir = transitionDir(entry.fromTier, entry.toTier);
  const trigger = historyTrigger(entry.triggeredBy, entry.eventType);
  const accent = dir.positive ? colors.primary : colors.destructive;
  return (
    <View style={[pStyles.settingsRow, { minHeight: 52 }]}>
      <View style={[pStyles.settingsIcon, { backgroundColor: accent + "14" }]}>
        <Feather name={dir.icon} size={13} color={accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={[pStyles.settingsTitle, { color: colors.foreground }]}>
          {dir.label} to {tierName(entry.toTier)}
        </Text>
        <Text numberOfLines={1} style={[pStyles.settingsSubtitle, { color: colors.mutedForeground }]}>
          {trigger}{historyDate(entry.createdAt) ? `  ·  ${historyDate(entry.createdAt)}` : ""}
        </Text>
      </View>
      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
        {tierName(entry.fromTier)}{"  →"}
      </Text>
    </View>
  );
}

// Extra styles for the appended settings sections
const pStyles = StyleSheet.create({
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 52,
  },
  settingsIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    letterSpacing: -0.1,
  },
  settingsSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 11.5,
    lineHeight: 15,
  },
  subscriptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  manageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  historyLabelRow: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  historyLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  historyPlaceholder: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  signOutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
  },
});

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
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

function SectionLabel({ text }: { text: string }) {
  const colors = useColors();
  return (
    <Text
      style={{
        color: colors.mutedForeground,
        fontFamily: "Inter_600SemiBold",
        fontSize: 11,
        letterSpacing: 1.1,
        marginTop: 14,
        marginBottom: 2,
        marginLeft: 4,
      }}
    >
      {text}
    </Text>
  );
}

function EditableRow(props: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <DetailRow
        icon={props.icon}
        label={props.label}
        value={props.value}
        colors={colors}
        chevron
      />
    </Pressable>
  );
}

function DetailRow({
  icon,
  label,
  value,
  colors,
  chevron,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  chevron?: boolean;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={[styles.iconBubble, { backgroundColor: colors.primary + "14" }]}>
        <Feather name={icon} size={15} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: "Inter_500Medium",
            fontSize: 11.5,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: colors.foreground,
            fontFamily: "Inter_600SemiBold",
            fontSize: 14.5,
            marginTop: 2,
          }}
        >
          {value}
        </Text>
      </View>
      {chevron && (
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Modal shell shared by all edit dialogs
// ---------------------------------------------------------------------------

function ModalShell(props: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void | Promise<void>;
  primaryDisabled?: boolean;
  busy?: boolean;
  destructive?: boolean;
  /**
   * Inline error rendered above the action row. Use this instead of
   * `Alert.alert` for failure feedback because Alert.alert is unreliable
   * on react-native-web (often silent), which leaves the user staring at
   * an apparently-broken Save button.
   */
  error?: string | null;
}) {
  const colors = useColors();
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalBackdrop}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={props.busy ? undefined : props.onClose}
        />
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius + 4,
            },
          ]}
        >
          <Text
            style={{
              color: colors.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 17,
              letterSpacing: -0.2,
              marginBottom: 14,
            }}
          >
            {props.title}
          </Text>
          {props.children}
          {props.error ? (
            <View
              style={{
                backgroundColor: "#B43E3E14",
                borderColor: "#B43E3E55",
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 8,
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  color: "#B43E3E",
                  fontFamily: "Inter_500Medium",
                  fontSize: 12.5,
                  lineHeight: 17,
                }}
              >
                {props.error}
              </Text>
            </View>
          ) : null}
          <View style={styles.modalActions}>
            <Pressable
              onPress={props.busy ? undefined : props.onClose}
              style={({ pressed }) => [
                styles.modalBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: "transparent",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                }}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={props.primaryDisabled || props.busy ? undefined : props.onPrimary}
              style={({ pressed }) => [
                styles.modalBtn,
                {
                  backgroundColor: props.destructive ? colors.destructive : colors.primary,
                  borderColor: "transparent",
                  opacity: props.primaryDisabled ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {props.busy ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text
                  style={{
                    color: colors.primaryForeground,
                    fontFamily: "Inter_700Bold",
                    fontSize: 14,
                  }}
                >
                  {props.primaryLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FieldInput(props: {
  label?: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  autoCapitalize?: "none" | "words";
  keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad";
  secureTextEntry?: boolean;
  autoFocus?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 10 }}>
      {props.label && (
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: "Inter_500Medium",
            fontSize: 11.5,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {props.label}
        </Text>
      )}
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize={props.autoCapitalize ?? "none"}
        autoCorrect={false}
        keyboardType={props.keyboardType ?? "default"}
        secureTextEntry={props.secureTextEntry}
        autoFocus={props.autoFocus}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: colors.radius,
          paddingHorizontal: 12,
          paddingVertical: 11,
          color: colors.foreground,
          fontFamily: "Inter_500Medium",
          fontSize: 15,
          backgroundColor: colors.background,
        }}
      />
    </View>
  );
}

// ---- Display name ----------------------------------------------------------

function NameModal(props: {
  visible: boolean;
  onClose: () => void;
  firstName: string;
  lastName: string;
  onSave: (first: string, last: string) => Promise<void>;
}) {
  const [first, setFirst] = useState(props.firstName);
  const [last, setLast] = useState(props.lastName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (props.visible) {
      setFirst(props.firstName);
      setLast(props.lastName);
      setError(null);
    }
  }, [props.visible, props.firstName, props.lastName]);

  const dirty =
    first.trim() !== props.firstName.trim() || last.trim() !== props.lastName.trim();

  return (
    <ModalShell
      visible={props.visible}
      onClose={props.onClose}
      title="Edit display name"
      primaryLabel="Save"
      primaryDisabled={!dirty || (!first.trim() && !last.trim())}
      busy={busy}
      error={error}
      onPrimary={async () => {
        setBusy(true);
        setError(null);
        try {
          await props.onSave(first.trim(), last.trim());
          props.onClose();
        } catch (err) {
          console.warn("[profile] name update failed", err);
          setError(friendlyAuthError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <FieldInput
        label="First name"
        value={first}
        onChangeText={setFirst}
        autoCapitalize="words"
        autoFocus
      />
      <FieldInput
        label="Last name"
        value={last}
        onChangeText={setLast}
        autoCapitalize="words"
      />
    </ModalShell>
  );
}

// ---- Email / Phone (2-step verify) ----------------------------------------

// Resource shape we keep across the 2-step flow. Holding the actual Clerk
// resource (not just its id) lets us call attemptVerification + destroy on
// the same instance even after it disappears from `user.emailAddresses` due
// to a stale snapshot.
type PendingResource = {
  id: string;
  attempt: (code: string) => Promise<void>;
  reload: () => Promise<void>;
  isVerified: () => boolean;
  destroy: () => Promise<void>;
};

function VerifyModal(props: {
  visible: boolean;
  onClose: () => void;
  kind: "email" | "phone";
  currentValue: string;
}) {
  const { user } = useUser();
  const isEmail = props.kind === "email";
  const [step, setStep] = useState<"input" | "code">("input");
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingResource | null>(null);

  // Reset on open. On close, if we still hold an unverified pending resource
  // (user dismissed mid-flow), best-effort destroy it so we don't leave
  // "zombie" emails/phones on the Clerk user that would later trip Clerk's
  // per-user limits.
  React.useEffect(() => {
    if (props.visible) {
      setStep("input");
      setValue("");
      setCode("");
      setError(null);
      setPending(null);
    } else if (pending) {
      const stale = pending;
      setPending(null);
      void (async () => {
        try {
          if (!stale.isVerified()) await stale.destroy();
        } catch (e) {
          console.warn("[profile] failed to destroy stale pending resource", e);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visible]);

  const sendCode = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      if (isEmail) {
        const created = await user.createEmailAddress({ email: value.trim() });
        await created.prepareVerification({ strategy: "email_code" });
        setPending({
          id: created.id,
          attempt: (c) => created.attemptVerification({ code: c }).then(() => {}),
          reload: () => created.reload().then(() => {}),
          isVerified: () => created.verification?.status === "verified",
          destroy: () => created.destroy(),
        });
      } else {
        const created = await user.createPhoneNumber({ phoneNumber: value.trim() });
        await created.prepareVerification();
        setPending({
          id: created.id,
          attempt: (c) => created.attemptVerification({ code: c }).then(() => {}),
          reload: () => created.reload().then(() => {}),
          isVerified: () => created.verification?.status === "verified",
          destroy: () => created.destroy(),
        });
      }
      setStep("code");
    } catch (err) {
      console.warn("[profile] send code failed", err);
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const verifyAndPromote = async () => {
    if (!user || !pending) return;
    setBusy(true);
    setError(null);
    try {
      await pending.attempt(code.trim());
      // Defensive: confirm Clerk really marked it verified before promoting.
      // attemptVerification mutates the resource in-place, but a reload
      // guarantees we see the server-side status.
      await pending.reload();
      if (!pending.isVerified()) {
        throw new Error("Verification did not complete. Please try again.");
      }
      await user.update(
        isEmail
          ? { primaryEmailAddressId: pending.id }
          : { primaryPhoneNumberId: pending.id },
      );
      // Best-effort cleanup: only AFTER the new resource is primary, remove
      // all other entries of the same kind so the user has exactly one
      // verified primary email/phone after the swap. Errors here are
      // logged but non-fatal — if Clerk refuses (e.g. last verified email
      // constraint), the user just keeps both, which is acceptable.
      const others = isEmail
        ? user.emailAddresses.filter((e) => e.id !== pending.id)
        : user.phoneNumbers.filter((p) => p.id !== pending.id);
      for (const o of others) {
        try {
          await o.destroy();
        } catch (e) {
          console.warn("[profile] cleanup of old contact failed", e);
        }
      }
      // Mark as consumed so the close-effect doesn't try to destroy it.
      setPending(null);
      props.onClose();
    } catch (err) {
      console.warn("[profile] verify/promote failed", err);
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const title = isEmail
    ? step === "input"
      ? "Change email"
      : "Verify email"
    : step === "input"
      ? "Change phone number"
      : "Verify phone number";

  const primaryLabel =
    step === "input" ? "Send code" : "Verify & save";
  // Clerk codes are 6-digit by default across email_code / phone_code.
  const primaryDisabled =
    step === "input" ? value.trim().length < (isEmail ? 5 : 6) : code.trim().length < 6;

  return (
    <ModalShell
      visible={props.visible}
      onClose={props.onClose}
      title={title}
      primaryLabel={primaryLabel}
      primaryDisabled={primaryDisabled}
      busy={busy}
      error={error}
      onPrimary={step === "input" ? sendCode : verifyAndPromote}
    >
      {step === "input" ? (
        <>
          <Text style={styles.modalHelper}>
            Current: {props.currentValue}
          </Text>
          <FieldInput
            label={isEmail ? "New email" : "New phone (e.g. +994501234567)"}
            value={value}
            onChangeText={setValue}
            placeholder={isEmail ? "you@example.com" : "+994501234567"}
            keyboardType={isEmail ? "email-address" : "phone-pad"}
            autoFocus
          />
        </>
      ) : (
        <>
          <Text style={styles.modalHelper}>
            We sent a code to {value.trim()}. Enter it below to confirm.
          </Text>
          <FieldInput
            label="Verification code"
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
            autoFocus
          />
        </>
      )}
    </ModalShell>
  );
}

// ---- Password --------------------------------------------------------------

function PasswordModal(props: {
  visible: boolean;
  onClose: () => void;
  passwordEnabled: boolean;
}) {
  const { user } = useUser();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (props.visible) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setError(null);
    }
  }, [props.visible]);

  const mismatch = next.length > 0 && confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 8;
  const disabled =
    next.length < 8 ||
    next !== confirm ||
    (props.passwordEnabled && current.length < 1);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await user.updatePassword({
        ...(props.passwordEnabled ? { currentPassword: current } : {}),
        newPassword: next,
        signOutOfOtherSessions: true,
      });
      // Success — close, then briefly notify on native (Alert.alert is
      // unreliable on web, so we don't rely on it as the only signal).
      props.onClose();
      if (Platform.OS !== "web") {
        Alert.alert(
          "Password updated",
          "You have been signed out of other devices.",
        );
      }
    } catch (err) {
      console.warn("[profile] password update failed", err);
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      visible={props.visible}
      onClose={props.onClose}
      title={props.passwordEnabled ? "Update password" : "Set password"}
      primaryLabel="Save"
      primaryDisabled={disabled}
      busy={busy}
      error={error}
      onPrimary={save}
    >
      {props.passwordEnabled && (
        <FieldInput
          label="Current password"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          autoFocus
        />
      )}
      <FieldInput
        label="New password"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoFocus={!props.passwordEnabled}
      />
      <FieldInput
        label="Confirm new password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
      />
      {(mismatch || tooShort) && (
        <Text style={{ color: "#B43E3E", fontFamily: "Inter_500Medium", fontSize: 12 }}>
          {tooShort ? "Use at least 8 characters." : "Passwords don't match."}
        </Text>
      )}
      <Text style={[styles.modalHelper, { marginTop: 6, marginBottom: 0 }]}>
        Saving will sign you out of all other devices.
      </Text>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 4,
  },
  identityCard: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  avatar: { width: 76, height: 76, borderRadius: 38 },
  cameraBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  modalCard: {
    borderWidth: 1,
    padding: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHelper: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#807763",
    marginBottom: 12,
    lineHeight: 18,
  },
});
