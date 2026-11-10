import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { profileKeys } from '@/modules/profile/hooks/use-profile';
import { createTestQueryClient } from '@/test/render-with-providers';
import { minigamePlaysApi } from '../api/daily-tasks.api';
import { useMinigamePlay } from './use-minigame-play';

vi.mock('../api/daily-tasks.api', () => ({ minigamePlaysApi: { start: vi.fn(), finish: vi.fn() } }));

const setup = (queryClient: QueryClient = createTestQueryClient()) => {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { ...renderHook(() => useMinigamePlay('rain'), { wrapper }), queryClient };
};

beforeEach(() => {
  vi.mocked(minigamePlaysApi.start).mockReset().mockResolvedValue({ id: 'play1' });
  vi.mocked(minigamePlaysApi.finish).mockReset().mockResolvedValue({ counted: true });
});

describe('useMinigamePlay (SCRUM-300)', () => {
  it('opens a play of its game when the game begins and closes it with the id the server gave', async () => {
    const { result } = setup();

    act(() => result.current.begin());
    act(() => result.current.finish());

    await waitFor(() => expect(minigamePlaysApi.finish).toHaveBeenCalledWith('play1'));
    expect(minigamePlaysApi.start).toHaveBeenCalledWith('rain');
  });

  it('closes a play once: a second finish does nothing', async () => {
    const { result } = setup();

    act(() => result.current.begin());
    act(() => result.current.finish());
    act(() => result.current.finish());

    await waitFor(() => expect(minigamePlaysApi.finish).toHaveBeenCalledTimes(1));
  });

  it('does nothing on finish without a begin', async () => {
    const { result } = setup();

    act(() => result.current.finish());

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(minigamePlaysApi.finish).not.toHaveBeenCalled();
  });

  it('waits for the id of a start still on its way before it finishes', async () => {
    let answer: (value: { id: string }) => void = () => undefined;
    vi.mocked(minigamePlaysApi.start).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { result } = setup();

    act(() => result.current.begin());
    act(() => result.current.finish());
    expect(minigamePlaysApi.finish).not.toHaveBeenCalled();

    answer({ id: 'late' });
    await waitFor(() => expect(minigamePlaysApi.finish).toHaveBeenCalledWith('late'));
  });

  it('never throws or finishes when the start fails', async () => {
    vi.mocked(minigamePlaysApi.start).mockRejectedValue(new Error('offline'));
    const { result } = setup();

    act(() => result.current.begin());
    act(() => result.current.finish());

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(minigamePlaysApi.finish).not.toHaveBeenCalled();
  });

  it('never throws when the finish fails', async () => {
    vi.mocked(minigamePlaysApi.finish).mockRejectedValue(new Error('offline'));
    const { result } = setup();

    act(() => result.current.begin());
    act(() => result.current.finish());

    await waitFor(() => expect(minigamePlaysApi.finish).toHaveBeenCalledTimes(1));
  });

  it('asks for the daily tasks again after a finish, so the Profile shows the new progress', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = setup(queryClient);

    act(() => result.current.begin());
    act(() => result.current.finish());

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: profileKeys.dailyTasks() }));
  });
});
