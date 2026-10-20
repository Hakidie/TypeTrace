import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminSettingsPage } from './AdminSettingsPage';

describe('AdminSettingsPage', () => {
  beforeEach(() => localStorage.clear());

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
