import { z } from 'zod';
import { sessionModes } from '../models/typing-session.model';

export const listPassagesQuerySchema = z.object({
  mode: z.enum(sessionModes).default('practice')
});

export type ListPassagesQuery = z.infer<typeof listPassagesQuerySchema>;
