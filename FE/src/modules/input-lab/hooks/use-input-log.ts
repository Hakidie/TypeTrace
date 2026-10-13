import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { loggedEventTypes, type InputLogEntry } from '../types/input-lab.types';
import { toEntry } from '../utils/input-log';

/**
 * Keeps memory bounded if someone types for a long time. The long sample with Unikey makes ~6,200 events;
 * 5,000 cut its first words off and broke their timings. The table only draws the last rows, so this stays fast.
 */
const MAX_ENTRIES = 20000;

/**
 * Records native keyboard, input and composition events of one element.
 * Native listeners on purpose: React's synthetic `onBeforeInput` is a polyfill without `inputType`.
 *
 * Each entry is captured synchronously in the listener (so `value` and the caret are exact), but the
 * state update is deferred to the next animation frame. One keystroke fires 4+ events; re-rendering the
 * log after every one of them made typing lag once the log had a few hundred rows.
 */
export const useInputLog = () => {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [entries, setEntries] = useState<InputLogEntry[]>([]);
  const startRef = useRef<number | null>(null);
  const seqRef = useRef(0);
  const pendingRef = useRef<InputLogEntry[]>([]);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!target) return;

    const flush = () => {
      frameRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = [];
      if (pending.length === 0) return;
      // A transition: React may pause this render to let the browser show the typed character first.
      startTransition(() => setEntries((previous) => [...previous, ...pending].slice(-MAX_ENTRIES)));
    };

    const record = (event: Event) => {
      const now = performance.now();
      startRef.current ??= now;
      seqRef.current += 1;
      pendingRef.current.push(toEntry(event, target, seqRef.current, Math.round((now - startRef.current) * 10) / 10));
      frameRef.current ??= requestAnimationFrame(flush);
    };

    loggedEventTypes.forEach((type) => target.addEventListener(type, record));
    return () => {
      loggedEventTypes.forEach((type) => target.removeEventListener(type, record));
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      pendingRef.current = [];
    };
  }, [target]);

  const clear = useCallback(() => {
    startRef.current = null;
    seqRef.current = 0;
    pendingRef.current = [];
    setEntries([]);
  }, []);

  /** Pass as `ref` to the input, textarea or contenteditable element. */
  return { targetRef: setTarget, entries, clear };
};
