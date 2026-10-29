import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { DailyToday } from '../types/daily.types';
import { DailyMode } from './DailyMode';

const today = vi.fn();
const startTry = vi.fn();
const complete = vi.fn();
const lottie = vi.fn();

vi.mock('../api/daily.api', () => ({
  dailyApi: {
    today: () => today(),
    leaderboard: () => Promise.resolve({ date: '2026-10-29', players: 0, items: [], me: null }),
    startTry: () => startTry(),
    history: () => Promise.resolve([]),
  },
}));
vi.mock('@/modules/typing/api/typing.api', () => ({
  typingApi: {
    begin: () => Promise.resolve({}),
    complete: (...args: unknown[]) => complete(...args),
  },
}));
vi.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: ({ src }: { src: string }) => {
    lottie(src);
    return null;
  },
}));

const day = (overrides: Partial<DailyToday> = {}): DailyToday => ({
  date: '2026-10-29',
  passageTitle: 'Hà Nội vào thu',
  preview: 'Hà Nội vào thu',
  seconds: 60,
  triesLeft: 2,
  best: { score: 57, wpm: 60, accuracy: 95 },
  rank: 4,
  streak: 5,
  coins: 0,
  lastTry: null,
  endsAt: new Date(Date.now() + 3_600_000).toISOString(),
  yesterdayWinner: null,
  ...overrides,
});
const afterBest = day({
  triesLeft: 1,
  best: { score: 63, wpm: 66, accuracy: 95 },
  rank: 3,
  streak: 6,
  coins: 45,
  lastTry: { score: 63, wpm: 66, accuracy: 95, counted: true, newBest: true, coins: 45 },
});
const session = { _id: 'd1', owner: 'u1', mode: 'daily', passageId: 'p1', targetWords: ['nhà', 'cửa'], status: 'in_progress', words: [], startedAt: '', isCounted: false };

/** Starts a try from the card and types both words; the card is `after` once the try is sent. */
const playTry = async (after: DailyToday) => {
  const user = userEvent.setup();
  renderWithProviders(<DailyMode />);
  await user.click(await screen.findByRole('button', { name: 'Start try 2' }));
  const area = await screen.findByRole('textbox', { name: 'Typing area' });
  today.mockResolvedValue(after);
  await user.type(area, 'nhà cửa ');
  await waitFor(() => expect(complete).toHaveBeenCalled());
};

describe('DailyMode', () => {
  beforeEach(() => {
    today.mockReset().mockResolvedValue(day());
    startTry.mockReset().mockResolvedValue(session);
    complete.mockReset().mockResolvedValue({ ...session, status: 'completed' });
    lottie.mockReset();
  });

  it('starts a try from the card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DailyMode />);

    await user.click(await screen.findByRole('button', { name: 'Start try 2' }));

    expect(await screen.findByRole('textbox', { name: 'Typing area' })).toBeInTheDocument();
    expect(screen.getByText('nhà')).toBeInTheDocument();
    expect(startTry).toHaveBeenCalledTimes(1);
  });

  it('sends the try with the 60 seconds of the challenge', async () => {
    await playTry(afterBest);

    expect(complete).toHaveBeenCalledWith('d1', ['nhà', 'cửa'], [expect.any(Number), expect.any(Number)], 60);
  });

  it('shows the result after the try', async () => {
    await playTry(afterBest);

    expect(await screen.findByLabelText('Score')).toBeInTheDocument();
    expect(screen.getByText('New best, #4 → #3')).toBeInTheDocument();
    expect(screen.getByLabelText('Coins')).toHaveTextContent('+45');
    expect(screen.getByText('20 + streak 25')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again (1 left)' })).toBeInTheDocument();
    expect(lottie).toHaveBeenCalledWith('/lottie/confetti.lottie');
  });

  it('names the rank of a first best of the day and a one-day streak', async () => {
    today.mockResolvedValue(day({ best: null, rank: null, streak: 0, triesLeft: 3 }));
    const user = userEvent.setup();
    renderWithProviders(<DailyMode />);
    await user.click(await screen.findByRole('button', { name: 'Start try 1' }));
    const area = await screen.findByRole('textbox', { name: 'Typing area' });
    today.mockResolvedValue({ ...afterBest, rank: 1, streak: 1, lastTry: { ...afterBest.lastTry!, coins: 20 } });
    await user.type(area, 'nhà cửa ');

    expect(await screen.findByText('New best, #1 today')).toBeInTheDocument();
    expect(screen.getByText('Streak 1 day')).toBeInTheDocument();
  });

  it('shows confetti only for a new best', async () => {
    await playTry(day({ triesLeft: 1, lastTry: { score: 50, wpm: 52, accuracy: 96, counted: true, newBest: false, coins: 0 } }));

    await screen.findByLabelText('Score');
    expect(lottie).not.toHaveBeenCalledWith('/lottie/confetti.lottie');
  });

  it('says when a try did not count', async () => {
    await playTry(day({ triesLeft: 1, lastTry: { score: 0, wpm: 4, accuracy: 100, counted: false, newBest: false, coins: 0 } }));

    expect(await screen.findByText('This try was too short to count')).toBeInTheDocument();
  });

  it('says when the last try of the day is used', async () => {
    await playTry({ ...afterBest, triesLeft: 0 });

    expect(await screen.findByText('Come back tomorrow')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Try again/ })).not.toBeInTheDocument();
  });

  it('shows an empty state when there is no passage', async () => {
    today.mockRejectedValue({ response: { status: 404 } });
    renderWithProviders(<DailyMode />);

    expect(await screen.findByText('No daily challenge today')).toBeInTheDocument();
  });
});
