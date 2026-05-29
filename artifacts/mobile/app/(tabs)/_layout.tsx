import { Feather, Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs, usePathname, useRouter } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function AnimatedTabIcon({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(focused ? 1 : 0.92);
  const translateY = useSharedValue(focused ? -1 : 0);
  React.useEffect(() => {
    scale.value = withSpring(focused ? 1.08 : 0.95, {
      damping: 14,
      stiffness: 220,
    });
    translateY.value = withTiming(focused ? -2 : 0, { duration: 180 });
  }, [focused, scale, translateY]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function AskAiFab() {
  const colors = useColors();
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  // The coach already fills the screen on its own route, so the global
  // shortcut hides there and shows on every other tab.
  const onCoach = pathname === "/coach" || pathname.endsWith("/coach");
  if (onCoach) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(120)}
      pointerEvents="box-none"
      style={[tabStyles.fabWrap, { bottom: (isWeb ? 96 : 78) + insets.bottom }]}
    >
      <Pressable
        onPress={() => router.push("/coach")}
        accessibilityRole="button"
        accessibilityLabel="Ask AI coach"
        testID="ask-ai-fab"
        style={({ pressed }) => [
          tabStyles.fab,
          {
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <Ionicons name="sparkles" size={18} color={colors.primaryForeground} />
        <Text style={[tabStyles.fabText, { color: colors.primaryForeground }]}>
          Ask AI
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function NativeTabLayout() {
  return (
    <View style={tabStyles.root}>
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "sun.max", selected: "sun.max.fill" }} />
        <Label>Today</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="roadmap">
        <Icon sf={{ default: "map", selected: "map.fill" }} />
        <Label>Roadmap</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="coach">
        <Icon sf={{ default: "sparkles", selected: "sparkles" }} />
        <Label>Coach</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="goals">
        <Icon sf={{ default: "list.bullet", selected: "list.bullet.indent" }} />
        <Label>Goals</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} />
        <Label>Account</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
      <AskAiFab />
    </View>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <View style={tabStyles.root}>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10.5,
          letterSpacing: 0.3,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : 70,
          paddingTop: 6,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              {isIOS ? (
                <SymbolView name="sun.max" tintColor={color} size={24} />
              ) : (
                <Feather name="sun" size={22} color={color} />
              )}
            </AnimatedTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="roadmap"
        options={{
          title: "Roadmap",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              {isIOS ? (
                <SymbolView name="map" tintColor={color} size={24} />
              ) : (
                <Feather name="map" size={22} color={color} />
              )}
            </AnimatedTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: "",
          tabBarLabel: () => null,
          tabBarButton: (props) => (
            <View style={[tabStyles.centerSlot, { pointerEvents: "box-none" }]}>
              <Pressable
                onPress={props.onPress}
                onLongPress={props.onLongPress}
                accessibilityRole="button"
                accessibilityLabel="Coach"
                accessibilityState={props.accessibilityState}
                testID={props.testID ?? "coach-tab-button"}
                style={({ pressed }) => [
                  tabStyles.centerButton,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.background,
                    opacity: pressed ? 0.9 : 1,
                    shadowColor: colors.primary,
                  },
                ]}
              >
                <Ionicons
                  name="sparkles"
                  size={24}
                  color={colors.primaryForeground}
                />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "Goals",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              {isIOS ? (
                <SymbolView name="list.bullet" tintColor={color} size={24} />
              ) : (
                <Feather name="list" size={22} color={color} />
              )}
            </AnimatedTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              {isIOS ? (
                <SymbolView name="person.crop.circle" tintColor={color} size={24} />
              ) : (
                <Feather name="user" size={22} color={color} />
              )}
            </AnimatedTabIcon>
          ),
        }}
      />
    </Tabs>
      <AskAiFab />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fabWrap: {
    position: "absolute",
    right: 18,
    alignItems: "flex-end",
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 7,
    elevation: 5,
  },
  fabText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    letterSpacing: 0.2,
  },
  centerSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  centerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    borderWidth: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default function TabsLayout() {
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}
