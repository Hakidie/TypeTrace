import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Usually a button that creates the first item. */
  action?: ReactNode;
}

/** Shown when a list has no items. */
export const EmptyState = ({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-3 border border-dashed p-10 text-center">
    <div className="flex size-12 items-center justify-center bg-muted text-muted-foreground">
      <Icon className="size-6" />
    </div>
    <div>
      <p className="font-medium">{title}</p>
      {description && <p className="text-base text-muted-foreground">{description}</p>}
    </div>
    {action}
  </div>
);
