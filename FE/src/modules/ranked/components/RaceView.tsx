import { TypingArea } from '@/modules/typing/components/TypingArea';
import { useSendProgress } from '../hooks/use-match';
import type { PublicMatch } from '../types/ranked.types';
import { Countdown } from './Countdown';
import { RaceLanes } from './RaceLanes';

/** Seconds left in the race by the server's end time (at least 1, so the typing area never starts already over). */
const secondsUntil = (endsAt?: string) => (endsAt ? Math.max(1, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)) : 180);

/**
 * The countdown, then the race: the lanes on top, the passage of the match to type below. Each finished word is sent to
 * the server (which grades it and streams it to the opponent); the last one is sent with `done`.
 */
export const RaceView = ({ match, myId }: { match: PublicMatch; myId?: string }) => {
  const sendProgress = useSendProgress();
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
        <p className="my-auto text-center text-xl text-primary">Finished — waiting for your opponent</p>
      )}
      {match.status === 'running' && !me?.finished && match.targetWords && (
        <TypingArea
          key={match.code}
          targetWords={match.targetWords}
          timeLimitSeconds={secondsUntil(match.endsAt)}
          onProgress={(typedWords, typedAtMs) => send(typedWords, typedAtMs)}
          onFinish={(typedWords, typedAtMs) => send(typedWords, typedAtMs, typedWords.length === match.targetWords!.length)}
        />
      )}
    </div>
  );
};
