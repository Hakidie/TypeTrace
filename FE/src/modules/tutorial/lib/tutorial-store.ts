import { useSyncExternalStore } from 'react';

/**
 * What the running guide asks of the page around it, so the guide and the modes need not know each other:
 * `hold: 'rain-word'` = word rain stops falling until the learner types the framed word (`completeHold` then lets the
 * guide go on). `onHoldDone` is set by the guide.
 */
interface TutorialPageState {
  hold: 'rain-word' | null;
}

let state: TutorialPageState = { hold: null };
let onHoldDone: (() => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const tutorialStore = {
  /** Called by the guide when a step that waits for the learner starts (or with `null` when it ends). */
  setHold(hold: TutorialPageState['hold'], done: (() => void) | null = null) {
    state = { hold };
    onHoldDone = done;
    emit();
  },
  /** Called by the page when the learner did what the step waits for. */
  completeHold() {
    const done = onHoldDone;
    tutorialStore.setHold(null);
    done?.();
  },
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** What the running guide asks of the page (see `tutorialStore`). */
export const useTutorialHold = () => useSyncExternalStore(tutorialStore.subscribe, () => tutorialStore.get().hold);
