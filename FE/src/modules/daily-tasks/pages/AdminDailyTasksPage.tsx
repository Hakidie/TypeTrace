import { CalendarCheck, CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "@/shared/components/confirm-dialog";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { CompactToolbar } from "@/shared/components/compact-toolbar";
import { LoadingState } from "@/shared/components/loading-state";
import { Pagination } from "@/shared/components/pagination";
import { Panel } from "@/shared/components/panel";
import { PanelTitleSwitch } from "@/shared/components/panel-title-switch";
import { useListParams } from "@/shared/hooks/use-list-params";
import { sectionTitleClass } from "@/shared/lib/panel-styles";
import { DailyTaskForm } from "../components/DailyTaskForm";
import { DailyTaskRow } from "../components/DailyTaskRow";
import { TaskCompletionsChart } from "../components/TaskCompletionsChart";
import { TasksPerDayItems } from "../components/TasksPerDayItems";
import { DAILY_TASK_TYPE_INFO, shownTaskTitle } from "../daily-tasks.config";
import {
  useDailyTasks,
  useDailyTaskSettings,
  useDeleteDailyTask,
  useUpdateDailyTask,
} from "../hooks/use-daily-tasks";
import {
  DAILY_TASK_TYPES,
  type DailyTask,
  type DailyTaskListParams,
} from "../types/daily-task.types";

// Three rows a page.
const PAGE_SIZE = 3;

// The first option is the default one; the labels are `dailyTasks:sort.<key>`.
const SORT_KEYS = [
  { value: "-createdAt", key: "newest" },
  { value: "createdAt", key: "oldest" },
  { value: "-updatedAt", key: "updated" },
  { value: "title", key: "titleAZ" },
  { value: "-title", key: "titleZA" },
] as const;

/**
 * Daily tasks (SCRUM-210), laid out like the learner's Passages page: the list (the chart of the learners who completed tasks
 * and the task templates) and the form share the page, one at a time, the list first, switched by the button under each
 * (`?show=form`). The form adds a task, or edits the one
 * picked with Edit (`DailyTaskForm`); under it the task templates: a `ListToolbar` (search, sort, Type and Status filters, in the URL; how many tasks a learner gets a day is a menu
 * on the right of the form's title row), one `DailyTaskRow` per task
 * (with the learners who completed it in the last 24 hours) with Edit, Activate / Deactivate and Delete in its kebab
 * menu, and pagination.
 */
export const AdminDailyTasksPage = () => {
  const { t } = useTranslation("dailyTasks");
  // Built here, not when the module loads, so they are in the language of the interface.
  const sortOptions = SORT_KEYS.map(({ value, key }) => ({ value, label: t(`sort.${key}`) }));
  const typeOptions = DAILY_TASK_TYPES.map((value) => ({ value, label: DAILY_TASK_TYPE_INFO[value].label }));
  const statusOptions = [
    { value: "true", label: t("status.active") },
    { value: "false", label: t("status.inactive") },
  ];
  const list = useListParams({ sort: "-createdAt" });
  const type = list.get("type") as DailyTaskListParams["type"];
  const isActive = list.get("isActive") as DailyTaskListParams["isActive"];

  const tasks = useDailyTasks({
    page: list.page,
    limit: PAGE_SIZE,
    q: list.q,
    type,
    isActive,
    sort: list.sort,
  });
  const perDay = useDailyTaskSettings().data?.dailyTaskCount;
  const updateTask = useUpdateDailyTask();
  const deleteTask = useDeleteDailyTask();

  // The task open in the top panel (Edit task instead of New task).
  const [editing, setEditing] = useState<DailyTask>();
  const [deleting, setDeleting] = useState<DailyTask>();
  // The form and the list (with the chart above it) share the page, one at a time: the list first, and a button under each
  // shows the other (`?show=form` in the URL).
  const [params, setParams] = useSearchParams();
  const showForm = params.get("show") === "form";
  const setShowForm = (show: boolean) =>
    setParams(
      (next) => {
        if (show) next.set("show", "form");
        else next.delete("show");
        return next;
      },
      { replace: true },
    );

  // A row that asks to be edited shows the form, loaded with its task.
  const startEditing = (task: DailyTask) => {
    setEditing(task);
    setShowForm(true);
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
        setEditing((current) =>
          current?._id === deleting._id ? undefined : current,
        );
        setDeleting(undefined);
      },
    });

  const isFiltered = Boolean(list.q || type || isActive);

  const renderList = () => {
    if (tasks.isPending) return <LoadingState rows={3} />;
    if (tasks.isError)
      return (
        <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
      );
    // Past the end: the effect above is moving back to the last page.
    if (tasks.data.totalPages > 0 && tasks.data.page > tasks.data.totalPages)
      return <LoadingState rows={3} />;
    if (tasks.data.items.length === 0) {
      return isFiltered ? (
        <EmptyState
          icon={CalendarCheck}
          title={t("page.noMatch")}
          description={t("page.noMatchHint")}
        />
      ) : (
        <EmptyState
          icon={CalendarCheck}
          title={t("page.none")}
          description={t("page.noneHint")}
        />
      );
    }
    return (
      <>
        <div className="space-y-2" aria-label={t("page.cards")}>
          {tasks.data.items.map((task) => (
            <DailyTaskRow
              key={task._id}
              task={task}
              onEdit={startEditing}
              onToggleActive={(target) =>
                updateTask.mutate({
                  id: target._id,
                  input: { isActive: !target.isActive },
                })
              }
              onDelete={setDeleting}
            />
          ))}
        </div>
        <Pagination
          page={tasks.data.page}
          totalPages={tasks.data.totalPages}
          onPageChange={list.setPage}
          variant="toolbar"
          accent
          plain
          flushRight
        />
      </>
    );
  };

  return (
    // The list view is one screen tall below the header (the screen minus the 61px header and the 2rem padding above and below): the chart takes the height the list leaves.
    <div
      className={`flex flex-1 flex-col gap-8 ${showForm ? "" : "min-h-[calc(100svh-61px-4rem)]"}`}
    >
      {showForm ? (
        <div className="flex flex-col lg:flex-1">
          {/* No visible title (the form says what it is); screen readers still get one. */}
          {/* PANEL Task form */}
          <Panel bare fill>
            <h2 className="sr-only">{editing ? t("page.editTask") : t("page.newTask")}</h2>
            {/* `key` remounts the form, so it starts from the task being edited (or empty). */}
            <DailyTaskForm
              key={editing?._id ?? "new"}
              task={editing}
              onDone={() => {
                // Saved or cancelled while editing: back to the list.
                if (editing) setShowForm(false);
                setEditing(undefined);
              }}
              // How many of the active tasks a learner gets a day: an app setting, saved as soon as it is picked; on the right of the title row.
              // The same size as the title (1.5rem, 3rem high), and its icon with it.
              titleAction={
                <div className="[&_button]:h-12 [&_button]:text-[1.5rem] [&_button]:font-normal [&_svg]:size-6">
                  <CompactToolbar
                    menus={[
                      {
                        label: t("perDay.label"),
                        icon: CalendarClock,
                        valueLabel:
                          perDay === undefined ? t("perDay.unknown") : t("perDay.value", { count: perDay }),
                        options: [],
                        value: "",
                        onChange: () => {},
                        children: <TasksPerDayItems />,
                      },
                    ]}
                  />
                </div>
              }
            />
            <div className="mt-3 flex shrink-0 items-center justify-center">
              <PanelTitleSwitch
                other={t("page.taskList")}
                showLabel
                onClick={() => setShowForm(false)}
              />
            </div>
          </Panel>
        </div>
      ) : (
        <>
          {/* PANEL Completions: the learners who completed tasks, by period, above the list. */}
          <TaskCompletionsChart />

          {/* PANEL Tasks */}
          <div className="flex flex-col gap-3">
            <Panel
              title={t("page.taskList")}
              bare
              titleClassName={sectionTitleClass}
              className="flex flex-col gap-3"
              actions={
                <CompactToolbar
                  showWords
                  search={{
                    label: t("page.search"),
                    placeholder: t("page.searchPlaceholder"),
                    defaultValue: list.q,
                    onSearch: (value) => list.set("q", value),
                  }}
                  sort={{
                    value: list.sort,
                    options: sortOptions,
                    onChange: (value) => list.set("sort", value),
                  }}
                  filters={[
                    {
                      label: t("page.type"),
                      value: type ?? "",
                      options: typeOptions,
                      onChange: (value) => list.set("type", value),
                    },
                    {
                      label: t("status.label"),
                      value: isActive ?? "",
                      options: statusOptions,
                      onChange: (value) => list.set("isActive", value),
                    },
                  ]}
                  count={{
                    icon: CalendarCheck,
                    value: tasks.data?.total ?? "…",
                    label: t("page.count"),
                  }}
                />
              }
            >
              {renderList()}
            </Panel>
            {/* Apart from the panel, 12px under it (`gap-3` of this wrapper, not the page's `gap-8`). */}
            <div className="flex shrink-0 items-center justify-center">
              <PanelTitleSwitch
                other={editing ? t("page.editTask") : t("page.dailyTask")}
                showLabel
                onClick={() => setShowForm(true)}
              />
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={t("page.deleteTitle")}
        description={
          deleting
            ? t("page.deleteText", { title: shownTaskTitle(deleting) })
            : undefined
        }
        confirmLabel={t("common:actions.delete")}
        destructive
        pending={deleteTask.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
