import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { LeaderboardPage } from './LeaderboardPage';

const leaderboard = vi.fn();
const placementBoard = vi.fn();
const passages = vi.fn();
const placementSettings = vi.fn();
const wordChainBoard = vi.fn();

vi.mock('@/modules/word-chain/api/word-chain.api', () => ({
  wordChainApi: { board: (range: string) => wordChainBoard(range) },
}));

vi.mock('../api/ranked.api', () => ({
  rankedApi: { leaderboard: (params: unknown) => leaderboard(params), placementBoard: (params: unknown) => placementBoard(params), placementSettings: () => placementSettings() },
}));

vi.mock('@/modules/typing/api/typing.api', () => ({
  typingApi: { passages: (mode: string) => passages(mode) },
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
  placementBoard.mockReset();
  placementSettings.mockReset().mockResolvedValue({ minAccuracy: 90 });
  passages.mockReset().mockResolvedValue([
    { _id: 'p1', title: 'Bài kiểm tra đầu vào', wordCount: 40 },
    { _id: 'p2', title: 'Sài Gòn mưa', wordCount: 35 },
  ]);
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
    expect(screen.getByRole('radio', { name: 'Rank S3' })).toBeInTheDocument();
    expect(leaderboard).toHaveBeenCalledWith({ page: 1, limit: 20, kind: 'race' });
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

    await waitFor(() => expect(leaderboard).toHaveBeenLastCalledWith({ page: 2, limit: 20, kind: 'race' }));
  });

  it('shows an error with a way to try again', async () => {
    leaderboard.mockRejectedValue(new Error('down'));
    renderPage();

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('switches between the Rank and Placement tabs', async () => {
    leaderboard.mockResolvedValue(board([row(1, 'u1', 'Minh', 1420, 'Platinum', 0.75)]));
    renderPage();
    await screen.findByText('Minh');
    expect(screen.getByRole('radio', { name: /^Rank/ })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: 'Placement' }));
    expect(screen.getByRole('radio', { name: 'Placement' })).toBeChecked();
    expect(screen.queryByText('Minh')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /^Rank/ }));
    expect(await screen.findByText('Minh')).toBeInTheDocument();
  });
});

describe('LeaderboardPage minigames tab', () => {
  it('shows the Nối từ board beside Rank, and opens on it from ?tab=minigames', async () => {
    leaderboard.mockResolvedValue(board([row(1, 'u1', 'Minh', 1420, 'Platinum', 0.75)]));
    wordChainBoard.mockResolvedValue({ range: 'week', items: [{ rank: 1, displayName: 'Lan', avatar, score: 12, isMe: false }], me: null });
    renderPage('/leaderboard?tab=minigames');
    expect(screen.getByRole('radio', { name: 'Minigames' })).toBeChecked();
    const panel = screen.getByRole('tabpanel', { name: 'Minigames' });
    expect(await within(panel).findByText('Lan')).toBeInTheDocument();
    expect(wordChainBoard).toHaveBeenCalledWith('week');

    fireEvent.click(screen.getByRole('radio', { name: /^Rank/ }));
    expect(await screen.findByText('Minh')).toBeInTheDocument();
  });
});

