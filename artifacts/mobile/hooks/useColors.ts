import { useContext } from "react";
import { useColorScheme } from "react-native";

import colors from "@/constants/colors";
import { AtlasThemeContext } from "@/providers/AtlasContext";

/**
 * Returns the design tokens for the current color scheme.
 *
 * Honors a manual override stored in `account.themeOverride` (light/dark/
 * system) when AtlasProvider is mounted; otherwise falls back to the OS
 * appearance setting. Safe to call outside the provider — returns the
 * system palette in that case.
 */
export function useColors() {
  const systemScheme = useColorScheme();
  const ctx = useContext(AtlasThemeContext);
  const override = ctx?.account.themeOverride ?? "system";
  const effective = override === "system" ? systemScheme : override;
  const palette = effective === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
