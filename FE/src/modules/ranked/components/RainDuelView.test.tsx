import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient, renderWithProviders } from '@/test/render-with-providers';
import { matchKeys } from '../hooks/use-match';
import type { RainDuelState } from '../lib/rain-duel';
import type { PublicMatch } from '../types/ranked.types';
import { RainDuelView } from './RainDuelView';

const sendRainWord = vi.fn();

vi.mock('../api/ranked.api', () => ({
  rankedApi: { sendRainWord: (code: string, text: string) => sendRainWord(code, text) },
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
  kind: 'rain',
  status: 'running',
  rated: false,
  passageTitle: 'Word rain',
  wordCount: 120,
  startedAt: new Date(Date.now() - 2000).toISOString(),
  endsAt: new Date(Date.now() + 118_000).toISOString(),
  players: [player('u1', 'Lan'), player('u2', 'Minh')],
};
const falling = (id: string, text: string) => ({ id, text, x: 50, fallMs: 7000, typed: 0, state: 'falling' as const, bornAt: Date.now() - 500 });
const duel = (extra: Partial<RainDuelState> = {}): RainDuelState => ({
  startedAt: Date.now() - 2000,
  endsAt: Date.now() + 118_000,
  sides: { u1: { lives: 3, hits: 0, drops: [falling('1', 'wind')] }, u2: { lives: 2, hits: 1, drops: [falling('2', 'moon')] } },
  ...extra,
});

const renderView = (state: RainDuelState = duel()) => {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(matchKeys.rain('ABC234'), state);
  return renderWithProviders(<RainDuelView match={match} myId="u1" />, { queryClient });
};

describe('RainDuelView (rain duel)', () => {
  beforeEach(() => sendRainWord.mockReset().mockResolvedValue({ hit: true }));

  it("shows my stage large and the opponent's small", () => {
    renderView();

    expect(screen.getByRole('region', { name: 'Your field' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: "Minh's field" })).toBeInTheDocument();
    expect(screen.getAllByTestId('rain-stage')[1]).not.toHaveClass('rain-sky');
  });

  it("shows both players' lives", () => {
    renderView();

    expect(screen.getByRole('img', { name: 'You: 3 lives left' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Minh: 2 lives left' })).toBeInTheDocument();
  });

  it('sends the word on space and clears the box', async () => {
    renderView();
    const box = screen.getByRole('textbox', { name: 'Type a falling word' });

    fireEvent.change(box, { target: { value: 'wind ' } });

    await waitFor(() => expect(sendRainWord).toHaveBeenCalledWith('ABC234', 'wind'));
    expect(box).toHaveValue('');
  });

  it('marks the letters typed on my falling word', () => {
    renderView();

    fireEvent.change(screen.getByRole('textbox', { name: 'Type a falling word' }), { target: { value: 'wi' } });

    expect(screen.getByText('wi')).toHaveClass('text-primary');
  });

  it('does not take a life on the CSS landing', () => {
    renderView();

    fireEvent(screen.getAllByTestId('fall-1')[0], Object.assign(new Event('webkitAnimationEnd', { bubbles: true }), { animationName: 'rain-fall' }));

    expect(sendRainWord).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'You: 3 lives left' })).toBeInTheDocument();
  });

  it('waits for the rain before the first word', () => {
    const queryClient = createTestQueryClient();
    renderWithProviders(<RainDuelView match={match} myId="u1" />, { queryClient });

    expect(screen.getByRole('region', { name: 'Your field' })).toBeInTheDocument();
  });
});

describe('RainDuelView moments (rain duel)', () => {
  it('flies the word my throw sends to the other player', () => {
    const { container } = renderView(
      duel({
        sides: { u1: { lives: 3, hits: 1, drops: [{ ...falling('1', 'wind'), state: 'popped' }] }, u2: { lives: 3, hits: 0, drops: [] } },
        lastHit: { side: 'u1', id: '1', thrownTo: 'u2', at: 5000 },
        // The server throws a new word, not the one typed.
        lastThrow: { to: 'u2', text: 'river', at: 5000 },
      }),
    );

    expect(container.querySelector('.rain-throw')).toHaveTextContent('river');
  });

  it('does not fly a word thrown at me', () => {
    const { container } = renderView(duel({ lastThrow: { to: 'u1', text: 'moon', at: 5000 } }));

    expect(container.querySelector('.rain-throw')).toBeNull();
  });

  it('announces a word thrown at me', () => {
    renderView(duel({ lastThrow: { to: 'u1', text: 'moon', at: 6000 } }));

    expect(screen.getByRole('status')).toHaveTextContent('Minh threw: moon');
    expect(screen.getByRole('region', { name: 'Your field' }).querySelector('.rain-incoming')).not.toBeNull();
  });

  it('tells the throw in the HUD line, not over the field', () => {
    renderView(duel({ lastThrow: { to: 'u1', text: 'moon', at: 6000 } }));

    const status = screen.getByRole('status');
    expect(status.closest('.absolute')).toBeNull();
    // In the line with my lives and words, not in a box laid over the stage.
    expect(status.parentElement).toHaveTextContent('0 words');
  });

  it('shows the tier of the rain', () => {
    renderWithProviders(<RainDuelView match={{ ...match, rainTier: 'Bronze' }} myId="u1" />);

    expect(screen.getByLabelText('Bronze rain')).toHaveTextContent('Bronze');
  });

  it("flashes the other player's field when they lose a life", () => {
    renderView(duel({ lastLand: { side: 'u2', at: 7000 } }));

    expect(screen.getByRole('region', { name: "Minh's field" }).querySelector('.rain-opponent-hit')).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Minh: 2 lives left' })).toBeInTheDocument();
  });
});

describe('RainDuelView typing box (rain duel)', () => {
  it('puts the cursor in the box when the duel starts after the countdown', () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(matchKeys.rain('ABC234'), duel());
    const countdown = { ...match, status: 'countdown' as const, countdownEndsAt: new Date(Date.now() + 3000).toISOString() };
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { rerender } = render(<RainDuelView match={countdown} myId="u1" />, { wrapper });
    const box = screen.getByRole('textbox', { name: 'Type a falling word' });
    expect(box).toBeDisabled();

    rerender(<RainDuelView match={match} myId="u1" />);

    expect(box).toBeEnabled();
    expect(box).toHaveFocus();
  });
});
