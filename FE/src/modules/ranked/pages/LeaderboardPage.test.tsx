import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { LeaderboardPage } from './LeaderboardPage';

const leaderboard = vi.fn();

vi.mock('../api/ranked.api', () => ({
  rankedApi: { leaderboard: (params: unknown) => leaderboard(params) },
}));

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: async () => ({ _id: 'u2', email: 'lan@example.com', role: 'user' }) },
}));

const avatar = { skin: 'peach', face: 'classic', hair: 'short-brown', top: 'red', bottom: 'navy', shoes: 'sneakers-brown' };
const row = (rank: number, userId: string, displayName: string, rating: number, tier: string, winRate: number) => ({
  rank,
  userId,
  displayName,
  avatar,
  rating,
  tier,
  matches: 20,
  wins: Math.round(winRate * 20),
  winRate,
});
const season = { number: 3, startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-11-26T00:00:00.000Z' };
const board = (items: unknown[], extra = {}) => ({ items, page: 1, limit: 20, total: items.length, totalPages: 1, season, ...extra });

const renderPage = (route = '/leaderboard') => renderWithProviders(<LeaderboardPage />, { route, path: '/leaderboard' });

beforeEach(() => {
  tokenStore.set('test-token');
  leaderboard.mockReset();
});

describe('LeaderboardPage (ranked duel, phase 5)', () => {
  it('lists the season by rank with name, tier, rating and win rate, and marks the user', async () => {
    leaderboard.mockResolvedValue(board([row(1, 'u1', 'Minh', 1420, 'Platinum', 0.75), row(2, 'u2', 'Lan', 1260, 'Gold', 0.5)]));
    renderPage();

    const rows = await screen.findAllByRole('article');
    expect(within(rows[0]).getByText('#1')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Minh')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Platinum')).toBeInTheDocument();
    expect(within(rows[0]).getByText('1420')).toBeInTheDocument();
    expect(within(rows[0]).getByText('75%')).toBeInTheDocument();
    expect(within(rows[1]).getByText('(you)')).toBeInTheDocument();
    expect(screen.getByText(/Season 3/)).toBeInTheDocument();
    expect(leaderboard).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('says when nobody has 5 matches yet', async () => {
    leaderboard.mockResolvedValue(board([]));
    renderPage();

    expect(await screen.findByText('No ranked players yet')).toBeInTheDocument();
  });

  it('turns the pages', async () => {
    leaderboard.mockResolvedValue(board([row(1, 'u1', 'Minh', 1420, 'Platinum', 0.75)], { total: 25, totalPages: 2 }));
    renderPage();
    await screen.findByText('Minh');

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(leaderboard).toHaveBeenLastCalledWith({ page: 2, limit: 20 }));
  });

  it('shows an error with a way to try again', async () => {
    leaderboard.mockRejectedValue(new Error('down'));
    renderPage();

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
