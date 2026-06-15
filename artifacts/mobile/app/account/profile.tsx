import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import i18n from "@/lib/i18n";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import { friendlyAuthError } from "@/lib/authErrors";
import { TIER_INFO, type SubscriptionTier } from "@/types/atlas";
import { LANGUAGES } from "@/lib/languageLocales";
import { COUNTRIES, DEFAULT_COUNTRY, type CountryCode } from "@/lib/countryCodes";
import {
  useGetMeTierHistory,
  type TierTransitionEntry,
} from "@workspace/api-client-react";

type EditField = "name" | "email" | "phone" | "password" | null;

export default function ProfileScreen() {
  const { t } = useTranslation();
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
    if (Platform.OS !== "web") Alert.alert(t("profile.appearance", "Appearance"), t("profile.followingSystem", "Following system setting."));
  };
  const onSignOut = () => {
    const doSignOut = async () => { await signOut(); };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(t("profile.signOutConfirmWeb", "Sign out of rubai?"))) void doSignOut();
    } else {
      Alert.alert(t("profile.signOutTitle", "Sign out?"), t("profile.signOutMessage", "You can sign back in any time."), [
        { text: t("profile.cancel", "Cancel"), style: "cancel" },
        { text: t("profile.signOut", "Sign out"), onPress: doSignOut },
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
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const email = user?.primaryEmailAddress?.emailAddress ?? "—";
  const phone = user?.primaryPhoneNumber?.phoneNumber ?? "—";
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    (user?.primaryEmailAddress?.emailAddress?.split("@")[0] ?? t("profile.yourAccount", "Your account"));
  const avatarUrl = localAvatarUri ?? user?.imageUrl ?? null;
  const initials =
    ((user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")).trim() ||
    fullName.slice(0, 2);

  // ---- Avatar: action sheet (iOS) / Alert (Android) ----
  const onAvatarPress = useCallback(() => {
    if (!user) return;
    const hasPhoto = !!user.imageUrl && !user.imageUrl.includes("/default");
    const options = hasPhoto
      ? [t("profile.chooseFromLibrary", "Choose from library"), t("profile.removePhoto", "Remove photo"), t("profile.cancel", "Cancel")]
      : [t("profile.chooseFromLibrary", "Choose from library"), t("profile.cancel", "Cancel")];
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
      Alert.alert(t("profile.profilePhoto", "Profile photo"), undefined, [
        { text: t("profile.chooseFromLibrary", "Choose from library"), onPress: () => handle(0) },
        ...(hasPhoto
          ? [{ text: t("profile.removePhoto", "Remove photo"), style: "destructive" as const, onPress: () => handle(1) }]
          : []),
        { text: t("profile.cancel", "Cancel"), style: "cancel" as const },
      ]);
    }
  }, [user]);

  const pickAndUpload = useCallback(async () => {
    if (!user) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t("profile.photos", "Photos"), t("profile.allowPhotoAccess", "Allow photo access to change your picture."));
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
      await user.reload();
      setLocalAvatarUri(null);
    } catch (err) {
      Alert.alert(t("profile.couldntUpdatePhoto", "Couldn't update photo"), friendlyAuthError(err));
    } finally {
      setAvatarBusy(false);
    }
  }, [user]);

  const removeAvatar = useCallback(async () => {
    if (!user) return;
    try {
      setAvatarBusy(true);
      await user.setProfileImage({ file: null });
      await user.reload();
      setLocalAvatarUri(null);
    } catch (err) {
      Alert.alert(t("profile.couldntRemovePhoto", "Couldn't remove photo"), friendlyAuthError(err));
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
        <SubHeader title={t("profile.title", "Profile")} onBack={() => router.back()} />

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
          label={t("profile.displayName", "Display Name")}
          value={fullName}
          onPress={() => setField("name")}
        />
        <EditableRow
          icon="mail"
          label={t("profile.email", "Email")}
          value={email}
          onPress={() => setField("email")}
        />
        <EditableRow
          icon="phone"
          label={t("profile.phone", "Phone")}
          value={phone}
          onPress={() => setField("phone")}
        />
        <Pressable
          onPress={() => setShowLangPicker(true)}
          style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        >
          <DetailRow
            icon="globe"
            label={t("profile.language", "Language")}
            value={account.preferredLanguage}
            colors={colors}
            chevron
          />
        </Pressable>

        <SectionLabel text={t("profile.security", "SECURITY")} />
        <EditableRow
          icon="lock"
          label={user?.passwordEnabled ? t("profile.updatePassword", "Update password") : t("profile.setPassword", "Set password")}
          value={user?.passwordEnabled ? "••••••••" : t("profile.notSet", "Not set")}
          onPress={() => setField("password")}
        />

        {/* ── PREFERENCES ── */}
        <SectionLabel text={t("profile.preferences", "PREFERENCES")} />
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
                  {t("profile.appearance", "Appearance")}
                </Text>
                <Text style={[pStyles.settingsSubtitle, { color: colors.mutedForeground }]}>
                  {account.themeOverride === "system"
                    ? t("profile.systemTheme", "System ({{mode}})", { mode: isDark ? t("profile.dark", "Dark") : t("profile.light", "Light") })
                    : isDark
                      ? t("profile.dark", "Dark")
                      : t("profile.light", "Light")}
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
            title={t("profile.notifications", "Notifications")}
            subtitle={t("profile.notificationsSubtitle", "Smart timing for nudges")}
            onPress={() => router.push("/account/notifications")}
            colors={colors}
          />
        </SettingsGroup>

        {/* ── ACCOUNT ── */}
        <SectionLabel text={t("profile.account", "ACCOUNT")} />
        <SettingsGroup>
          <SettingsNavRow
            icon="calendar"
            title={t("profile.calendarSync", "Calendar sync")}
            subtitle={
              account.calendarSync.enabled && account.calendarSync.calendarTitle
                ? t("profile.calendarOnTitle", "On · {{title}}", { title: account.calendarSync.calendarTitle })
                : account.calendarSync.enabled
                  ? t("profile.calendarOnPick", "On · pick a calendar")
                  : t("profile.calendarOff", "Off")
            }
            onPress={() => router.push("/account/calendar")}
            colors={colors}
          />
          <SettingsDivider />
          <SettingsNavRow
            icon="zap"
            title={t("profile.behavioralMemory", "Behavioral memory")}
            subtitle={t("profile.behavioralMemorySubtitle", "What rubai remembers about you")}
            onPress={() => router.push("/behavioral-insights")}
            colors={colors}
          />
          <SettingsDivider />
          <SettingsNavRow
            icon="shield"
            title={t("profile.privacyData", "Privacy & data")}
            subtitle={t("profile.privacyDataSubtitle", "Control what's stored")}
            onPress={() => router.push("/account/privacy")}
            colors={colors}
          />
          <SettingsDivider />
          <SettingsNavRow
            icon="file-text"
            title={t("profile.legal", "Legal")}
            subtitle={t("profile.legalSubtitle", "Privacy Policy & Terms of Service")}
            onPress={() => router.push("/legal/document?type=privacy_policy")}
            colors={colors}
          />
        </SettingsGroup>

        {/* ── SUBSCRIPTION ── */}
        <SectionLabel text={t("profile.subscription", "SUBSCRIPTION")} />
        <SettingsGroup>
          <View style={pStyles.subscriptionHeader}>
            <View style={[pStyles.settingsIcon, { backgroundColor: colors.primary + "14" }]}>
              <Feather name="credit-card" size={15} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[pStyles.settingsTitle, { color: colors.foreground }]}>
                {t("profile.tierPlan", "{{label}} plan", { label: tierInfo.label })}
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
                {t("profile.manage", "Manage")}
              </Text>
            </Pressable>
          </View>

          {/* Subscription history inline */}
          <SettingsDivider />
          <View style={pStyles.historyLabelRow}>
            <Text style={[pStyles.historyLabel, { color: colors.mutedForeground }]}>
              {t("profile.history", "HISTORY")}
            </Text>
          </View>
          {tierHistoryLoading ? (
            <View style={pStyles.historyPlaceholder}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : !tierHistoryData?.transitions?.length ? (
            <View style={pStyles.historyPlaceholder}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                {t("profile.noSubscriptionChanges", "No subscription changes yet.")}
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
        <SectionLabel text={t("profile.session", "SESSION")} />
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
            {t("profile.signOut", "Sign out")}
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
      <LanguageModal
        visible={showLangPicker}
        selected={account.preferredLanguage}
        onSelect={(lang) => {
          void updateAccount({ preferredLanguage: lang });
          setShowLangPicker(false);
        }}
        onClose={() => setShowLangPicker(false)}
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
  if (t > f) return { label: i18n.t("profile.upgraded", "Upgraded"), icon: "arrow-up-circle" as const, positive: true };
  if (t < f) return { label: i18n.t("profile.downgraded", "Downgraded"), icon: "arrow-down-circle" as const, positive: false };
  return { label: i18n.t("profile.changed", "Changed"), icon: "refresh-cw" as const, positive: true };
}
function tierName(t: string): string {
  const k = t as SubscriptionTier;
  return TIER_INFO[k]?.label ?? (t.charAt(0).toUpperCase() + t.slice(1));
}
function historyTrigger(triggeredBy: string, eventType: string | null): string {
  if (triggeredBy === "sync-tier") return i18n.t("profile.triggerAppSync", "App sync");
  if (!eventType) return i18n.t("profile.triggerPurchase", "Purchase");
  const m: Record<string, string> = {
    INITIAL_PURCHASE: i18n.t("profile.triggerPurchase", "Purchase"),
    RENEWAL: i18n.t("profile.triggerRenewal", "Renewal"),
    CANCELLATION: i18n.t("profile.triggerCancelled", "Cancelled"),
    EXPIRATION: i18n.t("profile.triggerExpired", "Expired"),
    BILLING_ISSUE: i18n.t("profile.triggerBillingIssue", "Billing issue"),
    PRODUCT_CHANGE: i18n.t("profile.triggerPlanChange", "Plan change"),
    TRANSFER: i18n.t("profile.triggerTransfer", "Transfer"),
    SUBSCRIBER_ALIAS: i18n.t("profile.triggerAccountMerge", "Account merge"),
  };
  return m[eventType] ?? i18n.t("profile.triggerPurchase", "Purchase");
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
  const { t } = useTranslation();
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
          {t("profile.historyTo", "{{label}} to {{tier}}", { label: dir.label, tier: tierName(entry.toTier) })}
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
  /**
   * Optional full-screen overlay rendered *inside* this modal (e.g. a country
   * picker). Rendered as a sibling of the card so it stacks reliably without
   * nesting a second React Native <Modal>, which is non-interactive on iOS.
   */
  overlay?: React.ReactNode;
}) {
  const { t } = useTranslation();
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
                {t("profile.cancel", "Cancel")}
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
        {props.overlay ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {props.overlay}
          </View>
        ) : null}
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
  const { t } = useTranslation();
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
      title={t("profile.editDisplayName", "Edit display name")}
      primaryLabel={t("profile.save", "Save")}
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
        label={t("profile.firstName", "First name")}
        value={first}
        onChangeText={setFirst}
        autoCapitalize="words"
        autoFocus
      />
      <FieldInput
        label={t("profile.lastName", "Last name")}
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
  const { t } = useTranslation();
  const { user } = useUser();
  const colors = useColors();
  const isEmail = props.kind === "email";
  const [step, setStep] = useState<"input" | "code">("input");
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingResource | null>(null);
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  React.useEffect(() => {
    if (props.visible) {
      setStep("input");
      setValue("");
      setCode("");
      setError(null);
      setPending(null);
      setCountry(DEFAULT_COUNTRY);
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

  const fullPhone = country.dialCode + value.trim();

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
        const created = await user.createPhoneNumber({ phoneNumber: fullPhone });
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
      await pending.reload();
      if (!pending.isVerified()) {
        throw new Error(t("profile.verificationIncomplete", "Verification did not complete. Please try again."));
      }
      await user.update(
        isEmail
          ? { primaryEmailAddressId: pending.id }
          : { primaryPhoneNumberId: pending.id },
      );
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
    ? step === "input" ? t("profile.changeEmail", "Change email") : t("profile.verifyEmail", "Verify email")
    : step === "input" ? t("profile.changePhone", "Change phone number") : t("profile.verifyPhone", "Verify phone number");

  const primaryLabel = step === "input" ? t("profile.sendCode", "Send code") : t("profile.verifySave", "Verify & save");
  const primaryDisabled =
    step === "input"
      ? isEmail
        ? value.trim().length < 5
        : value.trim().length < 4
      : code.trim().length < 6;

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
        overlay={
          showCountryPicker ? (
            <CountryPickerPanel
              selected={country}
              onSelect={(c) => {
                setCountry(c);
                setShowCountryPicker(false);
              }}
              onClose={() => setShowCountryPicker(false)}
            />
          ) : undefined
        }
      >
        {step === "input" ? (
          <>
            <Text style={styles.modalHelper}>
              {t("profile.current", "Current: {{value}}", { value: props.currentValue })}
            </Text>
            {isEmail ? (
              <FieldInput
                label={t("profile.newEmail", "New email")}
                value={value}
                onChangeText={setValue}
                placeholder={t("profile.emailPlaceholder", "you@example.com")}
                keyboardType="email-address"
                autoFocus
              />
            ) : (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  {t("profile.countryCode", "COUNTRY CODE")}
                </Text>
                <Pressable
                  onPress={() => setShowCountryPicker(true)}
                  style={[
                    styles.countryBtn,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 20 }}>{country.flag}</Text>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 15,
                      marginLeft: 8,
                    }}
                  >
                    {country.dialCode}
                  </Text>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                      fontSize: 13,
                      flex: 1,
                      marginLeft: 6,
                    }}
                    numberOfLines={1}
                  >
                    {country.name}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </Pressable>
                <FieldInput
                  label={t("profile.phoneNumber", "PHONE NUMBER")}
                  value={value}
                  onChangeText={setValue}
                  placeholder="501234567"
                  keyboardType="phone-pad"
                  autoFocus
                />
              </>
            )}
          </>
        ) : (
          <>
            <Text style={styles.modalHelper}>
              {t("profile.codeSentHelper", "We sent a code to {{target}}. Enter it below to confirm.", { target: isEmail ? value.trim() : fullPhone })}
            </Text>
            <FieldInput
              label={t("profile.verificationCode", "Verification code")}
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
  const { t } = useTranslation();
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
          t("profile.passwordUpdated", "Password updated"),
          t("profile.signedOutOtherDevices", "You have been signed out of other devices."),
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
      title={props.passwordEnabled ? t("profile.updatePassword", "Update password") : t("profile.setPassword", "Set password")}
      primaryLabel={t("profile.save", "Save")}
      primaryDisabled={disabled}
      busy={busy}
      error={error}
      onPrimary={save}
    >
      {props.passwordEnabled && (
        <FieldInput
          label={t("profile.currentPassword", "Current password")}
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          autoFocus
        />
      )}
      <FieldInput
        label={t("profile.newPassword", "New password")}
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoFocus={!props.passwordEnabled}
      />
      <FieldInput
        label={t("profile.confirmNewPassword", "Confirm new password")}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
      />
      {(mismatch || tooShort) && (
        <Text style={{ color: "#B43E3E", fontFamily: "Inter_500Medium", fontSize: 12 }}>
          {tooShort ? t("profile.useAtLeast8", "Use at least 8 characters.") : t("profile.passwordsDontMatch", "Passwords don't match.")}
        </Text>
      )}
      <Text style={[styles.modalHelper, { marginTop: 6, marginBottom: 0 }]}>
        {t("profile.savingSignsOut", "Saving will sign you out of all other devices.")}
      </Text>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// LanguageModal — full-screen list with checkmarks + backdrop dismiss
// ---------------------------------------------------------------------------

function LanguageModal(props: {
  visible: boolean;
  selected: string;
  onSelect: (lang: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      transparent
      onRequestClose={props.onClose}
    >
      <TouchableWithoutFeedback onPress={props.onClose}>
        <View style={langStyles.overlay} />
      </TouchableWithoutFeedback>
      <View
        style={[
          langStyles.sheet,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <View style={langStyles.handle} />
        <Text
          style={{
            color: colors.foreground,
            fontFamily: "Inter_700Bold",
            fontSize: 17,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          {t("profile.language", "Language")}
        </Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          {LANGUAGES.map((lang, i) => {
            const isLast = i === LANGUAGES.length - 1;
            const isSelected = lang === props.selected;
            return (
              <React.Fragment key={lang}>
                <Pressable
                  onPress={() => props.onSelect(lang)}
                  android_ripple={{ color: colors.muted }}
                  style={({ pressed }) => [
                    langStyles.langRow,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Text
                    style={{
                      flex: 1,
                      color: isSelected ? colors.primary : colors.foreground,
                      fontFamily: isSelected ? "Inter_600SemiBold" : "Inter_400Regular",
                      fontSize: 16,
                    }}
                  >
                    {lang}
                  </Text>
                  {isSelected && (
                    <Feather name="check" size={18} color={colors.primary} />
                  )}
                </Pressable>
                {!isLast && (
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: colors.border,
                      marginLeft: 16,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const langStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    alignSelf: "center",
    marginBottom: 14,
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 15,
  },
});

// ---------------------------------------------------------------------------
// CountryPickerModal — searchable list of countries with dial codes
// ---------------------------------------------------------------------------

function CountryPickerPanel(props: {
  selected: CountryCode;
  onSelect: (c: CountryCode) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        cpStyles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
        {/* Header */}
        <View style={[cpStyles.header, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={props.onClose}
            hitSlop={12}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
          >
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              color: colors.foreground,
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
            }}
          >
            {t("profile.selectCountry", "Select country")}
          </Text>
          <View style={{ width: 30 }} />
        </View>

        {/* Search */}
        <View
          style={[
            cpStyles.searchRow,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("profile.searchCountry", "Search country or code…")}
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            autoCapitalize="none"
            style={{
              flex: 1,
              color: colors.foreground,
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              paddingVertical: Platform.OS === "ios" ? 0 : 2,
            }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x-circle" size={15} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: colors.border,
                marginLeft: 56,
              }}
            />
          )}
          renderItem={({ item }) => {
            const isSelected = item.code === props.selected.code;
            return (
              <Pressable
                onPress={() => props.onSelect(item)}
                android_ripple={{ color: colors.muted }}
                style={({ pressed }) => [
                  cpStyles.countryRow,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={{ fontSize: 26, width: 36 }}>{item.flag}</Text>
                <Text
                  style={{
                    flex: 1,
                    color: isSelected ? colors.primary : colors.foreground,
                    fontFamily: isSelected ? "Inter_600SemiBold" : "Inter_400Regular",
                    fontSize: 15,
                  }}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                    fontSize: 14,
                    minWidth: 48,
                    textAlign: "right",
                  }}
                >
                  {item.dialCode}
                </Text>
                {isSelected && (
                  <Feather
                    name="check"
                    size={16}
                    color={colors.primary}
                    style={{ marginLeft: 8 }}
                  />
                )}
              </Pressable>
            );
          }}
        />
      </View>
  );
}

const cpStyles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
});

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
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11.5,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  countryBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
    gap: 4,
  },
});
