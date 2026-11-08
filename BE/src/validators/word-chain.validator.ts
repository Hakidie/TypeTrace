import { z } from 'zod';

/** A game of Nối từ: its chain, bot and player words in order (a 60 s game with +5 s per word stays far under 600). */
export const wordChainScoreSchema = z.object({
  chain: z
    .array(z.object({ by: z.enum(['bot', 'me']), word: z.string().trim().min(3).max(40) }))
    .min(1)
    .max(600)
});

export const wordChainBoardQuerySchema = z.object({
  range: z.enum(['week', 'all']).default('week')
});

export type WordChainScoreInput = z.infer<typeof wordChainScoreSchema>;
export type WordChainBoardQuery = z.infer<typeof wordChainBoardQuerySchema>;
