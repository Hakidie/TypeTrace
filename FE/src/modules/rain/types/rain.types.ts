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
}

/** What just happened to the player: a word was typed (`hop`) or reached the ground (`shake`). A new `key` replays the motion. */
export type RainReaction = { kind: 'hop' | 'shake'; key: number };
