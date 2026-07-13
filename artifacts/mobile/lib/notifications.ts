import { supportsRemotePush } from "@/lib/expoGo";

type NotificationsModule = typeof import("expo-notifications");

let cached: NotificationsModule | null | undefined;

/**
 * Lazy access to expo-notifications. NEVER import that package at the top
 * level — Expo Go SDK 53+ throws a fatal error on load (TokenAutoRegistration).
 */
export function getNotifications(): NotificationsModule | null {
  if (!supportsRemotePush()) return null;
  if (cached === null) return null;
  if (cached) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("expo-notifications") as NotificationsModule;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export function initPushNotificationHandler(): void {
  const N = getNotifications();
  if (!N) return;

  N.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as
        | Record<string, unknown>
        | null
        | undefined;
      if (data?.type === "tier_changed") {
        return {
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      }
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };
    },
  });
}

if (supportsRemotePush()) {
  initPushNotificationHandler();
}
