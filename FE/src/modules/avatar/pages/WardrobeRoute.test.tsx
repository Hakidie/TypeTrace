import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { DEFAULT_AVATAR } from '../types/avatar.types';
import { WardrobeRoute } from './WardrobeRoute';

const catalog = vi.fn();
vi.mock('../api/avatar.api', () => ({ avatarApi: { catalog: () => catalog() } }));

const slots = { skin: [], face: [], hair: [], top: [], bottom: [], shoes: [], headwear: [], accessory: [], back: [], effect: [] };

beforeEach(() => {
  catalog.mockReset().mockResolvedValue({ avatar: DEFAULT_AVATAR, coins: 0, premium: { active: false, until: null }, slots });
});

describe('WardrobeRoute', () => {
  it('opens the classic wardrobe until another version is chosen', async () => {
    renderWithProviders(<WardrobeRoute />, { route: '/wardrobe' });

    expect(await screen.findByRole('tablist', { name: 'Slots' })).toBeInTheDocument();
  });

  it('opens the modern wardrobe when the setting says so', async () => {
    localStorage.setItem('wardrobeVersion', 'modern');
    renderWithProviders(<WardrobeRoute />, { route: '/wardrobe' });

    expect(await screen.findByRole('group', { name: 'Clothes' })).toBeInTheDocument();
  });
});
