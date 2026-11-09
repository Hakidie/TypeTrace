import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminPlansPage } from './AdminPlansPage';

const get = vi.fn();
const preview = vi.fn();
const save = vi.fn();
const listSubscriptions = vi.fn();

vi.mock('../api/admin-plan.api', () => ({
  adminPlanApi: {
    get: () => get(),
    preview: (plans: unknown) => preview(plans),
    save: (plans: unknown) => save(plans),
    listSubscriptions: (params: unknown) => listSubscriptions(params),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const plans = {
  free: { priceVnd: 0, maxPassages: 9, canCreateErrorPractice: false, canUsePublicPassages: false },
  premium: { priceVnd: 99000, maxPassages: 90, canCreateErrorPractice: true, canUsePublicPassages: true },
};

const card = (name: 'Free' | 'Premium') => screen.getByRole('group', { name: `${name} plan` });
const setNumber = async (user: ReturnType<typeof userEvent.setup>, label: string, value: string) => {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, value);
};

const row = (over: object = {}) => ({
  _id: 'r1',
  userName: 'An',
  email: 'an@example.com',
  avatarUrl: null,
  avatar: DEFAULT_AVATAR,
  plan: 'premium',
  source: 'admin',
  startsAt: '2026-01-15T00:00:00.000Z',
  endsAt: '2026-03-15T00:00:00.000Z',
  status: 'active',
  changedByName: 'Boss',
  createdAt: '2026-01-15T00:00:00.000Z',
  ...over,
});
const subscriptionPage = (items: object[], over: object = {}) => ({ items, page: 1, limit: 3, total: items.length, totalPages: items.length ? 1 : 0, ...over });

beforeEach(() => {
  listSubscriptions.mockReset().mockResolvedValue(subscriptionPage([row()]));
  get.mockReset().mockResolvedValue(plans);
  preview.mockReset().mockResolvedValue({ lockedUsers: 0, lockedPassages: 0 });
  save.mockReset().mockImplementation(async (value: unknown) => value);
  vi.mocked(toast.success).mockClear();
});

describe('AdminPlansPage', () => {
  it('shows both plans and saves valid values', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });

    expect(await within(await screen.findByRole('group', { name: 'Free plan' })).findByLabelText('Passage limit (Free)')).toHaveValue(9);
    expect(within(card('Premium')).getByLabelText('Monthly price (Premium)')).toHaveValue(99000);
    expect(within(card('Premium')).getByRole('switch', { name: 'Generate practice passage (Premium)' })).toBeChecked();
    expect(within(card('Free')).getByRole('switch', { name: 'Generate practice passage (Free)' })).not.toBeChecked();

    await setNumber(user, 'Passage limit (Premium)', '100');
    await user.click(screen.getByRole('switch', { name: 'Allow premium passage (Free)' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

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
    await screen.findByRole('group', { name: 'Free plan' });

    await setNumber(user, 'Passage limit (Free)', '2');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/3 users will have passages locked/)).toBeInTheDocument();
    expect(within(dialog).getByText(/7 passage/)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(save).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  });

  it('does not warn when nobody would be locked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });
    await screen.findByRole('group', { name: 'Free plan' });

    await setNumber(user, 'Passage limit (Free)', '12');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rejects a negative quota in the form without asking the server', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });
    await screen.findByRole('group', { name: 'Free plan' });

    await setNumber(user, 'Passage limit (Free)', '-1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('At least 0')).toBeInTheDocument();
    expect(preview).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('shows the backend error with a retry button', async () => {
    get.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Database offline' } } });
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });

    expect(await screen.findByText('Database offline')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('group', { name: 'Free plan' })).toBeInTheDocument();
  });

  it('has two panels: the plan cards without a title, then the subscription list under its title', async () => {
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });

    await screen.findByRole('group', { name: 'Free plan' });
    // Only the list has a title.
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Subscriptions']);
    const cards = within(await screen.findByRole('region', { name: 'Subscriptions' }));
    expect(await cards.findByText('An')).toBeInTheDocument();
  });

  it('shows who changed whose plan, to what, from where and when it ends', async () => {
    listSubscriptions.mockResolvedValue(
      subscriptionPage([row(), row({ _id: 'r2', userName: 'Binh', plan: 'free', source: 'signup', endsAt: null, changedByName: null, email: 'binh@example.com' })]),
    );
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });

    expect(await screen.findByText('Binh')).toBeInTheDocument();
    expect(screen.getByText(/by Boss/)).toBeInTheDocument();
    // The email is under the name and the period in the middle; there is no chart of the term.
    expect(screen.getByText('an@example.com')).toBeInTheDocument();
    expect(screen.queryByText('59-day term')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'No term' })).not.toBeInTheDocument();
    expect(screen.queryByText('BY')).not.toBeInTheDocument();
    // Neither row was paid for: their source reads None.
    expect(screen.getAllByText('None')).toHaveLength(2);
    // The period in the middle reads start – end, and Now while a Free row has no end; the status says where the term is.
    expect(screen.getByText('15/03/26')).toBeInTheDocument();
    expect(screen.getAllByText('15/01/26')).toHaveLength(2);
    expect(screen.getByText('Now')).toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.queryByText('EXPIRES')).not.toBeInTheDocument();
  });

  it('shows the avatar of each user: the picture, else the pixel avatar', async () => {
    listSubscriptions.mockResolvedValue(subscriptionPage([row(), row({ _id: 'r2', userName: 'Binh', avatarUrl: 'https://img.example.com/binh.png' })]));
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });

    expect(await screen.findByRole('img', { name: 'Avatar of An' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Avatar of Binh' })).not.toBeInTheDocument();
    expect(document.querySelector('img[src="https://img.example.com/binh.png"]')).not.toBeNull();
  });

  it('names the four statuses', async () => {
    listSubscriptions.mockResolvedValue(
      subscriptionPage(['upcoming', 'cancelled', 'ended'].map((status, index) => row({ _id: `s${index}`, userName: `User ${status}`, status }))),
    );
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });

    expect(await screen.findByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });

  it('filters by status', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });
    await screen.findByText('An');

    await user.click(screen.getByRole('button', { name: /filter/i }));
    await user.click(within(await screen.findByRole('group', { name: 'Status' })).getByRole('menuitemradio', { name: 'Cancelled' }));
    await waitFor(() => expect(listSubscriptions).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'cancelled' })));
  });

  it('shows None for a source the list does not know', async () => {
    listSubscriptions.mockResolvedValue(subscriptionPage([row({ source: undefined })]));
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });

    expect(await screen.findByText('None')).toBeInTheDocument();
  });

  it('shows None as the source of a row made by the migration script', async () => {
    listSubscriptions.mockResolvedValue(subscriptionPage([row({ plan: 'free', source: 'migration', endsAt: '2026-03-15T00:00:00.000Z', changedByName: null })]));
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });

    expect(await screen.findByText('None')).toBeInTheDocument();
    expect(screen.queryByText('Migration')).not.toBeInTheDocument();
  });

  it('asks the server for the first page, and for a plan when the filter changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });
    await screen.findByText('An');
    expect(listSubscriptions).toHaveBeenCalledWith({ page: 1, limit: 3, sort: '-createdAt' });

    await user.click(screen.getByRole('button', { name: /filter/i }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Premium' }));
    await waitFor(() => expect(listSubscriptions).toHaveBeenLastCalledWith(expect.objectContaining({ plan: 'premium' })));
  });

  it('filters by source (None) and by who changed the plan (Admin, System)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });
    await screen.findByText('An');

    await user.click(screen.getByRole('button', { name: /filter/i }));
    await user.click(within(await screen.findByRole('group', { name: 'Source' })).getByRole('menuitemradio', { name: 'None' }));
    await waitFor(() => expect(listSubscriptions).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'none' })));

    await user.click(screen.getByRole('button', { name: /filter/i }));
    await user.click(within(await screen.findByRole('group', { name: 'By' })).getByRole('menuitemradio', { name: 'System' }));
    await waitFor(() => expect(listSubscriptions).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'none', by: 'system' })));
  });

  it('shows an empty state and a backend error with a retry button', async () => {
    listSubscriptions.mockResolvedValueOnce(subscriptionPage([]));
    const { unmount } = renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });
    expect(await screen.findByText('No plan changes yet')).toBeInTheDocument();
    unmount();

    listSubscriptions.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Subscriptions offline' } } });
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });
    expect(await screen.findByText('Subscriptions offline')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('An')).toBeInTheDocument();
  });
});
