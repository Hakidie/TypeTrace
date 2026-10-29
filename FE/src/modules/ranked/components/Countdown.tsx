import { useEffect, useState } from 'react';

const secondsLeft = (endsAt: string) => Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));

/** 3, 2, 1 until the server starts the race (the server clock decides, this only shows it). Each number pops in. */
export const Countdown = ({ endsAt }: { endsAt: string }) => {
  const [left, setLeft] = useState(() => secondsLeft(endsAt));
  useEffect(() => {
    const timer = setInterval(() => setLeft(secondsLeft(endsAt)), 200);
    return () => clearInterval(timer);
  }, [endsAt]);

  return (
    <div role="status" aria-label="Countdown" className="flex flex-col items-center gap-2 text-primary">
      <span key={left} className="duel-pop text-8xl font-black tabular-nums sm:text-9xl">
        {left > 0 ? left : 'Go!'}
      </span>
      <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">{left > 0 ? 'Get ready' : 'Type!'}</span>
    </div>
  );
};
