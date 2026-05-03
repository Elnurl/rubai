import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";

const LANGUAGES = ["English", "Español", "Português", "Deutsch", "Français"];

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { account, updateAccount } = useAtlas();

  const email = user?.primaryEmailAddress?.emailAddress ?? "Signed in";
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    email.split("@")[0] ||
    "Your account";
  const avatarUrl = user?.imageUrl ?? null;
  const initials =
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") ||
    fullName.slice(0, 2);

  const cycleLanguage = () => {
    const idx = LANGUAGES.indexOf(account.preferredLanguage);
    const next = LANGUAGES[(idx + 1) % LANGUAGES.length];
    void updateAccount({ preferredLanguage: next });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 40,
          paddingHorizontal: 22,
          gap: 22,
        }}
        showsVerticalScrollIndicator={false}
      >
        <SubHeader title="Profile" onBack={() => router.back()} />

        <View
          style={[
            styles.identityCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
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

        <DetailRow
          icon="user"
          label="Display Name"
          value={fullName}
          colors={colors}
        />
        <DetailRow
          icon="mail"
          label="Email"
          value={email}
          colors={colors}
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

        {Platform.OS !== "web" && (
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              textAlign: "center",
              marginTop: 4,
            }}
          >
            Manage your name and avatar from your Clerk profile.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function SubHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
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
      <View
        style={[
          styles.iconBubble,
          { backgroundColor: colors.primary + "14" },
        ]}
      >
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
        <Feather
          name="chevron-right"
          size={18}
          color={colors.mutedForeground}
        />
      )}
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
  identityCard: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  avatar: { width: 76, height: 76, borderRadius: 38 },
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
});
