import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminUsersPage } from './AdminUsersPage';

const listUsers = vi.fn();
const updateUser = vi.fn();
const deleteUser = vi.fn();
const setUserStatus = vi.fn();
const grantPremium = vi.fn();
const revokePremium = vi.fn();

vi.mock('../api/admin.api', () => ({
  adminApi: {
    listUsers: (params: unknown) => listUsers(params),
    updateUser: (id: string, input: unknown) => updateUser(id, input),
    deleteUser: (id: string) => deleteUser(id),
    setUserStatus: (id: string, status: string) => setUserStatus(id, status),
    grantPremium: (id: string, months: number) => grantPremium(id, months),
    revokePremium: (id: string) => revokePremium(id),
  },
}));

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => Promise.resolve(admin) },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const user = (id: string, email: string, extra = {}) => ({
  _id: id,
  email,
  displayName: email.split('@')[0],
  role: 'user',
  isEmailVerified: true,
  loginOtpEnabled: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...extra,
});

const admin = user('a1', 'admin@example.com', { role: 'admin' });
const lan = user('u1', 'lan@example.com');
const minh = user('u2', 'minh@example.com', { isEmailVerified: false });

const page = (items: unknown[]) => ({ items, page: 1, limit: 4, total: items.length, totalPages: 1 });

const renderPage = (route = '/admin/users') => renderWithProviders(<AdminUsersPage />, { route, path: '/admin/users' });

beforeEach(() => {
  tokenStore.set('jwt-value');
  listUsers.mockReset().mockResolvedValue(page([admin, lan, minh]));
  updateUser.mockReset();
  deleteUser.mockReset();
  setUserStatus.mockReset();
  grantPremium.mockReset();
  revokePremium.mockReset();
});

// Opens the kebab menu of a user card and picks one of its entries.
const pickAction = async (email: string, action: 'Edit' | 'Disable' | 'Enable' | 'Delete' | 'Cấp Premium' | 'Thu hồi Premium') => {
  const cards = await screen.findByLabelText('User cards');
  fireEvent.click(within(cards).getByRole('button', { name: `Actions for ${email}` }));
  fireEvent.click(within(cards).getByRole('menuitem', { name: action }));
};

