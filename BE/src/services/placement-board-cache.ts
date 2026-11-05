// The placement leaderboard is built from every session on the board of a passage, which grows for ever: it is kept in memory and built
// again only when something changed AND an hour has passed. The backend runs as one process (see AGENTS.md), so a memory cache is enough;
// with several processes each would keep its own and they would differ.

/** How long a board is served before the cache looks at whether anything changed. */
export const PLACEMENT_BOARD_REFRESH_MS = 60 * 60 * 1000;

interface Entry {
  rows: unknown[];
  /** The last moment the board was built or found still right. */
  checkedAt: number;
  /** `versionOf` the passage when the board was built. */
  version: number;
}

const entries = new Map<string, Entry>();
/** A board being built, so requests that arrive at the same time wait for it instead of building their own. */
const building = new Map<string, Promise<unknown[]>>();
const passageVersions = new Map<string, number>();
let globalVersion = 0;

const versionOf = (passageId: string) => globalVersion + (passageVersions.get(passageId) ?? 0);

/**
 * Tells the cache that the board of a passage may be different now (a session went on it or came off it); without a passage, that every board
 * may be (an admin changed the minimum accuracy, locked or deleted learners). The boards are not built again at once: at the next
 * read after their hour.
 */
export const placementBoardChanged = (passageId?: string) => {
  if (passageId) passageVersions.set(passageId, (passageVersions.get(passageId) ?? 0) + 1);
  else globalVersion += 1;
};

/** Forgets everything (the tests start each case from an empty database, so from an empty cache). */
export const clearPlacementBoardCache = () => {
  entries.clear();
  building.clear();
  passageVersions.clear();
  globalVersion = 0;
};

/**
 * The ranked rows of one board: the ones kept, while their hour is not over; after it, the same ones if nothing changed (and the
 * hour starts again), else built again with `build`. `key` names the board (passage, range and, for a week, the week).
 */
export const cachedBoardRows = async <T>(key: string, passageId: string, build: () => Promise<T[]>): Promise<T[]> => {
  const now = Date.now();
  const entry = entries.get(key);
  if (entry && now - entry.checkedAt < PLACEMENT_BOARD_REFRESH_MS) return entry.rows as T[];
  if (entry && entry.version === versionOf(passageId)) {
    entry.checkedAt = now;
    return entry.rows as T[];
  }

  const pending = building.get(key);
  if (pending) return pending as Promise<T[]>;
  // The version is read before building: a change that happens while it builds leaves the board marked as changed.
  const version = versionOf(passageId);
  const promise = build()
    .then((rows) => {
      entries.set(key, { rows, checkedAt: now, version });
      return rows;
    })
    .finally(() => building.delete(key));
  building.set(key, promise);
  return promise;
};
