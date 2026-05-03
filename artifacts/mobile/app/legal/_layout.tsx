import { Stack } from "expo-router";
import React from "react";

export default function LegalLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
      }}
    >
      <Stack.Screen name="consent" />
      <Stack.Screen name="document" />
    </Stack>
  );
}
