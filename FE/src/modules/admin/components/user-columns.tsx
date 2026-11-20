import { Pencil, Trash2 } from 'lucide-react';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import type { DataTableColumn } from '@/shared/components/data-table';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { i18n } from '@/shared/i18n/i18n';

interface UserColumnOptions {
  currentUserId?: string;
  onEdit?: (user: CurrentUser) => void;
  onDelete?: (user: CurrentUser) => void;
}

/**
 * Columns of the users table. `sortKey` values must be allowed by
 * `listUsersQuerySchema` on the backend. Leave out `onEdit`/`onDelete` for a
 * read-only table (as on the dashboard). The words are read in the language of the interface when it is called (SCRUM-336).
 */
export const userColumns = ({ currentUserId, onEdit, onDelete }: UserColumnOptions = {}): DataTableColumn<CurrentUser>[] => {
  const t = (key: string, options?: Record<string, unknown>) => i18n.t(`admin:${key}`, options);
  const columns: DataTableColumn<CurrentUser>[] = [
    {
      id: 'user',
      header: t('columns.user'),
      sortKey: 'email',
      cell: (user) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarImage src={user.avatarUrl} alt="" />
            <AvatarFallback className="text-sm">{user.email.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">
              {user.displayName || '—'}
              {user._id === currentUserId && <span className="ml-1 text-sm text-muted-foreground">{t('columns.you')}</span>}
            </p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: t('columns.role'),
      sortKey: 'role',
      cell: (user) => <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{t(`roles.${user.role}`)}</Badge>,
    },
    {
      id: 'verified',
      header: t('columns.email'),
      cell: (user) =>
        user.isEmailVerified ? <Badge variant="outline">{t('columns.verified')}</Badge> : <Badge variant="destructive">{t('columns.unverified')}</Badge>,
    },
    {
      id: 'createdAt',
      header: t('columns.joined'),
      sortKey: 'createdAt',
      cell: (user) => new Date(user.createdAt).toLocaleDateString(i18n.language),
    },
  ];

  if (onEdit || onDelete) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">{t('columns.actions')}</span>,
      className: 'text-right',
      cell: (user) => (
        <div className="flex justify-end gap-1">
          {onEdit && (
            <Button variant="ghost" size="sm" aria-label={t('columns.edit', { email: user.email })} onClick={() => onEdit(user)}>
              <Pencil className="size-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('columns.delete', { email: user.email })}
              disabled={user._id === currentUserId}
              onClick={() => onDelete(user)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ),
    });
  }

  return columns;
};
