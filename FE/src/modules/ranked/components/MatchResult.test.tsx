import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { PublicMatch } from '../types/ranked.types';
import { MatchResult } from './MatchResult';

const rematch = vi.fn();
const join = vi.fn();

vi.mock('../api/ranked.api', () => ({
  rankedApi: { rematch: (code: string) => rematch(code), join: (code: string) => join(code) },
  openMatchStream: () => () => undefined,
}));

const avatar = { skin: 'peach', face: 'classic', hair: 'short-brown', top: 'red', bottom: 'navy', shoes: 'sneakers-brown' };
const player = (userId: string, displayName: string, result: 'win' | 'loss' | 'draw' | 'forfeit', extra = {}) => ({
  userId,
  displayName,
  avatar,
  ready: true,
  typedCount: 3,
  correctWords: 3,
  accuracy: 1,
  wpm: 52.4,
  finished: true,
  result,
  ...extra,
});
const finished = (mine: 'win' | 'loss' | 'draw' | 'forfeit', theirs: 'win' | 'loss' | 'draw' | 'forfeit'): PublicMatch => ({
  code: 'ABC234',
  status: 'finished',
  rated: false,
  passageTitle: 'A quiet morning',
  wordCount: 3,
  players: [player('u1', 'Lan', mine), player('u2', 'Minh', theirs, { wpm: 40, accuracy: 0.67, correctWords: 2 })],
});

const renderResult = (match: PublicMatch, extra: { invite?: { code: string; from: string } } = {}) => {
  const onEnter = vi.fn();
  const onLeave = vi.fn();
  renderWithProviders(<MatchResult match={match} myId="u1" invite={extra.invite} onEnter={onEnter} onLeave={onLeave} />);
  return { onEnter, onLeave };
};

beforeEach(() => {
  rematch.mockReset();
  join.mockReset();
});

describe('MatchResult (ranked duel, phase 4)', () => {
  it('says who won, with each player in the win or lose pose and their numbers', () => {
    renderResult(finished('win', 'loss'));

    expect(screen.getByRole('heading', { name: 'You win' })).toBeInTheDocument();
    expect(screen.getByText('52 WPM')).toBeInTheDocument();
    expect(screen.getByText('67% accuracy')).toBeInTheDocument();
    expect(screen.getByText('Rating comes soon')).toBeInTheDocument();
    const images = [...document.querySelectorAll('img')].map((image) => image.getAttribute('src'));
    expect(images).toContain('/avatar/body/peach-win.png');
    expect(images).toContain('/avatar/body/peach-lose.png');
  });

  it('names a loss, a draw and a forfeit', () => {
    const { unmount } = renderWithProviders(<MatchResult match={finished('loss', 'win')} myId="u1" onEnter={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'You lose' })).toBeInTheDocument();
    unmount();
    const draw = renderWithProviders(<MatchResult match={finished('draw', 'draw')} myId="u1" onEnter={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Draw' })).toBeInTheDocument();
    draw.unmount();
    renderWithProviders(<MatchResult match={finished('forfeit', 'win')} myId="u1" onEnter={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'You forfeited' })).toBeInTheDocument();
  });

  it('asks for a rematch and moves to the new room', async () => {
    rematch.mockResolvedValue({ ...finished('win', 'loss'), code: 'XYZ789', status: 'waiting' });
    const { onEnter } = renderResult(finished('win', 'loss'));

    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));

    await waitFor(() => expect(rematch).toHaveBeenCalledWith('ABC234'));
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith('XYZ789'));
  });

  it("joins the opponent's rematch from the invitation", async () => {
    join.mockResolvedValue({ ...finished('win', 'loss'), code: 'XYZ789', status: 'waiting' });
    const { onEnter } = renderResult(finished('loss', 'win'), { invite: { code: 'XYZ789', from: 'Minh' } });

    expect(screen.getByText('Minh wants a rematch')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    await waitFor(() => expect(join).toHaveBeenCalledWith('XYZ789'));
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith('XYZ789'));
  });

  it('goes back to the lobby', () => {
    const { onLeave } = renderResult(finished('win', 'loss'));

    fireEvent.click(screen.getByRole('button', { name: 'Back to lobby' }));
    expect(onLeave).toHaveBeenCalled();
  });
});
