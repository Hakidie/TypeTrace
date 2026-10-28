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
}

/** Mirrors `toPublicMatch` of the backend (`BE/src/services/match-view.ts`). */
export interface PublicMatch {
  code: string;
  status: MatchStatus;
  rated: boolean;
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

export interface ProgressInput {
  typedWords: string[];
  typedAtMs: number[];
  done?: boolean;
}
