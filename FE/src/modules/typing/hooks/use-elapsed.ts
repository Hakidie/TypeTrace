import { useEffect, useState } from 'react';

/** Seconds since `startedAt`, refreshed every second while `running`. 0 until `startedAt` is set (null). */
export const useElapsedSeconds = (startedAt: number | null, running: boolean) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running || startedAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running, startedAt]);

  return startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
};
