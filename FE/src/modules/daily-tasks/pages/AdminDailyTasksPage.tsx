import { CalendarCheck, CalendarClock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { ListToolbar } from '@/shared/components/list-toolbar';
import { LoadingState } from '@/shared/components/loading-state';
import { Pagination } from '@/shared/components/pagination';
import { Panel } from '@/shared/components/panel';
import { useListParams } from '@/shared/hooks/use-list-params';
import { DailyTaskForm } from '../components/DailyTaskForm';
import { DailyTaskRow } from '../components/DailyTaskRow';
import { TasksPerDayItems } from '../components/TasksPerDayItems';
import { DAILY_TASK_TYPE_INFO } from '../daily-tasks.config';
import { useDailyTasks, useDailyTaskSettings, useDeleteDailyTask, useUpdateDailyTask } from '../hooks/use-daily-tasks';
import { DAILY_TASK_TYPES, type DailyTask, type DailyTaskListParams } from '../types/daily-task.types';

// Four rows a page.
const PAGE_SIZE = 4;

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
 * Daily tasks (SCRUM-210), laid out like the learner's Passages page: on top the form that adds a task, or edits the one
 * picked with Edit (`DailyTaskForm`); under it the task templates: a `ListToolbar` (search, how many tasks a learner gets
 * a day as a menu of its own, sort, Type and Status filters, all but the menu in the URL), one `DailyTaskRow` per task
 * (with the learners who completed it in the last 24 hours) with Edit, Activate / Deactivate and Delete in its kebab
 * menu, and pagination.
 */
export const AdminDailyTasksPage = () => {
  const list = useListParams({ sort: '-createdAt' });
  const type = list.get('type') as DailyTaskListParams['type'];
  const isActive = list.get('isActive') as DailyTaskListParams['isActive'];

  const tasks = useDailyTasks({ page: list.page, limit: PAGE_SIZE, q: list.q, type, isActive, sort: list.sort });
  const perDay = useDailyTaskSettings().data?.dailyTaskCount;
  const updateTask = useUpdateDailyTask();
  const deleteTask = useDeleteDailyTask();

  // The task open in the top panel (Edit task instead of New task).
  const [editing, setEditing] = useState<DailyTask>();
  const [deleting, setDeleting] = useState<DailyTask>();
  const formPanelRef = useRef<HTMLDivElement>(null);

  // The form is at the top of the page: bring it into view when a row asks to be edited.
  const startEditing = (task: DailyTask) => {
    setEditing(task);
    formPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  // A page past the end (its last task was just deleted, or an old link) goes back to the last page. Not while the
  // previous list is still on screen (`keepPreviousData`): its page count belongs to other filters.
  const { page, setPage } = list;
  const lastPage = tasks.isPlaceholderData ? 0 : (tasks.data?.totalPages ?? 0);
  useEffect(() => {
    if (lastPage > 0 && page > lastPage) setPage(lastPage);
  }, [lastPage, page, setPage]);

  // A deleted task can no longer be edited: the top panel goes back to New task.
  const confirmDelete = () =>
    deleting &&
    deleteTask.mutate(deleting._id, {
      onSuccess: () => {
        setEditing((current) => (current?._id === deleting._id ? undefined : current));
        setDeleting(undefined);
      },
    });

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
        <EmptyState icon={CalendarCheck} title="No daily tasks yet" description="Add the first task with the form above." />
      );
    }
    return (
      <>
        <div className="space-y-2" aria-label="Daily task cards">
          {tasks.data.items.map((task) => (
            <DailyTaskRow
              key={task._id}
              task={task}
              onEdit={startEditing}
              onToggleActive={(target) => updateTask.mutate({ id: target._id, input: { isActive: !target.isActive } })}
              onDelete={setDeleting}
            />
          ))}
        </div>
        <Pagination page={tasks.data.page} totalPages={tasks.data.totalPages} onPageChange={list.setPage} variant="toolbar" accent />
      </>
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-12">
      <div ref={formPanelRef} className="flex scroll-mt-4 flex-col lg:flex-1">
        {/* No visible title (the form says what it is); screen readers still get one. */}
        {/* PANEL Task form */}
        <Panel bare fill>
          <h2 className="sr-only">{editing ? 'Edit task' : 'New task'}</h2>
          {/* `key` remounts the form, so it starts from the task being edited (or empty). */}
          <DailyTaskForm key={editing?._id ?? 'new'} task={editing} onDone={() => setEditing(undefined)} />
        </Panel>
      </div>

      {/* PANEL Tasks */}
      <Panel bare>
        <h2 className="sr-only">Tasks</h2>
        <div className="flex flex-col gap-3">
          <ListToolbar
            title="Tasks"
            search={{
              label: 'Search tasks',
              placeholder: 'Search title or description…',
              defaultValue: list.q,
              onSearch: (value) => list.set('q', value),
            }}
            summary={tasks.data ? `${tasks.data.total} ${tasks.data.total === 1 ? 'task' : 'tasks'}` : 'Loading tasks…'}
            // How many of the active tasks a learner gets a day: an app setting, saved as soon as it is picked.
            menus={[
              {
                name: 'Tasks per day',
                label: perDay === undefined ? '— a day' : `${perDay} a day`,
                icon: CalendarClock,
                children: <TasksPerDayItems />,
              },
            ]}
            sort={{ value: list.sort, options: SORT_OPTIONS, onChange: (value) => list.set('sort', value) }}
            filters={[
              { label: 'Type', value: type ?? '', options: TYPE_OPTIONS, onChange: (value) => list.set('type', value) },
              { label: 'Status', value: isActive ?? '', options: STATUS_OPTIONS, onChange: (value) => list.set('isActive', value) },
            ]}
          />
          {renderList()}
        </div>
      </Panel>

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
