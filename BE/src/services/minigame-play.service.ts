// The plays of the minigames of the Minigames tab and the duels, as the daily task `minigames` counts them (SCRUM-300). The
// numbers themselves are worked out by user-daily-tasks.service.ts from minigame-times.service.ts; this file opens and
// closes plays and tells the daily tasks when something was finished.
import { MIN_PLAY_MS } from '../config/minigames';
import type { MatchDocument } from '../models/match.model';
import { Minigame, MinigamePlayModel } from '../models/minigame-play.model';
import { conflict, notFound } from '../utils/app-error';
import { countsAsPlayed } from './minigame-times.service';
import { recordDailyTaskProgress } from './user-daily-tasks.service';

/** Opens a play of `game` for the learner, starting now by the server's clock. Returns its id. */
export const startPlay = async (userId: string, game: Minigame) => {
  const play = await MinigamePlayModel.create({ owner: userId, game, startedAt: new Date() });
  return { id: String(play._id) };
};

/**
 * Closes the learner's play. A play that has not run `MIN_PLAY_MS[game]` yet is not counted and stays open (a later finish
 * can still count); a play already finished answers 409, and so does losing a race with another finish of the same play.
 * The day's numbers are brought up to date afterwards: a failure there never fails the finish.
 */
export const finishPlay = async (userId: string, playId: string, now = new Date()) => {
  const play = await MinigamePlayModel.findOne({ _id: playId, owner: userId });
  if (!play) throw notFound('Play not found');
  if (play.finished) throw conflict('This play is already finished');
  if (now.getTime() - play.startedAt.getTime() < MIN_PLAY_MS[play.game]) return { counted: false };

  const claim = await MinigamePlayModel.updateOne({ _id: play._id, finished: false }, { finished: true, finishedAt: now });
  if (claim.modifiedCount === 0) throw conflict('This play is already finished');
  await recordDailyTaskProgress(userId, now).catch((error) =>
    console.error('Daily tasks not updated, the next finished minigame of the day adds this one:', error)
  );
  return { counted: true };
};

/**
 * After a duel is saved as finished: brings the daily tasks of each player it counts for (`countsAsPlayed`) up to date, on
 * the day it ended. Never throws: a failed write is only logged, the next minigame of the day adds this one.
 */
export const recordMatchMinigames = async (match: MatchDocument) => {
  if (!match.endedAt) return;
  await Promise.all(
    match.players
      .filter((player) => countsAsPlayed(match, player))
      .map((player) =>
        recordDailyTaskProgress(player.user, match.endedAt!).catch((error) =>
          console.error('Daily tasks not updated after a duel, the next finished minigame of the day adds it:', error)
        )
      )
  );
};
