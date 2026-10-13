import { completedWords, currentWord } from '@typetrace/shared';
import {
  loggedEventTypes,
  type InputLogEntry,
  type LabMeta,
  type LogSummary,
  type LoggedEventType,
  type TargetKind,
  type WordCommit,
} from '../types/input-lab.types';

type TypingTarget = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

/** Text of the typing target, whatever its kind. */
export const readValue = (target: TypingTarget) =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : (target.textContent ?? '');

const readSelection = (target: TypingTarget): [number | null, number | null] => {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return [target.selectionStart, target.selectionEnd];
  }
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return [null, null];
  return [selection.anchorOffset, selection.focusOffset];
};

/** Turns a native event into a plain, serializable log entry. */
export const toEntry = (event: Event, target: TypingTarget, seq: number, time: number): InputLogEntry => {
  const [selectionStart, selectionEnd] = readSelection(target);
  const entry: InputLogEntry = {
    seq,
    time,
    type: event.type as LoggedEventType,
    isComposing: false,
    value: readValue(target),
    selectionStart,
    selectionEnd,
  };
  if (event instanceof KeyboardEvent) {
    entry.key = event.key;
    entry.code = event.code;
    entry.keyCode = event.keyCode;
    entry.isComposing = event.isComposing;
  } else if (event instanceof InputEvent) {
    entry.inputType = event.inputType;
    entry.data = event.data;
    entry.isComposing = event.isComposing;
  } else if (event instanceof CompositionEvent) {
    entry.data = event.data;
    entry.isComposing = event.type !== 'compositionend';
  }
  return entry;
};

/**
 * Rule under test: a word is finished when a separator after it reaches the committed text.
 * Committed text = the value after an `input` event outside a composition, or after `compositionend`.
 * Keystrokes are ignored on purpose: IMEs inject backspaces or hold text in a composition.
 * The word rules themselves (separators, completed words) live in @typetrace/shared.
 */
export const detectWordCommits = (entries: InputLogEntry[]): WordCommit[] => {
  const commits: WordCommit[] = [];
  let done = 0;
  let startedAt: number | null = null;

  for (const entry of entries) {
    if (startedAt === null) {
      const typingStarted =
        entry.type === 'compositionstart' || (entry.type === 'input' && currentWord(entry.value) !== '');
      if (typingStarted) startedAt = entry.time;
    }

    const committed = (entry.type === 'input' && !entry.isComposing) || entry.type === 'compositionend';
    if (!committed) continue;

    const words = completedWords(entry.value);
    if (words.length > done) {
      for (let index = done; index < words.length; index += 1) {
        commits.push({ index, word: words[index], startedAt: startedAt ?? entry.time, committedAt: entry.time });
      }
      startedAt = null;
    }
    // Deleting back over a separator reopens that word: it is committed again when a separator returns.
    done = words.length;
  }
  return commits;
};

export const summarize = (entries: InputLogEntry[]): LogSummary => {
  const byType = Object.fromEntries(loggedEventTypes.map((type) => [type, 0])) as Record<LoggedEventType, number>;
  const inputTypes: Record<string, number> = {};
  const keydownKeys = new Set<string>();
  let keyCode229 = 0;

  for (const entry of entries) {
    byType[entry.type] += 1;
    if (entry.type === 'input' && entry.inputType) {
      inputTypes[entry.inputType] = (inputTypes[entry.inputType] ?? 0) + 1;
    }
    if (entry.type === 'keydown') {
      if (entry.key !== undefined) keydownKeys.add(entry.key);
      if (entry.keyCode === 229) keyCode229 += 1;
    }
  }

  return {
    total: entries.length,
    byType,
    inputTypes,
    keydownKeys: [...keydownKeys],
    keyCode229,
    usesComposition: byType.compositionstart > 0,
    backspaceInputs: inputTypes.deleteContentBackward ?? 0,
  };
};

/** Everything needed to fill one row of the results table in docs/spikes/ime-input-events.md. */
export const buildExport = (entries: InputLogEntry[], meta: LabMeta, target: TargetKind) => ({
  meta: { ...meta, target, userAgent: navigator.userAgent, recordedAt: new Date().toISOString() },
  summary: summarize(entries),
  words: detectWordCommits(entries),
  finalText: entries.at(-1)?.value ?? '',
  entries,
});
