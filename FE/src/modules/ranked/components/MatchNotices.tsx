import { Flag, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Button } from '@/shared/components/ui/button';
import { useLeaveMatch } from '../hooks/use-match';
import type { PublicMatch } from '../types/ranked.types';

/** Now, every second while someone is away (the seconds before their DNF count down). */
const useNow = (ticking: boolean) => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
};

interface MatchNoticesProps {
  match: PublicMatch;
  myId?: string;
  /** Whether the own stream is open. */
  connected: boolean;
  /** The players whose stream dropped, with when they do not finish (DNF). */
  away: Record<string, string>;
}

/**
 * Above a running duel (SCRUM-154): the own lost connection while the stream comes back, the other player's lost
 * connection with the seconds before their DNF, and Forfeit (after a confirmation: leaving is a DNF, a lost match).
 */
export const MatchNotices = ({ match, myId, connected, away }: MatchNoticesProps) => {
  const [confirming, setConfirming] = useState(false);
  const leave = useLeaveMatch();
  const awayPlayers = match.players.filter((player) => player.userId !== myId && away[player.userId]);
  const now = useNow(awayPlayers.length > 0);

  const notice = !connected
    ? 'Connection lost — reconnecting…'
    : awayPlayers
        .map((player) => {
          const seconds = Math.max(0, Math.ceil((Date.parse(away[player.userId]) - now) / 1000));
          return `${player.displayName} lost the connection: DNF in ${seconds} s unless they come back.`;
        })
        .join(' ');

  return (
    <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
      <div className="min-w-0 flex-1">
        {notice && (
          <p role="status" className="flex items-center gap-2 border border-primary/50 bg-primary/10 px-3 py-1.5 text-sm text-primary">
            <WifiOff className="size-4 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        )}
      </div>
      <Button variant="outline" size="sm" className="border-primary/40 text-primary" onClick={() => setConfirming(true)}>
        <Flag aria-hidden="true" />
        Forfeit
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Forfeit this match?"
        description="You will not finish (DNF): the match counts as a loss and your opponent wins."
        confirmLabel="Forfeit the match"
        cancelLabel="Keep playing"
        destructive
        pending={leave.isPending}
        onConfirm={() => leave.mutate(match.code, { onSuccess: () => setConfirming(false) })}
      />
    </div>
  );
};
