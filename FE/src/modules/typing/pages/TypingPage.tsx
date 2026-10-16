import { RotateCcw } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Button } from '@/shared/components/ui/button';
import { redGlassTheme } from '@/shared/lib/red-glass-theme';
import { TypingArea } from '../components/TypingArea';
import { useBeginSession, useCompleteSession, useStartSession } from '../hooks/use-typing';
import type { SessionMode } from '../types/typing.types';

// Same look as the login and register pages (shared/lib/red-glass-theme.ts). The passage shows as soon as the page
// opens; the timer starts at the first key (TypingArea tells the server through `begin`).
export const TypingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // `/typing?mode=placement` types the placement test passage (Start on the placement intro page opens it).
  const mode: SessionMode = searchParams.get('mode') === 'placement' ? 'placement' : 'practice';
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
    <div className={`flex flex-1 flex-col gap-4 p-4 pb-0 md:p-8 md:pb-0 ${redGlassTheme}`}>
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
