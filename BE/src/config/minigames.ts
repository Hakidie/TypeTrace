import type { Minigame } from '../models/minigame-play.model';

/**
 * How long a minigame must have run, by the server's clock, before finishing it counts (SCRUM-300). Rain and the Bot duel can
 * end by lives: with nothing typed the third word lands after about 10 s, so a real loss must still count; Nối từ ends when its
 * 60 s clock does, sooner only by many skips. The minimum only stops a client that sends "finished" right after "started".
 */
export const MIN_PLAY_MS: Record<Minigame, number> = { chain: 8_000, rain: 8_000, bot: 8_000 };

/**
 * A finished duel with one of these `unratedReason`s was never really played (a player left before it began, a restart
 * lost it, nobody finished), so it does not count as a minigame. A duel the pair limit left unrated was played and counts.
 */
export const UNPLAYED_DUEL_REASONS = ['not-started', 'interrupted', 'abandoned'] as const;
