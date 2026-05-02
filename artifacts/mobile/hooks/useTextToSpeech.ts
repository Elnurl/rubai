import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Speech from "expo-speech";

type Result = {
  isSpeaking: boolean;
  speak: (text: string) => Promise<void>;
  stop: () => Promise<void>;
};

/**
 * Cross-platform text-to-speech.
 *
 * Web: uses the browser's `window.speechSynthesis`.
 * Native: uses `expo-speech`.
 *
 * Both are zero-cost (use the OS voice). For higher fidelity we'd swap to
 * OpenAI TTS server-side, but that's not part of the v1 scope.
 */
export function useTextToSpeech(): Result {
  const isWeb = Platform.OS === "web";
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<unknown>(null);

  useEffect(() => {
    return () => {
      // Best-effort silence on unmount.
      if (isWeb) {
        try {
          window.speechSynthesis?.cancel();
        } catch {
          // ignore
        }
      } else {
        Speech.stop().catch(() => {
          /* ignore */
        });
      }
    };
  }, [isWeb]);

  const speak = useCallback(
    async (text: string) => {
      const trimmed = text?.trim();
      if (!trimmed) return;
      try {
        if (isWeb) {
          if (typeof window === "undefined" || !window.speechSynthesis) return;
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(trimmed);
          u.rate = 1.0;
          u.pitch = 1.0;
          u.onend = () => setIsSpeaking(false);
          u.onerror = () => setIsSpeaking(false);
          utteranceRef.current = u;
          setIsSpeaking(true);
          window.speechSynthesis.speak(u);
          return;
        }
        await Speech.stop();
        setIsSpeaking(true);
        Speech.speak(trimmed, {
          rate: 1.0,
          pitch: 1.0,
          onDone: () => setIsSpeaking(false),
          onStopped: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        });
      } catch {
        setIsSpeaking(false);
      }
    },
    [isWeb],
  );

  const stop = useCallback(async () => {
    try {
      if (isWeb) {
        window.speechSynthesis?.cancel();
      } else {
        await Speech.stop();
      }
    } catch {
      // ignore
    }
    setIsSpeaking(false);
  }, [isWeb]);

  return { isSpeaking, speak, stop };
}
