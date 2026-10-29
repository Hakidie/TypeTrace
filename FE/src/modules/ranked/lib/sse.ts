/**
 * Splits server-sent events out of what the stream has sent so far: complete events (ended by a blank line) with their
 * JSON data, and the rest that is still coming. Comment lines (`: ping`) are skipped.
 */
export const parseEvents = (buffer: string) => {
  const events: { event: string; data: unknown }[] = [];
  const blocks = buffer.split('\n\n');
  const rest = blocks.pop() ?? '';
  for (const block of blocks) {
    const event = /^event: (.*)$/m.exec(block)?.[1];
    const data = /^data: (.*)$/m.exec(block)?.[1];
    if (event) events.push({ event, data: data ? JSON.parse(data) : undefined });
  }
  return { events, rest };
};
