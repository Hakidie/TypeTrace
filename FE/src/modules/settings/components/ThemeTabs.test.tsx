import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { getStoredTheme } from '@/shared/lib/theme';
import { renderWithProviders } from '@/test/render-with-providers';
import { ThemeTabs } from './ThemeTabs';

describe('ThemeTabs', () => {
  beforeEach(() => document.documentElement.classList.remove('dark'));

  it('starts on Dark and switches the mode, remembering it when nobody is signed in', async () => {
    renderWithProviders(<ThemeTabs />);
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: 'System' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked();
    expect(getStoredTheme().mode).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');

    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(getStoredTheme().mode).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
  });
});
