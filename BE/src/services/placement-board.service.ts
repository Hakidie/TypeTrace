import { PipelineStage } from 'mongoose';
import { DEFAULT_AVATAR } from '../data/avatar-catalog';
import { PassageModel } from '../models/passage.model';
import { TypingSessionModel } from '../models/typing-session.model';
import { ANONYMOUS_PLAYER_NAME } from '../models/user.model';
import { notFound } from '../utils/app-error';
import { addDays, localDateKey } from '../utils/local-date';
import type { PlacementBoardQuery } from '../validators/placement.validator';
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

interface BoardRow {
  _id: unknown;
  wpm: number;
  accuracy: number;
  durationMs: number;
  user: { displayName?: string; avatar?: typeof DEFAULT_AVATAR };
}

/**
 * The board of one placement passage: the best session of each active learner that went on it (`isOnPlacementBoard`),
 * the top `PLACEMENT_BOARD_SIZE`, and the place of the learner. Names and avatars only, never an email.
 */
export const getPlacementBoard = async (userId: string, { passageId, range }: PlacementBoardQuery) => {
  const passage = await PassageModel.exists({ _id: passageId, ...learnerPassageFilter(userId, 'placement') });
  if (!passage) throw notFound('Placement passage not found');

  const from = range === 'week' ? placementWeekStart(new Date()) : null;
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
    // Only the public fields of an active account: a locked or deleted learner has no line.
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        pipeline: [{ $match: { status: 'active' } }, { $project: { displayName: 1, avatar: 1 } }],
        as: 'user'
      }
    },
    { $unwind: '$user' },
    { $sort: RANK_ORDER }
  ];
  const rows = await TypingSessionModel.aggregate<BoardRow>(pipeline);

  const mine = rows.findIndex((row) => String(row._id) === userId);
  return {
    passageId,
    range,
    from,
    players: rows.length,
    items: rows.slice(0, PLACEMENT_BOARD_SIZE).map((row, index) => ({
      rank: index + 1,
      displayName: row.user.displayName?.trim() || ANONYMOUS_PLAYER_NAME,
      avatar: row.user.avatar ?? DEFAULT_AVATAR,
      wpm: row.wpm,
      accuracy: row.accuracy,
      durationMs: row.durationMs,
      isMe: String(row._id) === userId
    })),
    me: mine === -1 ? null : { rank: mine + 1, wpm: rows[mine].wpm, accuracy: rows[mine].accuracy, durationMs: rows[mine].durationMs }
  };
};
