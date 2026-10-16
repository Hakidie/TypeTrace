import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { PlacementIntroPage } from './PlacementIntroPage';

const renderPage = () =>
  renderWithProviders(<PlacementIntroPage />, { route: '/placement', otherRoutes: { '/typing': 'typing page' } });

describe('PlacementIntroPage', () => {
  it('explains the placement test before it starts', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Placement test' })).toBeInTheDocument();
    expect(screen.getByText(/ends after 3 minutes at most/)).toBeInTheDocument();
  });

  it('opens the placement test with Start', async () => {
    const user = userEvent.setup();
    renderPage();

    const start = screen.getByRole('link', { name: 'Start' });
    expect(start).toHaveAttribute('href', '/typing?mode=placement');
    await user.click(start);

    expect(await screen.findByText('typing page')).toBeInTheDocument();
  });

  it('opens normal practice with Skip', async () => {
    const user = userEvent.setup();
    renderPage();

    const skip = screen.getByRole('link', { name: 'Skip' });
    expect(skip).toHaveAttribute('href', '/typing');
    await user.click(skip);

    expect(await screen.findByText('typing page')).toBeInTheDocument();
  });
});
