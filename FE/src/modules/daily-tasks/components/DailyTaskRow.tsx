import { Ban, CircleCheck, Crosshair, Pencil, Power, PowerOff, Trash2 } from 'lucide-react';
import { LabeledTag } from '@/shared/components/labeled-tag';
import { ListRow, ListRowMenu, ListRowStat } from '@/shared/components/list-row';
import { RowContextMenu } from '@/shared/components/row-context-menu';
import { Badge } from '@/shared/components/ui/badge';
import { DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { DAILY_TASK_TYPE_INFO, ERROR_FOCUS_LABELS, formatTarget, goalOf } from '../daily-tasks.config';
import type { DailyTask, DailyTaskListItem } from '../types/daily-task.types';
import { DailyTaskCompletions } from './DailyTaskCompletions';

/** One line, cut with an ellipsis when it is long: the whole text shows in the project's tooltip while it is hovered. */
const CutLine = ({ text, className }: { text: string; className: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <p className={cn('truncate', className)}>{text}</p>
    </TooltipTrigger>
    {/* A description can be long: the tooltip wraps it instead of running off the screen. */}
    <TooltipContent className="max-w-sm whitespace-normal">{text}</TooltipContent>
  </Tooltip>
);

interface DailyTaskRowProps {
  task: DailyTaskListItem;
  onEdit: (task: DailyTask) => void;
  /** Activates an inactive task, deactivates an active one. */
  onToggleActive: (task: DailyTask) => void;
  /** The caller asks for confirmation. */
  onDelete: (task: DailyTask) => void;
}

/**
 * One task, laid out like a session card of the profile (`SessionCard`), with no background and no lines between its tiers:
 * the icon of its type, the title and under it the description (the goal in words, `goalOf`, when it has none); where a
 * session card has its speed line, the learners who completed it in each of the last 24 hours (`DailyTaskCompletions`, from
 * `xl`); then the learners of those 24 hours (DONE) and the target. Its actions are in a kebab menu that shows while the row is hovered,
 * and in the same menu on a right click (`RowContextMenu`). Under them the type and the focus error of an accuracy task as `LabeledTag`s and the status as a badge with an icon, as on the user rows (no date).
 */
export const DailyTaskRow = ({ task, onEdit, onToggleActive, onDelete }: DailyTaskRowProps) => {
  const { label, stat, icon: Icon } = DAILY_TASK_TYPE_INFO[task.type];
  const subtitle = task.description || goalOf(task);

  // The entries of the menu: the one a right click opens and the one of the kebab button that shows while the row is hovered.
  const actions = (
    <>
    <DropdownMenuItem className="gap-2" onClick={() => onEdit(task)}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onClick={() => onToggleActive(task)}>
                  {task.isActive ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                  {task.isActive ? 'Deactivate' : 'Activate'}
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-destructive" onClick={() => onDelete(task)}>
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>

    </>
  );

  return (
    // No background, like a session of the profile: the card's padding goes outside, so its text lines up with the title above.
    <RowContextMenu
      className="-mr-3 -ml-4"
      label={`Actions for ${task.title}`}
      menu={actions}
    >
      <ListRow
        plain
        flat
        identity={
          <div className="flex min-w-0 items-center gap-3">
            {/* The icon of the type: 61px high = the height of the chart and the stats, as wide as the icon, no background, like a session card. */}
            <span className="flex h-[61px] w-9 shrink-0 items-center justify-center text-primary" aria-hidden>
              <Icon className="size-9" />
            </span>
            <TooltipProvider delayDuration={200}>
              <div className="min-w-0">
                <CutLine text={task.title} className="text-2xl font-extrabold text-primary/80" />
                {/* One line, like the date of a session card. */}
                <CutLine text={subtitle} className="text-lg text-muted-foreground" />
              </div>
            </TooltipProvider>
          </div>
        }
        center={<DailyTaskCompletions completions={task.completions} />}
        extra={
          // One width per column (the widest value fits), so they line up from row to row, like the stats of a session card.
          <div className="flex w-full justify-between gap-4 xl:w-auto xl:justify-end xl:gap-8">
            <ListRowStat className="w-20" label="DONE" value={String(task.completions.learners)} />
            <ListRowStat className="w-28" label={stat} value={formatTarget(task)} />
          </div>
        }
        action={<ListRowMenu label={`Actions for ${task.title}`}>{actions}</ListRowMenu>}
        tags={
          <>
            <LabeledTag icon={Icon} text={label} hint="The kind of task" />
            {task.errorType && <LabeledTag icon={Crosshair} text={`Focus: ${ERROR_FOCUS_LABELS[task.errorType]}`} hint="The error type the task is about" />}
            <Badge variant={task.isActive ? 'default' : 'outline'} className={task.isActive ? undefined : 'border-primary text-primary'}>
              {task.isActive ? <CircleCheck className="mr-1.5 size-4" aria-hidden /> : <Ban className="mr-1.5 size-4" aria-hidden />}
              {task.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </>
        }
      />
    </RowContextMenu>
  );
};
