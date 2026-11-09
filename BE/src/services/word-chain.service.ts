import { Types } from 'mongoose';
import { DEFAULT_AVATAR } from '../data/avatar-catalog';
import { ANONYMOUS_PLAYER_NAME, UserModel } from '../models/user.model';
import { WordChainScoreModel } from '../models/word-chain-score.model';
import { badRequest } from '../utils/app-error';
import { scoreChain } from '../utils/word-chain-rules';
import type { WordChainBoardQuery, WordChainScoreInput } from '../validators/word-chain.validator';
import { placementWeekStart } from './placement-board.service';

/** The Nối từ board sends this many lines, and the player's own place when they are further down. */
export const WORD_CHAIN_BOARD_SIZE = 20;

/**
 * Saves a finished game: the score is worked out from the chain (`scoreChain`), a chain that breaks the rules is refused.
 * A game of 0 points is not saved. Returns the score.
 */
export const saveWordChainScore = async (userId: string, { chain }: WordChainScoreInput) => {
  const score = scoreChain(chain);
  if (score === null) throw badRequest('This chain breaks the rules of Nối từ');
  if (score > 0) await WordChainScoreModel.create({ user: userId, score, links: chain.length });
  return { score };
};

interface RankedRow {
  _id: Types.ObjectId;
  score: number;
}

/**
 * The board of this week (from Monday 0:00 in Vietnam, like the placement board) or of all the time: the best game of each
 * active player, best first (the earlier game first on a tie), the top `WORD_CHAIN_BOARD_SIZE` and the player's own place.
 * Names and avatars only, never an email.
 */
export const getWordChainBoard = async (userId: string, { range }: WordChainBoardQuery) => {
  const from = range === 'week' ? placementWeekStart(new Date()) : null;
  // ponytail: ranks every player at each request; cache it like placement-board-cache.ts if the games grow large
  const rows = await WordChainScoreModel.aggregate<RankedRow>([
    ...(from ? [{ $match: { createdAt: { $gte: from } } }] : []),
    { $sort: { score: -1, createdAt: 1 } },
    { $group: { _id: '$user', score: { $first: '$score' }, at: { $first: '$createdAt' } } },
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
    { $sort: { score: -1, at: 1 } },
    { $project: { score: 1 } }
  ]);
  const top = rows.slice(0, WORD_CHAIN_BOARD_SIZE);
  const users = await UserModel.find({ _id: { $in: top.map((row) => row._id) } })
    .select('displayName avatar')
    .lean();
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const items = top.map((row, index) => {
    const user = userById.get(String(row._id));
    return {
      rank: index + 1,
      displayName: user?.displayName?.trim() || ANONYMOUS_PLAYER_NAME,
      avatar: user?.avatar ?? DEFAULT_AVATAR,
      score: row.score,
      isMe: String(row._id) === userId
    };
  });
  const mine = rows.findIndex((row) => String(row._id) === userId);
  return { range, items, me: mine === -1 ? null : { rank: mine + 1, score: rows[mine].score } };
};
