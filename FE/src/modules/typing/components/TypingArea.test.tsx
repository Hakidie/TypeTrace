import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TypingArea } from './TypingArea';

const words = ['Tiếng', 'Việt', 'đẹp.'];

const renderArea = (onFinish = vi.fn()) => {
  render(<TypingArea targetWords={words} onFinish={onFinish} />);
  return { area: screen.getByRole('textbox', { name: 'Typing area' }), onFinish };
};

const passage = () => screen.getByLabelText('Passage to type');
const wordAt = (index: number) => passage().children[index] as HTMLElement;

describe('TypingArea', () => {
  it('colours a word as soon as it is finished, not before', async () => {
    const user = userEvent.setup();
    const { area } = renderArea();

    await user.type(area, 'Tieng');
    expect(wordAt(0)).toHaveTextContent('Tieng'); // typed, not graded yet
    expect(wordAt(0).className).toContain('bg-destructive/15');

    await user.type(area, ' ');
    expect(wordAt(0)).toHaveTextContent('Tieng'); // wrong: keeps what was typed
    expect(wordAt(0).className).not.toContain('bg-destructive/15');
    expect(wordAt(1).className).toContain('bg-destructive/15'); // the next word is now the current one
  });

  it('finishes with the typed words when the last word is closed by a space', async () => {
    const user = userEvent.setup();
    const { area, onFinish } = renderArea();

    await user.type(area, 'Tiếng Việt đẹp. ');

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(['Tiếng', 'Việt', 'đẹp.']);
    expect(area).toBeDisabled();
  });

  it('finishes when Enter closes the last word', async () => {
    const user = userEvent.setup();
    const { area, onFinish } = renderArea();

    await user.type(area, 'Tiếng Việt đẹp.{Enter}');

    expect(onFinish).toHaveBeenCalledWith(['Tiếng', 'Việt', 'đẹp.']);
  });

  it('does not grade text the input method has not committed yet', () => {
    const { area, onFinish } = renderArea();

    fireEvent.compositionStart(area);
    fireEvent.change(area, { target: { value: 'Tieengs ' } }); // half-written, with a space in it
    expect(wordAt(0).className).toContain('bg-destructive/15'); // still the next word

    fireEvent.change(area, { target: { value: 'Tiếng ' } });
    fireEvent.compositionEnd(area);
    expect(wordAt(0).className).toContain('text-foreground'); // committed and correct: white
    expect(wordAt(0).className).not.toContain('bg-destructive/15');
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('ignores Enter while a composition is open', () => {
    const { area } = renderArea();

    fireEvent.compositionStart(area);
    fireEvent.change(area, { target: { value: 'Tieeng' } });
    fireEvent.keyDown(area, { key: 'Enter' });

    expect(area).toHaveValue('Tieeng');
  });

  it('blocks pasting text', () => {
    const { area } = renderArea();

    const pasted = fireEvent.paste(area, { clipboardData: { getData: () => 'Tiếng Việt đẹp. ' } });

    expect(pasted).toBe(false); // the handler called preventDefault
    expect(area).toHaveValue('');
  });
});

describe('TypingArea typed text', () => {
  it('shows what is typed in white over the whole target word in grey, inside the passage', async () => {
    const user = userEvent.setup();
    const { area } = renderArea();

    await user.type(area, 'Tie');

    const [placeholder, typed] = Array.from(wordAt(0).children);
    expect(placeholder).toHaveTextContent('Tiếng'); // the whole target, marks included
    expect(placeholder.className).toContain('muted');
    expect(typed).toHaveTextContent('Tie');
    expect(typed.className).toContain('text-foreground');
  });

  it('colours nothing red until the word is finished', async () => {
    const user = userEvent.setup();
    const { area } = renderArea();

    await user.type(area, 'Tia');
    expect(wordAt(0).querySelector('.text-destructive')).toBeNull();

    await user.type(area, ' ');
    expect(wordAt(0).className).toContain('text-destructive');
  });

  it('shows a wrong finished word as typed, with the target on hover', async () => {
    const user = userEvent.setup();
    const { area } = renderArea();

    await user.type(area, 'Tieng ');

    expect(wordAt(0)).toHaveTextContent('Tieng');
    expect(wordAt(0)).toHaveAttribute('title', 'Should be: Tiếng');
  });

  it('shows a correct finished word in white', async () => {
    const user = userEvent.setup();
    const { area } = renderArea();

    await user.type(area, 'Tiếng ');

    expect(wordAt(0)).toHaveTextContent('Tiếng');
    expect(wordAt(0).className).toContain('text-foreground');
  });
});

describe('TypingArea composition', () => {
  it('shows the text being composed, even if the textarea value does not contain it yet', () => {
    const { area } = renderArea();

    fireEvent.compositionStart(area);
    fireEvent.compositionUpdate(area, { data: 'Tiế' });

    expect(wordAt(0).children[1]).toHaveTextContent('Tiế');
  });

  it('does not show the composed word twice when the value already holds a stale copy of it', () => {
    const { area } = renderArea();

    fireEvent.compositionStart(area);
    fireEvent.change(area, { target: { value: 'Tien' } });
    fireEvent.compositionUpdate(area, { data: 'Tieng' });

    expect(wordAt(0).children[1]).toHaveTextContent(/^Tieng$/);
  });
});

describe('TypingArea layout', () => {
  it('shows only 3 lines of the passage (3 x 44px and 2 gaps of 8px)', () => {
    render(<TypingArea targetWords={words} onFinish={vi.fn()} />);
    expect(passage()).toHaveStyle({ height: '148px' });
  });

  it('shows the actions, the word count and the timer outside of the card', () => {
    render(<TypingArea targetWords={words} onFinish={vi.fn()} actions={<button>Restart</button>} />);

    // passage -> its relative wrapper -> card content -> the card
    const card = screen.getByLabelText('Passage to type').parentElement?.parentElement?.parentElement as HTMLElement;
    expect(card).toContainElement(screen.getByLabelText('Passage to type'));
    expect(card).not.toContainElement(screen.getByRole('button', { name: 'Restart' }));
    expect(card).not.toContainElement(screen.getByText('Words 0 / 3'));
    expect(card).not.toContainElement(screen.getByLabelText('Elapsed time'));
    expect(screen.getByLabelText('Elapsed time')).toHaveClass('justify-self-center');
  });
});

describe('TypingArea timer', () => {
  it('starts only at the first key, once, and ignores modifier keys', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<TypingArea targetWords={words} onStart={onStart} onFinish={vi.fn()} />);
    const area = screen.getByRole('textbox', { name: 'Typing area' });
    expect(screen.getByLabelText('Elapsed time')).toHaveTextContent('0:00');

    await user.keyboard('{Shift}');
    expect(onStart).not.toHaveBeenCalled();

    await user.type(area, 'Ti');
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('counts the seconds after the first key', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { area } = renderArea();

      vi.advanceTimersByTime(5000);
      expect(screen.getByLabelText('Elapsed time')).toHaveTextContent('0:00'); // idle time does not count

      await user.type(area, 'T');
      vi.advanceTimersByTime(3000);
      await waitFor(() => expect(screen.getByLabelText('Elapsed time')).toHaveTextContent('0:03'));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('TypingArea time limit', () => {
  it('shows only the elapsed time, without the limit', () => {
    render(<TypingArea targetWords={words} onFinish={vi.fn()} />);

    expect(screen.getByLabelText('Elapsed time')).toHaveTextContent(/^0:00$/);
  });

  it('ends at 3:00 with the words finished so far', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onFinish = vi.fn();
      const onTimeUp = vi.fn();
      render(<TypingArea targetWords={words} onFinish={onFinish} onTimeUp={onTimeUp} />);

      await user.type(screen.getByRole('textbox', { name: 'Typing area' }), `${words[0]} ${words[1]} `);
      expect(onFinish).not.toHaveBeenCalled();
      vi.advanceTimersByTime(180_000);

      await waitFor(() => expect(onFinish).toHaveBeenCalledWith([words[0], words[1]]));
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onTimeUp).not.toHaveBeenCalled();
      expect(screen.getByRole('textbox', { name: 'Typing area' })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('tells the page when time is up and no word was finished', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onFinish = vi.fn();
      const onTimeUp = vi.fn();
      render(<TypingArea targetWords={words} onFinish={onFinish} onTimeUp={onTimeUp} />);

      await user.type(screen.getByRole('textbox', { name: 'Typing area' }), 'Ti');
      vi.advanceTimersByTime(180_000);

      await waitFor(() => expect(onTimeUp).toHaveBeenCalledTimes(1));
      expect(onFinish).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
