/** Where a game of word rain is: waiting to start, running, or over. */
export type RainPhase = 'ready' | 'playing' | 'won' | 'lost';

/** A word is falling, was typed in time (`popped`) or reached the ground (`missed`). */
export type RainDropState = 'falling' | 'popped' | 'missed';

export interface RainDrop {
  id: string;
  text: string;
  /** Where the word falls, from the left edge (0) to the right edge (100), in percent. */
  x: number;
  /** How long the word takes to fall, in milliseconds. */
  fallMs: number;
  /** How many letters from the start were typed right. */
  typed: number;
  state: RainDropState;
  /** When the word appeared: round time in word rain alone, server time in a duel (the stage then places it by age). */
  bornAt?: number;
}

/** What just happened to the player: a word was typed (`hop`) or reached the ground (`shake`). A new `key` replays the motion. */
export type RainReaction = { kind: 'hop' | 'shake'; key: number };

/** A word of a round: the drop the stage draws, plus its lane and when (round time, ms) it appeared and was typed or missed. */
export interface GameDrop extends RainDrop {
  lane: number;
  bornAt: number;
  settledAt?: number;
}

/** One round of word rain (`rainReducer`). Times are milliseconds of round time, which stops while the game is paused. */
export interface RainState {
  phase: RainPhase;
  elapsed: number;
  lives: number;
  /** Words typed in time, and their letters (for the speed on the result screen). */
  score: number;
  typedChars: number;
  drops: GameDrop[];
  /** The words of the round; `next` is the index of the next one to fall (it wraps around). */
  words: string[];
  next: number;
  /** What is in the typing box. */
  input: string;
  nextSpawnAt: number;
  lanes: number;
  reaction: RainReaction | null;
  lastId: number;
}

export type RainAction =
  | { type: 'start'; words: string[]; lanes: number }
  /** `rand` (0 to 1) picks the lane of a new word, so the reducer stays pure. */
  | { type: 'tick'; dt: number; rand: number }
  | { type: 'input'; text: string }
  | { type: 'land'; id: string };
