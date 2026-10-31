import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { tutorialStore } from '@/modules/tutorial/lib/tutorial-store';
import { ROUND_MS } from '../lib/rain-game';
import { RainMode } from './RainMode';

const words = vi.fn();

vi.mock('../api/rain.api', () => ({ rainApi: { words: () => words() } }));
vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: async () => ({ _id: 'u1', email: 'lan@example.com', role: 'user' }) },
}));

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const startRound = async () => {
  renderWithProviders(<RainMode />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
};

describe('RainMode', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    words.mockReset().mockResolvedValue({ words: ['nhà', 'cửa', 'bàn'], focus: [] });
  });
  afterEach(() => vi.useRealTimers());

  it('shows the start screen once the words are loaded', async () => {
    renderWithProviders(<RainMode />);

    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByText('Word rain')).toBeInTheDocument();
  });

  it('shows an empty state when the bank has no words', async () => {
    words.mockResolvedValue({ words: [], focus: [] });
    renderWithProviders(<RainMode />);

    expect(await screen.findByText('No words to rain yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
  });

  it('shows an error with a retry', async () => {
    words.mockRejectedValueOnce(new Error('down'));
    renderWithProviders(<RainMode />);

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('starts the round with Start', async () => {
    await startRound();

    expect(screen.getByRole('img', { name: '3 lives left' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Type a falling word' })).toHaveFocus();
    expect(screen.getByLabelText('Time left')).toHaveTextContent('1:00');
  });

  it('starts the round with Enter', async () => {
    renderWithProviders(<RainMode />);
    await screen.findByRole('button', { name: 'Start' });

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(screen.getByRole('textbox', { name: 'Type a falling word' })).toBeInTheDocument();
  });

  it('scores a typed word', async () => {
    await startRound();
    advance(200);
    const text = screen.getByTestId('tile-1').textContent!;

    fireEvent.change(screen.getByRole('textbox', { name: 'Type a falling word' }), { target: { value: `${text} ` } });

    expect(screen.getByLabelText('Score')).toHaveTextContent('1');
    expect(screen.getByRole('textbox', { name: 'Type a falling word' })).toHaveValue('');
  });

  it('scores the word in the box with Enter', async () => {
    await startRound();
    advance(200);
    const box = screen.getByRole('textbox', { name: 'Type a falling word' });
    fireEvent.change(box, { target: { value: screen.getByTestId('tile-1').textContent } });
    expect(screen.getByLabelText('Score')).toHaveTextContent('0');

    fireEvent.keyDown(box, { key: 'Enter' });

    expect(screen.getByLabelText('Score')).toHaveTextContent('1');
    expect(box).toHaveValue('');
  });

  it('lets the keyboard finish its word when Enter only confirms it', async () => {
    await startRound();
    advance(200);
    const box = screen.getByRole('textbox', { name: 'Type a falling word' });
    fireEvent.change(box, { target: { value: screen.getByTestId('tile-1').textContent } });

    fireEvent.keyDown(box, { key: 'Enter', isComposing: true });

    expect(screen.getByLabelText('Score')).toHaveTextContent('0');
  });

  it('pauses with Escape and resumes', async () => {
    await startRound();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByText('Paused')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.queryByText('Paused')).not.toBeInTheDocument();
  });

  it('shows the result when the time is up', async () => {
    await startRound();

    advance(ROUND_MS + 500);

    expect(screen.getByText('You beat the rain')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument();
  });

  it('holds the rain for Ping until the framed word is typed', async () => {
    const done = vi.fn();
    tutorialStore.setHold('rain-word', done);
    await startRound();
    advance(300);
    // The word falls a third of its way first, so it stands in the middle of the stage, not under Ping at the top.
    expect(document.querySelector('[data-tutorial="rain-word"]')).toBeNull();
    advance(3000);
    const framed = document.querySelector('[data-tutorial="rain-word"]');
    expect(framed).not.toBeNull();
    const word = framed!.textContent!;
    const time = screen.getByLabelText('Time left').textContent;

    advance(3000);
    // Nothing moves while Ping explains: the clock stands still, but the box still takes the word.
    expect(screen.getByLabelText('Time left')).toHaveTextContent(time!);
    const box = screen.getByRole('textbox', { name: 'Type a falling word' });
    expect(box).toBeEnabled();
    fireEvent.change(box, { target: { value: word + ' ' } });

    expect(done).toHaveBeenCalledOnce();
    expect(tutorialStore.get().hold).toBeNull();
  });
});
