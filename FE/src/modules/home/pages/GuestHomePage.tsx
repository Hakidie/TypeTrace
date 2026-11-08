import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { BrandFooter } from '@/shared/components/layout/BrandFooter';
import { BrandHeader } from '@/shared/components/layout/BrandHeader';
import { redGlassTheme } from '@/shared/lib/red-glass-theme';
import { TypingArea } from '@/modules/typing/components/TypingArea';
import { GuestResult } from '../components/GuestResult';
import { GUEST_TIME_LIMIT_SECONDS, pickGuestPassage } from '../lib/guest-passages';
import { summarizeGuestRun, type GuestRun } from '../lib/guest-result';

/**
 * The home page for someone who is not signed in: a one-minute typing test that runs only in the browser. It never calls
 * the API (no session, no saved result, no rating), like Ping's practice duel; the result invites the guest to register.
 */
export const GuestHomePage = () => {
  const [passage, setPassage] = useState(() => pickGuestPassage());
  const [run, setRun] = useState<GuestRun>();

  const tryAgain = () => {
    setPassage(pickGuestPassage(passage.index));
    setRun(undefined);
  };

  const finish = (typedWords: string[], typedAtMs: number[]) => {
    // A run that typed every word ends when the last word was finished, one that ran out of time lasted the whole minute.
    const finishedAll = typedWords.length >= passage.words.length;
    const durationMs = finishedAll ? (typedAtMs.at(-1) ?? 0) : GUEST_TIME_LIMIT_SECONDS * 1000;
    setRun(summarizeGuestRun(passage.words, typedWords, durationMs));
  };

  return (
    <div className={`flex min-h-screen flex-col overflow-x-clip ${redGlassTheme}`}>
      <BrandHeader to="/">
        <Button asChild variant="ghost">
          <Link to="/login">Login</Link>
        </Button>
        <Button asChild variant="destructive">
          <Link to="/register">Register</Link>
        </Button>
      </BrandHeader>

      <main className="mx-auto flex min-h-[calc(100vh-61px)] w-full max-w-7xl flex-col px-4 pb-8 pt-12">
        {run ? (
          <GuestResult run={run} onTryAgain={tryAgain} />
        ) : (
          <>
            <p className="text-center text-muted-foreground">
              Try a one-minute typing test. You do not need an account, and nothing is saved.
            </p>
            <TypingArea
              key={passage.index}
              targetWords={passage.words}
              timeLimitSeconds={GUEST_TIME_LIMIT_SECONDS}
              onFinish={finish}
              onTimeUp={() => setRun(summarizeGuestRun(passage.words, [], GUEST_TIME_LIMIT_SECONDS * 1000))}
            />
          </>
        )}
      </main>

      <BrandFooter />
    </div>
  );
};
