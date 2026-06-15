import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import { formatTime } from "@/lib/languageLocales";

export default function NotificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { account, updateAccount } = useAtlas();
  const [showPicker, setShowPicker] = useState(false);

  const displayTime = useMemo(
    () => formatTime(account.reminderTime, account.preferredLanguage),
    [account.reminderTime, account.preferredLanguage],
  );

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
            onPress={() => setShowPicker(true)}
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
                  {displayTime}
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

      <TimePickerModal
        visible={showPicker}
        value={account.reminderTime}
        language={account.preferredLanguage}
        onConfirm={(t) => {
          void updateAccount({ reminderTime: t });
          setShowPicker(false);
        }}
        onClose={() => setShowPicker(false)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// TimePickerModal — alarm-style hour + minute wheel
// ---------------------------------------------------------------------------

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const ITEM_H = 52;
const PAD_ITEMS = 2;

function TimePickerModal(props: {
  visible: boolean;
  value: string;
  language: string;
  onConfirm: (time: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [h, m] = props.value.split(":").map(Number);
  const initH = isNaN(h) ? 8 : h;
  const initM = isNaN(m) ? 0 : m;

  const [selH, setSelH] = useState(initH);
  const [selM, setSelM] = useState(initM);

  // Reset when modal opens
  React.useEffect(() => {
    if (props.visible) {
      const [hh, mm] = props.value.split(":").map(Number);
      setSelH(isNaN(hh) ? 8 : hh);
      setSelM(isNaN(mm) ? 0 : mm);
    }
  }, [props.visible, props.value]);

  const hourRef = useRef<FlatList>(null);
  const minRef = useRef<FlatList>(null);

  React.useEffect(() => {
    if (props.visible) {
      setTimeout(() => {
        hourRef.current?.scrollToIndex({ index: selH, animated: false, viewOffset: ITEM_H * PAD_ITEMS });
        minRef.current?.scrollToIndex({ index: selM, animated: false, viewOffset: ITEM_H * PAD_ITEMS });
      }, 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visible]);

  const previewTime = useMemo(() => {
    const d = new Date(2000, 0, 1, selH, selM);
    const locale = { "English": "en-US", "Azərbaycan": "az-AZ", "Русский": "ru-RU", "Türkçe": "tr-TR", "中文": "zh-CN", "العربية": "ar-SA", "Español": "es-ES", "Português": "pt-BR", "Deutsch": "de-DE", "Français": "fr-FR" }[props.language] ?? "en-US";
    try {
      return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    } catch {
      return `${String(selH).padStart(2, "0")}:${String(selM).padStart(2, "0")}`;
    }
  }, [selH, selM, props.language]);

  const handleHourScroll = (offset: number) => {
    const idx = Math.round(offset / ITEM_H);
    setSelH(Math.max(0, Math.min(23, idx)));
  };

  const handleMinScroll = (offset: number) => {
    const idx = Math.round(offset / ITEM_H);
    setSelM(Math.max(0, Math.min(59, idx)));
  };

  const padData = (arr: number[]) => [
    ...Array(PAD_ITEMS).fill(-1),
    ...arr,
    ...Array(PAD_ITEMS).fill(-2),
  ];

  const hourData = padData(HOURS);
  const minData = padData(MINUTES);

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      transparent
      onRequestClose={props.onClose}
    >
      <TouchableWithoutFeedback onPress={props.onClose}>
        <View style={styles2.overlay} />
      </TouchableWithoutFeedback>
      <View
        style={[
          styles2.sheet,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <View style={styles2.handle} />

        <Text
          style={{
            color: colors.foreground,
            fontFamily: "Inter_700Bold",
            fontSize: 17,
            textAlign: "center",
            marginBottom: 4,
          }}
        >
          Daily reminder
        </Text>
        <Text
          style={{
            color: colors.primary,
            fontFamily: "Inter_600SemiBold",
            fontSize: 28,
            textAlign: "center",
            marginBottom: 20,
            letterSpacing: -1,
          }}
        >
          {previewTime}
        </Text>

        <View style={styles2.pickerRow}>
          {/* Hour column */}
          <View style={styles2.col}>
            <Text style={[styles2.colLabel, { color: colors.mutedForeground }]}>
              Hour
            </Text>
            <View style={{ position: "relative", height: ITEM_H * (PAD_ITEMS * 2 + 1) }}>
              <View
                style={[
                  styles2.selectionBar,
                  { borderColor: colors.primary + "50", top: ITEM_H * PAD_ITEMS },
                ]}
              />
              <FlatList
                ref={hourRef}
                data={hourData}
                keyExtractor={(item, i) => `h-${i}`}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_H}
                decelerationRate="fast"
                onMomentumScrollEnd={(e) => handleHourScroll(e.nativeEvent.contentOffset.y)}
                getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
                renderItem={({ item }) => (
                  <View style={[styles2.item, { height: ITEM_H }]}>
                    {item >= 0 ? (
                      <Text
                        style={[
                          styles2.itemText,
                          {
                            color: item === selH ? colors.foreground : colors.mutedForeground,
                            fontFamily: item === selH ? "Inter_700Bold" : "Inter_400Regular",
                            fontSize: item === selH ? 28 : 22,
                          },
                        ]}
                      >
                        {String(item).padStart(2, "0")}
                      </Text>
                    ) : null}
                  </View>
                )}
              />
            </View>
          </View>

          <Text
            style={{
              color: colors.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 32,
              alignSelf: "center",
              marginTop: 28,
              paddingHorizontal: 4,
            }}
          >
            :
          </Text>

          {/* Minute column */}
          <View style={styles2.col}>
            <Text style={[styles2.colLabel, { color: colors.mutedForeground }]}>
              Min
            </Text>
            <View style={{ position: "relative", height: ITEM_H * (PAD_ITEMS * 2 + 1) }}>
              <View
                style={[
                  styles2.selectionBar,
                  { borderColor: colors.primary + "50", top: ITEM_H * PAD_ITEMS },
                ]}
              />
              <FlatList
                ref={minRef}
                data={minData}
                keyExtractor={(item, i) => `m-${i}`}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_H}
                decelerationRate="fast"
                onMomentumScrollEnd={(e) => handleMinScroll(e.nativeEvent.contentOffset.y)}
                getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
                renderItem={({ item }) => (
                  <View style={[styles2.item, { height: ITEM_H }]}>
                    {item >= 0 ? (
                      <Text
                        style={[
                          styles2.itemText,
                          {
                            color: item === selM ? colors.foreground : colors.mutedForeground,
                            fontFamily: item === selM ? "Inter_700Bold" : "Inter_400Regular",
                            fontSize: item === selM ? 28 : 22,
                          },
                        ]}
                      >
                        {String(item).padStart(2, "0")}
                      </Text>
                    ) : null}
                  </View>
                )}
              />
            </View>
          </View>
        </View>

        <View style={styles2.btnRow}>
          <Pressable
            onPress={props.onClose}
            style={({ pressed }) => [
              styles2.btn,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
              }}
            >
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              props.onConfirm(
                `${String(selH).padStart(2, "0")}:${String(selM).padStart(2, "0")}`,
              )
            }
            style={({ pressed }) => [
              styles2.btn,
              {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
                flex: 1.5,
              },
            ]}
          >
            <Text
              style={{
                color: colors.primaryForeground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
              }}
            >
              Set alarm
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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

const styles2 = StyleSheet.create({
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
    paddingHorizontal: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    alignSelf: "center",
    marginBottom: 16,
  },
  pickerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 24,
  },
  col: { alignItems: "center", flex: 1 },
  colLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  item: { alignItems: "center", justifyContent: "center" },
  itemText: { letterSpacing: -1 },
  selectionBar: {
    position: "absolute",
    left: 4,
    right: 4,
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    zIndex: 0,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
});
