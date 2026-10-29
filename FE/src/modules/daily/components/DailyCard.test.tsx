import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DailyToday } from '../types/daily.types';
import { DailyCard } from './DailyCard';

vi.mock('@lottiefiles/dotlottie-react', () => ({ DotLottieReact: () => null }));

const HOUR = 60 * 60 * 1000;
const todayFixture = (overrides: Partial<DailyToday> = {}): DailyToday => ({
  date: '2026-10-29',
  passageTitle: 'Hà Nội vào thu',
  preview: 'Mùa thu Hà Nội đến nhẹ nhàng',
  seconds: 60,
  triesLeft: 2,
  best: { score: 57, wpm: 60, accuracy: 95 },
  rank: 4,
  streak: 5,
  coins: 20,
  lastTry: null,
  endsAt: new Date(Date.now() + 6 * HOUR + 12 * 60 * 1000 + 30_000).toISOString(),
  yesterdayWinner: null,
  ...overrides,
});

describe('DailyCard', () => {
  it("shows the day's passage, tries, best and streak", () => {
    render(<DailyCard today={todayFixture()} onStart={vi.fn()} />);

    expect(screen.getByText('Hà Nội vào thu')).toBeInTheDocument();
    expect(screen.getByText('Mùa thu Hà Nội đến nhẹ nhàng…')).toBeInTheDocument();
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Your best')).toHaveTextContent('57');
    expect(screen.getByText('#4 today')).toBeInTheDocument();
    expect(screen.getByLabelText('Streak')).toHaveTextContent('5');
  });

  it('labels the button with the next try and starts it', () => {
    const onStart = vi.fn();
    render(<DailyCard today={todayFixture()} onStart={onStart} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start try 2' }));

    expect(onStart).toHaveBeenCalled();
  });

  it('says when the tries are used up', () => {
    render(<DailyCard today={todayFixture({ triesLeft: 0 })} onStart={vi.fn()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Come back tomorrow')).toBeInTheDocument();
  });

  it('shows the time left until the next challenge', () => {
    render(<DailyCard today={todayFixture()} onStart={vi.fn()} />);

    expect(screen.getByText('New one in 6h 12m')).toBeInTheDocument();
  });

  it('shows a fresh day without a score', () => {
    render(<DailyCard today={todayFixture({ best: null, rank: null, streak: 0, triesLeft: 3 })} onStart={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Start try 1' })).toBeInTheDocument();
    expect(screen.getByText('No score yet')).toBeInTheDocument();
  });
});
