import { Grid3x3 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Panel } from '@/shared/components/panel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { cn } from '@/shared/lib/utils';
import { useVowelTone } from '../hooks/use-progress';
import { cellRate, TONES, toneLetter, VOWELS, worstRate } from '../lib/vowel-tone';
import type { VowelToneCell, VowelToneGridData } from '../types/progress.types';

// The color of a cell: the theme's accent, from faint to full as the rate goes from 0 to the worst cell of the grid. No other color.
const heat = (rate: number, worst: number) => `color-mix(in srgb, var(--primary) ${Math.round(12 + (rate / worst) * 78)}%, transparent)`;

const CellTip = ({ cell, minSeen }: { cell: VowelToneCell; minSeen: number }) => {
  const rate = cellRate(cell, minSeen);
  return (
    <div className="space-y-1">
      <p className="font-medium">
        {cell.vowel} + {TONES.find((tone) => tone.id === cell.tone)!.label.toLowerCase()} ({toneLetter(cell.vowel, cell.tone)})
      </p>
      <p>
        Seen: {cell.seen} · Wrong: {cell.wrong}
        {rate !== null && ` · ${rate}%`}
      </p>
      {rate === null ? (
        <p className="text-muted-foreground">Not enough data yet: needs {minSeen} sightings.</p>
      ) : (
        cell.examples.length > 0 && <p className="text-muted-foreground">Typed wrong: {cell.examples.map((example) => `${example.target} → ${example.typed}`).join(', ')}</p>
      )}
    </div>
  );
};

/** One cell of the grid: the letter and its error rate, colored by the rate; grey while the data is too thin. */
const GridCell = ({ cell, minSeen, worst }: { cell: VowelToneCell; minSeen: number; worst: number }) => {
  const rate = cellRate(cell, minSeen);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${toneLetter(cell.vowel, cell.tone)}: ${rate === null ? 'not enough data' : `${rate}% wrong`}`}
          style={rate === null ? undefined : { backgroundColor: heat(rate, worst) }}
          className={cn(
            'flex h-full min-h-11 min-w-0 flex-col items-center justify-center leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            rate === null ? 'bg-muted text-muted-foreground hover:bg-muted/70' : 'text-foreground hover:ring-1 hover:ring-primary',
          )}
        >
          <span className="text-lg">{toneLetter(cell.vowel, cell.tone)}</span>
          <span className="text-xs">{rate === null ? '–' : `${rate}%`}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="whitespace-normal">
        <CellTip cell={cell} minSeen={minSeen} />
      </TooltipContent>
    </Tooltip>
  );
};

/** The grid and its legend side by side, centered together. */
const GridView = ({ data }: { data: VowelToneGridData }) => {
  const { minSeen } = data;
  const byKey = new Map(data.cells.map((cell) => [`${cell.vowel}:${cell.tone}`, cell]));
  const worst = worstRate(data.cells, minSeen);
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 gap-4">
      <TooltipProvider delayDuration={100}>
        <div
          className="grid min-h-0 w-full min-w-0 flex-1 grid-cols-[2.5rem_repeat(6,minmax(0,1fr))] grid-rows-[auto_repeat(12,minmax(2.75rem,1fr))] gap-1"
          role="group"
          aria-label="Error rate of each vowel with each tone"
        >
          <span aria-hidden />
          {TONES.map((tone) => (
            <span key={tone.id} className="py-1 text-center text-sm text-muted-foreground">
              {tone.label}
            </span>
          ))}
          {VOWELS.map((vowel) => (
            <div key={vowel} className="contents">
              <span className="flex items-center justify-center text-lg font-medium text-primary">{vowel}</span>
              {TONES.map((tone) => (
                <GridCell key={tone.id} cell={byKey.get(`${vowel}:${tone.id}`)!} minSeen={minSeen} worst={worst} />
              ))}
            </div>
          ))}
        </div>
      </TooltipProvider>

      {/* The legend, always vertical on the right of the grid (a phone too): 0% on top down to the worst rate, and the grey meaning written along it. */}
      <div className="flex w-10 shrink-0 flex-col items-center justify-center gap-6 text-sm text-muted-foreground">
        <span className="inline-flex flex-col items-center gap-2">
          0%
          <span
            aria-hidden
            style={{ '--low': heat(0, worst), '--high': heat(worst, worst) } as CSSProperties}
            className="h-32 w-3 bg-[linear-gradient(to_bottom,var(--low),var(--high))]"
          />
          {worst}%
        </span>
        <span className="inline-flex flex-col items-center gap-2">
          <span aria-hidden className="size-3 shrink-0 bg-muted" />
          <span className="whitespace-nowrap [writing-mode:vertical-rl]">Fewer than {minSeen} sightings: not enough data</span>
        </span>
      </div>
    </div>
  );
};

/**
 * The vowel × tone grid (SCRUM-29, `GET /api/profile/vowel-tone`): 12 vowels × 6 tones, each cell colored by how often that letter
 * was typed wrong in the learner's last counted Vietnamese sessions; a cell seen fewer than `minSeen` times (the backend's number) is grey.
 * On a large screen the page is as tall as the screen leaves it: the rows share the height (`1fr`, at least 2.75rem), so the spacing grows and shrinks with it.
 * It is a page of its own: the Progress page shows it with the button under it.
 */
export const VowelToneGrid = () => {
  const { data, isPending, isError, error, refetch } = useVowelTone();

  const content = () => {
    if (isPending) return <LoadingState rows={6} />;
    if (isError) return <ErrorState error={error} title="Could not load the vowel × tone grid" onRetry={() => void refetch()} />;
    if (data.sessionsUsed === 0) {
      return <EmptyState icon={Grid3x3} title="No counted Vietnamese sessions yet" description="Your grid starts with your first counted session." />;
    }
    return <GridView data={data} />;
  };

  return (
    <section aria-label="Vowel × tone" aria-busy={isPending} className="flex min-h-0 flex-1 flex-col">
      {/* PANEL Vowel × tone */}
      <Panel
        title="Vowel × tone"
        titleTip={data && `How often each vowel with each tone was typed wrong in your last ${data.window} counted Vietnamese sessions. Hover a cell for the details.`}
        bare
        fill
        titleClassName={sectionTitleClass}
        className="gap-4"
      >
        {content()}
      </Panel>
    </section>
  );
};
