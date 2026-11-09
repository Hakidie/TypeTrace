import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { Streak } from '../types/profile.types';
import { StreakRewardBar } from './StreakRewardBar';

const getStreak = vi.fn();
const claimStreakReward = vi.fn();

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: { getStreak: () => getStreak(), claimStreakReward: () => claimStreakReward() },
}));

const streakOf = (current: number, sessions: number, claimed: boolean, coins = 30): Streak => ({
  current,
  longest: 5,
  today: { date: '2026-11-09', sessions, missionGoal: 1, missionCompleted: sessions > 0, reward: { coins, claimed } },
});

const bar = () => screen.findByRole('region', { name: 'Streak and daily reward' });

describe('StreakRewardBar', () => {
  beforeEach(() => {
    getStreak.mockReset();
    claimStreakReward.mockReset();
  });

  it('tells what the first session of the day gives before it is typed', async () => {
    getStreak.mockResolvedValue(streakOf(2, 0, false));
    renderWithProviders(<StreakRewardBar />);

    expect(await bar()).toHaveTextContent('2 ngày streak');
    expect(await bar()).toHaveTextContent('Gõ xong 1 phiên hôm nay để giữ streak và nhận30 xu');
  });

  it('invites a learner without a streak to start one', async () => {
    getStreak.mockResolvedValue(streakOf(0, 0, false, 20));
    renderWithProviders(<StreakRewardBar />);

    expect(await bar()).toHaveTextContent('Bắt đầu streak hôm nay');
    expect(await bar()).toHaveTextContent('20 xu');
  });

  it('claims a due reward, then says it is claimed', async () => {
    getStreak.mockResolvedValueOnce(streakOf(3, 1, false)).mockResolvedValue(streakOf(3, 1, true));
    claimStreakReward.mockResolvedValue({ coins: 30, totalCoins: 130 });
    renderWithProviders(<StreakRewardBar />);

    await userEvent.click(await screen.findByRole('button', { name: 'Nhận 30 xu' }));

    expect(await screen.findByText('Đã nhận 30 xu hôm nay')).toBeInTheDocument();
    expect(claimStreakReward).toHaveBeenCalledTimes(1);
  });
});
