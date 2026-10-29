import { useEffect, useState } from 'react';

const secondsLeft = (endsAt: string) => Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));

/** 3, 2, 1 until the server starts the race (the server clock decides, this only shows it). */
export const Countdown = ({ endsAt }: { endsAt: string }) => {
  const [left, setLeft] = useState(() => secondsLeft(endsAt));
  useEffect(() => {
    const timer = setInterval(() => setLeft(secondsLeft(endsAt)), 200);
    return () => clearInterval(timer);
  }, [endsAt]);

  return (
    <div role="status" aria-label="Countdown" className="text-center text-7xl font-black text-primary">
      {left > 0 ? left : 'Go!'}
    </div>
  );
};
