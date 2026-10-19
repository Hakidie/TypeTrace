import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminUsersPage } from './AdminUsersPage';

const listUsers = vi.fn();
const updateUser = vi.fn();
const deleteUser = vi.fn();
const setUserStatus = vi.fn();

vi.mock('../api/admin.api', () => ({
  adminApi: {
    listUsers: (params: unknown) => listUsers(params),
    updateUser: (id: string, input: unknown) => updateUser(id, input),
    deleteUser: (id: string) => deleteUser(id),
    setUserStatus: (id: string, status: string) => setUserStatus(id, status),
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

const page = (items: unknown[]) => ({ items, page: 1, limit: 10, total: items.length, totalPages: 1 });

const renderPage = (route = '/admin/users') => renderWithProviders(<AdminUsersPage />, { route, path: '/admin/users' });

beforeEach(() => {
  tokenStore.set('jwt-value');
  listUsers.mockReset().mockResolvedValue(page([admin, lan, minh]));
  updateUser.mockReset();
  deleteUser.mockReset();
  setUserStatus.mockReset();
});

// Opens the kebab menu of a user card and picks one of its entries.
const pickAction = async (email: string, action: 'Edit' | 'Disable' | 'Enable' | 'Delete') => {
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
    expect(listUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10, sort: '-createdAt' }));
  });

  it('shows each user as a card with the typing stats from the backend', async () => {
    listUsers.mockResolvedValue(page([user('u1', 'lan@example.com', { stats: { wpm: 64, accuracy: 96.4 }, logins: [] }), minh]));
    renderPage();

    const cards = await screen.findByLabelText('User cards');
    expect(within(cards).getByText('64')).toBeInTheDocument();
    expect(within(cards).getByText('96.4%')).toBeInTheDocument();
    expect(within(cards).getAllByText('—')).toHaveLength(2);
  });

  it('edits a user from the kebab menu of the card', async () => {
    renderPage();

    const cards = await screen.findByLabelText('User cards');
    fireEvent.click(within(cards).getByRole('button', { name: 'Actions for minh@example.com' }));
    fireEvent.click(within(cards).getByRole('menuitem', { name: 'Edit' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
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

  it('pages through the users, 10 per page, from the Users panel', async () => {
    listUsers.mockResolvedValue({ items: [admin, lan, minh], page: 1, limit: 10, total: 25, totalPages: 3 });
    renderPage();
    await screen.findAllByText('lan@example.com');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 10 })));
  });

  it('sorts from the toolbar of the Users panel', async () => {
    renderPage();
    await screen.findAllByText('lan@example.com');

    fireEvent.click(screen.getByRole('button', { name: 'Sort' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Email A–Z' }));

    await waitFor(() => expect(listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'email' })));
  });

  it('edits a user', async () => {
    updateUser.mockResolvedValue({ ...minh, role: 'admin', isEmailVerified: true });
    renderPage();

    await pickAction('minh@example.com', 'Edit');
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Role'), { target: { value: 'admin' } });
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Email verified' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith('u2', {
        displayName: 'minh',
        role: 'admin',
        isEmailVerified: true,
        loginOtpEnabled: false,
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('saves the admin\'s own account without changing their role', async () => {
    updateUser.mockResolvedValue({ ...admin, displayName: 'Boss' });
    renderPage();

    await pickAction('admin@example.com', 'Edit');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Role')).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Display name'), { target: { value: 'Boss' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateUser).toHaveBeenCalled());
    expect(updateUser.mock.calls[0][1]).not.toHaveProperty('role', 'user');
    expect(updateUser.mock.calls[0][1]).toMatchObject({ displayName: 'Boss' });
  });

  it('shows an empty state for a search without results', async () => {
    listUsers.mockResolvedValue(page([]));
    renderPage('/admin/users?q=nobody');
    expect(await screen.findByText('No matching users')).toBeInTheDocument();
  });
});
