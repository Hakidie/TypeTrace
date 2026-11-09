import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { BotDuelMode } from './BotDuelMode';

vi.mock('@/modules/rain/api/rain.api', () => ({ rainApi: { words: async () => ({ words: ['nhà', 'cửa', 'bàn', 'ghế', 'mưa', 'đèn'], focus: [] }) } }));
vi.mock('../api/tutorial.api', () => ({
  tutorialApi: { start: vi.fn(), update: vi.fn(), reset: vi.fn(), coach: async () => ({ tip: 'Hay!', ai: true }) },
}));

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('BotDuelMode', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('picks a level, plays, then offers to play again or change level', async () => {
    renderWithProviders(<BotDuelMode />);

    expect(await screen.findByRole('button', { name: /^Bông · Easy/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Nhịp · Medium/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Dạ · Hard/ }));

    expect(await screen.findByRole('region', { name: "Dạ's field" })).toBeInTheDocument();
    // Nobody types on my side: three words land.
    advance(40_000);

    expect(await screen.findByRole('button', { name: 'Play again' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change level' }));
    expect(screen.getByRole('button', { name: /^Bông · Easy/ })).toBeInTheDocument();
  });

  it('switches the picker between English and Vietnamese', async () => {
    localStorage.clear();
    renderWithProviders(<BotDuelMode />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tiếng Việt' }));
    expect(await screen.findByRole('button', { name: /^Bông · Dễ/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chọn đối thủ' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(await screen.findByRole('heading', { name: 'Pick your opponent' })).toBeInTheDocument();
  });

  it('has no leave button inside a duel', async () => {
    renderWithProviders(<BotDuelMode />);
    fireEvent.click(await screen.findByRole('button', { name: /^Nhịp · Medium/ }));

    expect(await screen.findByRole('region', { name: "Nhịp's field" })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument();
  });

});
