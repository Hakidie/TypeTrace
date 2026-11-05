/** The minimum accuracy of the placement leaderboard until an admin changes it (the backend's default), and the least and most they may choose. */
export const DEFAULT_PLACEMENT_MIN_ACCURACY = 90;
export const MIN_PLACEMENT_MIN_ACCURACY = 50;
export const MAX_PLACEMENT_MIN_ACCURACY = 100;

/** "3:00", "2:05": the time of a placement session, from milliseconds. */
export const formatBoardTime = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
