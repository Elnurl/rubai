import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { NativeModules, Platform } from "react-native";
import {
  isLegalLocaleCode,
  type LegalLocaleCode,
} from "@/lib/legalUi";

const STORAGE_KEY = "rubai.legal.locale.v1";

function detectDeviceLocale(): LegalLocaleCode {
  let raw = "en";
  try {
    if (Platform.OS === "ios") {
      const settings = NativeModules.SettingsManager?.settings;
      raw =
        settings?.AppleLocale ||
        settings?.AppleLanguages?.[0] ||
        "en";
    } else if (Platform.OS === "android") {
      raw = NativeModules.I18nManager?.localeIdentifier || "en";
    } else if (typeof navigator !== "undefined") {
      raw = navigator.language || "en";
    }
  } catch {
    raw = "en";
  }
  const lower = raw.toLowerCase();
  // Match the leading 2-letter code against our supported set.
  const code = lower.slice(0, 2);
  if (isLegalLocaleCode(code)) return code;
  return "en";
}

export function useLegalLocale() {
  const [locale, setLocaleState] = useState<LegalLocaleCode>("en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (stored && isLegalLocaleCode(stored)) {
          setLocaleState(stored);
        } else {
          setLocaleState(detectDeviceLocale());
        }
      } catch {
        if (!cancelled) setLocaleState(detectDeviceLocale());
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: LegalLocaleCode) => {
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  return { locale, setLocale, hydrated };
}
