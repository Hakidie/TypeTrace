import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { renderWithProviders } from '@/test/render-with-providers';
import { DailyLeaderboard } from './DailyLeaderboard';

const leaderboard = vi.fn();

vi.mock('../api/daily.api', () => ({ dailyApi: { leaderboard: (day: string) => leaderboard(day) } }));
vi.mock('@lottiefiles/dotlottie-react', () => ({ DotLottieReact: () => null }));

const row = (rank: number, displayName: string, score: number, isMe = false) => ({ rank, displayName, avatar: DEFAULT_AVATAR, score, wpm: score, accuracy: 100, isMe });

describe('DailyLeaderboard', () => {
  beforeEach(() => {
    leaderboard.mockReset().mockResolvedValue({
      date: '2026-10-29',
      players: 38,
      items: [row(1, 'Minh Lan', 82), row(2, 'Quốc Tuấn', 74), row(3, 'Lan', 57, true)],
      me: { rank: 3, score: 57 },
    });
  });

  it("lists today's top players with you highlighted", async () => {
    renderWithProviders(<DailyLeaderboard yesterdayWinner={null} />);

    expect(await screen.findByText('Minh Lan')).toBeInTheDocument();
    expect(screen.getByText('38 typists')).toBeInTheDocument();
    expect(screen.getByText('Lan').closest('li')).toHaveAttribute('aria-current', 'true');
    expect(leaderboard).toHaveBeenCalledWith('today');
  });

  it("shows yesterday's winner", async () => {
    renderWithProviders(<DailyLeaderboard yesterdayWinner={{ displayName: 'Quốc Tuấn', avatar: DEFAULT_AVATAR, score: 79 }} />);

    expect(await screen.findByText("Yesterday's winner: Quốc Tuấn, 79")).toBeInTheDocument();
  });

  it('invites to play when nobody has played yet', async () => {
    leaderboard.mockResolvedValue({ date: '2026-10-29', players: 0, items: [], me: null });
    renderWithProviders(<DailyLeaderboard yesterdayWinner={null} />);

    expect(await screen.findByText('Be the first today')).toBeInTheDocument();
  });

  it('shows an error with a retry', async () => {
    leaderboard.mockRejectedValueOnce(new Error('down'));
    renderWithProviders(<DailyLeaderboard yesterdayWinner={null} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Minh Lan')).toBeInTheDocument();
  });
});
