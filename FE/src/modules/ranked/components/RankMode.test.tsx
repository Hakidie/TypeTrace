import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import type { PublicMatch } from '../types/ranked.types';
import { RankMode } from './RankMode';

const api = {
  create: vi.fn(),
  join: vi.fn(),
  get: vi.fn(),
  leave: vi.fn(),
  ready: vi.fn(),
  progress: vi.fn(),
  rematch: vi.fn(),
  me: vi.fn(),
};

const ranking = { season: { number: 2, startsAt: '', endsAt: '' }, rating: 1262, peakRating: 1300, tier: 'Gold', matches: 14, wins: 9, losses: 5, draws: 0 };

vi.mock('../api/ranked.api', () => ({
  rankedApi: new Proxy({}, { get: (_target, name: string) => (...args: unknown[]) => api[name as keyof typeof api](...args) }),
  openMatchStream: () => () => undefined,
}));

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: async () => ({ _id: 'u1', email: 'lan@example.com', role: 'user' }) },
}));

const avatar = { skin: 'peach', face: 'classic', hair: 'short-brown', top: 'red', bottom: 'navy', shoes: 'sneakers-brown' };
const player = (userId: string, displayName: string, extra = {}) => ({
  userId,
  displayName,
  avatar,
  ready: false,
  typedCount: 0,
  correctWords: 0,
  accuracy: 0,
  wpm: 0,
  finished: false,
  ...extra,
});
const room = (extra: Partial<PublicMatch> = {}): PublicMatch => ({
  code: 'ABC234',
  status: 'waiting',
  rated: false,
  passageTitle: 'A quiet morning',
  wordCount: 3,
  players: [player('u1', 'Lan')],
  ...extra,
});

const LocationProbe = () => <output aria-label="URL">{useLocation().search}</output>;
const renderAt = (route = '/typing?mode=rank') =>
  renderWithProviders(
    <>
      <RankMode />
      <LocationProbe />
    </>,
    { route, path: '/typing' },
  );
const urlParam = (name: string) => new URLSearchParams(screen.getByLabelText('URL').textContent ?? '').get(name);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.me.mockResolvedValue(ranking);
  sessionStorage.clear();
  // The current user (who "you" are in the room) is only fetched with a token.
  tokenStore.set('test-token');
});

describe('RankMode (ranked duel, phase 4)', () => {
  it('offers to create a room or to join one with a code', () => {
    renderAt();

    expect(screen.getByRole('button', { name: 'Create room' })).toBeInTheDocument();
    expect(screen.getByLabelText('Room code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();
  });

  it('shows the own season rating and tier in the lobby, with a link to the leaderboard (phase 5)', async () => {
    renderAt();

    expect(await screen.findByText('Season 2')).toBeInTheDocument();
    expect(screen.getByText('Gold')).toBeInTheDocument();
    expect(screen.getByText('1262')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Leaderboard' })).toHaveAttribute('href', '/leaderboard');
  });

  it('creates a room, puts its code in the URL and waits for an opponent', async () => {
    api.create.mockResolvedValue(room());
    api.get.mockResolvedValue(room());
    renderAt();

    fireEvent.click(screen.getByRole('button', { name: 'Create room' }));

    await waitFor(() => expect(urlParam('room')).toBe('ABC234'));
    expect(await screen.findByText('ABC234')).toBeInTheDocument();
    expect(screen.getByText('Waiting for an opponent…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });

  it('joins with a code typed in any case', async () => {
    api.join.mockResolvedValue(room({ code: 'XYZ789', players: [player('u2', 'Minh'), player('u1', 'Lan')] }));
    api.get.mockResolvedValue(room({ code: 'XYZ789', players: [player('u2', 'Minh'), player('u1', 'Lan')] }));
    renderAt();

    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'xyz789' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    await waitFor(() => expect(api.join).toHaveBeenCalledWith('XYZ789'));
    await waitFor(() => expect(urlParam('room')).toBe('XYZ789'));
    expect(await screen.findByText('Minh')).toBeInTheDocument();
  });

  it('goes back to the lobby when the room of the URL is gone', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('Room not found'), { response: { status: 404 } }));
    renderAt('/typing?mode=rank&room=OLD234');

    expect(await screen.findByRole('button', { name: 'Create room' })).toBeInTheDocument();
    await waitFor(() => expect(urlParam('room')).toBeNull());
  });

  it('goes back to the lobby when the code of the URL is not a room code', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('Invalid room code'), { response: { status: 400 } }));
    renderAt('/typing?mode=rank&room=bad!');

    expect(await screen.findByRole('button', { name: 'Create room' })).toBeInTheDocument();
    await waitFor(() => expect(urlParam('room')).toBeNull());
  });

  it('tries the room again from Try again after a failed load', async () => {
    api.get.mockRejectedValueOnce(Object.assign(new Error('Server error'), { response: { status: 500 } }));
    api.get.mockResolvedValue(room());
    renderAt('/typing?mode=rank&room=ABC234');

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Waiting for an opponent…')).toBeInTheDocument();
  });

  it('gets ready once the opponent is in, and leaves the room', async () => {
    const full = room({ players: [player('u1', 'Lan'), player('u2', 'Minh')] });
    api.get.mockResolvedValue(full);
    api.ready.mockResolvedValue({ ...full, players: [player('u1', 'Lan', { ready: true }), player('u2', 'Minh')] });
    api.leave.mockResolvedValue(room({ status: 'cancelled' }));
    renderAt('/typing?mode=rank&room=ABC234');

    fireEvent.click(await screen.findByRole('button', { name: 'Ready' }));
    await waitFor(() => expect(api.ready).toHaveBeenCalledWith('ABC234', true));
    expect(await screen.findByRole('button', { name: 'Not ready' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Leave room' }));
    await waitFor(() => expect(api.leave).toHaveBeenCalledWith('ABC234'));
    await waitFor(() => expect(urlParam('room')).toBeNull());
  });

  it('shows the closed room and a way back', async () => {
    api.get.mockResolvedValue(room({ status: 'cancelled' }));
    renderAt('/typing?mode=rank&room=ABC234');

    expect(await screen.findByText('This room was closed.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to lobby' }));
    await waitFor(() => expect(urlParam('room')).toBeNull());
  });
});
