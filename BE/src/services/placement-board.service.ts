import { PipelineStage, Types } from 'mongoose';
import { DEFAULT_AVATAR } from '../data/avatar-catalog';
import { PassageModel } from '../models/passage.model';
import { TypingSessionModel } from '../models/typing-session.model';
import { ANONYMOUS_PLAYER_NAME, UserModel } from '../models/user.model';
import { notFound } from '../utils/app-error';
import { addDays, localDateKey } from '../utils/local-date';
import type { PlacementBoardQuery, PlacementSettingsInput } from '../validators/placement.validator';
import { getAppSettings, updateAppSettings } from './app-setting.service';
import { cachedBoardRows } from './placement-board-cache';
import { rebuildPlacementBoardFlags } from './typing-session.service';
import { learnerPassageFilter } from './passage.service';

/** The placement leaderboard sends this many lines, and the learner's own place when they are further down (US10.1). */
export const PLACEMENT_BOARD_SIZE = 50;
/** The week of the board starts on Monday at 0:00 in this zone, for everyone (TypeTrace is a Vietnamese app). */
export const PLACEMENT_BOARD_ZONE = 'Asia/Ho_Chi_Minh';

/** Monday 0:00 of the week that holds `now` in `PLACEMENT_BOARD_ZONE`, as a point in time. */
export const placementWeekStart = (now: Date) => {
  const today = localDateKey(now, PLACEMENT_BOARD_ZONE);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 is Sunday
  const daysSinceMonday = (weekday + 6) % 7; // Monday 0, Tuesday 1, ... Sunday 6
  const monday = addDays(today, -daysSinceMonday);
  return new Date(`${monday}T00:00:00+07:00`); // Vietnam has no daylight saving time: always UTC+7
};

/** The best session of each learner comes first: WPM, then accuracy, then the shorter time, then who finished first. */
const RANK_ORDER = { wpm: -1, accuracy: -1, durationMs: 1, completedAt: 1 } as const;

/** One line of the ranking as it is kept in the cache: no name or avatar, which are read again at every request. */
interface RankedRow {
  _id: Types.ObjectId;
  wpm: number;
  accuracy: number;
  durationMs: number;
}

/**
 * The ranking of one board, every active learner with a session on it, best first (built from all the sessions: the cache keeps it,
 * see `placement-board-cache.ts`). The sort is the order of the index of the model, so MongoDB reads it already in order; the lookup
 * keeps only the id of the accounts that are active: a locked or deleted learner has no line.
 */
const buildRanking = (passageId: string, from: Date | null) => {
  const pipeline: PipelineStage[] = [
    {
      $match: {
        mode: 'placement',
        status: 'completed',
        isOnPlacementBoard: true,
        passageId,
        ...(from && { completedAt: { $gte: from } })
      }
    },
    { $sort: RANK_ORDER },
    {
      $group: {
        _id: '$owner',
        wpm: { $first: '$wpm' },
        accuracy: { $first: '$accuracy' },
        durationMs: { $first: '$durationMs' },
        completedAt: { $first: '$completedAt' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        pipeline: [{ $match: { status: 'active' } }, { $project: { _id: 1 } }],
        as: 'user'
      }
    },
    { $match: { user: { $ne: [] } } },
    { $sort: RANK_ORDER },
    { $project: { wpm: 1, accuracy: 1, durationMs: 1 } }
  ];
  return TypingSessionModel.aggregate<RankedRow>(pipeline).allowDiskUse(true);
};

/**
 * The board of one placement passage: the best session of each active learner that went on it (`isOnPlacementBoard`),
 * the top `PLACEMENT_BOARD_SIZE`, and the place of the learner. Names and avatars only, never an email. The ranking is kept for an
 * hour (`cachedBoardRows`); the names and avatars of the lines shown are read at every request, so they are always the current ones.
 */
export const getPlacementBoard = async (userId: string, { passageId, range }: PlacementBoardQuery) => {
  const passage = await PassageModel.exists({ _id: passageId, ...learnerPassageFilter(userId, 'placement') });
  if (!passage) throw notFound('Placement passage not found');

  const from = range === 'week' ? placementWeekStart(new Date()) : null;
  const key = `${passageId}|${range}|${from?.toISOString() ?? 'all'}`;
  const rows = await cachedBoardRows(key, passageId, () => buildRanking(passageId, from));

  // The lines shown, with the accounts as they are now: one that was locked or deleted since the ranking was built has no line.
  const top = rows.slice(0, PLACEMENT_BOARD_SIZE);
  const users = await UserModel.find({ _id: { $in: top.map((row) => row._id) }, status: 'active' })
    .select('displayName avatar')
    .lean();
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const items = top
    .filter((row) => userById.has(String(row._id)))
    .map((row, index) => {
      const user = userById.get(String(row._id))!;
      return {
        rank: index + 1,
        displayName: user.displayName?.trim() || ANONYMOUS_PLAYER_NAME,
        avatar: user.avatar ?? DEFAULT_AVATAR,
        wpm: row.wpm,
        accuracy: row.accuracy,
        durationMs: row.durationMs,
        isMe: String(row._id) === userId
      };
    });

  const mine = rows.findIndex((row) => String(row._id) === userId);
  return {
    passageId,
    range,
    from,
    players: rows.length,
    items,
    me: mine === -1 ? null : { rank: mine + 1, wpm: rows[mine].wpm, accuracy: rows[mine].accuracy, durationMs: rows[mine].durationMs }
  };
};

/** The placement settings the app shows: the minimum accuracy a session needs to go on the leaderboard (an admin changes it). */
export const getPlacementSettings = async () => ({ minAccuracy: (await getAppSettings()).placementMinAccuracy });

export const updatePlacementSettings = async ({ minAccuracy }: PlacementSettingsInput) => {
  const settings = await updateAppSettings({ placementMinAccuracy: minAccuracy });
  // The flags of the sessions already saved follow the new minimum (the boards in memory are built again at their next read after the hour).
  await rebuildPlacementBoardFlags();
  return { minAccuracy: settings.placementMinAccuracy };
};