describe('LeaderboardPage minigames tab look', () => {
  it('lists plain rows with a score, switches the range and shows the own place', async () => {
    wordChainBoard.mockResolvedValue({
      range: 'week',
      items: [{ rank: 1, displayName: 'Lan', avatar, score: 12, isMe: false }],
      me: { rank: 7, score: 3 },
    });
    renderPage('/leaderboard?tab=minigames');
    const panel = screen.getByRole('tabpanel', { name: 'Minigames' });
    expect(await within(panel).findByText('Lan')).toBeInTheDocument();
    expect(within(panel).getAllByText('SCORE').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Minigame')).toHaveTextContent('Word chain');
    expect(within(panel).getByRole('region', { name: 'Your place' })).toHaveTextContent('#7');

    fireEvent.click(screen.getByRole('radio', { name: 'All time' }));
    await waitFor(() => expect(wordChainBoard).toHaveBeenLastCalledWith('all'));
  });
});

describe('LeaderboardPage kinds of match (rain duel)', () => {
  it('switches to the rain board', async () => {
    leaderboard.mockResolvedValue(board([row(1, 'u1', 'Minh', 1420, 'Platinum', 0.75)]));
    renderPage();
    await screen.findAllByRole('article');

    fireEvent.click(screen.getByRole('radio', { name: 'Rain' }));

    await waitFor(() => expect(leaderboard).toHaveBeenLastCalledWith({ page: 1, limit: 20, kind: 'rain' }));
  });
});

describe('LeaderboardPage placement tab (US10.1)', () => {
  const timeline = { status: 'too_short', points: [] };
  const placementRow = (rank: number, displayName: string, wpm: number, accuracy: number, durationMs: number, isMe = false) => ({
    rank,
    displayName,
    avatar,
    wpm,
    accuracy,
    durationMs,
    timeline,
    isMe,
  });
  const placement = (items: unknown[], extra = {}) => ({
    passageId: 'p1',
    range: 'week',
    from: '2026-03-08T17:00:00.000Z',
    players: items.length,
    items,
    me: null,
    ...extra,
  });

  const openPlacement = async (route = '/leaderboard') => {
    leaderboard.mockResolvedValue(board([]));
    renderPage(route);
    await userEvent.click(await screen.findByRole('radio', { name: 'Placement' }));
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens on a random placement passage and the week', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // the last passage of the list
    placementBoard.mockResolvedValue(placement([]));

    await openPlacement();

    await waitFor(() => expect(placementBoard).toHaveBeenCalledWith({ passageId: 'p2', range: 'week' }));
    expect(passages).toHaveBeenCalledWith('placement');
    expect(screen.getByRole('button', { name: 'Choose passage' })).toHaveTextContent('Sài Gòn mưa');
    expect(screen.getByRole('radio', { name: 'This week' })).toBeChecked();
  });

  it('opens the passage menu centered under the leaderboard tabs', async () => {
    placementBoard.mockResolvedValue(placement([]));
    const user = userEvent.setup();
    await openPlacement();

    await user.click(screen.getByRole('button', { name: 'Choose passage' }));

    const menu = await screen.findByRole('menu', { name: 'Placement passages' });
    expect(menu.parentElement).toHaveClass('static');
    // The row of the tabs is what the menu is placed against, so its middle is the middle of the tabs.
    expect(screen.getByRole('radiogroup', { name: 'Leaderboard' }).parentElement).toHaveClass('relative');
  });

  it('lists the rank, name, WPM, accuracy and time of each line and marks the learner', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    placementBoard.mockResolvedValue(placement([placementRow(1, 'Minh', 72.5, 98, 180_000), placementRow(2, 'Lan', 60, 94.5, 125_000, true)]));

    await openPlacement();

    const rows = await screen.findAllByRole('article');
    expect(within(rows[0]).getByText('#1')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Minh')).toBeInTheDocument();
    expect(within(rows[0]).getByText('72.5')).toBeInTheDocument();
    expect(within(rows[0]).getByText('98%')).toBeInTheDocument();
    expect(within(rows[0]).getByText('3:00')).toBeInTheDocument();
    expect(within(rows[1]).getByText('(you)')).toBeInTheDocument();
    expect(within(rows[1]).getByText('2:05')).toBeInTheDocument();
    expect(within(rows[0]).getByText('ACC')).toBeInTheDocument();
    expect(within(rows[0]).getByText('TIME')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Too short to draw a speed line')).toBeInTheDocument();
  });

  it('shows the board of all time when All time is picked, and keeps it in the URL', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    placementBoard.mockResolvedValue(placement([]));
    await openPlacement();
    await waitFor(() => expect(placementBoard).toHaveBeenCalledWith({ passageId: 'p1', range: 'week' }));

    await userEvent.click(screen.getByRole('radio', { name: 'All time' }));

    await waitFor(() => expect(placementBoard).toHaveBeenLastCalledWith({ passageId: 'p1', range: 'all' }));
    expect(screen.getByRole('radio', { name: 'All time' })).toBeChecked();
  });

  it('shows the board of another passage picked in the menu', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    placementBoard.mockResolvedValue(placement([]));
    await openPlacement();
    await waitFor(() => expect(placementBoard).toHaveBeenCalledWith({ passageId: 'p1', range: 'week' }));

    await userEvent.click(screen.getByRole('button', { name: 'Choose passage' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: /Sài Gòn mưa/ }));

    await waitFor(() => expect(placementBoard).toHaveBeenLastCalledWith({ passageId: 'p2', range: 'week' }));
    expect(screen.getByRole('button', { name: 'Choose passage' })).toHaveTextContent('Sài Gòn mưa');
  });

  it('takes the passage and range of the URL', async () => {
    placementBoard.mockResolvedValue(placement([]));

    await openPlacement('/leaderboard?passage=p2&range=all');

    await waitFor(() => expect(placementBoard).toHaveBeenCalledWith({ passageId: 'p2', range: 'all' }));
  });

  it('tells a learner outside the top 50 where they are', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    placementBoard.mockResolvedValue(
      placement([placementRow(1, 'Minh', 72.5, 98, 180_000)], { players: 52, me: { rank: 52, wpm: 31, accuracy: 91, durationMs: 180_000, timeline } }),
    );

    await openPlacement();

    const mine = await screen.findByLabelText('Your place');
    expect(mine).toHaveTextContent('#52');
    expect(mine).toHaveTextContent('31');
    expect(mine).toHaveTextContent('91%');
  });

  it('does not repeat the place of a learner who is already in the list', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    placementBoard.mockResolvedValue(
      placement([placementRow(1, 'Lan', 60, 94, 180_000, true)], { me: { rank: 1, wpm: 60, accuracy: 94, durationMs: 180_000, timeline } }),
    );

    await openPlacement();

    await screen.findByText('Lan');
    expect(screen.queryByLabelText('Your place')).not.toBeInTheDocument();
  });

  it('says when nobody is on the board yet, and when there is no placement passage', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    placementBoard.mockResolvedValue(placement([]));
    await openPlacement();

    expect(await screen.findByText('No placement results yet')).toBeInTheDocument();
  });

  it('names the minimum accuracy an admin set in the empty board message', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    placementSettings.mockResolvedValue({ minAccuracy: 80 });
    placementBoard.mockResolvedValue(placement([]));
    await openPlacement();

    expect(await screen.findByText(/with 80% accuracy or more/i)).toBeInTheDocument();
  });

  it('says so when there is no placement passage to choose', async () => {
    passages.mockResolvedValue([]);

    await openPlacement();

    expect(await screen.findByText('No placement passages')).toBeInTheDocument();
    expect(placementBoard).not.toHaveBeenCalled();
  });

  it('shows an error with a way to try again', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    placementBoard.mockRejectedValue(new Error('down'));

    await openPlacement();

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('keeps the passage and time bars to the Placement tab', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    placementBoard.mockResolvedValue(placement([]));
    leaderboard.mockResolvedValue(board([row(1, 'u1', 'Minh', 1420, 'Platinum', 0.75)]));
    renderPage();
    await screen.findByText('Minh');

    expect(screen.queryByRole('button', { name: 'Choose passage' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'This week' })).not.toBeInTheDocument();
    expect(passages).not.toHaveBeenCalled();
  });
});
