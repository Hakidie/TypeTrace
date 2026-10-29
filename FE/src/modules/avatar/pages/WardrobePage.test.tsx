import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { DEFAULT_AVATAR, type AvatarLook } from '../types/avatar.types';
import { WardrobePage } from './WardrobePage';

const catalog = vi.fn();
const update = vi.fn();
const buy = vi.fn();

vi.mock('../api/avatar.api', () => ({
  avatarApi: { catalog: () => catalog(), update: (look: unknown) => update(look), buy: (item: string) => buy(item) },
}));

const free = { kind: 'free' };
const slots = {
  skin: [{ id: 'peach', unlock: free, owned: true }],
  face: [{ id: 'classic', unlock: free, owned: true }],
  hair: [
    { id: 'short-brown', unlock: free, owned: true },
    { id: 'long-pink', unlock: free, owned: true },
    { id: 'buns-pink', unlock: { kind: 'shop', price: 100 }, owned: false },
  ],
  top: [{ id: 'red', unlock: free, owned: true }],
  bottom: [{ id: 'navy', unlock: free, owned: true }],
  shoes: [{ id: 'sneakers-brown', unlock: free, owned: true }],
  headwear: [
    { id: 'crown', unlock: { kind: 'tier', tier: 'diamond' }, owned: true },
    { id: 'halo', unlock: { kind: 'tier', tier: 'legend' }, owned: false },
    { id: 'tiara', unlock: { kind: 'season' }, owned: false },
  ],
  accessory: [],
  back: [],
  effect: [],
};

const answer = (avatar: AvatarLook = DEFAULT_AVATAR) => catalog.mockResolvedValue({ avatar, coins: 0, slots });
const renderPage = () => renderWithProviders(<WardrobePage />, { route: '/wardrobe' });
const openTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));

beforeEach(() => {
  catalog.mockReset();
  update.mockReset();
  buy.mockReset();
  answer();
  update.mockImplementation(async (look: AvatarLook) => ({ _id: 'u1', email: 'demo@example.com', avatar: look }));
});

describe('WardrobePage', () => {
  it('shows the current look and the coins', async () => {
    renderPage();

    expect(await screen.findByRole('img', { name: 'Your avatar' })).toBeInTheDocument();
    expect(screen.getByText('0 coins')).toBeInTheDocument();
  });

  it('previews a free item and saves the new look', async () => {
    renderPage();
    await screen.findByRole('img', { name: 'Your avatar' });
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    openTab('Hair');
    fireEvent.click(screen.getByRole('button', { name: 'Long pink' }));
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ hair: 'long-pink' })));
  });

  it('shows locked items with their price or reward; a reward cannot be picked', async () => {
    renderPage();
    await screen.findByRole('img', { name: 'Your avatar' });

    openTab('Hair');
    expect(within(screen.getByRole('button', { name: /Buns pink/ })).getByText('100 coins')).toBeInTheDocument();

    openTab('Headwear');
    const halo = screen.getByRole('button', { name: /Halo/ });
    expect(within(halo).getByText('Legend reward')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /Tiara/ })).getByText('Season reward')).toBeInTheDocument();
    expect(halo).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(halo);
    expect(halo).toHaveAttribute('aria-pressed', 'false');
  });

  it('previews an item for sale and buys it with coins (phase 6)', async () => {
    catalog.mockResolvedValue({ avatar: DEFAULT_AVATAR, coins: 150, slots });
    buy.mockResolvedValue({ avatar: DEFAULT_AVATAR, coins: 50, slots: { ...slots, hair: slots.hair.map((item) => ({ ...item, owned: true })) } });
    renderPage();
    await screen.findByRole('img', { name: 'Your avatar' });

    openTab('Hair');
    const buns = screen.getByRole('button', { name: 'Buns pink (100 coins)' });
    fireEvent.click(buns);
    expect(buns).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Buy Buns pink for 100 coins' }));

    await waitFor(() => expect(buy).toHaveBeenCalledWith('hair:buns-pink'));
    expect(await screen.findByText('50 coins')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('cannot buy without enough coins (phase 6)', async () => {
    catalog.mockResolvedValue({ avatar: DEFAULT_AVATAR, coins: 40, slots });
    renderPage();
    await screen.findByRole('img', { name: 'Your avatar' });

    openTab('Hair');
    fireEvent.click(screen.getByRole('button', { name: /Buns pink/ }));

    expect(screen.getByRole('button', { name: 'Buy Buns pink for 100 coins' })).toBeDisabled();
    expect(screen.getByText('Not enough coins')).toBeInTheDocument();
  });

  it('clears an optional slot with None', async () => {
    answer({ ...DEFAULT_AVATAR, headwear: 'crown' });
    renderPage();
    await screen.findByRole('img', { name: 'Your avatar' });

    openTab('Headwear');
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ headwear: null })));
  });

  it('resets the preview to the saved look', async () => {
    renderPage();
    await screen.findByRole('img', { name: 'Your avatar' });

    openTab('Hair');
    fireEvent.click(screen.getByRole('button', { name: 'Long pink' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Short brown' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('groups the colors of a style: a style card puts it on, its colors are shown beside', async () => {
    catalog.mockResolvedValue({
      avatar: DEFAULT_AVATAR,
      coins: 0,
      slots: {
        ...slots,
        hair: ['short-brown', 'short-pink', 'long-brown', 'long-pink'].map((id) => ({ id, unlock: free, owned: true })),
      },
    });
    renderPage();
    await screen.findByRole('img', { name: 'Your avatar' });

    openTab('Hair');
    expect(within(screen.getByRole('region', { name: 'Short colors' })).getByRole('button', { name: 'Short pink' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Long' }));

    // The brown worn stays brown in the new style.
    expect(screen.getByRole('button', { name: 'Long brown' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('region', { name: 'Short colors' })).not.toBeInTheDocument();
  });

  it('shows the backend error with a retry button', async () => {
    catalog.mockRejectedValue(new Error('Network down'));
    renderPage();

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
