import { RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { redGlassTheme } from '@/shared/lib/red-glass-theme';
import { TypingArea } from '../components/TypingArea';
import { useBeginSession, useCompleteSession, useStartSession } from '../hooks/use-typing';
import type { SessionMode } from '../types/typing.types';

// Same frame as the chat button and the word count / timer at the bottom of the page.
const chipClass = 'inline-flex h-auto items-center gap-2 bg-primary/15 px-3 py-1.5 text-[1.125rem] text-primary';

// Rank has no session mode yet, so its tab is only shown.
const modeTabs = [
  { value: 'practice', label: 'Practice' },
  { value: 'placement', label: 'Placement' },
  { value: 'rank', label: 'Rank', disabled: true },
];

// The time choices are only shown for now: the session still lasts the usual limit.
const timeOptions = [
  { value: '1', label: '1m' },
  { value: '2', label: '2m' },
  { value: '3', label: '3m' },
];

interface TabGroupProps {
  label: string;
  tabs: { value: string; label: string; disabled?: boolean }[];
  value: string;
  onChange: (value: string) => void;
}

/** A row of switch buttons, same look as the Theme tabs in Settings (the border is an inside outline so the height is the same as the word count's). */
const TabGroup = ({ label, tabs, value, onChange }: TabGroupProps) => (
  <div role="radiogroup" aria-label={label} className="flex text-[1.125rem] outline outline-1 -outline-offset-1 outline-border">
    {tabs.map((tab) => (
      <button
        key={tab.value}
        type="button"
        role="radio"
        aria-checked={value === tab.value}
        disabled={tab.disabled}
        onClick={() => onChange(tab.value)}
        className={cn(
          'px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          value === tab.value ? 'bg-primary/15 text-primary' : 'text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground',
        )}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

// Same look as the login and register pages (shared/lib/red-glass-theme.ts). The passage shows as soon as the page
// opens; the timer starts at the first key (TypingArea tells the server through `begin`).
export const TypingPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // `/typing?mode=placement` types the placement test passage (Start on the placement intro page opens it).
  const mode: SessionMode = searchParams.get('mode') === 'placement' ? 'placement' : 'practice';
  const [minutes, setMinutes] = useState('3');
  const start = useStartSession();
  const begin = useBeginSession();
  const complete = useCompleteSession();
  const session = start.data;

  // A new session when the page opens or the mode changes (once per mode, even when React runs effects twice in development).
  const openedFor = useRef<SessionMode | null>(null);
  useEffect(() => {
    if (openedFor.current === mode) return;
    openedFor.current = mode;
    start.mutate({ mode });
  }, [mode, start]);

  const finish = (typedWords: string[]) => {
    if (!session) return;
    complete.mutate(
      { id: session._id, typedWords },
      { onSuccess: (done) => navigate(`/typing/result/${done._id}`) },
    );
  };

  return (
    <div className={`flex flex-1 flex-col gap-4 p-4 pb-0 pt-0 md:p-8 md:pb-0 md:pt-0 ${redGlassTheme}`}>
      {/* Top center: the name of the passage being typed on the left, the mode tabs in the exact center of the page and the time tabs on the right. */}
      <div className="flex flex-col items-center gap-2 md:grid md:gap-x-2 md:grid-cols-[1fr_auto_1fr]">
        <span className={`${chipClass} md:justify-self-end`}>{session?.passageTitle ?? '—'}</span>
        <TabGroup label="Mode" tabs={modeTabs} value={mode} onChange={(value) => setSearchParams(value === 'practice' ? {} : { mode: value })} />
        <div className="md:justify-self-start">
          <TabGroup label="Time" tabs={timeOptions} value={minutes} onChange={setMinutes} />
        </div>
      </div>
      {session ? (
        <TypingArea
          key={session._id}
          targetWords={session.targetWords}
          disabled={complete.isPending}
          onStart={() => begin.mutate(session._id)}
          onFinish={finish}
          onTimeUp={() => start.mutate({ mode })}
          actions={
            <Button
              variant="ghost"
              className="h-auto gap-2 px-4 py-2 text-[1.125rem] text-muted-foreground"
              onClick={() => start.mutate({ mode })}
              disabled={start.isPending || complete.isPending}
            >
              <RotateCcw className="size-5" /> Restart
            </Button>
          }
        />
      ) : (
        <div className="mx-auto my-auto w-full max-w-7xl">
          {start.isError ? <ErrorState error={start.error} onRetry={() => start.mutate({ mode })} /> : <LoadingState rows={2} />}
        </div>
      )}
    </div>
  );
};
