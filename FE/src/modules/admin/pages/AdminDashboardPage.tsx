import { BadgeCheck, NotebookText, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { DataTable } from '@/shared/components/data-table';
import { ErrorState } from '@/shared/components/error-state';
import { StatCard } from '@/shared/components/stat-card';
import { Button } from '@/shared/components/ui/button';
import { userColumns } from '../components/user-columns';
import { useAdminStats, useAdminUsers } from '../hooks/use-admin';

export const AdminDashboardPage = () => {
  const { t } = useTranslation('admin');
  // Built in the render: the headers are read in the language of the interface (the admin layout draws the page again when it changes).
  const recentUserColumns = userColumns();
  const stats = useAdminStats();
  const recentUsers = useAdminUsers({ limit: 5, sort: '-createdAt' });

  return (
    <div className="space-y-8">
      <p className="text-base text-muted-foreground">{t('dashboard.intro')}</p>

      {stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t('dashboard.users')}
            icon={Users}
            value={stats.data?.users}
            hint={stats.data && t('dashboard.newThisWeek', { number: stats.data.newUsersThisWeek })}
            isLoading={stats.isPending}
          />
          <StatCard label={t('dashboard.admins')} icon={ShieldCheck} value={stats.data?.admins} isLoading={stats.isPending} />
          <StatCard label={t('dashboard.verified')} icon={BadgeCheck} value={stats.data?.verified} isLoading={stats.isPending} />
          <StatCard label={t('dashboard.notes')} icon={NotebookText} value={stats.data?.notes} isLoading={stats.isPending} />
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserPlus className="size-5" />
            {t('dashboard.newest')}
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/users">{t('dashboard.viewAll')}</Link>
          </Button>
        </div>
        <DataTable
          label={t('dashboard.newest')}
          columns={recentUserColumns}
          rows={recentUsers.data?.items ?? []}
          getRowId={(user) => user._id}
          isLoading={recentUsers.isPending}
        />
      </section>
    </div>
  );
};
