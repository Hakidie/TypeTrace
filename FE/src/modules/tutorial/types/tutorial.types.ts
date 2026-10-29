/** Mirrors `TutorialState` of the backend (`BE/src/models/user.model.ts`): missing on accounts from before the tutorial. */
export type TutorialMode = 'practice' | 'placement' | 'rain' | 'daily' | 'rank';
export type TutorialStatus = 'done' | 'skipped';
export interface TutorialState {
  tour: 'active' | 'done' | 'skipped';
  modes: Partial<Record<TutorialMode, TutorialStatus>>;
}

/** The moves of Ping's sprite (`FE/public/mascot/ping-<move>.png`, drawn by `minigame-sprites/draw-ping.mjs`). */
export type PingMove = 'idle' | 'talk' | 'happy' | 'sad' | 'point' | 'typing';

/** One step of a guide: what Ping says, how he moves, what is framed, and whether he waits for the learner to act. */
export interface TutorialStep {
  id: string;
  mode: TutorialMode;
  move: PingMove;
  text: string;
  /** The `data-tutorial` id of the element framed by the spotlight. */
  target?: string;
  /** Ping talks from the top of the screen (what is framed is at the bottom, where he stands otherwise). */
  place?: 'top';
  /** Label of the button that goes on (default "Tiếp"). */
  next?: string;
  /** Ping waits for the learner instead of a button: `rain-word` = type the framed falling word. */
  waitFor?: 'rain-word';
}

/** `POST /api/tutorial/coach`: the numbers of a practice duel. */
export interface CoachStats {
  result: 'win' | 'loss' | 'draw';
  hits: number;
  thrown: number;
  livesLeft: number;
  seconds: number;
  missedWords: string[];
}
