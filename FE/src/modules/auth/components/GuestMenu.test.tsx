import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/shared/i18n/i18n';
import { readStoredUiLanguage } from '@/shared/i18n/ui-language';
import { renderWithProviders } from '@/test/render-with-providers';
import { GuestMenu } from './GuestMenu';

describe('GuestMenu', () => {
  it('shows a guest with the default avatar and a menu to log in or register', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GuestMenu />);

    await user.click(screen.getByRole('button', { name: 'Guest menu' }));

    expect(await screen.findByRole('menuitem', { name: 'Wardrobe' })).toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Dark' })).toBeInTheDocument();
  });

  it('switches the language of the interface and keeps it in the browser', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GuestMenu />);

    await user.click(screen.getByRole('button', { name: 'Guest menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'English' }));

    expect(i18n.language).toBe('vi');
    expect(readStoredUiLanguage()).toBe('vi');
  });
});