describe('AdminUsersPage', () => {
  it('lists users with role and verification badges', async () => {
    renderPage();
    expect(await screen.findAllByText('lan@example.com')).toHaveLength(1);
    const cards = screen.getByLabelText('User cards');
    expect(within(cards).getByText('Unverified')).toBeInTheDocument();
    expect(within(cards).getAllByText('Verified')).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('3 accounts in total')).toBeInTheDocument();
    expect(listUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 4, sort: '-createdAt' }));
  });

  it('shows each user as a card with the typing stats from the backend', async () => {
    listUsers.mockResolvedValue(page([user('u1', 'lan@example.com', { stats: { wpm: 64, accuracy: 96.4 }, sessions: [] }), minh]));
    renderPage();

    const cards = await screen.findByLabelText('User cards');
    expect(within(cards).getByText('64')).toBeInTheDocument();
    expect(within(cards).getByText('96.4%')).toBeInTheDocument();
    expect(within(cards).getByText('000D')).toBeInTheDocument();
    expect(within(cards).getByText('0000')).toBeInTheDocument();
    expect(within(cards).getByText('000%')).toBeInTheDocument();
    expect(within(cards).getAllByText('—')).toHaveLength(1);
  });

  it('edits a user from the kebab menu of the card', async () => {
    renderPage();

    const cards = await screen.findByLabelText('User cards');
    fireEvent.click(within(cards).getByRole('button', { name: 'Actions for minh@example.com' }));
    fireEvent.click(within(cards).getByRole('menuitem', { name: 'Edit' }));

    expect(await screen.findByDisplayValue('minh')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the user form empty and disabled until a user is picked', async () => {
    renderPage();
    await screen.findByLabelText('User cards');

    expect(screen.getByLabelText('Display name')).toBeDisabled();
    expect(screen.getByLabelText('Description')).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Admin role' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Update user' })).toBeDisabled();
  });

  it('starts with the filters Role user and Email verified, and All removes them', async () => {
    renderPage();
    await screen.findAllByText('lan@example.com');
    expect(listUsers).toHaveBeenCalledWith(expect.objectContaining({ role: 'user', verified: 'true' }));

    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Role' })).getByRole('menuitemradio', { name: 'All' }));
    await waitFor(() => expect(listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ role: '', verified: 'true' })));
  });

  it('shows the part of the email before the @ when a user has no display name', async () => {
    listUsers.mockResolvedValue(page([user('u9', 'sam@example.com', { displayName: undefined })]));
    renderPage();

    const cards = await screen.findByLabelText('User cards');
    expect(within(cards).getByText('sam')).toBeInTheDocument();
  });

  it('deletes a user from the kebab menu after confirmation, but not the signed-in admin', async () => {
    deleteUser.mockResolvedValue(undefined);
    renderPage();

    const cards = await screen.findByLabelText('User cards');
    fireEvent.click(within(cards).getByRole('button', { name: 'Actions for admin@example.com' }));
    expect(within(cards).queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();

    fireEvent.click(within(cards).getByRole('button', { name: 'Actions for minh@example.com' }));
    fireEvent.click(within(cards).getByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(deleteUser).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Delete this user?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith('u2'));
  });

  it('shows an Active or Locked tag on each card', async () => {
    listUsers.mockResolvedValue(page([lan, user('u3', 'tran@example.com', { status: 'locked' })]));
    renderPage();

    const cards = await screen.findByLabelText('User cards');
    expect(within(cards).getAllByText('Active')).toHaveLength(1);
    expect(within(cards).getAllByText('Locked')).toHaveLength(1);
  });

  it('disables a user from the kebab menu and enables a locked one again', async () => {
    setUserStatus.mockResolvedValue(minh);
    listUsers.mockResolvedValue(page([admin, minh, user('u3', 'tran@example.com', { status: 'locked' })]));
    renderPage();

    await pickAction('minh@example.com', 'Disable');
    await waitFor(() => expect(setUserStatus).toHaveBeenCalledWith('u2', 'locked'));

    await pickAction('tran@example.com', 'Enable');
    await waitFor(() => expect(setUserStatus).toHaveBeenCalledWith('u3', 'active'));
  });

  it('offers no Disable for an admin', async () => {
    listUsers.mockResolvedValue(page([admin, user('a2', 'boss@example.com', { role: 'admin' })]));
    renderPage();

    const cards = await screen.findByLabelText('User cards');
    for (const email of ['admin@example.com', 'boss@example.com']) {
      fireEvent.click(within(cards).getByRole('button', { name: `Actions for ${email}` }));
      expect(within(cards).queryByRole('menuitem', { name: 'Disable' })).not.toBeInTheDocument();
    }
  });

  it('applies filters and sorting from the URL and sends them to the API', async () => {
    renderPage('/admin/users?role=admin&verified=false&sort=email&q=lan');
    await screen.findAllByText('lan@example.com');
    expect(listUsers).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin', verified: 'false', sort: 'email', q: 'lan' }),
    );
  });

  it('changes a filter from the toolbar', async () => {
    renderPage();
    await screen.findAllByText('lan@example.com');

    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Role' })).getByRole('menuitemradio', { name: 'Admin' }));
    await waitFor(() => expect(listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'admin' })));
  });

  it('pages through the users, 4 per page, from the Users panel', async () => {
    listUsers.mockResolvedValue({ items: [admin, lan, minh], page: 1, limit: 4, total: 25, totalPages: 7 });
    renderPage();
    await screen.findAllByText('lan@example.com');
    expect(screen.getByText('Page 1 of 7')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 4 })));
  });

  it('sorts from the toolbar of the Users panel', async () => {
    renderPage();
    await screen.findAllByText('lan@example.com');

    fireEvent.click(screen.getByRole('button', { name: 'Sort' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Email A–Z' }));

    await waitFor(() => expect(listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'email' })));
  });

  it('edits a user in the form above the list', async () => {
    updateUser.mockResolvedValue({ ...minh, role: 'admin', isEmailVerified: true });
    renderPage();

    await pickAction('minh@example.com', 'Edit');
    fireEvent.click(await screen.findByRole('switch', { name: 'Admin role' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Email verified' }));
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Types at night.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update user' }));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith('u2', {
        displayName: 'minh',
        bio: 'Types at night.',
        role: 'admin',
        isEmailVerified: true,
        loginOtpEnabled: false,
      }),
    );
    // The form goes back to empty once the user is saved.
    await waitFor(() => expect(screen.getByLabelText('Display name')).toBeDisabled());
    expect(setUserStatus).not.toHaveBeenCalled();
  });

  it('locks the account from the form together with the other changes', async () => {
    updateUser.mockResolvedValue(minh);
    setUserStatus.mockResolvedValue(minh);
    renderPage();

    await pickAction('minh@example.com', 'Edit');
    fireEvent.click(await screen.findByRole('switch', { name: 'Account active' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update user' }));

    await waitFor(() => expect(setUserStatus).toHaveBeenCalledWith('u2', 'locked'));
  });

  it('cancels the edit and empties the form', async () => {
    renderPage();

    await pickAction('minh@example.com', 'Edit');
    expect(await screen.findByDisplayValue('minh')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.getByLabelText('Display name')).toBeDisabled());
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('saves the admin\'s own account without changing their role', async () => {
    updateUser.mockResolvedValue({ ...admin, displayName: 'Boss' });
    renderPage();

    await pickAction('admin@example.com', 'Edit');
    expect(await screen.findByRole('switch', { name: 'Admin role' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Account active' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Boss' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update user' }));

    await waitFor(() => expect(updateUser).toHaveBeenCalled());
    expect(updateUser.mock.calls[0][1]).not.toHaveProperty('role', 'user');
    expect(updateUser.mock.calls[0][1]).toMatchObject({ displayName: 'Boss' });
  });

  it('shows an empty state for a search without results', async () => {
    listUsers.mockResolvedValue(page([]));
    renderPage('/admin/users?q=nobody');
    expect(await screen.findByText('No matching users')).toBeInTheDocument();
  });

  it('shows the plan and its expiry on each user and filters by plan', async () => {
    const premium = user('u3', 'premium@example.com', { plan: 'premium', planExpiresAt: '2026-02-15T00:00:00.000Z' });
    listUsers.mockResolvedValue(page([{ ...lan, plan: 'free', planExpiresAt: null }, premium]));
    renderPage();

    const cards = await screen.findByLabelText('User cards');
    expect(within(cards).getByText('Premium · 15 Feb 2026')).toBeInTheDocument();
    expect(within(cards).getByText('Free')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Plan' })).getByRole('menuitemradio', { name: 'Premium' }));
    await waitFor(() => expect(listUsers).toHaveBeenCalledWith(expect.objectContaining({ plan: 'premium' })));
  });

  it('grants premium for the months typed after confirmation', async () => {
    grantPremium.mockResolvedValue({ plan: 'premium', expiresAt: '2026-03-15T00:00:00.000Z' });
    renderPage();
    await pickAction('lan@example.com', 'Cấp Premium');

    const dialog = await screen.findByRole('dialog');
    const months = within(dialog).getByLabelText('Số tháng');
    fireEvent.change(months, { target: { value: '0' } });
    expect(within(dialog).getByRole('button', { name: 'Cấp' })).toBeDisabled();
    fireEvent.change(months, { target: { value: '3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cấp' }));

    await waitFor(() => expect(grantPremium).toHaveBeenCalledWith('u1', 3));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('revokes premium after confirmation and offers it only to Premium users', async () => {
    listUsers.mockResolvedValue(page([{ ...lan, plan: 'premium', planExpiresAt: '2026-02-15T00:00:00.000Z' }, { ...minh, plan: 'free', planExpiresAt: null }]));
    revokePremium.mockResolvedValue(undefined);
    renderPage();

    const cards = await screen.findByLabelText('User cards');
    fireEvent.click(within(cards).getByRole('button', { name: 'Actions for minh@example.com' }));
    expect(within(cards).queryByRole('menuitem', { name: 'Thu hồi Premium' })).not.toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    await pickAction('lan@example.com', 'Thu hồi Premium');
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Thu hồi' }));

    await waitFor(() => expect(revokePremium).toHaveBeenCalledWith('u1'));
  });
});
