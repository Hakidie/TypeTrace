import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminUsersPage } from './AdminUsersPage';

const listUsers = vi.fn();
const updateUser = vi.fn();
const deleteUser = vi.fn();
const bulkDeleteUsers = vi.fn();

vi.mock('../api/admin.api', () => ({
  adminApi: {
    listUsers: (params: unknown) => listUsers(params),
    updateUser: (id: string, input: unknown) => updateUser(id, input),
    deleteUser: (id: string) => deleteUser(id),
    bulkDeleteUsers: (ids: string[]) => bulkDeleteUsers(ids),
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
  bulkDeleteUsers.mockReset();
});

describe('AdminUsersPage', () => {
  it('lists users with role and verification badges', async () => {
    renderPage();
    expect(await screen.findAllByText('lan@example.com')).toHaveLength(2);
    const table = screen.getByRole('table', { name: 'Users' });
    expect(within(table).getByText('Unverified')).toBeInTheDocument();
    expect(within(table).getAllByText('Verified')).toHaveLength(2);
    expect(screen.getByText('3 users')).toBeInTheDocument();
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

  it('applies filters and sorting from the URL and sends them to the API', async () => {
    renderPage('/admin/users?role=admin&verified=false&sort=email&q=lan');
    await screen.findAllByText('lan@example.com');
    expect(listUsers).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin', verified: 'false', sort: 'email', q: 'lan' }),
    );
  });

  it('changes a filter and sorts by a column', async () => {
    renderPage();
    await screen.findAllByText('lan@example.com');

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'admin' } });
    await waitFor(() => expect(listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'admin' })));

    fireEvent.click(screen.getByRole('button', { name: /Joined/ }));
    await waitFor(() => expect(listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'createdAt' })));
  });

  it('does not let the admin select or delete their own account', async () => {
    renderPage();
    await screen.findAllByText('lan@example.com');
    expect(screen.getByLabelText('Select row a1')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete admin@example.com' })).toBeDisabled();
  });

  it('deletes one user after confirmation', async () => {
    deleteUser.mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete lan@example.com' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete this user?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith('u1'));
  });

  it('bulk deletes the selected users', async () => {
    bulkDeleteUsers.mockResolvedValue({ deleted: 2 });
    renderPage();
    await screen.findAllByText('lan@example.com');

    fireEvent.click(screen.getByLabelText('Select all rows'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected (2)' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(bulkDeleteUsers).toHaveBeenCalledWith(['u1', 'u2']));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Delete selected/ })).not.toBeInTheDocument());
  });

  it('edits a user', async () => {
    updateUser.mockResolvedValue({ ...minh, role: 'admin', isEmailVerified: true });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit minh@example.com' }));
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

    fireEvent.click(await screen.findByRole('button', { name: 'Edit admin@example.com' }));
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
