import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { PublicMatch } from '../types/ranked.types';
import { RaceView } from './RaceView';

const progress = vi.fn();

vi.mock('../api/ranked.api', () => ({
  rankedApi: { progress: (code: string, input: unknown) => progress(code, input) },
  openMatchStream: () => () => undefined,
}));

const avatar = { skin: 'peach', face: 'classic', hair: 'short-brown', top: 'red', bottom: 'navy', shoes: 'sneakers-brown' };
const player = (userId: string, displayName: string, extra = {}) => ({
  userId,
  displayName,
  avatar,
  ready: true,
  typedCount: 0,
  correctWords: 0,
  accuracy: 0,
  wpm: 0,
  finished: false,
  ...extra,
});
const race = (extra: Partial<PublicMatch> = {}): PublicMatch => ({
  code: 'ABC234',
  status: 'running',
  rated: false,
  passageTitle: 'A quiet morning',
  wordCount: 3,
  targetWords: ['The', 'sun', 'rose.'],
  startedAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 180000).toISOString(),
  players: [player('u1', 'Lan'), player('u2', 'Minh')],
  ...extra,
});

beforeEach(() => {
  progress.mockReset();
  progress.mockResolvedValue({ typedCount: 1, correctWords: 1, accuracy: 0.33, wpm: 30, finished: false });
});

describe('RaceView (ranked duel, phase 4)', () => {
  it('counts down with both lanes before the race', () => {
    renderWithProviders(<RaceView match={race({ status: 'countdown', countdownEndsAt: new Date(Date.now() + 2500).toISOString() })} myId="u1" />);

    expect(screen.getByRole('status')).toHaveTextContent('3');
    expect(screen.getByRole('group', { name: 'Lan' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Minh' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Typing area' })).not.toBeInTheDocument();
  });

  it('types the passage of the match and sends each finished word', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RaceView match={race()} myId="u1" />);
    const area = screen.getByRole('textbox', { name: 'Typing area' });

    await user.type(area, 'The ');
    await waitFor(() => expect(progress).toHaveBeenCalledWith('ABC234', { typedWords: ['The'], typedAtMs: [expect.any(Number)] }));

    await user.type(area, 'sun rose. ');
    await waitFor(() =>
      expect(progress).toHaveBeenLastCalledWith('ABC234', expect.objectContaining({ typedWords: ['The', 'sun', 'rose.'], done: true })),
    );
  });

  it('shows how far each player is', () => {
    renderWithProviders(<RaceView match={race({ players: [player('u1', 'Lan'), player('u2', 'Minh', { typedCount: 2, wpm: 41 })] })} myId="u1" />);

    const lane = screen.getByRole('group', { name: 'Minh' });
    expect(within(lane).getByText('2/3 words')).toBeInTheDocument();
    expect(within(lane).getByText('41 WPM')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Lan' })).getByText('You')).toBeInTheDocument();
  });

  it('waits for the opponent once finished', () => {
    renderWithProviders(<RaceView match={race({ players: [player('u1', 'Lan', { finished: true, typedCount: 3 }), player('u2', 'Minh')] })} myId="u1" />);

    expect(screen.getByText('Finished — waiting for your opponent')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Typing area' })).not.toBeInTheDocument();
  });
});
