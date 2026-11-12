import { z } from 'zod';
import { MINIGAMES } from '../models/minigame-play.model';

/** `POST /api/minigames/plays`: the minigame that is starting. */
export const startPlaySchema = z.object({ game: z.enum(MINIGAMES) });

export type StartPlayInput = z.infer<typeof startPlaySchema>;
