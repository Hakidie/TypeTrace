// When a learner finished their minigames and ranked duels (SCRUM-300), for the daily task `minigames`. Reads models only, so
// user-daily-tasks.service.ts can import it without a cycle (minigame-play.service.ts imports that one).
import type { Types } from 'mongoose';
import { UNPLAYED_DUEL_REASONS } from '../config/minigames';
import { MatchDocument, MatchModel, MatchPlayer } from '../models/match.model';
import { MinigamePlayModel } from '../models/minigame-play.model';

type OwnerId = string | Types.ObjectId;

/**
 * Whether a finished duel counts as a minigame for one of its players: the match is finished and was not flagged, the
 * player won, lost or drew (a forfeit did not play it out), and it was not one that never really began.
 */
export const countsAsPlayed = (
  match: Pick<MatchDocument, 'status' | 'flagged' | 'unratedReason'>,
  player: Pick<MatchPlayer, 'result'>
) =>
  match.status === 'finished' &&
  !match.flagged &&
  !(match.unratedReason && (UNPLAYED_DUEL_REASONS as readonly string[]).includes(match.unratedReason)) &&
  (player.result === 'win' || player.result === 'loss' || player.result === 'draw');

/**
 * For each of `owners` (keyed by the id as a string), the times they finished a minigame or a counted duel in `[from, to)`,
 * oldest first: the `finishedAt` of their finished plays and the `endedAt` of their duels. An owner without any has no key.
 */
export const minigameFinishTimes = async (owners: readonly OwnerId[], from: Date, to: Date) => {
  const wanted = new Set(owners.map(String));
  const [plays, matches] = await Promise.all([
    MinigamePlayModel.find({ owner: { $in: [...wanted] }, finished: true, finishedAt: { $gte: from, $lt: to } })
      .select('owner finishedAt')
      .lean(),
    MatchModel.find({
      status: 'finished',
      flagged: false,
      endedAt: { $gte: from, $lt: to },
      unratedReason: { $nin: UNPLAYED_DUEL_REASONS },
      players: { $elemMatch: { user: { $in: [...wanted] }, result: { $in: ['win', 'loss', 'draw'] } } }
    })
      .select('status flagged unratedReason endedAt players.user players.result')
      .lean()
  ]);

  const times = new Map<string, Date[]>();
  const add = (owner: string, time: Date) => times.set(owner, [...(times.get(owner) ?? []), time]);
  for (const play of plays) add(String(play.owner), play.finishedAt!);
  for (const match of matches) {
    for (const player of match.players) {
      if (wanted.has(String(player.user)) && countsAsPlayed(match, player)) add(String(player.user), match.endedAt!);
    }
  }
  for (const list of times.values()) list.sort((a, b) => a.getTime() - b.getTime());
  return times;
};
