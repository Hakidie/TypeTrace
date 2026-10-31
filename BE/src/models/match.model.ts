// A ranked duel (ranked duel design, phase 3): two players type the same English passage; the server keeps the words,
// grades the progress and decides the result. This document is the truth of the match; `services/match-hub.ts` only
// holds the open event streams and the timers.
import mongoose, { Schema, Types } from 'mongoose';
import type { AvatarLook } from '../data/avatar-catalog';

export const matchStatuses = ['waiting', 'countdown', 'running', 'finished', 'cancelled'] as const;
export const OPEN_MATCH_STATUSES = ['waiting', 'countdown', 'running'] as const;
export const matchResults = ['win', 'loss', 'draw', 'forfeit'] as const;

/** Why a finished match did not count for Elo: left before the race, flagged by the WPM cap, or the pair's daily limit. */
/** `interrupted`: a rain duel whose rain was lost (the server restarted while it ran). */
export const unratedReasons = ['not-started', 'flagged', 'pair-limit', 'interrupted'] as const;
/** `race`: both type the same passage (the first ranked duel); `rain`: word rain, typed words thrown at the other player. */
export const matchKinds = ['race', 'rain'] as const;
export type MatchKind = (typeof matchKinds)[number];

export type MatchStatus = (typeof matchStatuses)[number];
export type MatchResult = (typeof matchResults)[number];
export type UnratedReason = (typeof unratedReasons)[number];

export interface MatchPlayer {
  user: Types.ObjectId;
  /** The name everyone in the room sees: the display name, never the email. */
  displayName: string;
  /** A copy of the look worn when joining. */
  avatar: AvatarLook;
  ready: boolean;
  /** Everything typed so far (sent again with each progress); only the server reads it. */
  typedWords: string[];
  typedAtMs: number[];
  typedCount: number;
  correctWords: number;
  /** Correct words / words of the passage, from 0 to 1. */
  accuracy: number;
  wpm: number;
  finishedAt?: Date;
  /** Rain duels: lives left, words typed in time and words thrown to the other player, saved when the duel ends. */
  lives?: number;
  hits?: number;
  thrown?: number;
  result?: MatchResult;
  /** The season rating before and after this match, when it was rated. */
  ratingBefore?: number;
  ratingAfter?: number;
  /** Coins earned by this match (rated matches only, within the daily limit). */
  coins?: number;
}

export interface MatchDocument extends mongoose.Document {
  code: string;
  kind: MatchKind;
  /** A rain duel: the tier its rain follows (the two players' average rain rating when it started). */
  rainTier?: string;
  status: MatchStatus;
  /** Counted for Elo; decided once, when the match finishes (`services/rating.service.ts`). */
  rated: boolean;
  /** The season the match was settled in; set once it finished, rated or not. */
  season?: Types.ObjectId;
  unratedReason?: UnratedReason;
  /** A player went over `MAX_COUNTED_WPM`: the match never counts. */
  flagged: boolean;
  /** Missing on rain duels. */
  passageId?: Types.ObjectId;
  passageTitle: string;
  targetWords: string[];
  countdownEndsAt?: Date;
  startedAt?: Date;
  endedAt?: Date;
  /** The room of the rematch, once one player asked for it: the other one is sent there too. */
  rematchCode?: string;
  players: Types.DocumentArray<MatchPlayer & mongoose.Types.Subdocument>;
  createdAt: Date;
  updatedAt: Date;
}

const playerSchema = new Schema<MatchPlayer>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    displayName: { type: String, required: true },
    avatar: { type: Schema.Types.Mixed, required: true },
    ready: { type: Boolean, default: false },
    typedWords: { type: [String], default: [] },
    typedAtMs: { type: [Number], default: [] },
    typedCount: { type: Number, default: 0 },
    correctWords: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    wpm: { type: Number, default: 0 },
    finishedAt: Date,
    lives: Number,
    hits: Number,
    thrown: Number,
    result: { type: String, enum: matchResults },
    ratingBefore: Number,
    ratingAfter: Number,
    coins: Number
  },
  { _id: false }
);

const matchSchema = new Schema<MatchDocument>(
  {
    code: { type: String, required: true },
    kind: { type: String, enum: matchKinds, default: 'race' },
    rainTier: String,
    status: { type: String, enum: matchStatuses, default: 'waiting' },
    rated: { type: Boolean, default: false },
    flagged: { type: Boolean, default: false },
    season: { type: Schema.Types.ObjectId, ref: 'Season' },
    unratedReason: { type: String, enum: unratedReasons },
    // A rain duel has no passage: its words come from every English passage.
    passageId: { type: Schema.Types.ObjectId, ref: 'Passage', required: function (this: MatchDocument) { return this.kind !== 'rain'; } },
    passageTitle: { type: String, required: true },
    targetWords: { type: [String], required: true },
    countdownEndsAt: Date,
    startedAt: Date,
    endedAt: Date,
    rematchCode: String,
    players: { type: [playerSchema], default: [] }
  },
  { timestamps: true }
);

// A code names one open room; finished and cancelled rooms keep theirs as history, so a code can come back later.
matchSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { status: { $in: [...OPEN_MATCH_STATUSES] } } });
// "The room this code names now" (the newest match with it): every progress report reads it.
matchSchema.index({ code: 1, createdAt: -1 });
// One open room per player, also when two requests race (a double click): the database refuses the second one.
matchSchema.index({ 'players.user': 1 }, { unique: true, partialFilterExpression: { status: { $in: [...OPEN_MATCH_STATUSES] } } });
// A player's match history.
matchSchema.index({ 'players.user': 1, status: 1 });

export const MatchModel = mongoose.model<MatchDocument>('Match', matchSchema);
