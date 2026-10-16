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

/** Shown when a list has no items. Like `ErrorState` (red icon, centered text) but without the border, so it fits inside a panel that already has one. */
export const EmptyState = ({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
    <Icon className="size-8 text-destructive" />
    <div>
      <p className="font-medium">{title}</p>
      {description && <p className="text-base text-muted-foreground">{description}</p>}
    </div>
    {action}
  </div>
);
