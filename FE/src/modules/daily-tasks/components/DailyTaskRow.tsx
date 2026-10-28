import { Pencil, Power, PowerOff, Trash2 } from 'lucide-react';
import { ListRow, ListRowMenu, ListRowStat } from '@/shared/components/list-row';
import { Badge } from '@/shared/components/ui/badge';
import { DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { DAILY_TASK_TYPE_INFO, formatTarget, goalOf } from '../daily-tasks.config';
import type { DailyTask } from '../types/daily-task.types';

interface DailyTaskRowProps {
  task: DailyTask;
  onEdit: (task: DailyTask) => void;
  /** Activates an inactive task, deactivates an active one. */
  onToggleActive: (task: DailyTask) => void;
  /** The caller asks for confirmation. */
  onDelete: (task: DailyTask) => void;
}

/** One task in the red card look of the user rows: the icon of its type, the title, its goal, the target, a kebab menu. */
export const DailyTaskRow = ({ task, onEdit, onToggleActive, onDelete }: DailyTaskRowProps) => {
  const { label, stat, icon: Icon } = DAILY_TASK_TYPE_INFO[task.type];
  const goal = goalOf(task);

  return (
    <ListRow
      identity={
        <div className="flex min-w-0 items-center gap-3">
          {/* 61px = the height of the target, like the avatar of a user row. */}
          <div className="flex size-[61px] shrink-0 items-center justify-center bg-primary/25 text-primary">
            <Icon className="size-7" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-2xl font-extrabold text-primary/80">{task.title}</p>
            {/* From `xl` the goal is in the wide middle column instead: this one is at most 300px wide there. */}
            <p className="line-clamp-2 text-lg text-muted-foreground xl:hidden">{goal}</p>
          </div>
        </div>
      }
      center={
        <div className="min-w-0">
          <p className="truncate text-lg text-muted-foreground">{goal}</p>
          {task.description && <p className="truncate text-base text-muted-foreground">{task.description}</p>}
        </div>
      }
      extra={
        <div className="flex w-full justify-end">
          <ListRowStat label={stat} value={formatTarget(task)} className="w-28" />
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
          <Badge variant={task.isActive ? 'default' : 'outline'} className={task.isActive ? undefined : 'border-primary text-primary'}>
            {task.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </>
      }
      meta={new Date(task.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
    />
  );
};
