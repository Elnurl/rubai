import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

import { getNotifications } from "@/lib/notifications";
import { supportsRemotePush } from "@/lib/expoGo";

export type PushRegistration = {
  token: string;
  tzOffsetMinutes: number;
};

/**
 * Request push permission and resolve an Expo push token. Returns null on
 * web, simulators, Expo Go, when permission was denied, or when no projectId
 * is configured.
 */
export async function registerForPushAsync(): Promise<PushRegistration | null> {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;
  if (!supportsRemotePush()) return null;

  const Notifications = getNotifications();
  if (!Notifications) return null;

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
    const tzOffsetMinutes = -new Date().getTimezoneOffset();
    return { token: tokenResp.data, tzOffsetMinutes };
  } catch {
    return null;
  }
}
