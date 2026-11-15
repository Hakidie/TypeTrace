import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Keyboard, ShoppingBag, Trophy, User } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { NavLinks } from './NavLinks';

const items = [
  { to: '/typing', label: 'Typing', icon: Keyboard, guest: true },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy, guest: true },
  { to: '/profile', label: 'Profile', icon: User },
  { Component: () => <button type="button">Chat</button> },
  { to: '/admin', label: 'Admin', icon: ShoppingBag, roles: ['admin' as const] },
];

describe('NavLinks', () => {
  it('shows every link and widget to a signed-in user, none locked', () => {
    renderWithProviders(<NavLinks items={items.slice(0, 4)} />, { route: '/typing' });

    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.queryByText('(locked)')).not.toBeInTheDocument();
  });

  it('keeps the pages open to guests as links for a guest, and locks the others with a link to Register', () => {
    renderWithProviders(<NavLinks items={items.slice(0, 4)} guest />, { route: '/typing' });

    expect(screen.getByRole('link', { name: 'Typing' })).toHaveAttribute('href', '/typing');
    expect(screen.getByRole('link', { name: 'Leaderboard' })).toHaveAttribute('href', '/leaderboard');
    const locked = screen.getByRole('link', { name: /Profile/ });
    expect(locked).toHaveAttribute('href', '/register');
    expect(locked).toHaveTextContent('(locked)');
    // A widget (the AI chat button) calls APIs that need a sign-in: not for a guest.
    expect(screen.queryByRole('button', { name: 'Chat' })).not.toBeInTheDocument();
  });

  it('says "Create an account" in a tooltip when a locked tab is hovered', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NavLinks items={items.slice(0, 3)} guest />, { route: '/typing' });
    expect(screen.queryByText('Create an account')).not.toBeInTheDocument();

    await user.hover(screen.getByRole('link', { name: /Profile/ }));
    expect((await screen.findAllByText('Create an account'))[0]).toBeInTheDocument();
  });
});
