import { useEffect } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Panel } from '@/shared/components/panel';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { cn } from '@/shared/lib/utils';
import { useSaveFontFamily, useSettings } from '../hooks/use-settings';
import { FONT_OPTIONS } from '../lib/fonts';

const description = 'Choose the font of the whole interface. It applies at once and goes with your account.';

/** In Settings, the Font tab: the font of the whole interface (SCRUM-158), each choice shown in its own font. */
export const FontSettings = () => {
  const { isLoading, error, refetch } = useCurrentUser();
  const { fontFamily } = useSettings();
  const save = useSaveFontFamily();

  // Every row is drawn in its own font, so the files of all of them load while this tab is open.
  useEffect(() => {
    for (const option of FONT_OPTIONS) void option.load().catch(() => undefined);
  }, []);

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading) return <LoadingState rows={3} />;

  return (
    <Panel title="Font" titleTip={description} bare titleClassName={sectionTitleClass} className="flex flex-col gap-4 pt-3">
      <p className="text-lg text-muted-foreground">{description}</p>
      <div role="radiogroup" aria-label="Interface font" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {FONT_OPTIONS.map((option) => {
          const checked = option.id === fontFamily;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={save.isPending}
              onClick={() => !checked && save.mutate(option.id)}
              style={{ fontFamily: option.stack }}
              className={cn(
                'truncate border px-3 py-2 text-center text-lg transition-colors hover:border-destructive/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                checked ? 'border-primary text-primary' : 'border-border text-muted-foreground',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </Panel>
  );
};
