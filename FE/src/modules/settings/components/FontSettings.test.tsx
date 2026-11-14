import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { FONT_OPTIONS } from '../lib/fonts';
import { FontSettings } from './FontSettings';

const getMe = vi.fn();
const updateSettings = vi.fn();

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => getMe() },
}));
vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: { updateSettings: (data: unknown) => updateSettings(data) },
}));

const user = (settings: object) => ({ _id: 'user-1', email: 'alice@example.com', role: 'user', settings });

const group = () => screen.findByRole('radiogroup', { name: 'Interface font' });

beforeEach(() => {
  vi.restoreAllMocks();
  for (const option of FONT_OPTIONS) vi.spyOn(option, 'load').mockResolvedValue(undefined);
  tokenStore.set('jwt-value');
  getMe.mockReset();
  updateSettings.mockReset();
});

describe('FontSettings', () => {
  it('lists the five fonts, each row in its own font, and loads their files to show them', async () => {
    getMe.mockResolvedValue(user({}));
    renderWithProviders(<FontSettings />);

    const radios = within(await group()).getAllByRole('radio');
    expect(radios.map((radio) => radio.textContent)).toEqual(FONT_OPTIONS.map((option) => expect.stringContaining(option.label)));
    // jsdom writes the quotes of a family name as " when it reads the style back.
    radios.forEach((radio, index) => expect(radio.style.fontFamily.replaceAll('"', "'")).toBe(FONT_OPTIONS[index].stack));
    for (const option of FONT_OPTIONS) expect(option.load).toHaveBeenCalled();
  });

  it('checks the saved font, JetBrains Mono for an account that never chose one', async () => {
    getMe.mockResolvedValue(user({}));
    renderWithProviders(<FontSettings />);

    expect(within(await group()).getByRole('radio', { name: /JetBrains Mono/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(await group()).getByRole('radio', { name: /Lexend/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('saves the font that was chosen', async () => {
    getMe.mockResolvedValue(user({}));
    updateSettings.mockResolvedValue(user({ fontFamily: 'lexend' }));
    renderWithProviders(<FontSettings />);

    fireEvent.click(within(await group()).getByRole('radio', { name: /Lexend/ }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ fontFamily: 'lexend' }));
    await waitFor(() => expect(within(screen.getByRole('radiogroup', { name: 'Interface font' })).getByRole('radio', { name: /Lexend/ })).toHaveAttribute('aria-checked', 'true'));
  });

  it('keeps the old font checked when the save fails', async () => {
    getMe.mockResolvedValue(user({ fontFamily: 'noto-serif' }));
    updateSettings.mockRejectedValue({ response: { data: { message: 'Server down' } } });
    renderWithProviders(<FontSettings />);

    fireEvent.click(within(await group()).getByRole('radio', { name: /Lexend/ }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalled());
    expect(within(screen.getByRole('radiogroup', { name: 'Interface font' })).getByRole('radio', { name: /Noto Serif/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the error state when the user fails to load', async () => {
    getMe.mockRejectedValue({ response: { data: { message: 'Server down' } } });
    renderWithProviders(<FontSettings />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Server down');
  });
});
