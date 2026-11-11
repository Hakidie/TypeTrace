import { ArrowRight, Lock } from 'lucide-react';
import { ErrorTypeCard } from '@/modules/profile/components/ErrorTypeCard';
import { useErrorProfile } from '@/modules/profile/hooks/use-profile';
import { ErrorState } from '@/shared/components/error-state';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { LoadingState } from '@/shared/components/loading-state';
import type { WordErrorType } from '@/shared/lib/vietnamese-errors';
import { TypingPreview } from './TypingPreview';
import { errorLabels, WEAK_SPOTS_FOCUS_TYPES } from '../typing.config';

/** What a Weak spots card starts: the learner's error types with the highest error rates (`auto`, US3.2) or one error type (SCRUM-74). */
export type WeakSpotsFocus = 'auto' | WordErrorType;

/** A sentence for each error type, to show what a lesson looks like: the words between asterisks are the ones that train the type. */
const EXAMPLES: Partial<Record<string, string>> = {
  BASE_LETTER: 'Chiều nay *chị* *trồng* *rau* *sạch* sau *sân*. *Trời* *xanh*, nắng *chảy* *xuống* mái nhà.',
  D_MISSING: '*Đêm* qua *đàn* chim *đã* bay *đi* thật xa. *Đường* về nhà *đầy* *đom* *đóm* *đẹp* lắm.',
  MARK_WRONG: 'Ông *bước* ra *sân*, *ngắm* *cơn* *mưa* *rơi*. Gió *thổi* qua *những* *đồng* *xuân*.',
  TONE_WRONG: 'Trời *đẹp*, em *đạp* xe *qua* *cầu* thật *nhanh*. Chiều *về*, mẹ *nấu* *cơm* *thơm* *ngon*.',
  HOI_NGA_CONFUSION: 'Chị *sẽ* *vẽ* một bức tranh, rồi *nghỉ* *ngơi* một lát. Mỗi sáng, em *cũng* *giữ* gìn sức *khỏe*.',
};

interface WeakSpotsModeProps {
  /** The learner's plan has no Weak spots (`canCreateErrorPractice`): the cards show a lock and open the plan. */
  locked: boolean;
  onPick: (focus: WeakSpotsFocus) => void;
}

/**
 * The Weak spots tab before a lesson: on top the auto lesson (US3.2), which names the error types it will train (the
 * learner's highest error rates among the types with enough data, weak or not, from their error profile, as the server picks
 * them) and their rates, or says that a random passage comes while the profile has no type with enough data; below it, in a grid of three columns, the
 * five error types (SCRUM-74), the cards of the Profile's error profile, each starting a lesson of its own type, also before it
 * has enough data. On phones the auto lesson is on top. Always the Vietnamese profile (SCRUM-219), whatever the learner types
 * in Practice: the lessons are made of the Vietnamese word bank, so its types are Vietnamese ones.
 */
export const WeakSpotsMode = ({ locked, onPick }: WeakSpotsModeProps) => {
  const errorProfile = useErrorProfile('vi');
  if (errorProfile.isPending) return <LoadingState rows={3} />;
  if (errorProfile.isError) return <ErrorState error={errorProfile.error} onRetry={() => void errorProfile.refetch()} />;

  const profile = errorProfile.data;
  const focus = profile.rankedTypes.slice(0, WEAK_SPOTS_FOCUS_TYPES).map((type) => profile.types.find((item) => item.type === type)!);

  const title = !focus.length ? 'Practice your weak spots' : focus.length === 1 ? 'Practice your most frequent error' : `Practice your ${focus.length} most frequent errors`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 py-4">
      <button
        type="button"
        onClick={() => onPick('auto')}
        aria-label={`Practice your weak spots${locked ? ' (Premium)' : ''}`}
        className="group flex flex-1 flex-col justify-center gap-12 text-left transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
      >
        <span className="relative flex items-center justify-center">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-2xl text-primary/80">{title}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start">
                A passage written for the error types you miss most.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {locked && (
            <span className="absolute right-0 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="size-4" aria-hidden /> Premium
            </span>
          )}
        </span>
        <span className="flex items-center">
          {focus.length ? (
            <TypingPreview text={focus.map((item) => EXAMPLES[item.type]).filter(Boolean).join(' ')} />
          ) : (
            <span className="flex-1 text-center text-base text-muted-foreground">
              Your error profile does not have enough data yet, so this starts a random passage. Pick an error type to practice it now.
            </span>
          )}
        </span>
        {focus.length > 0 && (
          <span className="flex flex-wrap justify-evenly gap-x-12 gap-y-6">
            {focus.map((item) => (
              <span key={item.type} className="flex items-start gap-4">
                <span className="max-w-40 pt-0.5 text-base leading-tight text-muted-foreground">{errorLabels[item.type]}</span>
                <span className="text-5xl font-extrabold tabular-nums leading-none text-primary">{item.rate}%</span>
              </span>
            ))}
          </span>
        )}
        <span className="flex h-9 w-fit items-center gap-2 self-end bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform duration-200 group-hover:-translate-y-0.5">
          Start <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
        </span>
      </button>
      <section aria-label="Error types">
        <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {profile.types.map((item) => (
            <ErrorTypeCard key={item.type} item={item} profile={profile} locked={locked} onSelect={() => onPick(item.type as WordErrorType)} />
          ))}
        </ul>
      </section>
    </div>
  );
};
