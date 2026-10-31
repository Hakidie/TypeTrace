import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { PublicMatch } from '../types/ranked.types';
import { MatchNotices } from './MatchNotices';

const leave = vi.fn();

vi.mock('../api/ranked.api', () => ({
  rankedApi: { leave: (code: string) => leave(code) },
  openMatchStream: () => () => undefined,
}));

const avatar = { skin: 'peach', face: 'classic', hair: 'short-brown', top: 'red', bottom: 'navy', shoes: 'sneakers-brown' };
const player = (userId: string, displayName: string) => ({
  userId,
  displayName,
  avatar,
  ready: true,
  typedCount: 0,
  correctWords: 0,
  accuracy: 0,
  wpm: 0,
  finished: false,
});
const match: PublicMatch = {
  code: 'ABC234',
  kind: 'race',
  status: 'running',
  rated: false,
  passageTitle: 'A quiet morning',
  wordCount: 3,
  players: [player('u1', 'Lan'), player('u2', 'Minh')],
};

beforeEach(() => {
  leave.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-30T10:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MatchNotices (SCRUM-154)', () => {
  it('says nothing while both players are here', () => {
    renderWithProviders(<MatchNotices match={match} myId="u1" connected away={{}} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('tells the player their own connection dropped and is coming back', () => {
    renderWithProviders(<MatchNotices match={match} myId="u1" connected={false} away={{}} />);

    expect(screen.getByRole('status')).toHaveTextContent('Connection lost — reconnecting…');
  });

  it('tells the player the opponent is away and when they forfeit', () => {
    renderWithProviders(<MatchNotices match={match} myId="u1" connected away={{ u2: '2026-10-30T10:00:12.000Z' }} />);

    expect(screen.getByRole('status')).toHaveTextContent('Minh lost the connection: DNF in 12 s unless they come back.');
  });

  it('forfeits the match after a confirmation', async () => {
    leave.mockResolvedValue({ ...match, status: 'finished' });
    renderWithProviders(<MatchNotices match={match} myId="u1" connected away={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Forfeit' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('You will not finish (DNF)');
    fireEvent.click(screen.getByRole('button', { name: 'Forfeit the match' }));
    await waitFor(() => expect(leave).toHaveBeenCalledWith('ABC234'));
  });
});
