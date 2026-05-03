import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
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

const REMINDER_OPTIONS = ["07:00", "08:00", "09:00", "12:00", "18:00", "21:00"];

export default function NotificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { account, updateAccount } = useAtlas();

  const cycleReminder = () => {
    const idx = REMINDER_OPTIONS.indexOf(account.reminderTime);
    const next = REMINDER_OPTIONS[(idx + 1) % REMINDER_OPTIONS.length];
    void updateAccount({ reminderTime: next });
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
            Notifications
          </Text>
        </View>

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
              <Feather name="bell" size={15} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14.5,
                }}
              >
                Smart Nudges
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                }}
              >
                AI-timed reminders adapted to your rhythm
              </Text>
            </View>
            <Switch
              value={account.notificationsEnabled}
              onValueChange={(v) =>
                void updateAccount({ notificationsEnabled: v })
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

          <Pressable
            onPress={cycleReminder}
            android_ripple={{ color: colors.muted }}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <View style={styles.row}>
              <View
                style={[
                  styles.icon,
                  { backgroundColor: colors.primary + "14" },
                ]}
              >
                <Feather name="clock" size={15} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14.5,
                  }}
                >
                  Daily reminder time
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                  }}
                >
                  Tap to cycle • Currently {account.reminderTime}
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={18}
                color={colors.mutedForeground}
              />
            </View>
          </Pressable>
        </View>
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
