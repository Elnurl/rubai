module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    // Required for AwardToast, tabs layout, etc. — missing plugin can blank the UI.
    plugins: ["react-native-reanimated/plugin"],
  };
};
