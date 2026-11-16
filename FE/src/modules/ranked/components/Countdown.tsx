import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

const secondsLeft = (endsAt: string) => Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));

/** 3, 2, 1 until the server starts the race (the server clock decides, this only shows it). Each number pops in. */
export const Countdown = ({ endsAt }: { endsAt: string }) => {
  const { t } = useTranslation('ranked');
  const [left, setLeft] = useState(() => secondsLeft(endsAt));
  useEffect(() => {
    const timer = setInterval(() => setLeft(secondsLeft(endsAt)), 200);
    return () => clearInterval(timer);
  }, [endsAt]);

  return (
    <div role="status" aria-label={t('duel.countdown')} className="flex flex-col items-center gap-2 text-primary">
      <span key={left} className="duel-pop text-8xl font-black tabular-nums sm:text-9xl">
        {left > 0 ? left : t('duel.go')}
      </span>
      <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">{left > 0 ? t('duel.getReady') : t('duel.type')}</span>
    </div>
  );
};
