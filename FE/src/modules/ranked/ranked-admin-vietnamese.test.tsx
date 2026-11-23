import { act } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { AdminSettingsPage } from '@/modules/settings/pages/AdminSettingsPage';
import { i18n } from '@/shared/i18n/i18n';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminSeasonsPage } from './pages/AdminSeasonsPage';

// The AI lessons panel of the same page (SCRUM-153): answered, so it does not show an error of its own.
vi.mock('@/modules/settings/api/ai-settings.api', () => ({
  aiSettingsApi: { get: async () => ({ lessonsPerDay: 20, lessonsPerMinute: 5 }), update: async (settings: unknown) => settings },
}));

const updatePlacementSettings = vi.fn();
vi.mock('./api/ranked.api', () => ({
  rankedApi: {
    seasons: () =>
      Promise.resolve({
        items: [
          { _id: 's2', number: 2, status: 'active', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-10-27T00:00:00.000Z', participants: { race: 12, rain: 1 } },
          { _id: 's1', number: 1, status: 'closed', startsAt: '2026-07-01T00:00:00.000Z', endsAt: '2026-08-26T00:00:00.000Z', participants: { race: 3, rain: 0 } },
        ],
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      }),
    closeSeason: vi.fn(),
    placementSettings: async () => ({ minAccuracy: 90 }),
    updatePlacementSettings: (settings: unknown) => updatePlacementSettings(settings),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(async () => {
  tokenStore.set('test-token');
  updatePlacementSettings.mockReset().mockImplementation(async (settings: unknown) => settings);
  vi.mocked(toast.success).mockClear();
  await act(() => i18n.changeLanguage('vi'));
});

describe('the admin Seasons and Settings pages in Vietnamese (SCRUM-336)', () => {
  it('says the seasons in Vietnamese: the status, the players, the mode and the close question', async () => {
    renderWithProviders(<AdminSeasonsPage />, { route: '/admin/seasons', path: '/admin/seasons' });

    const rows = await screen.findAllByRole('article');
    expect(within(rows[0]).getByText('ĐANG DIỄN RA')).toBeInTheDocument();
    expect(within(rows[1]).getByText('ĐÃ ĐÓNG')).toBeInTheDocument();
    expect(within(rows[0]).getByText('12 người chơi')).toBeInTheDocument();
    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Chế độ: Đua gõ' }));
    expect(within(rows[0]).getByRole('button', { name: 'Chế độ: Mưa chữ' })).toBeInTheDocument();

    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Đóng mùa giải' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Đóng mùa giải 2?')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Đóng mùa giải' })).toBeInTheDocument();
  });

  it('says the admin Settings page in Vietnamese, with the check and the toast of the minimum accuracy', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminSettingsPage />, { route: '/admin/settings', path: '/admin/settings' });

    expect(screen.getByRole('heading', { name: 'Giao diện' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Thanh bên thu gọn' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bảng xếp hạng Kiểm tra' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bài học AI' })).toBeInTheDocument();
    const field = await screen.findByLabelText('Độ chính xác tối thiểu (%)');
    // The page has other Save buttons (the AI lessons panel): this one belongs to the form of the field.
    const save = within(field.closest('form')!).getByRole('button', { name: 'Lưu' });

    await user.clear(field);
    await user.type(field, '20');
    await user.click(save);
    expect(await screen.findByRole('alert')).toHaveTextContent('Ít nhất 50');

    await user.clear(field);
    await user.type(field, '85');
    await user.click(save);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã lưu cài đặt bài kiểm tra.'));
  });
});
