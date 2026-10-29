import { CalendarCheck, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListToolbar } from '@/shared/components/list-toolbar';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { useListParams } from '@/shared/hooks/use-list-params';
import { panelBodyClass, panelTitleClass } from '@/shared/lib/panel-styles';
import { DailyTaskFormDialog } from '../components/DailyTaskFormDialog';
import { DailyTaskRow } from '../components/DailyTaskRow';
import { DailyTaskSettingsPanel } from '../components/DailyTaskSettingsPanel';
import { DAILY_TASK_TYPE_INFO } from '../daily-tasks.config';
import { useDailyTasks, useDeleteDailyTask, useUpdateDailyTask } from '../hooks/use-daily-tasks';
import { DAILY_TASK_TYPES, type DailyTask, type DailyTaskListParams } from '../types/daily-task.types';

const PAGE_SIZE = 10;

// The first option is the default one.
const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest' },
  { value: 'createdAt', label: 'Oldest' },
  { value: '-updatedAt', label: 'Recently updated' },
  { value: 'title', label: 'Title A–Z' },
  { value: '-title', label: 'Title Z–A' },
];

const TYPE_OPTIONS = DAILY_TASK_TYPES.map((type) => ({ value: type, label: DAILY_TASK_TYPE_INFO[type].label }));

const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

/**
 * Daily tasks (SCRUM-210): the Settings panel (how many tasks a learner gets a day), then the Tasks panel with the task
 * templates: a `ListToolbar` (search, sort, Type and Status filters, all in the URL), one `DailyTaskRow` per task with
 * Edit, Activate / Deactivate and Delete in its kebab menu, pagination, and New task. Built like `AdminUsersPage`.
 */
export const AdminDailyTasksPage = () => {
  const list = useListParams({ sort: '-createdAt' });
  const type = list.get('type') as DailyTaskListParams['type'];
  const isActive = list.get('isActive') as DailyTaskListParams['isActive'];

  const tasks = useDailyTasks({ page: list.page, limit: PAGE_SIZE, q: list.q, type, isActive, sort: list.sort });
  const updateTask = useUpdateDailyTask();
  const deleteTask = useDeleteDailyTask();

  // `undefined` = closed, `null` = creating, a task = editing it.
  const [editing, setEditing] = useState<DailyTask | null>();
  const [deleting, setDeleting] = useState<DailyTask>();

  // A page past the end (its last task was just deleted, or an old link) goes back to the last page. Not while the
  // previous list is still on screen (`keepPreviousData`): its page count belongs to other filters.
  const { page, setPage } = list;
  const lastPage = tasks.isPlaceholderData ? 0 : (tasks.data?.totalPages ?? 0);
  useEffect(() => {
    if (lastPage > 0 && page > lastPage) setPage(lastPage);
  }, [lastPage, page, setPage]);

  const confirmDelete = () =>
    deleting && deleteTask.mutate(deleting._id, { onSuccess: () => setDeleting(undefined) });

  const isFiltered = Boolean(list.q || type || isActive);

  const renderList = () => {
    if (tasks.isPending) return <LoadingState rows={3} />;
    if (tasks.isError) return <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />;
    // Past the end: the effect above is moving back to the last page.
    if (tasks.data.totalPages > 0 && tasks.data.page > tasks.data.totalPages) return <LoadingState rows={3} />;
    if (tasks.data.items.length === 0) {
      return isFiltered ? (
        <EmptyState icon={CalendarCheck} title="No matching tasks" description="Try another search or filter." />
      ) : (
        <EmptyState icon={CalendarCheck} title="No daily tasks yet" description="Create the first task with New task." />
      );
    }
    return (
      <>
        <div className="space-y-2" aria-label="Daily task cards">
          {tasks.data.items.map((task) => (
            <DailyTaskRow
              key={task._id}
              task={task}
              onEdit={setEditing}
              onToggleActive={(target) => updateTask.mutate({ id: target._id, input: { isActive: !target.isActive } })}
              onDelete={setDeleting}
            />
          ))}
        </div>
        <Pagination page={tasks.data.page} totalPages={tasks.data.totalPages} onPageChange={list.setPage} variant="toolbar" />
      </>
    );
  };

  return (
    <div className="space-y-6">
      <DailyTaskSettingsPanel />

      <Panel
        title="Tasks"
        bare
        titleClassName={panelTitleClass}
        className={panelBodyClass}
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus className="size-4" />
            New task
          </Button>
        }
      >
        <div className="space-y-3">
          <ListToolbar
            search={{
              label: 'Search tasks',
              placeholder: 'Search title or description…',
              defaultValue: list.q,
              onSearch: (value) => list.set('q', value),
            }}
            sort={{ value: list.sort, options: SORT_OPTIONS, onChange: (value) => list.set('sort', value) }}
            summary={tasks.data ? `${tasks.data.total} ${tasks.data.total === 1 ? 'task' : 'tasks'} in total` : 'Loading tasks…'}
            filters={[
              { label: 'Type', value: type ?? '', options: TYPE_OPTIONS, onChange: (value) => list.set('type', value) },
              { label: 'Status', value: isActive ?? '', options: STATUS_OPTIONS, onChange: (value) => list.set('isActive', value) },
            ]}
          />
          {renderList()}
        </div>
      </Panel>

      {editing !== undefined && (
        <DailyTaskFormDialog key={editing?._id ?? 'new'} task={editing ?? undefined} onClose={() => setEditing(undefined)} />
      )}

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete this task?"
        description={deleting ? `"${deleting.title}" is deleted for good. Deactivate it instead to keep it for later.` : undefined}
        confirmLabel="Delete"
        destructive
        pending={deleteTask.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
