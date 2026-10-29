import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminSeasonsPage } from './AdminSeasonsPage';

const seasons = vi.fn();
const closeSeason = vi.fn();

vi.mock('../api/ranked.api', () => ({
  rankedApi: { seasons: (params: unknown) => seasons(params), closeSeason: (id: string) => closeSeason(id) },
}));

const season = (id: string, number: number, status: 'active' | 'closed') => ({
  _id: id,
  number,
  status,
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2026-10-27T00:00:00.000Z',
});
const page = (items: unknown[]) => ({ items, page: 1, limit: 20, total: items.length, totalPages: 1 });

beforeEach(() => {
  tokenStore.set('test-token');
  seasons.mockReset().mockResolvedValue(page([season('s2', 2, 'active'), season('s1', 1, 'closed')]));
  closeSeason.mockReset().mockResolvedValue(season('s3', 3, 'active'));
});

describe('AdminSeasonsPage (ranked duel, phase 5)', () => {
  it('lists the seasons with their status; only the active one can be closed', async () => {
    renderWithProviders(<AdminSeasonsPage />, { route: '/admin/seasons', path: '/admin/seasons' });

    const rows = await screen.findAllByRole('article');
    expect(within(rows[0]).getByText('Season 2')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Active')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Closed')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('button', { name: 'Close season' })).toBeInTheDocument();
    expect(within(rows[1]).queryByRole('button', { name: 'Close season' })).not.toBeInTheDocument();
  });

  it('closes the season after a confirmation', async () => {
    renderWithProviders(<AdminSeasonsPage />, { route: '/admin/seasons', path: '/admin/seasons' });

    fireEvent.click(await screen.findByRole('button', { name: 'Close season' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/halfway back to 1000/i);
    expect(closeSeason).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close season' }));

    await waitFor(() => expect(closeSeason).toHaveBeenCalledWith('s2'));
    await waitFor(() => expect(seasons).toHaveBeenCalledTimes(2));
  });
});
