import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { DesktopNotice } from './DesktopNotice';

const originalMatchMedia = window.matchMedia;
const setDesktop = (desktop: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: desktop, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
};
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('DesktopNotice', () => {
  it('tells phones and tablets that TypeTrace is best on a desktop', () => {
    setDesktop(false);
    renderWithProviders(<DesktopNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('best on a desktop');
  });

  it('shows nothing on a desktop', () => {
    setDesktop(true);
    renderWithProviders(<DesktopNotice />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('closes with the button and stays closed the next time', async () => {
    setDesktop(false);
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<DesktopNotice />);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    unmount();
    renderWithProviders(<DesktopNotice />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
