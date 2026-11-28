import { screen, within } from '@testing-library/react';
import { Keyboard, User } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { MobileTabBar } from './MobileTabBar';

const items = [
  { to: '/typing', label: 'Typing', icon: Keyboard, guest: true },
  { to: '/profile', label: 'Profile', icon: User },
];
const originalMatchMedia = window.matchMedia;
const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
};
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('MobileTabBar', () => {
  it('shows every link with its label on a phone', () => {
    setWide(false);
    renderWithProviders(<MobileTabBar items={items} />, { route: '/typing' });
    const bar = screen.getByRole('region', { name: 'Main navigation' });
    expect(within(bar).getByRole('link', { name: 'Typing' })).toHaveAttribute('href', '/typing');
    expect(within(bar).getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
  });

  it('locks the pages a guest cannot open', () => {
    setWide(false);
    renderWithProviders(<MobileTabBar items={items} guest />, { route: '/typing' });
    expect(screen.getByRole('link', { name: /Profile/ })).toHaveAttribute('href', '/register');
  });

  it('is not drawn on a wide screen, where the header has the links', () => {
    setWide(true);
    renderWithProviders(<MobileTabBar items={items} />);
    expect(screen.queryByRole('region', { name: 'Main navigation' })).not.toBeInTheDocument();
  });
});
