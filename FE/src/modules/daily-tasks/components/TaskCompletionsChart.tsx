import {
  Calendar,
  CalendarDays,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  anchorFor,
  periodLabel,
  periodOptions,
  periodValue,
} from "@/modules/profile/lib/chart-period";
import {
  axisLabel,
  rangeUnit,
  tooltipTitle,
} from "@/modules/profile/lib/month-label";
import type { ChartRange } from "@/modules/profile/types/profile.types";
import { CompactToolbar } from "@/shared/components/compact-toolbar";
import { ErrorState } from "@/shared/components/error-state";
import { LoadingState } from "@/shared/components/loading-state";
import { Panel } from "@/shared/components/panel";
import { dateKeyIn } from "@/shared/lib/local-date";
import { sectionTitleClass } from "@/shared/lib/panel-styles";
import { useTaskCompletions } from "../hooks/use-daily-tasks";
import type {
  TaskCompletionsChartData,
  TaskCompletionsPoint,
} from "../types/daily-task.types";

/** The admin charts are read in Vietnam time, like the backend's (`ADMIN_ZONE`). */
const CHART_ZONE = "Asia/Ho_Chi_Minh";

// Week, Month, Year: the smallest first, as on the Progress and Plans pages.
const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];
const ICONS: Record<ChartRange, LucideIcon> = {
  year: Calendar,
  month: CalendarRange,
  week: CalendarDays,
};
const TICK_SIZE = 16;

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** The shade of the bar of the task at `index` of `count`: the theme red, lighter for each next task (theme tokens only). */
const shadeOf = (index: number, count: number) =>
  `color-mix(in oklab, var(--primary) ${Math.round(100 - (index * 60) / Math.max(1, count - 1))}%, transparent)`;

/** The tooltip of a point: the period, then each task with the learners who completed it, and the totals. */
const PointTooltip = ({
  point,
  range,
  tasks,
}: {
  point: TaskCompletionsPoint;
  range: ChartRange;
  tasks: TaskCompletionsChartData["tasks"];
}) => (
  <div className="border border-border bg-background px-3 py-2 text-base">
    <p className="font-semibold">{tooltipTitle(range, point.key)}</p>
    {tasks.map((task, index) => {
      const learners =
        point.byTask.find((entry) => entry.taskId === task.taskId)?.learners ??
        0;
      return (
        <p key={task.taskId} className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block size-3 shrink-0"
            style={{ backgroundColor: shadeOf(index, tasks.length) }}
          />
          <span>
            {task.title}: {learners}
          </span>
        </p>
      );
    })}
    <p className="mt-1 text-muted-foreground">
      {plural(point.learners, "learner")}, {plural(point.tasks, "task")}{" "}
      completed
    </p>
  </div>
);

/**
 * How many learners completed daily tasks over time, built like the users chart of the admin Plans page: a title and, in the
 * look of the compact toolbar, Week, Month and Year buttons, each with a menu of its own periods; under them a bar chart,
 * a column for each task in each period (the learners who completed it, each once, the columns lighter task after task; the
 * tooltip names them and adds the totals). The chart takes the height the page leaves it (at least 12rem).
 * Each point is a day (week), a block of 7 days (month) or a month (year); the periods to come are not drawn. No frame or background.
 */
export const TaskCompletionsChart = () => {
  const today = dateKeyIn(new Date(), CHART_ZONE);
  const [range, setRange] = useState<ChartRange>("week");
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked && picked <= today ? picked : today;
  const query = useTaskCompletions(range, date);

  const renderChart = () => {
    if (query.isPending) return <LoadingState rows={1} />;
    if (query.isError)
      return (
        <ErrorState
          error={query.error}
          title="Could not load the completions chart"
          onRetry={() => void query.refetch()}
        />
      );
    const shown = query.data.range;
    const { tasks } = query.data;
    const top = Math.max(
      1,
      ...query.data.points.flatMap((point) =>
        point.byTask.map((entry) => entry.learners),
      ),
    );
    const marks = [0, Math.round(top / 2), top].filter(
      (mark, index, all) => all.indexOf(mark) === index,
    );
    // One field for each task: `task:<id>`.
    const data = query.data.points.map((point) => ({
      ...point,
      ...Object.fromEntries(
        point.byTask.map((entry) => [`task:${entry.taskId}`, entry.learners]),
      ),
      label: axisLabel(shown, point.key),
    }));
    return (
      // The box is positioned, so the chart reads its size from it.
      <div
        role="img"
        aria-label={`Learners who completed tasks by ${rangeUnit(shown)}`}
        className="relative min-h-48 flex-1"
      >
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              barGap={2}
              barCategoryGap="25%"
              margin={{ top: 8, right: 28, bottom: 0, left: 28 }}
            >
              <XAxis
                dataKey="label"
                interval={0}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                height={32}
                tickSize={0}
                tickMargin={12}
                tick={{ fontSize: TICK_SIZE, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                width={60}
                tickMargin={12}
                domain={[0, top]}
                ticks={marks}
                allowDecimals={false}
                tickLine={false}
                stroke="var(--border)"
                tick={{ fontSize: TICK_SIZE, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                cursor={{ fill: "var(--primary)", fillOpacity: 0.1 }}
                content={({ payload }) =>
                  payload?.length ? (
                    <PointTooltip
                      point={payload[0].payload as TaskCompletionsPoint}
                      range={shown}
                      tasks={tasks}
                    />
                  ) : null
                }
              />
              {tasks.map((task, index) => (
                <Bar
                  key={task.taskId}
                  dataKey={`task:${task.taskId}`}
                  name={task.title}
                  fill={shadeOf(index, tasks.length)}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <section
      aria-label="Task completions"
      className="flex min-h-0 flex-1 flex-col"
    >
      <Panel
        title="Completions"
        bare
        fill
        titleClassName={sectionTitleClass}
        className="space-y-3"
        actions={
          <CompactToolbar
            menus={RANGE_OPTIONS.map(({ value: menuRange, label }) => {
              const active = menuRange === range;
              return {
                label,
                icon: ICONS[menuRange],
                valueLabel: periodLabel(menuRange, date),
                active,
                options: periodOptions(menuRange, date, today),
                value: active ? periodValue(range, date) : "",
                onChange: (value: string) => {
                  setRange(menuRange);
                  setPicked(anchorFor(menuRange, value, date, today));
                },
              };
            })}
          />
        }
      >
        {renderChart()}
      </Panel>
    </section>
  );
};
