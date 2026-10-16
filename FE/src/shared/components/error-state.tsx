import { AlertTriangle } from 'lucide-react';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { Button } from '@/shared/components/ui/button';

interface ErrorStateProps {
  /** The thrown value; its backend message is shown when there is one. */
  error?: unknown;
  title?: string;
  onRetry?: () => void;
}

/** Shown when loading data failed (no border of its own, like `EmptyState`, so it fits inside a panel). Pair with `query.error` and `query.refetch`. */
export const ErrorState = ({ error, title = 'Something went wrong', onRetry }: ErrorStateProps) => (
  <div role="alert" className="flex flex-col items-center justify-center gap-3 p-10 text-center">
    <AlertTriangle className="size-8 text-destructive" />
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-base text-muted-foreground">{getApiErrorMessage(error, 'Please try again.')}</p>
    </div>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);
