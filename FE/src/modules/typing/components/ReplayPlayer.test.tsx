import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render-with-providers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplayEvent } from '../types/typing.types';
import { ReplayPlayer } from './ReplayPlayer';
import { TypingArea } from './TypingArea';

const words = ['Tiếng', 'Việt', 'đẹp.'];

const passage = () => screen.getByLabelText('Passage to type');
const wordAt = (index: number) => passage().children[index] as HTMLElement;
const slider = () => screen.getByRole('slider', { name: 'Replay position' });
const seek = (ms: number) => fireEvent.change(slider(), { target: { value: String(ms) } });
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

/** "Tiếng Việt đẹp. " in 3.2 s, with a stop of 2 s after "Tiếng ". */
const events: ReplayEvent[] = [
  [0, 0, 0, 'Tiếng'], // 0 ms
  [500, 5, 0, ' '], // 500 ms: the first word is finished
  [2000, 6, 0, 'Vi'], // 2500 ms, after a stop of 2 s
  [300, 8, 0, 'ệt '], // 2800 ms
  [400, 11, 0, 'đẹp. '], // 3200 ms: all the words are finished
];

describe('ReplayPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays the typing back from the start at once, as the learner saw it', () => {
    renderWithProviders(<ReplayPlayer targetWords={words} events={events} />);

    expect(wordAt(0).className).toContain('bg-destructive/15'); // being typed
    expect(wordAt(0).children[1]).toHaveTextContent('Tiếng');
    expect(screen.getByText('0:00 / 0:03')).toBeInTheDocument();

    wait(600);
    expect(wordAt(0).className).toContain('text-foreground'); // finished and right
    expect(wordAt(1).className).toContain('bg-destructive/15');
    expect(slider()).toHaveValue('600');
  });

  it('stops on Pause and goes on from there on Play', () => {
    renderWithProviders(<ReplayPlayer targetWords={words} events={events} />);
    wait(500);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    wait(2000);
    expect(slider()).toHaveValue('500');

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    wait(1000);
    expect(slider()).toHaveValue('1500');
  });

  it('plays at the speed chosen, 1× being the speed the learner typed at', () => {
    renderWithProviders(<ReplayPlayer targetWords={words} events={events} />);
    const speeds = screen.getByRole('radiogroup', { name: 'Speed' });
    expect(speeds).toHaveTextContent('0.5×1×2×4×');
    expect(screen.getByRole('radio', { name: '1×' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: '2×' }));
    wait(1000);
    expect(slider()).toHaveValue('2000');

    fireEvent.click(screen.getByRole('radio', { name: '0.5×' }));
    wait(1000);
    expect(slider()).toHaveValue('2500');
  });

  it('moves to any moment with the time bar', () => {
    renderWithProviders(<ReplayPlayer targetWords={words} events={events} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    seek(2800);

    expect(wordAt(1).className).toContain('text-foreground');
    expect(wordAt(2).className).toContain('bg-destructive/15');
    expect(screen.getByText('0:02 / 0:03')).toBeInTheDocument();
    expect(slider()).toHaveAttribute('aria-valuetext', '0:02 of 0:03');
  });

  it('marks where the learner stopped and goes there on a click', () => {
    renderWithProviders(<ReplayPlayer targetWords={words} events={events} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    seek(3000);

    fireEvent.click(screen.getByRole('button', { name: 'Hesitation at 0:00: 2.0 s on “Việt”' }));

    expect(slider()).toHaveValue('500');
    expect(wordAt(0).className).toContain('text-foreground');
    expect(wordAt(1).children[1]).toHaveTextContent(/^$/); // "Việt" not started yet
    // The usual pause is 400 ms: only a stop of 1.2 s or more counts.
    expect(screen.getByText('1 hesitation: stops of 1.2 s or more.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Hesitation/ })).toHaveLength(1);
  });

  it('says so when the learner never stopped', () => {
    renderWithProviders(<ReplayPlayer targetWords={words} events={[[0, 0, 0, 'Tiếng '], [300, 6, 0, 'Việt ']]} />);

    expect(screen.getByText('No hesitation: you never stopped 1.0 s or more.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Hesitation/ })).not.toBeInTheDocument();
  });

  it('stops at the end without a caret, and Play starts again from the beginning', () => {
    renderWithProviders(<ReplayPlayer targetWords={words} events={events} />);

    wait(5000);
    expect(screen.getByText('0:03 / 0:03')).toBeInTheDocument();
    expect(passage().querySelector('.animate-pulse')).toBeNull();
    expect(Array.from(passage().children).every((word) => word.className.includes('text-foreground'))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(slider()).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('tells until when the replay is kept', () => {
    renderWithProviders(<ReplayPlayer targetWords={words} events={events} expiresAt="2026-12-03T08:00:00.000Z" />);

    expect(screen.getByText('Kept until 03 Dec 2026')).toBeInTheDocument();
  });
});

/**
 * SCRUM-35: a learner types "Tiếng Việt đẹp. " with one of two input methods, and the replay must show, at every moment, the
 * passage exactly as the typing area showed it then. Unikey (Telex here) types a mark as backspaces and new letters, with
 * no composition; the Vietnamese keyboards of Windows and macOS, and phones, compose a word (VNI here) and commit it at the
 * space or the full stop, and some browsers keep the text one letter behind the composition.
 */
describe('the replay of two input methods (SCRUM-35)', () => {
  const T0 = Date.UTC(2026, 10, 3, 8);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** A key at `ms` after the first one. */
  type Key = [ms: number, press: (area: HTMLElement, ms: number) => void];

  /** Unikey: a key gives the texts the textarea goes through, a millisecond apart (a mark: backspaces, then new letters). */
  const unikey =
    (...texts: string[]) =>
    (area: HTMLElement, ms: number) => {
      fireEvent.keyDown(area, { key: 'Unidentified' });
      texts.forEach((text, index) => {
        vi.setSystemTime(T0 + ms + index);
        fireEvent.change(area, { target: { value: text } });
      });
    };

  /** An input method that composes: the word being composed, and the textarea's text (maybe a letter behind). */
  const compose =
    (word: string, text: string, first = false) =>
    (area: HTMLElement) => {
      fireEvent.keyDown(area, { key: 'Process' });
      if (first) fireEvent.compositionStart(area);
      fireEvent.compositionUpdate(area, { data: word });
      fireEvent.change(area, { target: { value: text } });
    };

  /** A space or a full stop ends the composition: the word is committed, then the key's own character comes. */
  const commit =
    (word: string, text: string, after: string) =>
    (area: HTMLElement) => {
      fireEvent.keyDown(area, { key: after.at(-1) });
      fireEvent.change(area, { target: { value: text } });
      fireEvent.compositionEnd(area, { data: word });
      fireEvent.change(area, { target: { value: after } });
    };

  /** A key typed straight into the text, outside a composition. */
  const plain = (text: string) => (area: HTMLElement) => {
    fireEvent.keyDown(area, { key: text.at(-1) });
    fireEvent.change(area, { target: { value: text } });
  };

  /** Types the keys and notes what the passage shows after each one; returns that and what the area finished with. */
  const typeAndWatch = (keys: Key[]) => {
    const onFinish = vi.fn();
    const view = renderWithProviders(<TypingArea targetWords={words} onFinish={onFinish} />);
    const area = screen.getByRole('textbox', { name: 'Typing area' });
    const seen = keys.map(([ms, press]) => {
      vi.setSystemTime(T0 + ms);
      press(area, ms);
      return { ms, html: passage().innerHTML };
    });
    view.unmount();
    expect(onFinish).toHaveBeenCalledTimes(1);
    const [typedWords, , replay] = onFinish.mock.calls[0] as [string[], number[], ReplayEvent[]];
    return { seen, typedWords, replay };
  };

  /** Plays the replay back and checks that it shows, at each moment, what the passage showed while typing. */
  const expectSameAsTyping = (seen: { ms: number; html: string }[], replay: ReplayEvent[]) => {
    renderWithProviders(<ReplayPlayer targetWords={words} events={replay} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    for (const { ms, html } of seen) {
      seek(ms);
      expect({ ms, html: passage().innerHTML }).toEqual({ ms, html });
    }
  };

  it('Unikey with Telex: backspaces and new letters, a wrong word taken back, a stop on “Việt”', () => {
    const { seen, typedWords, replay } = typeAndWatch([
      [0, unikey('T')],
      [100, unikey('Ti')],
      [200, unikey('Tie')],
      [300, unikey('Ti', 'Tiê')], // e: ê
      [400, unikey('Tiên')],
      [500, unikey('Tiêng')],
      [600, unikey('Tiên', 'Tiê', 'Ti', 'Tiế', 'Tiến', 'Tiếng')], // s: the tone goes on ê
      [700, unikey('Tiếng ')],
      [800, unikey('Tiếng V')],
      [900, unikey('Tiếng Vi')],
      [1000, unikey('Tiếng Vie')],
      [1100, unikey('Tiếng Viet')],
      [1200, unikey('Tiếng Viet ')], // finished, and wrong
      [1300, unikey('Tiếng Viet')], // Backspace: the word is being typed again
      [1400, unikey('Tiếng Vie')],
      [1500, unikey('Tiếng Vi', 'Tiếng Viê')],
      [1600, unikey('Tiếng Viêt')],
      [3600, unikey('Tiếng Viê', 'Tiếng Vi', 'Tiếng Việ', 'Tiếng Việt')], // j, after a stop of 2 s
      [3700, unikey('Tiếng Việt ')],
      [3800, unikey('Tiếng Việt d')],
      [3900, unikey('Tiếng Việt ', 'Tiếng Việt đ')], // d: đ
      [4000, unikey('Tiếng Việt đe')],
      [4100, unikey('Tiếng Việt đep')],
      [4200, unikey('Tiếng Việt đe', 'Tiếng Việt đ', 'Tiếng Việt đẹ', 'Tiếng Việt đẹp')],
      [4300, unikey('Tiếng Việt đẹp.')],
      [4400, unikey('Tiếng Việt đẹp. ')],
    ]);

    expect(typedWords).toEqual(words);
    expect(replay).toHaveLength(26); // one change per key, however many inputs the key sent
    expect(seen[12].html).toContain('Should be: Việt'); // the wrong word was on screen for a moment
    expectSameAsTyping(seen, replay);
    expect(screen.getByRole('button', { name: 'Hesitation at 0:01: 2.0 s on “Việt”' })).toBeInTheDocument();
  });

  it('an input method that composes, with VNI: the word shows while composed and is graded once committed', () => {
    const { seen, typedWords, replay } = typeAndWatch([
      [0, compose('T', 'T', true)],
      [100, compose('Ti', 'Ti')],
      [200, compose('Tie', 'Tie')],
      [300, compose('Tiê', 'Tie')], // 6: ê, the text still one letter behind
      [400, compose('Tiế', 'Tiế')], // 1: sắc
      [500, compose('Tiến', 'Tiến')],
      [600, compose('Tiếng', 'Tiếng')],
      [700, commit('Tiếng', 'Tiếng', 'Tiếng ')],
      [800, compose('V', 'Tiếng V', true)],
      [900, compose('Vi', 'Tiếng Vi')],
      [1000, compose('Vie', 'Tiếng Vie')],
      [1100, compose('Viê', 'Tiếng Viê')],
      [1200, compose('Viêt', 'Tiếng Viê')],
      [3200, compose('Việt', 'Tiếng Việt')], // 5: nặng, after a stop of 2 s
      [3300, commit('Việt', 'Tiếng Việt', 'Tiếng Việt ')],
      [3400, compose('d', 'Tiếng Việt d', true)],
      [3500, compose('đ', 'Tiếng Việt đ')], // 9: đ
      [3600, compose('đe', 'Tiếng Việt đe')],
      [3700, compose('đep', 'Tiếng Việt đep')],
      [3800, compose('đẹp', 'Tiếng Việt đẹp')],
      [3900, commit('đẹp', 'Tiếng Việt đẹp', 'Tiếng Việt đẹp.')],
      [4000, plain('Tiếng Việt đẹp. ')],
    ]);

    expect(typedWords).toEqual(words);
    expect(replay).toHaveLength(22); // one change per key
    // Composed, not graded yet: every key but the two spaces and the full stop that commit, and the last space.
    expect(replay.filter((event) => event.length === 5)).toHaveLength(18);
    expectSameAsTyping(seen, replay);
    expect(screen.getByRole('button', { name: 'Hesitation at 0:01: 2.0 s on “Việt”' })).toBeInTheDocument();
  });
});
