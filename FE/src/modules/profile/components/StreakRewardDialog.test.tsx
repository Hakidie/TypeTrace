import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { i18n } from '@/shared/i18n/i18n';
import { renderWithProviders } from '@/test/render-with-providers';
import type { Streak } from '../types/profile.types';
import { StreakRewardDialog } from './StreakRewardDialog';

const getStreak = vi.fn();
const claimStreakReward = vi.fn();

vi.mock('@lottiefiles/dotlottie-react', () => ({ DotLottieReact: () => null }));

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: { getStreak: () => getStreak(), claimStreakReward: () => claimStreakReward() },
}));

const streakOf = (sessions: number, claimed: boolean): Streak => ({
  current: 3,
  longest: 5,
  today: { date: '2026-11-09', sessions, missionGoal: 1, missionCompleted: sessions > 0, reward: { coins: 30, claimed } },
});

describe('StreakRewardDialog', () => {
  beforeEach(() => {
    getStreak.mockReset();
    claimStreakReward.mockReset();
  });

  it("claims today's coins after the first counted session", async () => {
    getStreak.mockResolvedValueOnce(streakOf(1, false)).mockResolvedValue(streakOf(1, true));
    claimStreakReward.mockResolvedValue({ coins: 30, totalCoins: 130 });
    renderWithProviders(<StreakRewardDialog />);

    expect(await screen.findByRole('dialog', { name: 'Claim your reward' })).toHaveTextContent('3-day streak');
    await userEvent.click(screen.getByRole('button', { name: 'Claim 30 coins' }));

    expect(await screen.findByRole('dialog', { name: 'Reward claimed' })).toHaveTextContent('+30 coins');
    expect(claimStreakReward).toHaveBeenCalledTimes(1);
    // The dialog also has its own corner X, named Close: the first is the button under the text.
    await userEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('says it all in Vietnamese when the interface is in Vietnamese', async () => {
    await act(() => i18n.changeLanguage('vi'));
    getStreak.mockResolvedValueOnce(streakOf(1, false)).mockResolvedValue(streakOf(1, true));
    claimStreakReward.mockResolvedValue({ coins: 30, totalCoins: 130 });
    renderWithProviders(<StreakRewardDialog />);

    expect(await screen.findByRole('dialog', { name: 'Nhận thưởng' })).toHaveTextContent('streak 3 ngày');
    await userEvent.click(screen.getByRole('button', { name: 'Nhận 30 xu' }));

    expect(await screen.findByRole('dialog', { name: 'Đã nhận thưởng' })).toHaveTextContent('+30 xu');
    expect(claimStreakReward).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('stays closed before a counted session today and once the reward is claimed', async () => {
    getStreak.mockResolvedValue(streakOf(0, false));
    const { unmount } = renderWithProviders(<StreakRewardDialog />);
    await waitFor(() => expect(getStreak).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();

    getStreak.mockResolvedValue(streakOf(2, true));
    renderWithProviders(<StreakRewardDialog />);
    await waitFor(() => expect(getStreak).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
