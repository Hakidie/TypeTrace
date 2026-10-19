import { Users } from 'lucide-react';
import { useState } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListToolbar } from '@/shared/components/list-toolbar';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { useListParams } from '@/shared/hooks/use-list-params';
import { panelBodyClass, panelTitleClass } from '@/shared/lib/panel-styles';
import { UserEditDialog } from '../components/UserEditDialog';
import { UserRow } from '../components/UserRow';
import { useAdminUsers, useDeleteUsers, useSetUserStatus } from '../hooks/use-admin';
import type { AdminUserListParams } from '../types/admin.types';

const PAGE_SIZE = 10;

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
  const role = list.get('role') as AdminUserListParams['role'];
  const verified = list.get('verified') as AdminUserListParams['verified'];

  const users = useAdminUsers({ page: list.page, limit: PAGE_SIZE, q: list.q, role, verified, sort: list.sort });
  const deleteUsers = useDeleteUsers();
  const setStatus = useSetUserStatus();

  const [editing, setEditing] = useState<CurrentUser>();
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
              logins={user.logins}
              status={user.status}
              onEdit={setEditing}
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
        <Pagination page={users.data.page} totalPages={users.data.totalPages} onPageChange={list.setPage} variant="toolbar" />
      </>
    );
  };

  return (
    <div className="space-y-6">
      <Panel title="Users" bare titleClassName={panelTitleClass} className={panelBodyClass}>
        <div className="space-y-3">
          <ListToolbar
            search={{
              label: 'Search users',
              placeholder: 'Search email or name…',
              defaultValue: list.q,
              onSearch: (value) => list.set('q', value),
            }}
            sort={{ value: list.sort, options: SORT_OPTIONS, onChange: (value) => list.set('sort', value) }}
            summary={users.data ? `${users.data.total} accounts in total` : 'Loading accounts…'}
            filters={[
              { label: 'Role', value: role ?? '', options: ROLE_OPTIONS, onChange: (value) => list.set('role', value) },
              { label: 'Email', value: verified ?? '', options: VERIFIED_OPTIONS, onChange: (value) => list.set('verified', value) },
            ]}
          />
          {renderList()}
        </div>
      </Panel>

      {editing && (
        <UserEditDialog
          key={editing._id}
          user={editing}
          isSelf={editing._id === currentUser?._id}
          onClose={() => setEditing(undefined)}
        />
      )}

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
