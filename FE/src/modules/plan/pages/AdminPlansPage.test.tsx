import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminPlansPage } from './AdminPlansPage';

const get = vi.fn();
const preview = vi.fn();
const save = vi.fn();

vi.mock('../api/admin-plan.api', () => ({
  adminPlanApi: {
    get: () => get(),
    preview: (plans: unknown) => preview(plans),
    save: (plans: unknown) => save(plans),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const plans = {
  free: { priceVnd: 0, maxPassages: 9, canCreateErrorPractice: false, canUsePublicPassages: false },
  premium: { priceVnd: 99000, maxPassages: 90, canCreateErrorPractice: true, canUsePublicPassages: true },
};

const card = (name: 'Free' | 'Premium') => screen.getByRole('group', { name: `Gói ${name}` });
const setNumber = async (user: ReturnType<typeof userEvent.setup>, label: string, value: string) => {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, value);
};

beforeEach(() => {
  get.mockReset().mockResolvedValue(plans);
  preview.mockReset().mockResolvedValue({ lockedUsers: 0, lockedPassages: 0 });
  save.mockReset().mockImplementation(async (value: unknown) => value);
  vi.mocked(toast.success).mockClear();
});

describe('AdminPlansPage', () => {
  it('shows both plans and saves valid values', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });

    expect(await within(await screen.findByRole('group', { name: 'Gói Free' })).findByLabelText('Hạn mức passage (Free)')).toHaveValue(9);
    expect(within(card('Premium')).getByLabelText('Giá theo tháng (Premium)')).toHaveValue(99000);
    expect(within(card('Premium')).getByRole('switch', { name: 'Tạo bài luyện theo lỗi (Premium)' })).toBeChecked();
    expect(within(card('Free')).getByRole('switch', { name: 'Tạo bài luyện theo lỗi (Free)' })).not.toBeChecked();

    await setNumber(user, 'Hạn mức passage (Premium)', '100');
    await user.click(screen.getByRole('switch', { name: 'Luyện passage công khai của người khác (Free)' }));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    const expected = {
      free: { ...plans.free, canUsePublicPassages: true },
      premium: { ...plans.premium, maxPassages: 100 },
    };
    await waitFor(() => expect(save).toHaveBeenCalledWith(expected));
    expect(preview).toHaveBeenCalledWith(expected);
    expect(toast.success).toHaveBeenCalled();
  });

  it('warns how many users will be locked before saving, and saves only after confirming', async () => {
    const user = userEvent.setup();
    preview.mockResolvedValue({ lockedUsers: 3, lockedPassages: 7 });
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });
    await screen.findByRole('group', { name: 'Gói Free' });

    await setNumber(user, 'Hạn mức passage (Free)', '2');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/3 user sẽ bị khóa passage/)).toBeInTheDocument();
    expect(within(dialog).getByText(/7 passage/)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(save).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  });

  it('does not warn when nobody would be locked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });
    await screen.findByRole('group', { name: 'Gói Free' });

    await setNumber(user, 'Hạn mức passage (Free)', '12');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rejects a negative quota in the form without asking the server', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });
    await screen.findByRole('group', { name: 'Gói Free' });

    await setNumber(user, 'Hạn mức passage (Free)', '-1');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('At least 0')).toBeInTheDocument();
    expect(preview).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('shows the backend error with a retry button', async () => {
    get.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Database offline' } } });
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });

    expect(await screen.findByText('Database offline')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('group', { name: 'Gói Free' })).toBeInTheDocument();
  });
});
