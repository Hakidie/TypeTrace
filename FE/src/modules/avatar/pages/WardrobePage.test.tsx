import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { DEFAULT_AVATAR, type AvatarLook } from '../types/avatar.types';
import { WardrobePage } from './WardrobePage';

const catalog = vi.fn();
const update = vi.fn();

vi.mock('../api/avatar.api', () => ({
  avatarApi: { catalog: () => catalog(), update: (look: unknown) => update(look) },
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
    fireEvent.click(screen.getByRole('button', { name: 'long-pink' }));
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ hair: 'long-pink' })));
  });

  it('shows locked items with their price or reward and does not pick them', async () => {
    renderPage();
    await screen.findByRole('img', { name: 'Your avatar' });

    openTab('Hair');
    const buns = screen.getByRole('button', { name: /buns-pink/ });
    expect(within(buns).getByText('100 coins')).toBeInTheDocument();
    expect(buns).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(buns);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    openTab('Headwear');
    expect(within(screen.getByRole('button', { name: /halo/ })).getByText('Legend reward')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'long-pink' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'short-brown' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the backend error with a retry button', async () => {
    catalog.mockRejectedValue(new Error('Network down'));
    renderPage();

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
