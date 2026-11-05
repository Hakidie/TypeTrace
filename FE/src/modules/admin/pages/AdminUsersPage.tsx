import { Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListToolbar } from '@/shared/components/list-toolbar';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { useListParams } from '@/shared/hooks/use-list-params';
import { UserForm } from '../components/UserForm';
import { UserRow } from '../components/UserRow';
import { useAdminUsers, useDeleteUsers, useSetUserStatus } from '../hooks/use-admin';
import type { AdminUser, AdminUserListParams } from '../types/admin.types';

// Four users a page.
const PAGE_SIZE = 4;

// In the URL, `all` means no filter at all (an empty value means the filter was not touched: its default applies).
const ALL = 'all';
const filterValue = (param: string, fallback: string) => (param === '' ? fallback : param === ALL ? '' : param);

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest' },
  { value: 'createdAt', label: 'Oldest' },
  { value: 'displayName', label: 'Name A–Z' },
  { value: '-displayName', label: 'Name Z–A' },
  { value: 'email', label: 'Email A–Z' },
  { value: '-email', label: 'Email Z–A' },
  { value: 'role', label: 'Role A–Z' },
];

const VERIFIED_OPTIONS = [
  { value: 'true', label: 'Verified' },
  { value: 'false', label: 'Unverified' },
];

/**
 * Reference admin page for one resource: a toolbar (search, sort, filters), a list of
 * cards with a kebab menu (edit, delete), pagination and a confirmation before deleting.
 * Copy it for other resources.
 */
export const AdminUsersPage = () => {
  const { data: currentUser } = useCurrentUser();
  const list = useListParams({ sort: '-createdAt' });
  // The filters start on Role "User" and Email "Verified". Choosing "All" puts `all` in the URL: an empty value would bring the default back.
  const role = filterValue(list.get('role'), 'user') as AdminUserListParams['role'];
  const verified = filterValue(list.get('verified'), 'true') as AdminUserListParams['verified'];
  const setFilter = (key: string) => (value: string) => list.set(key, value === '' ? ALL : value);

  const users = useAdminUsers({ page: list.page, limit: PAGE_SIZE, q: list.q, role, verified, sort: list.sort });
  const deleteUsers = useDeleteUsers();
  const setStatus = useSetUserStatus();

  const [editing, setEditing] = useState<AdminUser>();
  const formPanelRef = useRef<HTMLDivElement>(null);
  // The form is at the top of the page: bring it into view when a row asks to be edited.
  const editingId = editing?._id;
  useEffect(() => {
    if (editingId) formPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [editingId]);
  // Id of the user waiting for delete confirmation.
  const [pendingDelete, setPendingDelete] = useState<string>();

  const confirmDelete = () =>
    deleteUsers.mutate([pendingDelete!], { onSuccess: () => setPendingDelete(undefined) });

  const isFiltered = Boolean(list.q || role || verified);

  const renderList = () => {
    if (users.isPending) return <LoadingState rows={3} />;
    if (users.isError) return <ErrorState error={users.error} onRetry={() => void users.refetch()} />;
    if (users.data.items.length === 0) {
      return (
        <EmptyState
          icon={Users}
          title={isFiltered ? 'No matching users' : 'No users yet'}
          description={isFiltered ? 'Try another search or filter.' : undefined}
        />
      );
    }
    return (
      <>
        <div className="space-y-2" aria-label="User cards">
          {users.data.items.map((user) => (
            <UserRow
              key={user._id}
              user={user}
              stats={user.stats}
              sessions={user.sessions}
              status={user.status}
              onEdit={() => setEditing(user)}
              // Admins cannot be disabled (the backend refuses), but a locked one can always be enabled again.
              onToggleStatus={
                user.status !== 'locked' && (user.role === 'admin' || user._id === currentUser?._id)
                  ? undefined
                  : (target) => setStatus.mutate({ id: target._id, status: user.status === 'locked' ? 'active' : 'locked' })
              }
              // The backend refuses to delete your own account, so the entry is left out for it.
              onDelete={user._id === currentUser?._id ? undefined : (target) => setPendingDelete(target._id)}
            />
          ))}
        </div>
        <Pagination page={users.data.page} totalPages={users.data.totalPages} onPageChange={list.setPage} variant="toolbar" accent />
      </>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      {/* PANEL User info: always there, but only for editing (there is no "new user"): empty and disabled until Edit picks a user. No visible title, screen readers still get one. */}
      <div ref={formPanelRef} className="scroll-mt-4">
        <Panel bare>
          <h2 className="sr-only">User info</h2>
          <UserForm
            key={editing?._id ?? 'none'}
            user={editing}
            stats={editing?.stats}
            sessions={editing?.sessions}
            status={editing?.status}
            isSelf={editing?._id === currentUser?._id}
            onDone={() => setEditing(undefined)}
          />
        </Panel>
      </div>

      {/* PANEL Users */}
      <Panel bare>
        <h2 className="sr-only">Users</h2>
        <div className="flex flex-col gap-3">
          <ListToolbar
            title="Users"
            search={{
              label: 'Search users',
              placeholder: 'Search email or name…',
              defaultValue: list.q,
              onSearch: (value) => list.set('q', value),
            }}
            sort={{ value: list.sort, options: SORT_OPTIONS, onChange: (value) => list.set('sort', value) }}
            summary={users.data ? `${users.data.total} accounts in total` : 'Loading accounts…'}
            filters={[
              { label: 'Role', value: role ?? '', options: ROLE_OPTIONS, onChange: setFilter('role') },
              { label: 'Email', value: verified ?? '', options: VERIFIED_OPTIONS, onChange: setFilter('verified') },
            ]}
          />
          {renderList()}
        </div>
      </Panel>

      <ConfirmDialog
        open={pendingDelete !== undefined}
        onOpenChange={(open) => !open && setPendingDelete(undefined)}
        title="Delete this user?"
        description="The account is deleted for good, with their notes, typing sessions and avatar. This cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={deleteUsers.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
