import { describe, expect, it } from 'vitest';
import type { InputLogEntry } from '../types/input-lab.types';
import { detectWordCommits, summarize } from './input-log';

type Step = Partial<InputLogEntry> & Pick<InputLogEntry, 'type'>;

/** Builds a log with one event every 10 ms. */
const log = (steps: Step[]): InputLogEntry[] =>
  steps.map((step, index) => ({
    seq: index + 1,
    time: index * 10,
    isComposing: false,
    value: '',
    selectionStart: null,
    selectionEnd: null,
    ...step,
  }));

const insert = (value: string, data: string): Step => ({ type: 'input', inputType: 'insertText', data, value });
const backspace = (value: string): Step => ({ type: 'input', inputType: 'deleteContentBackward', data: null, value });

describe('detectWordCommits', () => {
  it('handles IMEs that inject backspaces (Unikey/EVKey style)', () => {
    const entries = log([
      { type: 'keydown', key: 'v', keyCode: 86 },
      insert('v', 'v'),
      insert('vi', 'i'),
      insert('vie', 'e'),
      { type: 'keydown', key: 'e', keyCode: 69 },
      backspace('vi'),
      insert('viê', 'ê'),
      insert('viêt', 't'),
      backspace('viê'),
      backspace('vi'),
      insert('việt', 'ệt'),
      insert('việt ', ' '),
    ]);

    expect(detectWordCommits(entries)).toEqual([{ index: 0, word: 'việt', startedAt: 10, committedAt: 110 }]);
  });

  it('follows a real Unikey log: dummy "·" + backspaces per tone mark, and "text" restored before the comma', () => {
    // Taken from docs/spikes/ime-logs/2026-10-13-unikey-telex-chrome-input-short.json (Chrome 155, Windows 10).
    const entries = log([
      insert('T', 'T'),
      insert('Ti', 'i'),
      insert('Tie', 'e'),
      insert('Tie·', '·'), // Unikey inserts U+00B7, then deletes it together with the letters it retypes
      backspace('Tie'),
      backspace('Ti'),
      insert('Tiê', 'ê'),
      insert('Tiên', 'n'),
      insert('Tiêng', 'g'),
      insert('Tiêng·', '·'), // "s" typed: tone goes on ê, so Unikey retypes "ếng"
      backspace('Tiêng'),
      backspace('Tiên'),
      backspace('Tiê'),
      backspace('Ti'),
      insert('Tiế', 'ế'),
      insert('Tiến', 'n'),
      insert('Tiếng', 'g'),
      insert('Tiếng ', ' '),
      insert('Tiếng t', 't'),
      insert('Tiếng te', 'e'),
      insert('Tiếng tẽ', 'ẽ'), // "x" is the ngã tone in Telex
      insert('Tiếng tẽ·', '·'), // "t" typed: not Vietnamese, Unikey restores "tex" before inserting "t"
      backspace('Tiếng tẽ'),
      backspace('Tiếng t'),
      insert('Tiếng te', 'e'),
      insert('Tiếng tex', 'x'),
      insert('Tiếng text', 't'),
      insert('Tiếng text,', ','),
    ]);

    expect(detectWordCommits(entries).map(({ index, word }) => ({ index, word }))).toEqual([
      { index: 0, word: 'Tiếng' },
      { index: 1, word: 'text' },
    ]);
  });

  it('handles IMEs that compose (macOS style) and commits only after the separator', () => {
    const entries = log([
      { type: 'compositionstart', data: '', isComposing: true },
      { type: 'compositionupdate', data: 'đ', isComposing: true },
      { type: 'input', inputType: 'insertCompositionText', data: 'đ', isComposing: true, value: 'đ' },
      { type: 'compositionupdate', data: 'đẹp', isComposing: true },
      { type: 'input', inputType: 'insertCompositionText', data: 'đẹp', isComposing: true, value: 'đẹp' },
      { type: 'compositionend', data: 'đẹp', value: 'đẹp' },
      insert('đẹp ', ' '),
    ]);

    expect(detectWordCommits(entries)).toEqual([{ index: 0, word: 'đẹp', startedAt: 0, committedAt: 60 }]);
  });

  it('ignores separators typed inside a composition until it is committed', () => {
    const entries = log([
      { type: 'compositionstart', data: '', isComposing: true },
      { type: 'input', inputType: 'insertCompositionText', data: 'a b', isComposing: true, value: 'a b' },
    ]);

    expect(detectWordCommits(entries)).toEqual([]);
  });

  it('commits a word again after the user deletes back over its separator and fixes it', () => {
    const entries = log([insert('tôi', 'tôi'), insert('tôi ', ' '), backspace('tôi'), backspace('tô'), insert('tôn', 'n'), insert('tôn ', ' ')]);

    expect(detectWordCommits(entries).map(({ index, word }) => ({ index, word }))).toEqual([
      { index: 0, word: 'tôi' },
      { index: 0, word: 'tôn' },
    ]);
  });

  it('commits a word on punctuation', () => {
    const entries = log([insert('xong', 'xong'), insert('xong.', '.')]);

    expect(detectWordCommits(entries).map((commit) => commit.word)).toEqual(['xong']);
  });
});

describe('summarize', () => {
  it('counts event types, input types and IME key codes', () => {
    const summary = summarize(
      log([
        { type: 'keydown', key: 'Process', keyCode: 229 },
        { type: 'compositionstart', isComposing: true },
        backspace(''),
        { type: 'keydown', key: 'Backspace', keyCode: 8 },
      ]),
    );

    expect(summary.total).toBe(4);
    expect(summary.byType.keydown).toBe(2);
    expect(summary.usesComposition).toBe(true);
    expect(summary.keyCode229).toBe(1);
    expect(summary.backspaceInputs).toBe(1);
    expect(summary.keydownKeys).toEqual(['Process', 'Backspace']);
    expect(summary.inputTypes).toEqual({ deleteContentBackward: 1 });
  });
});
