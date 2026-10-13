import { memo } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { InputLogEntry, LoggedEventType } from '../types/input-lab.types';

/** Rows drawn at once. Older events stay in memory and in the download; drawing thousands of rows made typing lag. */
const MAX_ROWS = 300;

const typeVariant: Record<LoggedEventType, 'default' | 'secondary' | 'outline'> = {
  keydown: 'outline',
  keyup: 'outline',
  beforeinput: 'secondary',
  input: 'default',
  compositionstart: 'secondary',
  compositionupdate: 'secondary',
  compositionend: 'secondary',
};

/** Shows spaces and empty strings so they can be told apart in the log. */
const show = (text: string | null | undefined) => {
  if (text === undefined) return '';
  if (text === null) return 'null';
  return `"${text.replace(/ /g, '·')}"`;
};

/** Memoized: entries never change once recorded, so a row is only rendered the first time it appears. */
const EventRow = memo(function EventRow({ entry }: { entry: InputLogEntry }) {
  return (
    <tr className={cn('border-t', entry.type.startsWith('key') && 'text-muted-foreground')}>
      <td className="px-2 py-1">{entry.seq}</td>
      <td className="px-2 py-1">{entry.time.toFixed(1)}</td>
      <td className="px-2 py-1">
        <Badge variant={typeVariant[entry.type]}>{entry.type}</Badge>
      </td>
      <td className="px-2 py-1">
        {entry.key !== undefined && `${show(entry.key)} / ${entry.code || '—'} / ${entry.keyCode}`}
      </td>
      <td className="px-2 py-1">{entry.inputType}</td>
      <td className="px-2 py-1">{show(entry.data)}</td>
      <td className="px-2 py-1">{entry.isComposing ? 'yes' : ''}</td>
      <td className="px-2 py-1">{show(entry.value)}</td>
      <td className="px-2 py-1">
        {entry.selectionStart}–{entry.selectionEnd}
      </td>
    </tr>
  );
});

interface EventLogTableProps {
  entries: InputLogEntry[];
}

/** The most recent events, oldest first. Key events are faded so text changes stand out. */
export const EventLogTable = ({ entries }: EventLogTableProps) => {
  const visible = entries.length > MAX_ROWS ? entries.slice(-MAX_ROWS) : entries;

  return (
    <div className="space-y-2">
      {visible.length < entries.length && (
        <p className="text-base text-muted-foreground">
          Showing the last {MAX_ROWS} of {entries.length} events. Download has all of them.
        </p>
      )}
      <div className="max-h-[32rem] overflow-auto border">
        <table className="w-full min-w-[56rem] text-left font-mono text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {['#', 'ms', 'type', 'key / code / keyCode', 'inputType', 'data', 'composing', 'value', 'sel'].map((label) => (
                <th key={label} className="px-2 py-1 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((entry) => (
              <EventRow key={entry.seq} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
