import { cn } from '@/shared/lib/utils';

/** Two rings turning in opposite directions with a line under them: a room opens, or a seat waits for a player. */
export const LoadingRing = ({ label, className }: { label: string; className?: string }) => (
  <div role="status" className={cn('flex flex-col items-center gap-4 text-muted-foreground', className)}>
    <span aria-hidden="true" className="relative size-16">
      <span className="absolute inset-0 rounded-full border-4 border-primary/15" />
      <span className="duel-spin absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary" />
      <span className="duel-spin-reverse absolute inset-3 rounded-full border-2 border-transparent border-b-primary/70 border-l-primary/70" />
    </span>
    <span>{label}</span>
  </div>
);
