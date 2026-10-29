import { z } from 'zod';
import { matchKinds } from '../models/match.model';
import { paginationQuerySchema, sortSchema } from '../utils/pagination';

/** Which kind of match a rating or a board is about; the first ranked duel (`race`) when it is not said. */
const kindSchema = z.enum(matchKinds).default('race');

export const rankingQuerySchema = z.object({ kind: kindSchema });

/** The leaderboard of one kind is always by rating, best first. */
export const leaderboardQuerySchema = paginationQuerySchema.extend({
  sort: sortSchema(['rating'], '-rating'),
  kind: kindSchema
});

/** Admin list of seasons, newest first. */
export const listSeasonsQuerySchema = paginationQuerySchema.extend({
  sort: sortSchema(['number'], '-number')
});

export type RankingQuery = z.infer<typeof rankingQuerySchema>;
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
export type ListSeasonsQuery = z.infer<typeof listSeasonsQuerySchema>;
