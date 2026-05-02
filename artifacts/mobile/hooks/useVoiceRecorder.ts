import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

export type VoiceRecorderState = "idle" | "recording" | "processing" | "error";

type Result = {
  state: VoiceRecorderState;
  errorMessage: string | null;
  durationMs: number;
  start: () => Promise<void>;
  /**
   * Stop the recording and return the captured clip as a FormData-ready Blob
   * (web) or { uri, name, type } (native).
   */
  stop: () => Promise<RecordedClip | null>;
  cancel: () => Promise<void>;
};

export type RecordedClip =
  | { kind: "web-blob"; blob: Blob; mimeType: string; filename: string }
  | { kind: "native-uri"; uri: string; mimeType: string; filename: string };

/**
 * Cross-platform voice recorder.
 *
 * Web: uses the browser's MediaRecorder + getUserMedia.
 * Native: uses expo-audio's `useAudioRecorder` hook.
 *
 * The returned `RecordedClip` can be appended to a FormData object directly:
 *   form.append("audio", clip.kind === "web-blob"
 *     ? clip.blob
 *     : { uri: clip.uri, name: clip.filename, type: clip.mimeType } as any);
 */
export function useVoiceRecorder(): Result {
  const isWeb = Platform.OS === "web";

  // ---- Native (expo-audio) ----
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  // ---- Web (MediaRecorder) ----
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const webStartedAtRef = useRef<number>(0);
  const [webDurationMs, setWebDurationMs] = useState(0);
  const webIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<VoiceRecorderState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track current state in a ref so the unmount cleanup (which only sees the
  // first render's state) can decide whether the native recorder is still
  // running and needs to be stopped.
  const stateRef = useRef<VoiceRecorderState>("idle");
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Cleanup on unmount — covers both web and native paths.
  useEffect(() => {
    return () => {
      if (webIntervalRef.current) {
        clearInterval(webIntervalRef.current);
        webIntervalRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      // Native: if we unmount mid-recording, stop the recorder and release
      // the mic / restore the default audio mode so other apps (and our own
      // playback) aren't left in a weird state.
      if (!isWeb && stateRef.current === "recording") {
        recorder.stop().catch(() => {
          /* ignore — best effort */
        });
        setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(
          () => {
            /* ignore */
          },
        );
      }
    };
  }, [isWeb, recorder]);

  const start = useCallback(async () => {
    setErrorMessage(null);
    try {
      if (isWeb) {
        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices?.getUserMedia ||
          typeof MediaRecorder === "undefined"
        ) {
          throw new Error("Voice recording isn't supported in this browser.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const mimeType = pickWebMimeType();
        const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunksRef.current = [];
        rec.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
        };
        rec.start();
        mediaRecorderRef.current = rec;
        webStartedAtRef.current = Date.now();
        setWebDurationMs(0);
        webIntervalRef.current = setInterval(() => {
          setWebDurationMs(Date.now() - webStartedAtRef.current);
        }, 200);
        setState("recording");
        return;
      }

      // Native path.
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        throw new Error("Microphone permission denied.");
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setState("recording");
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Recording failed.");
    }
  }, [isWeb, recorder]);

  const stop = useCallback(async (): Promise<RecordedClip | null> => {
    try {
      setState("processing");
      if (isWeb) {
        const rec = mediaRecorderRef.current;
        if (!rec) {
          setState("idle");
          return null;
        }
        const stopped = new Promise<Blob>((resolve) => {
          rec.onstop = () => {
            const mimeType = rec.mimeType || "audio/webm";
            const blob = new Blob(chunksRef.current, { type: mimeType });
            resolve(blob);
          };
        });
        rec.stop();
        const blob = await stopped;
        // Tear down the mic.
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        if (webIntervalRef.current) {
          clearInterval(webIntervalRef.current);
          webIntervalRef.current = null;
        }
        setState("idle");
        const ext = blob.type.includes("mp4") ? "m4a" : "webm";
        return {
          kind: "web-blob",
          blob,
          mimeType: blob.type || "audio/webm",
          filename: `voice.${ext}`,
        };
      }

      // Native path.
      await recorder.stop();
      const uri = recorder.uri;
      setState("idle");
      if (!uri) return null;
      // expo-audio HIGH_QUALITY produces m4a on iOS / mp4 on Android.
      return {
        kind: "native-uri",
        uri,
        mimeType: "audio/m4a",
        filename: "voice.m4a",
      };
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Stop failed.");
      return null;
    }
  }, [isWeb, recorder]);

  const cancel = useCallback(async () => {
    if (isWeb) {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // ignore — we're tearing down anyway.
      }
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      if (webIntervalRef.current) {
        clearInterval(webIntervalRef.current);
        webIntervalRef.current = null;
      }
      setWebDurationMs(0);
    } else {
      try {
        await recorder.stop();
      } catch {
        // ignore
      }
    }
    setState("idle");
    setErrorMessage(null);
  }, [isWeb, recorder]);

  const durationMs = isWeb
    ? webDurationMs
    : Math.round((recorderState.durationMillis ?? 0));

  return { state, errorMessage, durationMs, start, stop, cancel };
}

function pickWebMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      // some implementations throw on unknown types — skip
    }
  }
  return undefined;
}
