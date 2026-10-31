import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { PracticeResult } from './PracticeResult';

const coach = vi.fn();
vi.mock('../api/tutorial.api', () => ({
  tutorialApi: { start: vi.fn(), update: vi.fn(), reset: vi.fn(), coach: (stats: unknown) => coach(stats) },
}));

const STATS = { result: 'win' as const, hits: 19, thrown: 7, livesLeft: 3, seconds: 74, missedWords: [] };

describe('PracticeResult', () => {

  it("shows the numbers and Ping's tip", async () => {
    coach.mockResolvedValue({ tip: 'Đỉnh! Bạn giữ đủ 3 mạng.', ai: true });
    renderWithProviders(<PracticeResult stats={STATS} onAgain={vi.fn()} onRank={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'You win' })).toBeInTheDocument();
    expect(screen.getByText('words thrown').previousSibling).toHaveTextContent('7');
    expect(await screen.findByText('Đỉnh! Bạn giữ đủ 3 mạng.')).toBeInTheDocument();
    expect(coach).toHaveBeenCalledWith(STATS);
  });

  it('still gives a tip when the request fails', async () => {
    coach.mockRejectedValue(new Error('offline'));
    renderWithProviders(<PracticeResult stats={{ ...STATS, result: 'loss', livesLeft: 0 }} onAgain={vi.fn()} onRank={vi.fn()} />);

    expect(await screen.findByText(/Gõ chữ ở thấp nhất trước/)).toBeInTheDocument();
  });

  it('plays again or goes to the real Rank', () => {
    coach.mockResolvedValue({ tip: 'Hay!', ai: true });
    const onAgain = vi.fn();
    const onRank = vi.fn();
    renderWithProviders(<PracticeResult stats={STATS} onAgain={onAgain} onRank={onRank} />);

    fireEvent.click(screen.getByRole('button', { name: 'Đấu lại với Ping' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vào Rank thật' }));

    expect(onAgain).toHaveBeenCalledOnce();
    expect(onRank).toHaveBeenCalledOnce();
  });
});
