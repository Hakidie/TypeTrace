import { z } from 'zod';

/** A room code as typed: any case, upper-cased here; 6 characters of the room alphabet (no 0, O, 1 or I). */
export const matchCodeParamsSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((code) => code.toUpperCase())
    .pipe(z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/, 'Room codes have 6 letters and digits'))
});
