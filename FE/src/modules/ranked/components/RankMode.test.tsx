import userEvent from '@testing-library/user-event';
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
  kind: 'race',
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
    expect(screen.queryByRole('button', { name: 'Join' })).not.toBeInTheDocument();
    expect(screen.queryByText('Room code')).not.toBeInTheDocument();
  });

  it('shows the own season rating and tier in the lobby, with a link to the leaderboard (phase 5)', async () => {
    renderAt();

    expect(await screen.findByText('Season 2')).toBeInTheDocument();
    expect(screen.getByText('Gold')).toBeInTheDocument();
    expect(screen.getByText('1262')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Leaderboard' })).toHaveAttribute('href', '/leaderboard');
  });

  it('shows the days the season runs on two lines, and the leaderboard icon says its name in a tooltip', async () => {
    api.me.mockResolvedValue({ ...ranking, season: { number: 2, startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-12-31T23:59:59.000Z' } });
    renderAt();

    expect(await screen.findByText('FROM 1 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('TO 31 Dec 2026')).toBeInTheDocument();
    expect(screen.getByText('9W · 5L · 0D')).toBeInTheDocument();

    await userEvent.setup().hover(screen.getByRole('link', { name: 'Leaderboard' }));
    expect((await screen.findAllByRole('tooltip'))[0]).toHaveTextContent('Leaderboard');
  });

  it('has no line for the season days when the dates are missing', async () => {
    renderAt();

    await screen.findByText('Season 2');
    expect(screen.queryByText(/^FROM /)).not.toBeInTheDocument();
    expect(screen.queryByText(/^TO /)).not.toBeInTheDocument();
  });

  it('titles the two panels at the size of the profile sections, in the red of the season, centered', () => {
    renderAt();

    for (const name of ['Duel a friend', 'Join a room']) {
      expect(screen.getByRole('heading', { name })).toHaveClass('text-[1.5rem]', 'text-primary');
      expect(screen.getByRole('heading', { name }).parentElement?.parentElement).toHaveClass('text-center');
    }
  });

  it('fills the free space of the two panels with a big icon each, which screen readers skip', () => {
    const { container } = renderAt();

    expect(container.querySelectorAll('svg.size-24[aria-hidden="true"]')).toHaveLength(2);
  });

  it('frames each of the two panels, in thin red while it is hovered', () => {
    renderAt();

    for (const name of ['Duel a friend', 'Join a room']) {
      expect(screen.getByRole('heading', { name }).closest('.border')).toHaveClass('border-border', 'hover:border-destructive/40');
    }
  });

  it('says what a duel is in a tooltip on the title, not in a line of its own', async () => {
    renderAt();

    expect(screen.queryByText(/You both type the same English passage/)).not.toBeInTheDocument();
    await userEvent.setup().hover(screen.getByText('Duel a friend'));
    expect((await screen.findAllByRole('tooltip'))[0]).toHaveTextContent('Open a room and share its code. You both type the same English passage.');
  });

  it('says how to join in a tooltip on the title of the join panel', async () => {
    renderAt();

    await userEvent.setup().hover(screen.getByText('Join a room'));
    expect((await screen.findAllByRole('tooltip'))[0]).toHaveTextContent("Type the 6-character code of a friend's room to join their duel.");
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

  it('stretches the two seats to the same height, with the VS in the middle', async () => {
    api.get.mockResolvedValue(room());
    renderAt('/typing?mode=rank&room=ABC234');

    const grid = (await screen.findByText('VS')).parentElement;
    expect(grid).toHaveClass('items-stretch');
    expect(screen.getByText('VS')).toHaveClass('self-center');
  });

  it('has Leave room and Ready as buttons of the same size, Leave room in the red outline with an icon', async () => {
    api.get.mockResolvedValue(room({ players: [player('u2', 'Minh'), player('u1', 'Lan')] }));
    renderAt('/typing?mode=rank&room=ABC234');

    const leave = await screen.findByRole('button', { name: 'Leave room' });
    expect(leave).toHaveClass('h-11', 'min-w-44', 'border-primary/40', 'text-primary');
    expect(leave.querySelector('svg')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Ready' })).toHaveClass('h-11', 'min-w-44');
  });

  it('names the copy button in the shared tooltip, not in a title attribute', async () => {
    api.get.mockResolvedValue(room());
    renderAt('/typing?mode=rank&room=ABC234');

    const copy = await screen.findByRole('button', { name: 'Copy code' });
    expect(copy).not.toHaveAttribute('title');
    await userEvent.setup().hover(copy);
    expect((await screen.findAllByRole('tooltip'))[0]).toHaveTextContent('Copy code');
  });

  it('joins at once when the code is complete, and not before', async () => {
    api.join.mockResolvedValue(room({ code: 'XYZ789', players: [player('u2', 'Minh'), player('u1', 'Lan')] }));
    api.get.mockResolvedValue(room({ code: 'XYZ789', players: [player('u2', 'Minh'), player('u1', 'Lan')] }));
    renderAt();

    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'xyz78' } });
    expect(api.join).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'xyz789' } });

    await waitFor(() => expect(api.join).toHaveBeenCalledWith('XYZ789'));
    expect(api.join).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(urlParam('room')).toBe('XYZ789'));
  });

  it('joins with Enter too, with a code typed in any case', async () => {
    api.join.mockResolvedValue(room({ code: 'XYZ789', players: [player('u2', 'Minh'), player('u1', 'Lan')] }));
    api.get.mockResolvedValue(room({ code: 'XYZ789', players: [player('u2', 'Minh'), player('u1', 'Lan')] }));
    renderAt();

    await userEvent.setup().type(screen.getByLabelText('Room code'), 'xyz789{Enter}');

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

describe('RankMode kinds of match (rain duel)', () => {
  it('creates a rain room from the lobby', async () => {
    api.create.mockResolvedValue(room({ kind: 'rain' }));
    api.get.mockResolvedValue(room({ kind: 'rain' }));
    renderAt();

    fireEvent.click(screen.getByRole('radio', { name: 'Rain' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create room' }));

    await waitFor(() => expect(api.create).toHaveBeenCalledWith('rain'));
  });

  it('creates a race room by default', async () => {
    api.create.mockResolvedValue(room());
    api.get.mockResolvedValue(room());
    renderAt();

    fireEvent.click(screen.getByRole('button', { name: 'Create room' }));

    await waitFor(() => expect(api.create).toHaveBeenCalledWith('race'));
  });

  it('shows the rating of the chosen kind', async () => {
    renderAt();
    await waitFor(() => expect(api.me).toHaveBeenCalledWith('race'));

    fireEvent.click(screen.getByRole('radio', { name: 'Rain' }));

    await waitFor(() => expect(api.me).toHaveBeenCalledWith('rain'));
  });
});
