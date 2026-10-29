import type { AvatarLook } from '@/modules/avatar/types/avatar.types';

/** Tries a learner gets each day (`DAILY_TRIES` in `BE/src/services/daily.service.ts`). */
export const DAILY_TRIES = 3;

export interface DailyBest {
  score: number;
  wpm: number;
  accuracy: number;
}

/** The last try of the day, for the result screen. */
export interface DailyTry extends DailyBest {
  counted: boolean;
  newBest: boolean;
  coins: number;
}

export interface DailyPlayer {
  displayName: string;
  avatar: AvatarLook;
}

/** `GET /api/daily`. */
export interface DailyToday {
  date: string;
  passageTitle: string;
  preview: string;
  seconds: number;
  triesLeft: number;
  best: DailyBest | null;
  rank: number | null;
  streak: number;
  coins: number;
  lastTry: DailyTry | null;
  endsAt: string;
  yesterdayWinner: (DailyPlayer & { score: number }) | null;
}

export type DailyDay = 'today' | 'yesterday';

export interface DailyBoardRow extends DailyPlayer, DailyBest {
  rank: number;
  isMe: boolean;
}

/** `GET /api/daily/leaderboard`. */
export interface DailyBoard {
  date: string;
  players: number;
  items: DailyBoardRow[];
  me: { rank: number; score: number } | null;
}
