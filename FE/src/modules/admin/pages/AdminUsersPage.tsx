import { Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable, FilterSelect, SearchInput, TableToolbar } from '@/shared/components/data-table';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { PageHeader } from '@/shared/components/page-header';
import { Pagination } from '@/shared/components/pagination';
import { Button } from '@/shared/components/ui/button';
import { useListParams } from '@/shared/hooks/use-list-params';
import { UserEditDialog } from '../components/UserEditDialog';
import { userColumns } from '../components/user-columns';
import { useAdminUsers, useDeleteUsers } from '../hooks/use-admin';
import type { AdminUserListParams } from '../types/admin.types';

const PAGE_SIZE = 10;

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

const VERIFIED_OPTIONS = [
  { value: 'true', label: 'Verified' },
  { value: 'false', label: 'Unverified' },
];

/**
 * Reference admin page for one resource: search, filters, sortable table,
 * pagination, edit dialog, delete and bulk delete. Copy it for other resources.
 */
export const AdminUsersPage = () => {
  const { data: currentUser } = useCurrentUser();
  const list = useListParams({ sort: '-createdAt' });
  const role = list.get('role') as AdminUserListParams['role'];
  const verified = list.get('verified') as AdminUserListParams['verified'];

  const users = useAdminUsers({ page: list.page, limit: PAGE_SIZE, q: list.q, role, verified, sort: list.sort });
  const deleteUsers = useDeleteUsers();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<CurrentUser>();
  // Ids waiting for delete confirmation (one user or the selection).
  const [pendingDelete, setPendingDelete] = useState<string[]>([]);

  // Selection belongs to the rows on screen: clear it whenever the view changes.
  const changeList = (key: string, value: string) => {
    setSelectedIds([]);
    list.set(key, value);
  };

  const columns = userColumns({
    currentUserId: currentUser?._id,
    onEdit: setEditing,
    onDelete: (user) => setPendingDelete([user._id]),
  });

  const confirmDelete = () =>
    deleteUsers.mutate(pendingDelete, {
      onSuccess: () => {
        setSelectedIds((ids) => ids.filter((id) => !pendingDelete.includes(id)));
        setPendingDelete([]);
      },
    });

  const isFiltered = Boolean(list.q || role || verified);

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Search, edit and remove accounts." />

      <TableToolbar
        actions={
          selectedIds.length > 0 && (
            <Button variant="destructive" onClick={() => setPendingDelete(selectedIds)}>
              <Trash2 className="size-4" />
              Delete selected ({selectedIds.length})
            </Button>
          )
        }
      >
        <SearchInput
          label="Search users"
          placeholder="Search email or name…"
          defaultValue={list.q}
          onSearch={(value) => changeList('q', value)}
        />
        <FilterSelect label="Role" value={role ?? ''} options={ROLE_OPTIONS} onChange={(value) => changeList('role', value)} />
        <FilterSelect
          label="Email"
          value={verified ?? ''}
          options={VERIFIED_OPTIONS}
          onChange={(value) => changeList('verified', value)}
        />
      </TableToolbar>

      {users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : (
        <>
          <DataTable
            label="Users"
            columns={columns}
            rows={users.data?.items ?? []}
            getRowId={(user) => user._id}
            isLoading={users.isPending}
            sort={list.sort}
            onSortChange={(sort) => changeList('sort', sort)}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            isRowSelectable={(user) => user._id !== currentUser?._id}
            emptyState={
              <EmptyState
                icon={Users}
                title={isFiltered ? 'No matching users' : 'No users yet'}
                description={isFiltered ? 'Try another search or filter.' : undefined}
              />
            }
          />
          {users.data && (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-base text-muted-foreground">{users.data.total} users</p>
              <Pagination
                page={users.data.page}
                totalPages={users.data.totalPages}
                onPageChange={(page) => {
                  setSelectedIds([]);
                  list.setPage(page);
                }}
              />
            </div>
          )}
        </>
      )}

      {editing && (
        <UserEditDialog
          key={editing._id}
          user={editing}
          isSelf={editing._id === currentUser?._id}
          onClose={() => setEditing(undefined)}
        />
      )}

      <ConfirmDialog
        open={pendingDelete.length > 0}
        onOpenChange={(open) => !open && setPendingDelete([])}
        title={pendingDelete.length === 1 ? 'Delete this user?' : `Delete ${pendingDelete.length} users?`}
        description="Their notes and avatar are deleted too. This cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={deleteUsers.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
