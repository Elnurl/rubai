/**
 * Expo config
 *
 * - Expo Go (`pnpm dev:mobile`): strips EAS Updates + notifications plugin.
 * - Dev / production native builds (`EXPO_NATIVE_BUILD` or `EAS_BUILD`):
 *   includes notifications, cleartext HTTP for local API.
 */
/** @type {import('expo/config').ConfigContext} */
module.exports = () => {
  const base = require("./app.json").expo;
  const isEasBuild = process.env.EAS_BUILD === "true";
  const isNativeBuild =
    isEasBuild || process.env.EXPO_NATIVE_BUILD === "true";
  const isDevProfile =
    process.env.EAS_BUILD_PROFILE === "development" ||
    (!isEasBuild && process.env.NODE_ENV !== "production");

  const { updates: _updates, runtimeVersion: _runtimeVersion, ...rest } = base;

  const nativePlugins = isNativeBuild
    ? [
        [
          "expo-notifications",
          {
            color: "#84CC16",
          },
        ],
      ]
    : [];

  const filteredBasePlugins = base.plugins.filter((plugin) => {
    if (!isNativeBuild && Array.isArray(plugin) && plugin[0] === "expo-notifications") {
      return false;
    }
    return true;
  });

  return {
    ...rest,
    ...(isEasBuild
      ? {
          updates: base.updates,
          runtimeVersion: base.runtimeVersion,
        }
      : {}),
    plugins: [
      ...nativePlugins,
      ...filteredBasePlugins.map((plugin) => {
        if (Array.isArray(plugin) && plugin[0] === "expo-router") {
          return ["expo-router", { origin: false }];
        }
        return plugin;
      }),
    ],
    android: {
      ...base.android,
      usesCleartextTraffic: !isEasBuild || isDevProfile,
    },
    ios: {
      ...base.ios,
      infoPlist: {
        ...base.ios.infoPlist,
        ...(isEasBuild
          ? {}
          : {
              NSAppTransportSecurity: {
                NSAllowsLocalNetworking: true,
              },
            }),
      },
    },
  };
};
