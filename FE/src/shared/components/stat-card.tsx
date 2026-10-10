import type { LucideIcon } from 'lucide-react';
import { Card } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface StatCardProps {
  label: string;
  value?: number | string;
  icon: LucideIcon;
  /** Small text under the value, e.g. "3 new this week". */
  hint?: string;
  isLoading?: boolean;
}

/** One number on a dashboard. */
export const StatCard = ({ label, value, icon: Icon, hint, isLoading }: StatCardProps) => (
  <Card className="flex items-start justify-between gap-4 p-5">
    <div className="space-y-1">
      <p className="text-base text-muted-foreground">{label}</p>
      {isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-3xl font-bold">{value ?? '—'}</p>}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
    <div className="flex size-10 items-center justify-center bg-primary/10 text-primary">
      <Icon className="size-5" />
    </div>
  </Card>
);
