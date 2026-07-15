// Stub expo-updates in Expo Go / local Metro so the native layer never
// shows "Checking for new updates…". Real EAS release/preview builds use
// the real package and must NOT require `metro-resolver` at config load
// time (pnpm + EAS often omit it from the mobile package graph).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const isEasBuild =
  process.env.EAS_BUILD === "true" || process.env.EXPO_NATIVE_BUILD === "true";

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

if (!isEasBuild) {
  let metroResolve = null;
  try {
    metroResolve = require("metro-resolver").resolve;
  } catch {
    // Optional locally; Expo's default resolver still works without the stub.
  }

  const defaultResolve =
    config.resolver.resolveRequest ??
    (metroResolve
      ? (context, moduleName, platform) =>
          metroResolve(context, moduleName, platform)
      : null);

  if (defaultResolve) {
    config.resolver.resolveRequest = (context, moduleName, platform) => {
      if (
        moduleName === "expo-updates" ||
        moduleName.startsWith("expo-updates/")
      ) {
        return {
          filePath: path.resolve(__dirname, "lib/expoUpdatesStub.js"),
          type: "sourceFile",
        };
      }
      return defaultResolve(context, moduleName, platform);
    };
  }
}

module.exports = config;
