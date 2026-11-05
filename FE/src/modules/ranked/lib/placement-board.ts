/** "3:00", "2:05": the time of a placement session, from milliseconds. */
export const formatBoardTime = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
