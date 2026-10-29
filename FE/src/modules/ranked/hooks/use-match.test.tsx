import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient } from '@/test/render-with-providers';
import type { MatchEvent, PublicMatch } from '../types/ranked.types';
import { useMatch } from './use-match';

const get = vi.fn();
const close = vi.fn();
let emit: (event: MatchEvent) => void = () => undefined;

vi.mock('../api/ranked.api', () => ({
  rankedApi: { get: (code: string) => get(code) },
  openMatchStream: (_code: string, onEvent: (event: MatchEvent) => void) => {
    emit = onEvent;
    return close;
  },
}));

const avatar = { skin: 'peach', face: 'classic', hair: 'short-brown', top: 'red', bottom: 'navy', shoes: 'sneakers-brown' };
const player = (userId: string, displayName: string) => ({
  userId,
  displayName,
  avatar,
  ready: false,
  typedCount: 0,
  correctWords: 0,
  accuracy: 0,
  wpm: 0,
  finished: false,
});
const match: PublicMatch = {
  code: 'ABC234',
  status: 'running',
  rated: false,
  passageTitle: 'A quiet morning',
  wordCount: 3,
  targetWords: ['The', 'sun', 'rose.'],
  players: [player('u1', 'Lan'), player('u2', 'Minh')],
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
);

beforeEach(() => {
  get.mockReset();
  close.mockReset();
  get.mockResolvedValue(match);
});

describe('useMatch', () => {
  it('keeps the match up to date from the stream', async () => {
    const { result } = renderHook(() => useMatch('ABC234'), { wrapper });
    await waitFor(() => expect(result.current.match?.code).toBe('ABC234'));

    act(() => emit({ event: 'progress', data: { userId: 'u2', typedCount: 2, correctWords: 2, accuracy: 0.66, wpm: 40, finished: false } }));
    await waitFor(() => expect(result.current.match?.players[1]).toMatchObject({ typedCount: 2, wpm: 40 }));

    act(() => emit({ event: 'state', data: { ...match, status: 'finished' } }));
    await waitFor(() => expect(result.current.match?.status).toBe('finished'));
  });

  it('hands over a rematch invitation and closes the stream when it is no longer used', async () => {
    const { result, unmount } = renderHook(() => useMatch('ABC234'), { wrapper });
    await waitFor(() => expect(result.current.match).toBeDefined());

    act(() => emit({ event: 'rematch', data: { code: 'XYZ789', from: 'Minh' } }));
    expect(result.current.invite).toEqual({ code: 'XYZ789', from: 'Minh' });

    unmount();
    expect(close).toHaveBeenCalled();
  });
});
