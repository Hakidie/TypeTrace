import { Languages, Lock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlanDialog } from '@/modules/plan/components/PlanDialog';
import { usePlan } from '@/modules/plan/hooks/use-plan';
import { errorLabels, languageNames } from '@/modules/typing/typing.config';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { PanelTitleSwitch } from '@/shared/components/panel-title-switch';
import { Panel } from '@/shared/components/panel';
import { CompactToolbar } from '@/shared/components/compact-toolbar';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { practiceButtonClass, sectionTitleClass } from '@/shared/lib/panel-styles';
import type { TypingLanguage } from '@/shared/lib/typing-language';
import type { WordErrorType } from '@/shared/lib/vietnamese-errors';
import { useErrorProfile } from '../hooks/use-profile';
import { ErrorTypeCard } from './ErrorTypeCard';

const linkClass = 'text-primary underline-offset-4 hover:underline';
// One column on phones, two from `md`, three from `lg`, like the daily tasks. `grid-cols-1` keeps the phone column at the
// width of the screen.
const gridClass = 'grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3';
// Blank error types while the profile loads: a row of them on wide screens.
const BLANK_TYPES = 3;

interface PracticeButtonProps {
  type: WordErrorType;
  /** The learner's plan has no Train (`canCreateErrorPractice`): a lock, and a click opens the plan. */
  locked: boolean;
  onLocked: () => void;
}

/**
 * "Practice this error" under an error type (SCRUM-274): a link to the Train lesson of that type (US3.2, the lesson of its card
 * in the Train tab), also for a type without enough data yet, whose lesson says so. Its name says the type.
 */
const PracticeButton = ({ type, locked, onLocked }: PracticeButtonProps) => {
  const name = `Practice this error: ${errorLabels[type]}${locked ? ' (Premium)' : ''}`;
  if (locked) {
    return (
      <Button variant="outline" size="sm" className={practiceButtonClass} aria-label={name} onClick={onLocked}>
        <Lock className="size-4" aria-hidden /> Practice this error
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="sm" className={practiceButtonClass}>
      <Link to={`/typing?mode=targeted&focus=${type}`} aria-label={name}>
        Practice this error
      </Link>
    </Button>
  );
};

/**
 * The learner's error profile (SCRUM-27), under the heatmap and without a frame: each error type of their last counted
 * sessions of their typing language (SCRUM-219: the set of that language, which the texts name) with its error rate, its
 * level (weak, OK, or what it needs first) and its trend against the sessions before, as the backend works them out
 * (`useErrorProfile`); the thresholds come with the answer. In the Vietnamese profile each type has a button that practices
 * it (SCRUM-274; on a plan without Train it opens the plan instead); the English one has none, since the Train lessons are
 * Vietnamese. While it loads, blank items hold their place; when it fails, the reason and a retry on one line; before the
 * first counted session, one muted line. With `onSwitch` a button next to the title shows another panel in its place
 * (`switchTo`, My Sessions by default) (`PanelTitleSwitch`, the Progress page).
 */
export const ProfileErrorProfile = ({ onSwitch, switchTo = 'My Sessions' }: { onSwitch?: () => void; switchTo?: string } = {}) => {
  // The language shown: the learner's own until they press the switch (a view only, the account's typing language is not saved).
  const [picked, setPicked] = useState<TypingLanguage>();
  const errorProfile = useErrorProfile(picked);
  const shown: TypingLanguage = picked ?? errorProfile.data?.language ?? 'vi';
  const other: TypingLanguage = shown === 'vi' ? 'en' : 'vi';
  // The profile is the one of the language shown (SCRUM-219): "English sessions".
  const language = languageNames[shown];
  // As on the Train tab: locked once the plan says so; while it loads (or if it fails) the lesson page decides.
  const plan = usePlan();
  const locked = plan.data !== undefined && !plan.data.canCreateErrorPractice;
  const [planOpen, setPlanOpen] = useState(false);

  const renderBody = () => {
    if (errorProfile.isPending) {
      return (
        <div className={gridClass}>
          {Array.from({ length: BLANK_TYPES }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      );
    }
    if (errorProfile.isError) {
      return (
        <p role="alert" className="text-base text-muted-foreground">
          <span className="text-destructive">Error profile could not load.</span> {getApiErrorMessage(errorProfile.error, 'Please try again.')} ·{' '}
          <button type="button" onClick={() => void errorProfile.refetch()} className={linkClass}>
            Try again
          </button>
        </p>
      );
    }
    if (errorProfile.data.sessionsUsed === 0) {
      return <p className="text-base text-muted-foreground">No counted {language} sessions yet: your error profile starts with your first one.</p>;
    }
    // Only the Vietnamese types can be practiced: the Train lessons are made of the Vietnamese word bank.
    const practicable = errorProfile.data.language === 'vi';
    return (
      <ul className={gridClass}>
        {errorProfile.data.types.map((item) => (
          <ErrorTypeCard
            key={item.type}
            item={item}
            profile={errorProfile.data}
            action={practicable && <PracticeButton type={item.type as WordErrorType} locked={locked} onLocked={() => setPlanOpen(true)} />}
          />
        ))}
      </ul>
    );
  };

  return (
    <section aria-label="Error profile" aria-busy={errorProfile.isPending}>
      {/* PANEL Error profile */}
      <Panel
        title="Error profile"
        titleAction={onSwitch && <PanelTitleSwitch other={switchTo} onClick={onSwitch} />}
        titleTip={
          errorProfile.data &&
          `Your last ${errorProfile.data.window} counted ${language} sessions: a type is weak from ${errorProfile.data.weakRate}% wrong, and its trend compares them with the ${errorProfile.data.window} sessions before. Use the language button to see the other language.`
        }
        bare
        titleClassName={sectionTitleClass}
        className="space-y-4"
        actions={
          <CompactToolbar
            buttons={[
              {
                label: `Error profile language: ${language}. Switch to ${languageNames[other]}`,
                icon: Languages,
                valueLabel: language,
                onClick: () => setPicked(other),
              },
            ]}
          />
        }
      >
        {renderBody()}
      </Panel>
      {/* Mounted only while open, as on the plan badge. */}
      {planOpen && <PlanDialog open onOpenChange={setPlanOpen} />}
    </section>
  );
};
