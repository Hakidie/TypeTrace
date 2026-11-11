import { languageNames } from '@/modules/typing/typing.config';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { Panel } from '@/shared/components/panel';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { useErrorProfile } from '../hooks/use-profile';
import { ErrorTypeCard } from './ErrorTypeCard';

const linkClass = 'text-primary underline-offset-4 hover:underline';
// One column on phones, two from `md`, three from `lg`, like the daily tasks. `grid-cols-1` keeps the phone column at the
// width of the screen.
const gridClass = 'grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3';
// Blank error types while the profile loads: a row of them on wide screens.
const BLANK_TYPES = 3;

/**
 * The learner's error profile (SCRUM-27), under the heatmap and without a frame: each error type of their last counted
 * sessions of their typing language (SCRUM-219: the set of that language, which the texts name) with its error rate, its
 * level (weak, OK, or what it needs first) and its trend against the sessions before, as the backend works them out
 * (`useErrorProfile`); the thresholds come with the answer. While it loads, blank items hold their place; when it fails,
 * the reason and a retry on one line; before the first counted session, one muted line.
 */
export const ProfileErrorProfile = () => {
  const errorProfile = useErrorProfile();
  const used = errorProfile.data?.sessionsUsed ?? 0;
  // The profile is the one of the learner's typing language (SCRUM-219): "English sessions".
  const language = languageNames[errorProfile.data?.language ?? 'vi'];

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
    return (
      <ul className={gridClass}>
        {errorProfile.data.types.map((item) => (
          <ErrorTypeCard key={item.type} item={item} profile={errorProfile.data} />
        ))}
      </ul>
    );
  };

  return (
    <section aria-label="Error profile" aria-busy={errorProfile.isPending}>
      {/* PANEL Error profile */}
      <Panel
        title="Error profile"
        titleTip={
          errorProfile.data &&
          `Your last ${errorProfile.data.window} counted ${language} sessions: a type is weak from ${errorProfile.data.weakRate}% wrong, and its trend compares them with the ${errorProfile.data.window} sessions before. Switch VI / EN in Practice to see the other language.`
        }
        bare
        titleClassName={sectionTitleClass}
        className="space-y-4"
        actions={used > 0 && <p className="text-base text-muted-foreground">Last {used} counted {language} {used === 1 ? 'session' : 'sessions'}</p>}
      >
        {renderBody()}
      </Panel>
    </section>
  );
};
