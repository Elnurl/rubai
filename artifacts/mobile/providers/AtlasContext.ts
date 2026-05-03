import { createContext } from "react";

import type { ThemeOverride } from "@/types/atlas";

/**
 * Lightweight context consumed by `useColors` so the manual theme override
 * (account.themeOverride: light/dark/system) is reflected app-wide without
 * forcing every consumer to depend on the full AtlasContext value (and its
 * heavy type graph). AtlasProvider mounts this with the current override.
 */
export type AtlasThemeContextValue = {
  account: { themeOverride: ThemeOverride };
};

export const AtlasThemeContext = createContext<
  AtlasThemeContextValue | undefined
>(undefined);
