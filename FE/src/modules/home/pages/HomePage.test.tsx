import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { HomePage } from './HomePage';

beforeEach(() => tokenStore.clear());

describe('HomePage', () => {
  it('opens the typing page for a signed-in user', async () => {
    tokenStore.set('jwt-value');
    renderWithProviders(<HomePage />, { route: '/', otherRoutes: { '/typing': 'typing page' } });

    expect(await screen.findByText('typing page')).toBeInTheDocument();
  });

  it('lets a guest try typing on the home page itself', () => {
    renderWithProviders(<HomePage />, { route: '/', otherRoutes: { '/typing': 'typing page' } });

    expect(screen.getByRole('textbox', { name: 'Typing area' })).toBeInTheDocument();
    expect(screen.queryByText('typing page')).not.toBeInTheDocument();
  });
});
