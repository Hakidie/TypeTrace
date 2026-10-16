import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminSettingsPage } from './AdminSettingsPage';

describe('AdminSettingsPage', () => {
  it('shows the page description', () => {
    renderWithProviders(<AdminSettingsPage />, { route: '/admin/settings', path: '/admin/settings' });
    expect(screen.getByText(/settings of the app/)).toBeInTheDocument();
  });
});
