import { Feather, Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

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

function NativeTabLayout() {
  return (
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
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          letterSpacing: 0.2,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 70 : 58,
          paddingTop: 4,
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
                <SymbolView name="sun.max" tintColor={color} size={20} />
              ) : (
                <Feather name="sun" size={18} color={color} />
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
                <SymbolView name="map" tintColor={color} size={20} />
              ) : (
                <Feather name="map" size={18} color={color} />
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
                  size={20}
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
                <SymbolView name="list.bullet" tintColor={color} size={20} />
              ) : (
                <Feather name="list" size={18} color={color} />
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
                <SymbolView name="person.crop.circle" tintColor={color} size={20} />
              ) : (
                <Feather name="user" size={18} color={color} />
              )}
            </AnimatedTabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  centerSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  centerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
