import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useTranslation } from "react-i18next";

import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import {
  getCalendarPermissionStatus,
  listWritableCalendars,
  requestCalendarAccess,
  type LightCalendar,
} from "@/lib/calendar";
import {
  isGoogleCalendarAvailable,
  listGoogleWritableCalendars,
  type GoogleLightCalendar,
} from "@/lib/googleCalendar";
import type { CalendarProvider } from "@/types/atlas";

type AnyCalendar = {
  id: string;
  title: string;
  source: string;
  color: string;
};

export default function CalendarSyncScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { account, updateAccount } = useAtlas();

  const sync = account.calendarSync;
  const provider: CalendarProvider = sync.provider ?? "native";

  // Native (expo-calendar) state
  const [permission, setPermission] = useState<
    "granted" | "denied" | "undetermined" | "loading"
  >("loading");
  const [nativeCals, setNativeCals] = useState<LightCalendar[]>([]);

  // Google state
  const [googleAvailable, setGoogleAvailable] = useState<boolean | null>(null);
  const [googleCals, setGoogleCals] = useState<GoogleLightCalendar[]>([]);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const refreshNative = useCallback(async () => {
    try {
      const cals = await listWritableCalendars();
      setNativeCals(cals);
      if (
        provider === "native" &&
        sync.calendarId &&
        !cals.some((c) => c.id === sync.calendarId)
      ) {
        void updateAccount({
          calendarSync: {
            ...sync,
            calendarId: null,
            calendarTitle: null,
            autoWrite: false,
          },
        });
      }
    } catch (e) {
      console.warn("listWritableCalendars failed", e);
    }
  }, [sync, provider, updateAccount]);

  const refreshGoogle = useCallback(async () => {
    setGoogleError(null);
    try {
      const cals = await listGoogleWritableCalendars();
      setGoogleCals(cals);
      if (
        provider === "google" &&
        sync.calendarId &&
        !cals.some((c) => c.id === sync.calendarId)
      ) {
        void updateAccount({
          calendarSync: {
            ...sync,
            calendarId: null,
            calendarTitle: null,
            autoWrite: false,
          },
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("calendar.couldntReachGoogle", "Couldn't reach Google.");
      setGoogleError(msg);
    }
  }, [sync, provider, updateAccount]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Platform.OS === "web") {
        setPermission("denied");
      } else {
        const status = await getCalendarPermissionStatus();
        if (cancelled) return;
        setPermission(status);
        if (status === "granted") await refreshNative();
      }
      const ok = await isGoogleCalendarAvailable();
      if (cancelled) return;
      setGoogleAvailable(ok);
      if (ok) await refreshGoogle();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshNative, refreshGoogle]);

  const setProvider = (next: CalendarProvider) => {
    if (next === provider) return;
    void updateAccount({
      calendarSync: {
        ...sync,
        provider: next,
        // Picking a new source invalidates the previous selection.
        calendarId: null,
        calendarTitle: null,
        autoWrite: false,
      },
    });
  };

  const onConnectNative = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        t("calendar.mobileOnlyTitle", "Mobile only"),
        t("calendar.mobileOnlyBody", "Native calendar sync is available on iOS and Android. Switch to Google Calendar for web."),
      );
      return;
    }
    setBusy(true);
    try {
      const status =
        permission === "granted"
          ? "granted"
          : (await requestCalendarAccess())
            ? "granted"
            : "denied";
      setPermission(status);
      if (status === "granted") {
        await refreshNative();
        await updateAccount({
          calendarSync: { ...sync, provider: "native", enabled: true },
        });
      } else {
        Alert.alert(
          t("calendar.permissionTitle", "Permission needed"),
          t("calendar.permissionBody", "Allow calendar access in Settings to let rubai see your day."),
          [
            { text: t("calendar.cancel", "Cancel"), style: "cancel" },
            { text: t("calendar.openSettings", "Open Settings"), onPress: () => Linking.openSettings() },
          ],
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const onConnectGoogle = async () => {
    setBusy(true);
    try {
      if (googleAvailable === null) {
        const ok = await isGoogleCalendarAvailable();
        setGoogleAvailable(ok);
        if (!ok) {
          Alert.alert(
            t("calendar.googleUnavailableTitle", "Google Calendar unavailable"),
            t("calendar.googleUnavailableBody", "The workspace owner needs to connect Google Calendar in Replit first."),
          );
          return;
        }
      } else if (!googleAvailable) {
        Alert.alert(
          t("calendar.googleUnavailableTitle", "Google Calendar unavailable"),
          t("calendar.googleUnavailableBody", "The workspace owner needs to connect Google Calendar in Replit first."),
        );
        return;
      }
      await refreshGoogle();
      await updateAccount({
        calendarSync: { ...sync, provider: "google", enabled: true },
      });
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = () => {
    void updateAccount({
      calendarSync: {
        enabled: false,
        provider: sync.provider,
        calendarId: null,
        calendarTitle: null,
        contextRead: sync.contextRead,
        autoWrite: false,
      },
    });
  };

  const onPickCalendar = (cal: AnyCalendar) => {
    void updateAccount({
      calendarSync: {
        ...sync,
        provider,
        enabled: true,
        calendarId: cal.id,
        calendarTitle: cal.title,
      },
    });
  };

  const granted = permission === "granted";
  const nativeConnected = granted && sync.enabled && provider === "native";
  const googleConnected =
    googleAvailable === true && sync.enabled && provider === "google";
  const connected = nativeConnected || googleConnected;

  const calendars: AnyCalendar[] =
    provider === "google" ? googleCals : nativeCals;

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
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
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
            {t("calendar.headerTitle", "Calendar sync")}
          </Text>
        </View>

        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 12.5,
            lineHeight: 18,
            paddingHorizontal: 4,
          }}
        >
          {t("calendar.intro", "rubai uses your calendar only as raw signal — to understand your day, find ideal time slots, and plan tasks around real meetings. Connecting only grants access. Reading events and writing tasks are two separate switches below, both off by default.")}
        </Text>

        {/* Provider toggle */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: 999,
            borderWidth: 1,
            padding: 4,
            gap: 4,
          }}
        >
          {(["native", "google"] as CalendarProvider[]).map((p) => {
            const active = provider === p;
            const label = p === "google" ? t("calendar.providerGoogle", "Google Calendar") : t("calendar.providerDevice", "Device");
            return (
              <Pressable
                key={p}
                onPress={() => setProvider(p)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 999,
                    alignItems: "center",
                    backgroundColor: active ? colors.primary : "transparent",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 12.5,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {provider === "google" && (
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 11.5,
              lineHeight: 16,
              paddingHorizontal: 4,
            }}
          >
            {t("calendar.googleNote", "Google Calendar runs through your workspace's Replit connector and works on web too. Heads up: it's currently shared at the workspace level — fine for personal use, not for multi-user accounts.")}
          </Text>
        )}

        {/* Status / connect */}
        <View
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
            borderWidth: 1,
            overflow: "hidden",
          }}
        >
          <View style={styles.row}>
            <View
              style={[styles.icon, { backgroundColor: colors.primary + "14" }]}
            >
              <Feather name="calendar" size={15} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14.5,
                }}
              >
                {provider === "google" ? t("calendar.googleCalendar", "Google Calendar") : t("calendar.deviceCalendar", "Device calendar")}
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                }}
              >
                {provider === "google"
                  ? googleAvailable === null
                    ? t("calendar.checking", "Checking…")
                    : googleConnected
                      ? t("calendar.connected", "Connected")
                      : googleAvailable
                        ? sync.enabled && sync.provider === "google"
                          ? t("calendar.paused", "Paused")
                          : t("calendar.notConnected", "Not connected")
                        : t("calendar.workspaceNotLinked", "Workspace not linked")
                  : permission === "loading"
                    ? t("calendar.checking", "Checking…")
                    : nativeConnected
                      ? t("calendar.connected", "Connected")
                      : granted
                        ? sync.enabled && sync.provider === "native"
                          ? t("calendar.paused", "Paused")
                          : t("calendar.notConnected", "Not connected")
                        : t("calendar.notConnected", "Not connected")}
              </Text>
            </View>
            {connected ? (
              <Pressable
                onPress={onDisconnect}
                hitSlop={8}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 12,
                  }}
                >
                  {t("calendar.disconnect", "Disconnect")}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={
                  provider === "google" ? onConnectGoogle : onConnectNative
                }
                disabled={busy}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: colors.primary,
                    opacity: pressed || busy ? 0.7 : 1,
                  },
                ]}
              >
                {busy ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primaryForeground}
                  />
                ) : (
                  <Text
                    style={{
                      color: colors.primaryForeground,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 12,
                    }}
                  >
                    {provider === "google"
                      ? googleAvailable && sync.enabled
                        ? t("calendar.resume", "Resume")
                        : t("calendar.connect", "Connect")
                      : granted
                        ? t("calendar.resume", "Resume")
                        : t("calendar.connect", "Connect")}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
          {provider === "google" && googleError && (
            <View
              style={{
                paddingHorizontal: 14,
                paddingBottom: 12,
              }}
            >
              <Text
                style={{
                  color: colors.destructive ?? "#DC2626",
                  fontFamily: "Inter_400Regular",
                  fontSize: 11.5,
                }}
              >
                {googleError}
              </Text>
            </View>
          )}
        </View>

        {/* Toggles */}
        {connected && (
          <View style={{ gap: 8 }}>
            <Text
              style={{
                color: colors.primary,
                fontFamily: "Inter_600SemiBold",
                fontSize: 11,
                letterSpacing: 1.8,
                paddingHorizontal: 4,
              }}
            >
              {t("calendar.whatToShare", "WHAT TO SHARE")}
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                borderWidth: 1,
                overflow: "hidden",
              }}
            >
            <View style={styles.row}>
              <View
                style={[
                  styles.icon,
                  { backgroundColor: colors.primary + "14" },
                ]}
              >
                <Feather name="eye" size={15} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14.5,
                  }}
                >
                  {t("calendar.letAiReadTitle", "Let AI read today's events")}
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                  }}
                >
                  {t("calendar.letAiReadSubtitle", "Used as context to find free time and plan around meetings")}
                </Text>
              </View>
              <Switch
                value={sync.contextRead}
                onValueChange={(v) =>
                  void updateAccount({
                    calendarSync: { ...sync, contextRead: v },
                  })
                }
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.primaryForeground}
              />
            </View>

            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: colors.border,
                marginLeft: 62,
              }}
            />

            <View style={styles.row}>
              <View
                style={[
                  styles.icon,
                  { backgroundColor: colors.primary + "14" },
                ]}
              >
                <Feather name="upload" size={15} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14.5,
                  }}
                >
                  {t("calendar.autoWriteTitle", "Auto-write daily tasks")}
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                  }}
                >
                  {t("calendar.autoWriteSubtitle", "Each generated task becomes a reminder in your calendar")}
                </Text>
              </View>
              <Switch
                value={sync.autoWrite}
                onValueChange={(v) => {
                  if (v && !sync.calendarId) {
                    Alert.alert(
                      t("calendar.pickCalendarTitle", "Pick a calendar"),
                      t("calendar.pickCalendarBody", "Choose which calendar to write to first."),
                    );
                    return;
                  }
                  void updateAccount({
                    calendarSync: { ...sync, autoWrite: v },
                  });
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.primaryForeground}
              />
            </View>
            </View>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 11.5,
                lineHeight: 16,
                paddingHorizontal: 4,
              }}
            >
              {t("calendar.togglesFootnote", "Both off by default. Turn on only what you're comfortable sharing — you can disconnect anytime to stop everything.")}
            </Text>
          </View>
        )}

        {/* Empty state for Google when no writable calendars are visible */}
        {connected && provider === "google" && calendars.length === 0 && (
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
              borderWidth: 1,
              padding: 14,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 13.5,
                marginBottom: 4,
              }}
            >
              {t("calendar.noWritableTitle", "No writable Google calendars found")}
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                lineHeight: 17,
              }}
            >
              {t("calendar.noWritableBody", "The connector is reachable but no calendars allow writes. Check the workspace's Google account permissions, then retry.")}
            </Text>
            <Pressable
              onPress={() => void refreshGoogle()}
              style={({ pressed }) => [
                {
                  alignSelf: "flex-start",
                  marginTop: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 12,
                }}
              >
                {t("calendar.retry", "Retry")}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Calendar picker */}
        {connected && calendars.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text
              style={{
                color: colors.primary,
                fontFamily: "Inter_600SemiBold",
                fontSize: 11,
                letterSpacing: 1.8,
                paddingHorizontal: 4,
              }}
            >
              {t("calendar.writeTo", "WRITE TO")}
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                borderWidth: 1,
                overflow: "hidden",
              }}
            >
              {calendars.map((cal, idx) => {
                const selected = cal.id === sync.calendarId;
                return (
                  <React.Fragment key={cal.id}>
                    {idx > 0 && (
                      <View
                        style={{
                          height: StyleSheet.hairlineWidth,
                          backgroundColor: colors.border,
                          marginLeft: 62,
                        }}
                      />
                    )}
                    <Pressable
                      onPress={() => onPickCalendar(cal)}
                      android_ripple={{ color: colors.muted }}
                      style={({ pressed }) => [
                        { opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <View style={styles.row}>
                        <View
                          style={[
                            styles.icon,
                            { backgroundColor: cal.color + "30" },
                          ]}
                        >
                          <View
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: cal.color,
                            }}
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
                            {cal.title}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: colors.mutedForeground,
                              fontFamily: "Inter_400Regular",
                              fontSize: 12,
                            }}
                          >
                            {cal.source}
                          </Text>
                        </View>
                        {selected && (
                          <Feather
                            name="check"
                            size={18}
                            color={colors.primary}
                          />
                        )}
                      </View>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
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
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
