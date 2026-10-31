import { Pencil, Power, PowerOff, Trash2 } from 'lucide-react';
import { ListRow, ListRowMenu, ListRowStat } from '@/shared/components/list-row';
import { Badge } from '@/shared/components/ui/badge';
import { DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { DAILY_TASK_TYPE_INFO, ERROR_FOCUS_LABELS, formatTarget, goalOf } from '../daily-tasks.config';
import type { DailyTask, DailyTaskListItem } from '../types/daily-task.types';
import { DailyTaskCompletions } from './DailyTaskCompletions';

interface DailyTaskRowProps {
  task: DailyTaskListItem;
  onEdit: (task: DailyTask) => void;
  /** Activates an inactive task, deactivates an active one. */
  onToggleActive: (task: DailyTask) => void;
  /** The caller asks for confirmation. */
  onDelete: (task: DailyTask) => void;
}

/**
 * One task, laid out like a session card of the profile (`SessionCard`) in the red card look of the user rows: the icon
 * of its type, the title and under it the description (the goal in words, `goalOf`, when it has none); where a session
 * card has its speed line, the learners who completed it in each of the last 24 hours (`DailyTaskCompletions`, from `xl`);
 * then the target and the learners of the 24 hours (DONE 24H), and a kebab menu. Under them the type, the focus error of
 * an accuracy task and the status as badges, and the created date.
 */
export const DailyTaskRow = ({ task, onEdit, onToggleActive, onDelete }: DailyTaskRowProps) => {
  const { label, stat, icon: Icon } = DAILY_TASK_TYPE_INFO[task.type];
  const subtitle = task.description || goalOf(task);

  return (
    <ListRow
      identity={
        <div className="flex min-w-0 items-center gap-3">
          {/* The icon of the type: 61px high = the height of the chart and the stats, as wide as the icon, no background, like a session card. */}
          <span className="flex h-[61px] w-9 shrink-0 items-center justify-center text-primary" aria-hidden>
            <Icon className="size-9" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-2xl font-extrabold text-primary/80" title={task.title}>{task.title}</p>
            {/* One line, like the date of a session card: the whole text is its tooltip. */}
            <p className="truncate text-lg text-muted-foreground" title={subtitle}>{subtitle}</p>
          </div>
        </div>
      }
      center={<DailyTaskCompletions completions={task.completions} />}
      extra={
        // One width per column (the widest value fits), so they line up from row to row, like the stats of a session card.
        <div className="flex w-full justify-between gap-4 xl:w-auto xl:justify-end xl:gap-8">
          <ListRowStat className="w-28" label={stat} value={formatTarget(task)} />
          <ListRowStat className="w-28" label="DONE 24H" value={String(task.completions.learners)} />
        </div>
      }
      action={
        <ListRowMenu label={`Actions for ${task.title}`}>
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
        </ListRowMenu>
      }
      tags={
        <>
          <Badge>{label}</Badge>
          {task.errorType && <Badge>Focus: {ERROR_FOCUS_LABELS[task.errorType]}</Badge>}
          <Badge variant={task.isActive ? 'default' : 'outline'} className={task.isActive ? undefined : 'border-primary text-primary'}>
            {task.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </>
      }
      meta={new Date(task.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
    />
  );
};
