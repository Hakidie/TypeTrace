import { z } from 'zod';

export const dailyBoardQuerySchema = z.object({
  day: z.enum(['today', 'yesterday']).default('today')
});

export type DailyBoardQuery = z.infer<typeof dailyBoardQuerySchema>;
