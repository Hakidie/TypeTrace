import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUserKey } from '@/modules/auth/hooks/use-current-user';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { renderWithProviders } from '@/test/render-with-providers';
import { SecuritySettings } from './SecuritySettings';

const updateSecurity = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: { updateSecurity: (data: unknown) => updateSecurity(data) },
}));

vi.mock('sonner', () => ({
  toast: { error: (msg: string) => toastError(msg), success: (msg: string) => toastSuccess(msg) },
}));

const user = {
  _id: 'user-1',
  email: 'alice@example.com',
  role: 'user',
  loginOtpEnabled: false,
} as CurrentUser;

beforeEach(() => {
  updateSecurity.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe('SecuritySettings', () => {
  it('sends the new value and stores the returned user', async () => {
    updateSecurity.mockResolvedValue({ ...user, loginOtpEnabled: true });
    const { queryClient } = renderWithProviders(<SecuritySettings user={user} />);
    queryClient.setQueryData(currentUserKey, user);

    fireEvent.click(screen.getByRole('switch', { name: 'Email code at login' }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(updateSecurity).toHaveBeenCalledWith({ loginOtpEnabled: true });
    expect(queryClient.getQueryData<CurrentUser>(currentUserKey)?.loginOtpEnabled).toBe(true);
  });

  it('restores the previous value and shows the error when saving fails', async () => {
    updateSecurity.mockRejectedValue({ response: { data: { message: 'Server down' } } });
    const { queryClient } = renderWithProviders(<SecuritySettings user={user} />);
    queryClient.setQueryData(currentUserKey, user);

    fireEvent.click(screen.getByRole('switch', { name: 'Email code at login' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Server down'));
    expect(queryClient.getQueryData<CurrentUser>(currentUserKey)?.loginOtpEnabled).toBe(false);
  });

  it('reflects an enabled setting', () => {
    renderWithProviders(<SecuritySettings user={{ ...user, loginOtpEnabled: true }} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });
});
