/** Native events the lab listens to on the typing target. */
export const loggedEventTypes = [
  'keydown',
  'keyup',
  'beforeinput',
  'input',
  'compositionstart',
  'compositionupdate',
  'compositionend',
] as const;

export type LoggedEventType = (typeof loggedEventTypes)[number];

/** Which kind of element receives the typing. The real typing screen may use any of them. */
export type TargetKind = 'input' | 'textarea' | 'contenteditable';

/** One recorded event. `value` is the target's text at the moment the handler ran. */
export interface InputLogEntry {
  seq: number;
  /** Milliseconds since the first event of the session. */
  time: number;
  type: LoggedEventType;
  /** KeyboardEvent.key / code / keyCode (keydown, keyup). */
  key?: string;
  code?: string;
  keyCode?: number;
  /** InputEvent.inputType (beforeinput, input). */
  inputType?: string;
  /** InputEvent.data or CompositionEvent.data. */
  data?: string | null;
  isComposing: boolean;
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
}

/** A word the detector considers finished, with the time it took to type. */
export interface WordCommit {
  index: number;
  word: string;
  /** Time of the first event that changed the text for this word. */
  startedAt: number;
  /** Time the separator after the word reached the committed text. */
  committedAt: number;
}

export interface LogSummary {
  total: number;
  byType: Record<LoggedEventType, number>;
  /** Count per InputEvent.inputType, from `input` events. */
  inputTypes: Record<string, number>;
  /** Distinct KeyboardEvent.key values seen on keydown, e.g. "Process", "Unidentified", "Backspace". */
  keydownKeys: string[];
  /** keydown events with keyCode 229 (the browser says an IME handles the key). */
  keyCode229: number;
  usesComposition: boolean;
  /** `input` events with inputType deleteContentBackward (real and IME-injected backspaces). */
  backspaceInputs: number;
}

/** Notes the tester fills in so an exported log can be read later. */
export interface LabMeta {
  ime: string;
  method: string;
  note: string;
  /** Id of the sample text from input-lab.config.ts. */
  sample: string;
}
