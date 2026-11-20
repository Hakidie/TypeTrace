import { ArrowRight, ChevronDown, Lock } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorTypeCard } from '@/modules/profile/components/ErrorTypeCard';
import { useErrorProfile } from '@/modules/profile/hooks/use-profile';
import { ErrorState } from '@/shared/components/error-state';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { practiceButtonClass } from '@/shared/lib/panel-styles';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { LoadingState } from '@/shared/components/loading-state';
import type { SessionErrorType, TypingLanguage } from '@/shared/lib/typing-language';
import { TypingPreview } from './TypingPreview';
import { errorLabels, WEAK_SPOTS_FOCUS_TYPES } from '../typing.config';

/** What a Weak spots card starts: the learner's error types with the highest error rates (`auto`, US3.2) or one error type (SCRUM-74). */
export type WeakSpotsFocus = 'auto' | SessionErrorType;

/**
 * A sentence for each error type, in its language, to show what a lesson looks like: the words between asterisks are the ones
 * that train the type (any word for the letters, as the server picks them).
 */
const EXAMPLES: Record<SessionErrorType, string> = {
  BASE_LETTER: 'Chiều nay *chị* *trồng* *rau* *sạch* sau *sân*. *Trời* *xanh*, nắng *chảy* *xuống* mái nhà.',
  D_MISSING: '*Đêm* qua *đàn* chim *đã* bay *đi* thật xa. *Đường* về nhà *đầy* *đom* *đóm* *đẹp* lắm.',
  MARK_WRONG: 'Ông *bước* ra *sân*, *ngắm* *cơn* *mưa* *rơi*. Gió *thổi* qua *những* *đồng* *xuân*.',
  TONE_WRONG: 'Trời *đẹp*, em *đạp* xe *qua* *cầu* thật *nhanh*. Chiều *về*, mẹ *nấu* *cơm* *thơm* *ngon*.',
  HOI_NGA_CONFUSION: 'Chị *sẽ* *vẽ* một bức tranh, rồi *nghỉ* *ngơi* một lát. Mỗi sáng, em *cũng* *giữ* gìn sức *khỏe*.',
  LETTER_WRONG: 'Every *morning* *Lan* *walks* *along* the *river* and *counts* the *boats* *passing* by.',
  LETTER_MISSING: 'The *little* *kitten* *jumped* *across* the *garden* *fence* and *chased* a *yellow* *butterfly*.',
  LETTER_EXTRA: 'We *packed* *bread*, *apples* and *water* for the *long* *walk* up the *green* *hill*.',
  LETTERS_SWAPPED: 'The *bright* *stars* *shine* *over* the *quiet* *town* while *everyone* *sleeps*.',
  CASE_WRONG: '*On* *Monday*, *Lan* and *Minh* took the train to *Hanoi* with *Mr.* *Brown*.',
  PUNCTUATION_WRONG: '*"Wait,"* said *Minh.* *"It\'s* *late,* *isn\'t* *it?"* Lan *nodded.*',
};

interface WeakSpotsModeProps {
  /** The learner's plan has no Weak spots (`canCreateErrorPractice`): the cards show a lock and open the plan. */
  locked: boolean;
  /** The language the learner types (SCRUM-319): the cards show its error profile, and its lessons are typed in it. */
  language: TypingLanguage;
  /** The button that switches the language typed (and the interface), as in Practice: under "Practice on one error". */
  languageSwitch?: ReactNode;
  onPick: (focus: WeakSpotsFocus) => void;
}

/**
 * The Weak spots tab before a lesson: on top the auto lesson (US3.2), which names the error types it will train (the
 * learner's highest error rates among the types with enough data, weak or not, from their error profile, as the server picks
 * them) and their rates, or says that a random passage comes while the profile has no type with enough data; below it, in a grid of three columns, the
 * error types (SCRUM-74), the cards of the Profile's error profile, each starting a lesson of its own type, also before it
 * has enough data. On phones the auto lesson is on top. The error profile of the language the learner types (SCRUM-319: the
 * five Vietnamese or the six English types), which the language button under the auto lesson switches.
 */
export const WeakSpotsMode = ({ locked, language, languageSwitch, onPick }: WeakSpotsModeProps) => {
  const { t } = useTranslation('typing');
  const errorProfile = useErrorProfile(language);
  // The error types stay under the auto lesson until "Practice on one error" is pressed: the lesson fills the screen on its own.
  const [showTypes, setShowTypes] = useState(false);
  const typesRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (showTypes) typesRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [showTypes]);
  if (errorProfile.isPending) return <LoadingState rows={3} />;
  if (errorProfile.isError) return <ErrorState error={errorProfile.error} onRetry={() => void errorProfile.refetch()} />;

  const profile = errorProfile.data;
  const focus = profile.rankedTypes.slice(0, WEAK_SPOTS_FOCUS_TYPES).map((type) => profile.types.find((item) => item.type === type)!);

  const title = !focus.length ? t('weakSpots.titleNone') : focus.length === 1 ? t('weakSpots.titleOne') : t('weakSpots.titleMany', { count: focus.length });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 py-4">
      {/* The first panel: the auto lesson and the button that shows the error types. It stretches to fit the screen (the room the page leaves). */}
      <div className={cn('flex flex-1 flex-col gap-6', showTypes && 'min-h-[calc(100svh-14rem)]')}>
        <button
          type="button"
          onClick={() => onPick('auto')}
          aria-label={`${t('weakSpots.ariaStart')}${locked ? t('weakSpots.premiumSuffix') : ''}`}
          className="group flex flex-1 flex-col justify-center gap-12 text-left transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
        >
          <span className="relative flex items-center justify-center">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-2xl text-muted-foreground">{title}</span>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start">
                  {t('weakSpots.tip')}
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
              <TypingPreview text={focus.map((item) => EXAMPLES[item.type]).join(' ')} />
            ) : (
              <span className="flex-1 text-center text-base text-muted-foreground">
                {t('weakSpots.noData')}
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
          <span className="flex h-9 w-fit items-center gap-2 self-center bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform duration-200 group-hover:-translate-y-0.5">
            {t('weakSpots.start')} <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
          </span>
        </button>
        <div className="flex flex-col items-center gap-2">
          <Button
            variant="ghost"
            className="group h-auto px-4 py-2 text-[1.125rem] text-muted-foreground"
            aria-expanded={showTypes}
            onClick={() => setShowTypes((shown) => !shown)}
          >
            {t('weakSpots.oneError')} <ChevronDown className={cn('ml-2 size-5 transition-transform duration-200', showTypes && 'rotate-180')} aria-hidden />
          </Button>
          {languageSwitch}
        </div>
      </div>
      {showTypes && (
        <section ref={typesRef} aria-label={t('weakSpots.errorTypes')} className="scroll-mt-4">
          <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {profile.types.map((item) => (
              <ErrorTypeCard
                key={item.type}
                item={item}
                profile={profile}
                locked={locked}
                onSelect={() => onPick(item.type)}
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    className={practiceButtonClass}
                    aria-label={`${t('weakSpots.practiceThisAria', { type: errorLabels[item.type] })}${locked ? t('weakSpots.premiumSuffix') : ''}`}
                    onClick={() => onPick(item.type)}
                  >
                    {locked && <Lock className="size-4" aria-hidden />} {t('weakSpots.practiceThis')}
                  </Button>
                }
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
