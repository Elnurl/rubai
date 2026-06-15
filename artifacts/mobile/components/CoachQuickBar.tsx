import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Props = {
  /** Placeholder text shown inside the composer. */
  placeholder: string;
  /** Reports the rendered height so the screen can reserve scroll padding. */
  onHeight?: (height: number) => void;
};

/**
 * A pinned "quick interaction" composer for the AI coach. Lives at the bottom of
 * the Today / Roadmap / Goals tabs, just above the tab bar.
 *
 * Unlike the old version, it does NOT jump to the Coach tab the moment it's
 * tapped. The user types their message in place, and only when they send does it
 * navigate to the Coach with the message auto-sent — so the conversation that
 * opens makes clear what they asked and where it came from.
 */
export function CoachQuickBar({ placeholder, onHeight }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  // Sit directly above the floating tab bar (height mirrors _layout.tsx).
  const tabBarSpace = isWeb ? 84 : 70 + insets.bottom;
  const [draft, setDraft] = useState("");
  const [kbHeight, setKbHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);

  // Lift the bar above the on-screen keyboard while typing (absolute-positioned
  // bars don't move with the keyboard on their own).
  useEffect(() => {
    if (isWeb) return;
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvt, (e) =>
      setKbHeight(e.endCoordinates?.height ?? 0),
    );
    const onHide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [isWeb]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    Keyboard.dismiss();
    router.push({
      pathname: "/(tabs)/coach",
      params: { prefill: text, autostart: "1" },
    });
  };

  const openCoachFocused = () => {
    router.push({ pathname: "/(tabs)/coach", params: { focus: "1" } });
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    onHeight?.(e.nativeEvent.layout.height);
  };

  const bottom = kbHeight > 0 ? kbHeight : tabBarSpace;
  const hasText = draft.trim().length > 0;

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.wrap,
        {
          bottom,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.pill,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Ionicons
          name="sparkles"
          size={16}
          color={colors.primary}
          style={styles.spark}
        />
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            { color: colors.foreground, fontFamily: "Inter_400Regular" },
          ]}
          returnKeyType="send"
          onSubmitEditing={submit}
          blurOnSubmit={false}
        />
        {hasText ? (
          <Pressable
            onPress={submit}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("coachQuickBar.sendToCoach", "Send to coach")}
            style={[styles.sendBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="arrow-up" size={16} color={colors.primaryForeground} />
          </Pressable>
        ) : (
          <Pressable
            onPress={openCoachFocused}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("coachQuickBar.openVoiceCoach", "Open voice coach")}
            style={styles.sendBtn}
          >
            <Feather name="mic" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  spark: {
    marginRight: 2,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    paddingVertical: Platform.OS === "ios" ? 6 : 2,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
