import { useMemo } from 'react';
import { TypingArea } from '@/modules/typing/components/TypingArea';
import { useSendProgress } from '../hooks/use-match';
import type { PublicMatch, RaceResume } from '../types/ranked.types';
import { Countdown } from './Countdown';
import { LoadingRing } from './LoadingRing';
import { RaceLanes } from './RaceLanes';

/** Seconds left in the race by the server's end time (at least 1, so the typing area never starts already over). */
const secondsUntil = (endsAt?: string) => (endsAt ? Math.max(1, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)) : 180);

/**
 * The countdown, then the race: the lanes on top, the passage of the match to type below. Each finished word is sent to
 * the server (which grades it and streams it to the opponent); the last one is sent with `done`. After a reload, `resume`
 * (the words the server kept) fills the typing area again so the race goes on from there.
 */
export const RaceView = ({ match, myId, resume }: { match: PublicMatch; myId?: string; resume?: RaceResume }) => {
  const sendProgress = useSendProgress();
  // Once per race: the typing area counts its own seconds, so a limit recomputed on every update would shrink twice as fast.
  const timeLimitSeconds = useMemo(() => secondsUntil(match.endsAt), [match.endsAt]);
  const me = match.players.find((player) => player.userId === myId);
  const send = (typedWords: string[], typedAtMs: number[], done?: boolean) =>
    sendProgress.mutate({ code: match.code, input: done ? { typedWords, typedAtMs, done } : { typedWords, typedAtMs } });

  return (
    <div className="flex flex-1 flex-col gap-4">
      <RaceLanes match={match} myId={myId} />
      {match.status === 'countdown' && match.countdownEndsAt && (
        <div className="my-auto">
          <Countdown endsAt={match.countdownEndsAt} />
        </div>
      )}
      {match.status === 'running' && me?.finished && (
        <LoadingRing label="Finished — waiting for your opponent" className="my-auto text-xl text-primary" />
      )}
      {match.status === 'running' && !me?.finished && match.targetWords && (
        <TypingArea
          // The kept words arrive with the stream, a moment after the area shows: it starts again with them.
          key={`${match.code}:${resume?.typedWords.length ?? 0}`}
          initialTyped={resume}
          targetWords={match.targetWords}
          timeLimitSeconds={timeLimitSeconds}
          onProgress={(typedWords, typedAtMs) => send(typedWords, typedAtMs)}
          onFinish={(typedWords, typedAtMs) => send(typedWords, typedAtMs, typedWords.length === match.targetWords!.length)}
        />
      )}
    </div>
  );
};
