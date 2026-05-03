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

import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import {
  getCalendarPermissionStatus,
  listWritableCalendars,
  requestCalendarAccess,
  type LightCalendar,
} from "@/lib/calendar";

export default function CalendarSyncScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { account, updateAccount } = useAtlas();

  const sync = account.calendarSync;
  const [permission, setPermission] = useState<
    "granted" | "denied" | "undetermined" | "loading"
  >("loading");
  const [calendars, setCalendars] = useState<LightCalendar[]>([]);
  const [busy, setBusy] = useState(false);

  const refreshCalendars = useCallback(async () => {
    try {
      const cals = await listWritableCalendars();
      setCalendars(cals);
      if (sync.calendarId && !cals.some((c) => c.id === sync.calendarId)) {
        // Saved calendar no longer exists (deleted, account removed, or list
        // empty) — clear it and disable auto-write so we can't write to a
        // ghost id.
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
  }, [sync, updateAccount]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Platform.OS === "web") {
        setPermission("denied");
        return;
      }
      const status = await getCalendarPermissionStatus();
      if (cancelled) return;
      setPermission(status);
      if (status === "granted") await refreshCalendars();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshCalendars]);

  const onConnect = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Mobile only",
        "Native calendar sync is available on iOS and Android.",
      );
      return;
    }
    setBusy(true);
    try {
      // If permission is already granted (e.g. user just paused it) skip the
      // OS prompt and simply re-enable the integration.
      const status =
        permission === "granted"
          ? "granted"
          : (await requestCalendarAccess())
            ? "granted"
            : "denied";
      setPermission(status);
      if (status === "granted") {
        await refreshCalendars();
        await updateAccount({
          calendarSync: { ...sync, enabled: true },
        });
      } else {
        Alert.alert(
          "Permission needed",
          "Allow calendar access in Settings to let rubai see your day.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const onPickCalendar = (cal: LightCalendar) => {
    void updateAccount({
      calendarSync: {
        ...sync,
        enabled: true,
        calendarId: cal.id,
        calendarTitle: cal.title,
      },
    });
  };

  const onDisconnect = () => {
    void updateAccount({
      calendarSync: {
        enabled: false,
        calendarId: null,
        calendarTitle: null,
        contextRead: sync.contextRead,
        autoWrite: false,
      },
    });
  };

  const granted = permission === "granted";
  // The "connected" state is the user-facing toggle: OS permission must be
  // granted AND the user hasn't disabled the integration. Driving the UI from
  // both prevents the confusing case where the user taps Disconnect and the
  // row still shows "Connected" because OS permission lingers.
  const connected = granted && sync.enabled;

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
            Calendar sync
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
          Let rubai read your day to plan around real meetings, and write each
          daily task into your calendar so you never forget.
        </Text>

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
                Device calendar
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                }}
              >
                {permission === "loading"
                  ? "Checking…"
                  : connected
                    ? "Connected"
                    : granted
                      ? "Paused"
                      : "Not connected"}
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
                  Disconnect
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onConnect}
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
                    {granted ? "Resume" : "Connect"}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        </View>

        {/* Toggles */}
        {connected && (
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
                  Use today's events as context
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                  }}
                >
                  rubai plans around your meetings
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
                  Write tasks to calendar
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                  }}
                >
                  Each daily task gets a reminder
                </Text>
              </View>
              <Switch
                value={sync.autoWrite}
                onValueChange={(v) => {
                  if (v && !sync.calendarId) {
                    Alert.alert(
                      "Pick a calendar",
                      "Choose which calendar to write to first.",
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
              WRITE TO
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
