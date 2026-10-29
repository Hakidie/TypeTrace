import type { AvatarLook } from '@/modules/avatar/types/avatar.types';

export type MatchStatus = 'waiting' | 'countdown' | 'running' | 'finished' | 'cancelled';
export type MatchResult = 'win' | 'loss' | 'draw' | 'forfeit';

/** A player as the room shows them: never the email or the words they typed. */
export interface MatchPlayerView {
  userId: string;
  displayName: string;
  avatar: AvatarLook;
  ready: boolean;
  typedCount: number;
  correctWords: number;
  /** Correct words / words of the passage, 0 to 1. */
  accuracy: number;
  wpm: number;
  finished: boolean;
  result?: MatchResult;
  /** The season rating around this match, when it was rated. */
  ratingBefore?: number;
  ratingAfter?: number;
  /** Coins earned by this match (rated matches only). */
  coins?: number;
}

/** Why a finished match did not count for Elo. */
export type UnratedReason = 'not-started' | 'flagged' | 'pair-limit';

/** Mirrors `toPublicMatch` of the backend (`BE/src/services/match-view.ts`). */
export interface PublicMatch {
  code: string;
  status: MatchStatus;
  rated: boolean;
  unratedReason?: UnratedReason;
  passageTitle: string;
  wordCount: number;
  /** Only once the countdown starts. */
  targetWords?: string[];
  countdownEndsAt?: string;
  startedAt?: string;
  endsAt?: string;
  endedAt?: string;
  players: MatchPlayerView[];
}

export interface ProgressUpdate {
  typedCount: number;
  correctWords: number;
  accuracy: number;
  wpm: number;
  finished: boolean;
}

export interface RematchInvite {
  code: string;
  from: string;
}

/** The events of `GET /api/matches/:code/events`. */
export type MatchEvent =
  | { event: 'state' | 'result'; data: PublicMatch }
  | { event: 'countdown'; data: { countdownEndsAt: string } }
  | { event: 'progress'; data: ProgressUpdate & { userId: string } }
  | { event: 'rematch'; data: RematchInvite };

export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Legend';

export interface SeasonInfo {
  number: number;
  startsAt: string;
  endsAt: string;
}

/** `GET /api/ranked/me`: the own rating in the current season. */
export interface RankedMe {
  season: SeasonInfo;
  rating: number;
  peakRating: number;
  tier: Tier;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
}

/** One row of `GET /api/ranked/leaderboard`: a display name, never an email. */
export interface LeaderboardRow {
  rank: number;
  userId: string;
  displayName: string;
  avatar: AvatarLook;
  rating: number;
  tier: Tier;
  matches: number;
  wins: number;
  /** 0 to 1. */
  winRate: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type Leaderboard = Paginated<LeaderboardRow> & { season: SeasonInfo };

/** A season as the admin sees it. */
export interface Season extends SeasonInfo {
  _id: string;
  status: 'active' | 'closed';
  closedAt?: string;
}

export interface ProgressInput {
  typedWords: string[];
  typedAtMs: number[];
  done?: boolean;
}
