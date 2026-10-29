import { screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUserKey } from '@/modules/auth/hooks/use-current-user';
import { tokenStore } from '@/modules/auth/store/token.store';
import { createQueryClient } from '@/shared/api/query-client';
import { createTestQueryClient, renderWithProviders } from '@/test/render-with-providers';
import { profileKeys, useTypingActivity } from '../hooks/use-profile';
import { TimezoneSync } from './TimezoneSync';

const zone = vi.hoisted(() => ({ browser: 'Europe/Paris' }));
const getMe = vi.fn();
const updateSettings = vi.fn();
const getActivity = vi.fn();

vi.mock('@/shared/lib/local-date', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/local-date')>()),
  browserTimeZone: () => zone.browser,
}));

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => getMe() },
}));

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: { updateSettings: (input: unknown) => updateSettings(input), getActivity: () => getActivity() },
}));

/** A profile query, as the profile page has one: its days are in the zone the answer names. */
const ActivityZone = () => {
  const { data } = useTypingActivity();
  return <p>{data ? `Days in ${data.timezone}` : 'Loading'}</p>;
};

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// The zone is sent at most once per user and page load, and this file is one page load: each test signs in a new user.
let users = 0;
const signIn = (timezone?: string) => {
  users += 1;
  const user = {
    _id: `user-${users}`,
    email: 'alice@example.com',
    role: 'user',
    isEmailVerified: true,
    loginOtpEnabled: false,
    ...(timezone && { settings: { timezone } }),
    createdAt: '2026-01-15T12:00:00.000Z',
    updatedAt: '2026-01-15T12:00:00.000Z',
  };
  getMe.mockResolvedValue(user);
  return user;
};

/** Long enough for the user to load and the effect to run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

beforeEach(() => {
  tokenStore.set('jwt-value');
  zone.browser = 'Europe/Paris';
  getMe.mockReset();
  updateSettings.mockReset();
  getActivity.mockReset();
  vi.mocked(toast.error).mockClear();
});

describe('TimezoneSync (SCRUM-31)', () => {
  it("sends the browser's zone when the account has another one, keeps the user it returns and refreshes the profile", async () => {
    const user = signIn('Asia/Ho_Chi_Minh');
    updateSettings.mockResolvedValue({ ...user, settings: { timezone: 'Europe/Paris' } });
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderWithProviders(<TimezoneSync />, { queryClient });

    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ timezone: 'Europe/Paris' }));
    await waitFor(() => expect(queryClient.getQueryData(currentUserKey)).toMatchObject({ settings: { timezone: 'Europe/Paris' } }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: profileKeys.all });
    await settle();
    expect(updateSettings).toHaveBeenCalledOnce();
  });

  it('sends it for an account that has no zone yet', async () => {
    signIn();
    updateSettings.mockResolvedValue({});
    renderWithProviders(<TimezoneSync />);

    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ timezone: 'Europe/Paris' }));
  });

  it('sends nothing when the account already has the browser zone, or when the browser gives none', async () => {
    zone.browser = 'Asia/Ho_Chi_Minh';
    signIn('Asia/Ho_Chi_Minh');
    const { unmount } = renderWithProviders(<TimezoneSync />);
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    await settle();
    unmount();

    zone.browser = '';
    signIn('Asia/Ho_Chi_Minh');
    renderWithProviders(<TimezoneSync />);
    await waitFor(() => expect(getMe).toHaveBeenCalledTimes(2));
    await settle();

    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('sends nothing when the account has another name of the browser zone', async () => {
    // Chrome says Asia/Saigon where the account's default is Asia/Ho_Chi_Minh; Node's Intl, used here, knows both as one.
    zone.browser = 'Asia/Saigon';
    signIn('Asia/Ho_Chi_Minh');
    renderWithProviders(<TimezoneSync />);
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    await settle();

    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('asks again for a profile query whose first answer, from the old zone, was still on its way', async () => {
    const user = signIn('Asia/Ho_Chi_Minh');
    updateSettings.mockResolvedValue({ ...user, settings: { timezone: 'Europe/Paris' } });
    let oldAnswer!: (activity: unknown) => void;
    getActivity
      .mockReturnValueOnce(new Promise((resolve) => (oldAnswer = resolve)))
      .mockResolvedValue({ timezone: 'Europe/Paris', sessions: [] });
    const queryClient = createTestQueryClient();
    renderWithProviders(
      <>
        <TimezoneSync />
        <ActivityZone />
      </>,
      { queryClient },
    );

    await waitFor(() => expect(queryClient.getQueryData(currentUserKey)).toMatchObject({ settings: { timezone: 'Europe/Paris' } }));
    await settle();
    // The answer asked before the zone was saved comes last: it must not be kept.
    oldAnswer({ timezone: 'Asia/Ho_Chi_Minh', sessions: [] });
    await settle();

    expect(screen.getByText('Days in Europe/Paris')).toBeInTheDocument();
    expect(getActivity).toHaveBeenCalledTimes(2);
  });

  it('drops an answer that comes after the learner signed out, so the next account never shows theirs', async () => {
    const user = signIn('Asia/Ho_Chi_Minh');
    let answer!: (saved: unknown) => void;
    updateSettings.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const queryClient = createTestQueryClient();
    const { unmount } = renderWithProviders(<TimezoneSync />, { queryClient });
    await waitFor(() => expect(updateSettings).toHaveBeenCalled());

    // Logging out (`useLogout`) leaves the app and clears the cache; then another learner signs in.
    unmount();
    queryClient.clear();
    const next = { ...user, _id: 'next-learner', email: 'bob@example.com' };
    queryClient.setQueryData(currentUserKey, next);
    answer({ ...user, settings: { timezone: 'Europe/Paris' } });
    await settle();

    expect(queryClient.getQueryData(currentUserKey)).toEqual(next);
  });

  it('stays silent when the zone cannot be saved, and does not try again', async () => {
    signIn('Asia/Ho_Chi_Minh');
    updateSettings.mockRejectedValue({ response: { status: 400, data: { message: 'Unknown time zone' } } });
    // The app's client: it shows a toast for a failed mutation without its own `onError`.
    const queryClient = createQueryClient();
    renderWithProviders(<TimezoneSync />, { queryClient });

    await waitFor(() => expect(updateSettings).toHaveBeenCalledOnce());
    await settle();
    // The user is asked for again (e.g. after an avatar change): still no second request.
    await queryClient.invalidateQueries({ queryKey: currentUserKey });
    await settle();

    expect(toast.error).not.toHaveBeenCalled();
    expect(updateSettings).toHaveBeenCalledOnce();
  });

  it('sends it once per page load, however often it is drawn', async () => {
    signIn('Asia/Ho_Chi_Minh');
    updateSettings.mockReturnValue(new Promise(() => undefined));
    const { unmount } = renderWithProviders(
      <>
        <TimezoneSync />
        <TimezoneSync />
      </>,
    );
    await waitFor(() => expect(updateSettings).toHaveBeenCalled());
    unmount();

    // Drawn again, e.g. after a visit to the admin area: same user, same page load.
    renderWithProviders(<TimezoneSync />);
    await waitFor(() => expect(getMe).toHaveBeenCalledTimes(2));
    await settle();

    expect(updateSettings).toHaveBeenCalledOnce();
  });
});
