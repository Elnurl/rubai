import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Foreground presentation: when a push lands while the app is open we still
// want it to show as a banner/sound — otherwise the user sees nothing for
// scheduled morning nudges they're already inside the app for.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushRegistration = {
  token: string;
  tzOffsetMinutes: number;
};

/**
 * Request push permission and resolve an Expo push token. Returns null on
 * web, simulators, when permission was denied, or when no projectId is
 * configured (Expo Go without an account, EAS preview without a project).
 */
export async function registerForPushAsync(): Promise<PushRegistration | null> {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;

  // Android needs a notification channel before a push can render. Set it
  // up unconditionally — it's idempotent.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#84CC16",
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return null;

  // The projectId is required so Expo's push service can route the token
  // to the right app. EAS-built clients have it on `extra.eas.projectId`;
  // some Expo Go shells expose it on `easConfig.projectId`.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } })
      .easConfig?.projectId ??
    undefined;

  try {
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (!tokenResp.data) return null;
    // -getTimezoneOffset returns minutes WEST of UTC; we want east of UTC.
    const tzOffsetMinutes = -new Date().getTimezoneOffset();
    return { token: tokenResp.data, tzOffsetMinutes };
  } catch {
    // Most common cause: running inside Expo Go on SDK 53+ where push
    // tokens are no longer issued without a project. Fail silently — the
    // app still works without push.
    return null;
  }
}
