import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { DEFAULT_AVATAR, type AvatarLook } from '../types/avatar.types';
import { WardrobeV2Page } from './WardrobeV2Page';

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
  headwear: [{ id: 'tiara', unlock: { kind: 'season' }, owned: false }],
  accessory: [],
  back: [],
  effect: [],
};

const renderPage = () => renderWithProviders(<WardrobeV2Page />, { route: '/wardrobe' });

beforeEach(() => {
  catalog.mockReset().mockResolvedValue({ avatar: DEFAULT_AVATAR, coins: 150, premium: { active: false, until: null }, slots });
  update.mockReset().mockImplementation(async (look: AvatarLook) => ({ _id: 'u1', email: 'demo@example.com', avatar: look }));
  buy.mockReset();
});

const openSlot = (name: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));

describe('WardrobeV2Page', () => {
  it('shows the avatar, the coins and the slots in three groups', async () => {
    renderPage();

    expect(await screen.findByRole('img', { name: 'Your avatar' })).toBeInTheDocument();
    expect(screen.getByText('150 coins')).toBeInTheDocument();
    const names = (group: string) => within(screen.getByRole('group', { name: group })).getAllByRole('button').map((b) => b.querySelector('span')?.firstChild?.textContent);
    expect(names('Clothes')).toEqual(['Top', 'Bottom', 'Shoes']);
    expect(names('Looks')).toEqual(['Skin', 'Face', 'Hair', 'Effect']);
    expect(names('Extras')).toEqual(['Headwear', 'Accessory', 'Back']);
  });

  it('links the coins to the coin packs of the Store', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'Get coins' })).toHaveAttribute('href', '/store?section=coins');
  });

  it('says on each tab what the avatar wears in that slot', async () => {
    renderPage();
    await screen.findByRole('img', { name: 'Your avatar' });

    expect(screen.getByRole('button', { name: /^Hair/ })).toHaveTextContent(/Short brown|Long|Buns/);
    expect(screen.getByRole('button', { name: /^Headwear/ })).toHaveTextContent('None');
    openSlot('Hair');
    fireEvent.click(screen.getByRole('button', { name: 'Long pink' }));
    expect(screen.getByRole('button', { name: /^Hair/ })).toHaveTextContent('Long pink');
  });

  it('opens the items of a slot in a drawer beside the avatar, previews one and saves the look', async () => {
    renderPage();
    await screen.findByRole('img', { name: 'Your avatar' });

    openSlot('Hair');
    expect(screen.getByRole('complementary', { name: 'Hair' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Long pink' }));
    expect(screen.getByRole('img', { name: 'Your avatar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ hair: 'long-pink' })));
  });

  it('offers to buy an item for sale and cannot save until it is bought', async () => {
    renderPage();
    await screen.findByRole('img', { name: 'Your avatar' });

    openSlot('Hair');
    fireEvent.click(screen.getByRole('button', { name: 'Buns pink (100 coins)' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Buy Buns pink for 100 coins' }));

    await waitFor(() => expect(buy).toHaveBeenCalledWith('hair:buns-pink'));
  });

  it('does not put on a reward that is not won yet', async () => {
    renderPage();
    await screen.findByRole('img', { name: 'Your avatar' });

    openSlot('Headwear');
    fireEvent.click(screen.getByRole('button', { name: 'Tiara (Season reward)' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves the classic wardrobe as the choice from the switch beside the title', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Switch to Classic wardrobe' }));

    expect(localStorage.getItem('wardrobeVersion')).toBe('classic');
  });

  it('closes the drawer with its Close button or with the tab again', async () => {
    renderPage();
    await screen.findByRole('img', { name: 'Your avatar' });

    openSlot('Hair');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    openSlot('Hair');
    openSlot('Hair');
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('is the first wardrobe on a phone', async () => {
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    renderPage();

    expect(await screen.findByRole('tablist', { name: 'Slots' })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('opens the drawer on the right for every slot, whatever its group', async () => {
    renderPage();
    await screen.findByRole('img', { name: 'Your avatar' });

    openSlot('Top');
    expect(screen.getByRole('complementary', { name: 'Top' })).toHaveClass('right-0');
    openSlot('Hair');
    expect(screen.getByRole('complementary', { name: 'Hair' })).toHaveClass('right-0');
    openSlot('Headwear');
    expect(screen.getByRole('complementary', { name: 'Headwear' })).toHaveClass('right-0');
  });
});
