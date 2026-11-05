import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminSettingsPage } from './AdminSettingsPage';

vi.mock('@/modules/ranked/api/ranked.api', () => ({
  rankedApi: { placementSettings: async () => ({ minAccuracy: 90 }), updatePlacementSettings: async (settings: unknown) => settings },
}));

describe('AdminSettingsPage', () => {
  beforeEach(() => localStorage.clear());

  it('has the Placement leaderboard panel with the minimum accuracy in use', async () => {
    renderWithProviders(<AdminSettingsPage />, { route: '/admin/settings', path: '/admin/settings' });

    expect(screen.getByRole('heading', { name: 'Placement leaderboard' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Minimum accuracy (%)')).toHaveValue(90);
  });

  it('shows the Appearance panel with the theme above the sidebar option', () => {
    renderWithProviders(<AdminSettingsPage />, { route: '/admin/settings', path: '/admin/settings' });
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
    const theme = screen.getByText('Theme');
    const sidebar = screen.getByText('Compact sidebar');
    expect(theme.compareDocumentPosition(sidebar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switches the sidebar between default and compact and remembers it', async () => {
    renderWithProviders(<AdminSettingsPage />, { route: '/admin/settings', path: '/admin/settings' });
    const toggle = screen.getByRole('switch', { name: 'Compact sidebar' });
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);
    expect(toggle).toBeChecked();
    expect(localStorage.getItem('sidebarMode')).toBe('compact');

    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(localStorage.getItem('sidebarMode')).toBe('default');
  });
});
