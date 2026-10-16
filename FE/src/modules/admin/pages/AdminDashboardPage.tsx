import { BadgeCheck, NotebookText, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataTable } from '@/shared/components/data-table';
import { ErrorState } from '@/shared/components/error-state';
import { StatCard } from '@/shared/components/stat-card';
import { Button } from '@/shared/components/ui/button';
import { userColumns } from '../components/user-columns';
import { useAdminStats, useAdminUsers } from '../hooks/use-admin';

const recentUserColumns = userColumns();

export const AdminDashboardPage = () => {
  const stats = useAdminStats();
  const recentUsers = useAdminUsers({ limit: 5, sort: '-createdAt' });

  return (
    <div className="space-y-6">
      <p className="text-base text-muted-foreground">Overview of the app.</p>

      {stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Users"
            icon={Users}
            value={stats.data?.users}
            hint={stats.data && `${stats.data.newUsersThisWeek} new this week`}
            isLoading={stats.isPending}
          />
          <StatCard label="Admins" icon={ShieldCheck} value={stats.data?.admins} isLoading={stats.isPending} />
          <StatCard label="Verified emails" icon={BadgeCheck} value={stats.data?.verified} isLoading={stats.isPending} />
          <StatCard label="Notes" icon={NotebookText} value={stats.data?.notes} isLoading={stats.isPending} />
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserPlus className="size-5" />
            Newest users
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/users">View all</Link>
          </Button>
        </div>
        <DataTable
          label="Newest users"
          columns={recentUserColumns}
          rows={recentUsers.data?.items ?? []}
          getRowId={(user) => user._id}
          isLoading={recentUsers.isPending}
        />
      </section>
    </div>
  );
};
