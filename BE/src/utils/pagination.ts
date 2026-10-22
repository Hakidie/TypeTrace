import type { Model, mongo, QueryFilter } from 'mongoose';
import { z } from 'zod';

/**
 * `sort` query value restricted to `fields`, optionally prefixed with `-` for
 * descending order (`-createdAt`). Only list fields users may sort by: never
 * private ones such as `password`.
 */
export const sortSchema = (fields: readonly [string, ...string[]], defaultSort = '-createdAt') => {
  const allowed = new Set(fields.flatMap((field) => [field, `-${field}`]));
  return z
    .string()
    .default(defaultSort)
    .refine((value) => allowed.has(value), `sort must be one of: ${[...allowed].join(', ')}`);
};

/**
 * Query string shared by every list endpoint: `?page=1&limit=20&sort=-createdAt`.
 * Extend it per feature, including the fields it may be sorted by:
 *   paginationQuerySchema.extend({ q: z.string().optional(), sort: sortSchema(['createdAt', 'title']) })
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: sortSchema(['createdAt', 'updatedAt'])
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Response body of every list endpoint. */
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Optional extras of `paginate`. */
export interface PaginateOptions {
  /** Only these fields, e.g. `'title wordCount'`: leaves out fields `toJSON` keeps but this user may not see. */
  select?: string;
  /** How text is compared when sorting, e.g. `{ locale: 'vi' }` to sort Vietnamese titles. */
  collation?: mongo.CollationOptions;
}

/** Runs a filtered, sorted, paginated find plus the matching count. */
export const paginate = async <T>(
  model: Model<T>,
  filter: QueryFilter<T>,
  { page, limit, sort }: PaginationQuery,
  { select, collation }: PaginateOptions = {}
): Promise<Paginated<T>> => {
  // `_id` breaks ties (e.g. same createdAt) so pages never overlap or skip items.
  const field = sort.replace(/^-/, '');
  const stableSort = field === '_id' ? sort : `${sort} ${sort.startsWith('-') ? '-_id' : '_id'}`;

  const query = model
    .find(filter)
    .sort(stableSort)
    .skip((page - 1) * limit)
    .limit(limit);
  // The count uses the same collation: an index made for that collation then serves both, not only the page.
  const count = model.countDocuments(filter);
  if (select) query.select(select);
  if (collation) {
    query.collation(collation);
    count.collation(collation);
  }

  const [items, total] = await Promise.all([query, count]);

  return { items: items as T[], page, limit, total, totalPages: Math.ceil(total / limit) };
};
