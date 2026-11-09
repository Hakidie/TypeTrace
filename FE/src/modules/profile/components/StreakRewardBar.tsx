import { Check, Coins, Flame } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useClaimStreakReward, useStreak } from '../hooks/use-profile';

/**
 * The learner's streak and today's reward, one quiet line under the mode tabs of Practice and Placement (the page they land
 * on): what today's first counted session gives, a button to claim it once it is due (when the result page's dialog was
 * closed), or that it is claimed. Draws nothing until the streak is loaded, or when it cannot be read.
 */
export const StreakRewardBar = () => {
  const { data: streak } = useStreak();
  const claim = useClaimStreakReward();
  if (!streak) return null;

  const { current, today } = streak;
  const { coins, claimed } = today.reward;
  const due = today.sessions > 0 && !claimed;

  return (
    <section
      aria-label="Streak and daily reward"
      data-tutorial="streak-reward"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-muted-foreground"
    >
      <span className="inline-flex items-center gap-1.5">
        <Flame className={cn('size-5', current > 0 ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
        {current > 0 ? (
          <>
            <span className="font-semibold text-foreground tabular-nums">{current}</span> ngày streak
          </>
        ) : (
          'Bắt đầu streak hôm nay'
        )}
      </span>
      {claimed ? (
        <span className="inline-flex items-center gap-1.5">
          <Check className="size-4 text-primary" aria-hidden="true" /> Đã nhận {coins} xu hôm nay
        </span>
      ) : due ? (
        <Button size="sm" className="h-8 gap-1.5" onClick={() => claim.mutate()} disabled={claim.isPending}>
          <Coins className="size-4" aria-hidden="true" /> Nhận {coins} xu
        </Button>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <Coins className="size-4 text-primary" aria-hidden="true" />
          {current > 0 ? 'Gõ xong 1 phiên hôm nay để giữ streak và nhận' : 'Gõ xong 1 phiên để nhận'}
          <span className="font-semibold text-primary tabular-nums">{coins} xu</span>
        </span>
      )}
    </section>
  );
};
