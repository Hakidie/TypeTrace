import { Coins } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lottie } from '@/shared/components/lottie';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/components/ui/dialog';
import { useClaimStreakReward, useStreak } from '../hooks/use-profile';

/**
 * The day's streak reward, on the result page: it opens once today has a counted session and the reward is not claimed.
 * "Nhận" gives the coins (`POST /api/profile/streak/reward`). Closed without claiming, it opens again on the next result
 * page of the day.
 */
export const StreakRewardDialog = () => {
  const { t } = useTranslation('profile');
  const { data: streak } = useStreak();
  const claim = useClaimStreakReward();
  const [closed, setClosed] = useState(false);

  const due = Boolean(streak && streak.today.sessions > 0 && !streak.today.reward.claimed);
  // After the claim the streak says `claimed`: the dialog stays open on the coins just given until it is closed.
  const open = !closed && (due || claim.isSuccess);
  if (!streak) return null;
  const coins = claim.data?.coins ?? streak.today.reward.coins;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && setClosed(true)}>
      <DialogContent className="flex flex-col items-center gap-3 text-center sm:max-w-sm">
        <Lottie name="fire-streak" className="size-20" />
        <DialogTitle className="text-2xl font-bold">{claim.isSuccess ? t('streak.claimedTitle') : t('streak.title')}</DialogTitle>
        <DialogDescription>
          {claim.isSuccess
            ? t('streak.claimed', { coins })
            : t('streak.due', { days: streak.current, coins })}
        </DialogDescription>
        {claim.isSuccess ? (
          <Button className="mt-2 w-full" onClick={() => setClosed(true)} autoFocus>
            {t('streak.close')}
          </Button>
        ) : (
          <Button className="mt-2 w-full gap-2" onClick={() => claim.mutate()} disabled={claim.isPending} autoFocus>
            <Coins className="size-4" aria-hidden="true" /> {t('streak.claim', { coins })}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};
