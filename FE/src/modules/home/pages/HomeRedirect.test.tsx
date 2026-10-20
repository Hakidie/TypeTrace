import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { HomeRedirect } from './HomeRedirect';

describe('HomeRedirect', () => {
  it('opens the typing page, which is the home page', async () => {
    renderWithProviders(<HomeRedirect />, { route: '/', otherRoutes: { '/typing': 'typing page' } });

    expect(await screen.findByText('typing page')).toBeInTheDocument();
  });
});
