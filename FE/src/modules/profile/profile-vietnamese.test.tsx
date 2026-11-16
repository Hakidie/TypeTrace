import { act } from 'react';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/shared/i18n/i18n';
import { dayInWords } from '@/shared/lib/local-date';
import { renderWithProviders } from '@/test/render-with-providers';
import { ProfileDailyTasks } from './components/ProfileDailyTasks';
import { anchorFor, compareLabel, periodLabel, periodOptions } from './lib/chart-period';
import { chanceWords, missingWords } from './lib/chance-words';
import { axisLabel, tooltipTitle } from './lib/month-label';
import type { DailyTaskProgress } from './types/profile.types';

const getDailyTasks = vi.fn();
vi.mock('@/modules/profile/api/profile.api', () => ({ profileApi: { getDailyTasks: () => getDailyTasks() } }));

const task = (extra: Partial<DailyTaskProgress>): DailyTaskProgress => ({
  id: 'a', title: 'Warm-up', description: '', type: 'sessions', target: 3, coins: 20, rewarded: false, progress: 3, completed: true, ...extra,
});

describe('the Profile and Progress modules in Vietnamese (SCRUM-331)', () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage('vi'));
  });

  it('names the periods, the axis and the tooltips of the charts in Vietnamese', () => {
    expect(periodLabel('month', '2026-03-09')).toBe('Tháng 3');
    expect(periodLabel('week', '2026-03-09')).toBe('Tuần 2');
    expect(compareLabel('week', '2026-03-09')).toBe('Tuần 2 Tháng 3 2026');
    expect(periodOptions('week', '2026-03-09', '2026-03-31')[0].label).toBe('Tuần 1');
    expect(anchorFor('month', '2026-02', '2026-03-09', '2026-03-31')).toBe('2026-02-01');
    expect(axisLabel('year', '2026-03-01')).toBe('T3');
    expect(axisLabel('week', '2026-03-09')).toBe('T2');
    expect(tooltipTitle('month', '2026-03-09')).toBe('T2 THG 3 2026');
    expect(dayInWords('2026-10-27')).toBe('T3, 27 Thg 10 2026');
  });

  it('says what a type still needs in Vietnamese', () => {
    expect(chanceWords('D_MISSING')).toBe('từ có đ');
    expect(missingWords('D_MISSING', 12)).toBe('thêm 12 từ có đ');
  });

  it('shows the daily tasks in Vietnamese', async () => {
    getDailyTasks.mockResolvedValue({ date: '2026-03-10', tasks: [task({})] });
    renderWithProviders(<ProfileDailyTasks />);

    expect(await screen.findByText('3 / 3 lượt gõ')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Nhiệm vụ hằng ngày' })).toBeInTheDocument();
    expect(screen.getByText('Xong')).toBeInTheDocument();
    expect(screen.getByText('Đã xong nhiệm vụ hôm nay')).toBeInTheDocument();
    expect(screen.getByText('20 xu')).toBeInTheDocument();
  });

  it('shows a short title and the full goal in Vietnamese instead of the English words the admin wrote', async () => {
    getDailyTasks.mockResolvedValue({
      date: '2026-03-10',
      tasks: [
        task({ id: 'a', title: 'Warm-up', description: 'Finish three sessions.' }),
        task({ id: 'b', title: 'Games', type: 'minigames', target: 2, progress: 0, completed: false }),
        task({ id: 'c', title: 'One game', type: 'minigames', target: 1, progress: 0, completed: false }),
      ],
    });
    renderWithProviders(<ProfileDailyTasks />);

    expect(await screen.findByText('Luyện gõ 3')).toBeInTheDocument();
    expect(screen.getByText('Hoàn thành 3 lượt gõ tính điểm trong ngày')).toBeInTheDocument();
    expect(screen.getByText('Minigame 2')).toBeInTheDocument();
    expect(screen.getByText('Hoàn thành 2 minigame trong ngày')).toBeInTheDocument();
    expect(screen.getByText('Minigame 1')).toBeInTheDocument();
    expect(screen.getByText('Hoàn thành 1 minigame trong ngày')).toBeInTheDocument();
    expect(screen.queryByText('Warm-up')).not.toBeInTheDocument();
    expect(screen.queryByText('Finish three sessions.')).not.toBeInTheDocument();
  });
});
