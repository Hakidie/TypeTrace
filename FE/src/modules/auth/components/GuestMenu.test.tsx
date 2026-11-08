import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { GuestMenu } from './GuestMenu';

describe('GuestMenu', () => {
  it('shows a guest with the default avatar and a menu to log in or register', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GuestMenu />);

    await user.click(screen.getByRole('button', { name: 'Guest menu' }));

    expect(await screen.findByRole('menuitem', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Mode:/ })).toBeInTheDocument();
  });
});
