// Stub expo-updates in Expo Go / local Metro dev so the native layer never
// shows "Checking for new updates…". Real EAS builds use the real package.
const { getDefaultConfig } = require("expo/metro-config");
const { resolve: metroResolve } = require("metro-resolver");
const path = require("path");

const isEasBuild = process.env.EAS_BUILD === "true";

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const defaultResolve =
  config.resolver.resolveRequest ??
  ((context, moduleName, platform) =>
    metroResolve(context, moduleName, platform));

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (!isEasBuild && (moduleName === "expo-updates" || moduleName.startsWith("expo-updates/"))) {
    return {
      filePath: path.resolve(__dirname, "lib/expoUpdatesStub.js"),
      type: "sourceFile",
    };
  }
  return defaultResolve(context, moduleName, platform);
};

module.exports = config;
