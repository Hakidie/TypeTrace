import { fireEvent, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { i18n } from '@/shared/i18n/i18n';
import { readStoredUiLanguage } from '@/shared/i18n/ui-language';
import { renderWithProviders } from '@/test/render-with-providers';
import { LanguageSettings } from './LanguageSettings';
import { LanguageSync } from './LanguageSync';

const getMe = vi.fn();
const updateSettings = vi.fn();

vi.mock('@/modules/auth/api/auth.api', () => ({ authApi: { getMe: () => getMe() } }));
vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: { updateSettings: (data: unknown) => updateSettings(data) },
}));

const account = (settings: object) => ({ _id: 'user-1', email: 'alice@example.com', role: 'user', settings });

beforeEach(() => {
  getMe.mockReset();
  updateSettings.mockReset();
  tokenStore.clear();
});

describe('LanguageSettings', () => {
  it('changes the interface at once, keeps it in the browser and saves it in the account', async () => {
    tokenStore.set('jwt-value');
    getMe.mockResolvedValue(account({}));
    updateSettings.mockResolvedValue(account({ uiLanguage: 'vi' }));
    renderWithProviders(<LanguageSettings />);

    fireEvent.click(await screen.findByRole('radio', { name: 'Tiếng Việt' }));

    expect(await screen.findByText('Ngôn ngữ', { selector: 'h2, h3, span, div' })).toBeInTheDocument();
    expect(i18n.language).toBe('vi');
    expect(readStoredUiLanguage()).toBe('vi');
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ uiLanguage: 'vi' }));
  });

  it('works for a guest without calling the API', async () => {
    renderWithProviders(<LanguageSettings />);

    fireEvent.click(await screen.findByRole('radio', { name: 'Tiếng Việt' }));

    expect(i18n.language).toBe('vi');
    expect(readStoredUiLanguage()).toBe('vi');
    expect(updateSettings).not.toHaveBeenCalled();
  });
});

describe('LanguageSync', () => {
  it('shows the language saved in the account, whatever this browser had', async () => {
    tokenStore.set('jwt-value');
    getMe.mockResolvedValue(account({ uiLanguage: 'vi' }));
    renderWithProviders(<LanguageSync />);

    await waitFor(() => expect(i18n.language).toBe('vi'));
    expect(readStoredUiLanguage()).toBe('vi');
  });

  it('keeps the browser language for an account that never chose one', async () => {
    tokenStore.set('jwt-value');
    await act(() => i18n.changeLanguage('vi'));
    getMe.mockResolvedValue(account({}));
    renderWithProviders(<LanguageSync />);

    await waitFor(() => expect(getMe).toHaveBeenCalled());
    expect(i18n.language).toBe('vi');
  });
});
