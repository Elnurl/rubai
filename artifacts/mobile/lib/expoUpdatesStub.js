/** Metro stub — expo-updates disabled during local Expo Go dev. */
module.exports = {
  checkForUpdateAsync: async () => ({ isAvailable: false }),
  fetchUpdateAsync: async () => ({}),
  reloadAsync: async () => {},
  isEnabled: false,
  isEmbeddedLaunch: true,
  channel: null,
  runtimeVersion: null,
  updateId: null,
  manifest: null,
};
