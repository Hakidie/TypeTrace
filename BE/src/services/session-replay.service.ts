import { REPLAY_TTL_MS, ReplayEvent, SessionReplayModel } from '../models/session-replay.model';
import { notFound } from '../utils/app-error';

/** Saves the replay of a session the learner has just completed (`completeSession`, SCRUM-35). */
export const saveSessionReplay = (userId: string, sessionId: string, events: ReplayEvent[]) =>
  SessionReplayModel.create({ owner: userId, session: sessionId, events });

/**
 * The replay of one of the learner's sessions, with the day it will be deleted (`expiresAt`). 404 for another learner's
 * session (even for an admin), a session without a replay (not completed, typed before replays, or too big to keep) and a
 * replay older than 30 days, also in the minute before MongoDB's TTL monitor deletes it.
 */
export const getSessionReplay = async (userId: string, sessionId: string) => {
  const replay = await SessionReplayModel.findOne({
    session: sessionId,
    owner: userId,
    createdAt: { $gt: new Date(Date.now() - REPLAY_TTL_MS) }
  });
  if (!replay) throw notFound('Replay not found');
  return {
    session: replay.session,
    events: replay.events,
    createdAt: replay.createdAt,
    expiresAt: new Date(replay.createdAt.getTime() + REPLAY_TTL_MS)
  };
};
