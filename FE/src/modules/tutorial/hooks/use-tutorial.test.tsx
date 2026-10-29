import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUserKey } from '@/modules/auth/hooks/use-current-user';
import { createTestQueryClient } from '@/test/render-with-providers';
import { useStartTutorial, useUpdateTutorial } from './use-tutorial';

const update = vi.fn();
const start = vi.fn();
vi.mock('../api/tutorial.api', () => ({
  tutorialApi: { start: () => start(), update: (body: unknown) => update(body), reset: vi.fn(), coach: vi.fn() },
}));

const user = { _id: 'u1', email: 'a@example.com', isEmailVerified: true, role: 'user', loginOtpEnabled: false, createdAt: '' };

describe('tutorial hooks', () => {
  beforeEach(() => {
    update.mockReset();
    start.mockReset();
  });

  it('puts the answered user in the cache', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(currentUserKey, user);
    start.mockResolvedValue({ ...user, tutorial: { tour: 'active', modes: {} } });
    update.mockResolvedValue({ ...user, tutorial: { tour: 'active', modes: { rain: 'done' } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const started = renderHook(() => useStartTutorial(), { wrapper });
    const updated = renderHook(() => useUpdateTutorial(), { wrapper });

    await act(() => started.result.current.mutateAsync());
    expect(queryClient.getQueryData<{ tutorial?: unknown }>(currentUserKey)?.tutorial).toEqual({ tour: 'active', modes: {} });
    await act(() => updated.result.current.mutateAsync({ mode: 'rain', status: 'done' }));

    expect(update).toHaveBeenCalledWith({ mode: 'rain', status: 'done' });
    expect(queryClient.getQueryData<{ tutorial?: unknown }>(currentUserKey)?.tutorial).toEqual({ tour: 'active', modes: { rain: 'done' } });
  });
});
