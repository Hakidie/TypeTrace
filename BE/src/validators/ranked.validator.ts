import { z } from 'zod';
import { paginationQuerySchema, sortSchema } from '../utils/pagination';

/** The leaderboard is always by rating, best first. */
export const leaderboardQuerySchema = paginationQuerySchema.extend({
  sort: sortSchema(['rating'], '-rating')
});

/** Admin list of seasons, newest first. */
export const listSeasonsQuerySchema = paginationQuerySchema.extend({
  sort: sortSchema(['number'], '-number')
});

export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
export type ListSeasonsQuery = z.infer<typeof listSeasonsQuerySchema>;
