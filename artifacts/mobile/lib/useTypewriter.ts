import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Smooths streamed text into a steady "typing" reveal.
 *
 * Network delivery of SSE deltas is bursty — a fronting proxy may buffer
 * the stream and hand us large chunks at once, which makes the assistant
 * reply pop in all at once instead of typing out. This hook decouples the
 * *received* text (the target) from the *displayed* text: it reveals the
 * target a few characters per tick so the user always sees a natural
 * word-by-word cadence regardless of how the bytes actually arrived.
 *
 * Usage:
 *   const typer = useTypewriter();
 *   // for each delta, push the full accumulated text so far:
 *   typer.push(accumulatedReply);
 *   // once the stream is done, reveal the final text then wait:
 *   typer.push(finalReply);
 *   await typer.flush();
 *   // ...commit to history, then:
 *   typer.reset();
 */
export function useTypewriter(opts?: { tickMs?: number; divisor?: number }) {
  const tickMs = opts?.tickMs ?? 16;
  // Higher divisor = slower reveal. We reveal a fraction of the remaining
  // backlog each tick (min 2 chars) so we never lag far behind a big burst
  // but still type smoothly when text trickles in.
  const divisor = opts?.divisor ?? 18;

  const [displayed, setDisplayed] = useState("");
  const targetRef = useRef("");
  const displayedRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneResolversRef = useRef<Array<() => void>>([]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resolveWaiters = useCallback(() => {
    const resolvers = doneResolversRef.current;
    doneResolversRef.current = [];
    resolvers.forEach((r) => r());
  }, []);

  const tick = useCallback(() => {
    const target = targetRef.current;
    const current = displayedRef.current;
    if (current.length >= target.length) {
      // Caught up — pause the timer (push() restarts it) and release any
      // flush() waiters.
      stopTimer();
      resolveWaiters();
      return;
    }
    const remaining = target.length - current.length;
    const step = Math.max(2, Math.ceil(remaining / divisor));
    const next = target.slice(0, current.length + step);
    displayedRef.current = next;
    setDisplayed(next);
    if (next.length >= target.length) {
      stopTimer();
      resolveWaiters();
    }
  }, [divisor, resolveWaiters, stopTimer]);

  const ensureTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(tick, tickMs);
  }, [tick, tickMs]);

  /** Set the full text received so far and (re)start the reveal loop. */
  const push = useCallback(
    (fullTextSoFar: string) => {
      targetRef.current = fullTextSoFar;
      if (displayedRef.current.length > targetRef.current.length) {
        // Target shrank (e.g. the canonical final reply is shorter than the
        // streamed text). Snap the displayed text down so the live bubble
        // never shows more than the canonical text, and settle waiters.
        displayedRef.current = fullTextSoFar;
        setDisplayed(fullTextSoFar);
        stopTimer();
        resolveWaiters();
        return;
      }
      if (displayedRef.current.length < targetRef.current.length) {
        ensureTimer();
      }
    },
    [ensureTimer, resolveWaiters, stopTimer],
  );

  /** Resolves once the displayed text has caught up to the current target. */
  const flush = useCallback((): Promise<void> => {
    if (displayedRef.current.length >= targetRef.current.length) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      doneResolversRef.current.push(resolve);
      ensureTimer();
    });
  }, [ensureTimer]);

  /** Clear everything back to empty (call after committing the message). */
  const reset = useCallback(() => {
    stopTimer();
    targetRef.current = "";
    displayedRef.current = "";
    resolveWaiters();
    setDisplayed("");
  }, [resolveWaiters, stopTimer]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      // Settle any pending flush() so an awaiting caller (e.g. a coach turn
      // mid type-out) never hangs after the component unmounts.
      const resolvers = doneResolversRef.current;
      doneResolversRef.current = [];
      resolvers.forEach((r) => r());
    };
  }, []);

  return { displayed, push, flush, reset };
}
