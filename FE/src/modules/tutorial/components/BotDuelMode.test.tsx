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

    expect(await screen.findByRole('button', { name: /^Bông · Dễ/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Nhịp · Vừa/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Dạ · Khó/ }));

    expect(await screen.findByRole('region', { name: "Dạ's field" })).toBeInTheDocument();
    // Nobody types on my side: three words land.
    advance(40_000);

    expect(await screen.findByRole('button', { name: 'Chơi lại' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đổi độ khó' }));
    expect(screen.getByRole('button', { name: /^Bông · Dễ/ })).toBeInTheDocument();
  });

  it('stops the duel when the learner leaves it', async () => {
    renderWithProviders(<BotDuelMode />);
    fireEvent.click(await screen.findByRole('button', { name: /^Nhịp · Vừa/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Thoát' }));

    advance(40_000);

    expect(screen.getByRole('button', { name: /^Nhịp · Vừa/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chơi lại' })).not.toBeInTheDocument();
  });
});
