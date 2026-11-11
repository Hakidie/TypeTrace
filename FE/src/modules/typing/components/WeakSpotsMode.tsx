import { ArrowRight, Crosshair, Lock } from 'lucide-react';
import { ErrorTypeCard } from '@/modules/profile/components/ErrorTypeCard';
import { useErrorProfile } from '@/modules/profile/hooks/use-profile';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import type { WordErrorType } from '@/shared/lib/vietnamese-errors';
import { cn } from '@/shared/lib/utils';
import { errorLabels, WEAK_SPOTS_FOCUS_TYPES } from '../typing.config';

/** What a Weak spots card starts: the learner's weakest error types (`auto`, US3.2) or one error type (SCRUM-74). */
export type WeakSpotsFocus = 'auto' | WordErrorType;

// The frame of the cards, as the tiles of the Minigames tab.
const frame = 'border border-primary/20 bg-background/30 backdrop-blur-sm';

interface WeakSpotsModeProps {
  /** The learner's plan has no Weak spots (`canCreateErrorPractice`): the cards show a lock and open the plan. */
  locked: boolean;
  onPick: (focus: WeakSpotsFocus) => void;
}

/**
 * The Weak spots tab before a lesson: on the left the auto lesson (US3.2), which names the error types it will train (the
 * learner's weakest, from their error profile, as the server picks them) and their rates, or says that a random passage comes
 * when they have none; on the right the five error types (SCRUM-74), the cards of the Profile's error profile, each starting a
 * lesson of its own type, also before it has enough data. On phones the auto lesson is on top.
 */
export const WeakSpotsMode = ({ locked, onPick }: WeakSpotsModeProps) => {
  const errorProfile = useErrorProfile();
  if (errorProfile.isPending) return <LoadingState rows={3} />;
  if (errorProfile.isError) return <ErrorState error={errorProfile.error} onRetry={() => void errorProfile.refetch()} />;

  const profile = errorProfile.data;
  const focus = profile.weakTypes.slice(0, WEAK_SPOTS_FOCUS_TYPES).map((type) => profile.types.find((item) => item.type === type)!);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <button
        type="button"
        onClick={() => onPick('auto')}
        aria-label={`Practice your weak spots${locked ? ' (Premium)' : ''}`}
        className={cn(
          frame,
          'group flex flex-col gap-5 p-6 text-left transition-[border-color,transform] duration-200 hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]',
        )}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-3 text-3xl font-bold text-primary">
            <Crosshair className="size-7" aria-hidden /> Your weak spots
          </span>
          {locked && (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="size-4" aria-hidden /> Premium
            </span>
          )}
        </span>
        {focus.length ? (
          <>
            <span className="text-base text-muted-foreground">
              A passage written for the error types you miss most, from words of the word bank.
            </span>
            <span className="flex flex-col gap-3">
              {focus.map((item) => (
                <span key={item.type} className="flex items-baseline justify-between gap-3 border-b border-primary/15 pb-2">
                  <span className="text-xl font-extrabold text-primary/80">{errorLabels[item.type]}</span>
                  <span className="text-xl font-extrabold tabular-nums text-primary">{item.rate}%</span>
                </span>
              ))}
            </span>
          </>
        ) : (
          <span className="text-base text-muted-foreground">
            You have no weak error type yet, so this starts a random passage. Pick an error type to practice it now.
          </span>
        )}
        <span className="mt-auto flex h-9 w-fit items-center gap-2 bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform duration-200 group-hover:-translate-y-0.5">
          Start <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
        </span>
      </button>
      <section aria-label="Error types" className={cn(frame, 'px-6 py-3')}>
        <ul className="flex flex-col">
          {profile.types.map((item) => (
            <ErrorTypeCard key={item.type} item={item} profile={profile} locked={locked} onSelect={() => onPick(item.type)} />
          ))}
        </ul>
      </section>
    </div>
  );
};
