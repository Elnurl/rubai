import Constants from "expo-constants";

/** True when running inside the Expo Go store client (not a dev/production build). */
export function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

/** Remote push + notification background tasks are not supported in Expo Go (SDK 53+). */
export function supportsRemotePush(): boolean {
  return !isExpoGo();
}
