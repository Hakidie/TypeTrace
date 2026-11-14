import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { FONT_OPTIONS } from '../lib/fonts';
import { FontSync } from './FontSync';

const user = vi.hoisted(() => ({ current: undefined as undefined | { settings?: { fontFamily?: string } } }));

vi.mock('@/modules/auth/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: user.current }),
  useSetCurrentUser: () => () => undefined,
}));

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty('--app-font');
  localStorage.clear();
});

describe('FontSync', () => {
  it("applies the signed-in learner's font and remembers it", async () => {
    for (const item of FONT_OPTIONS) vi.spyOn(item, 'load').mockResolvedValue(undefined);
    user.current = { settings: { fontFamily: 'be-vietnam-pro' } };

    const { container } = renderWithProviders(<FontSync />);

    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--app-font')).toBe(FONT_OPTIONS.find((item) => item.id === 'be-vietnam-pro')!.stack),
    );
    expect(localStorage.getItem('typetrace-font')).toBe('be-vietnam-pro');
    expect(container).toBeEmptyDOMElement();
  });

  it('uses JetBrains Mono for an account that never chose a font', async () => {
    for (const item of FONT_OPTIONS) vi.spyOn(item, 'load').mockResolvedValue(undefined);
    user.current = { settings: {} };

    renderWithProviders(<FontSync />);

    await waitFor(() => expect(localStorage.getItem('typetrace-font')).toBe('jetbrains-mono'));
  });
});
