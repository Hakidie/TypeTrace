import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import type { LogSummary, WordCommit } from '../types/input-lab.types';

interface LogSummaryPanelProps {
  summary: LogSummary;
  words: WordCommit[];
}

const Row = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between gap-4 border-b py-1 last:border-b-0">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-right font-mono">{value}</dd>
  </div>
);

/** The numbers that go into the results table of the spike document, plus the detected words. */
export const LogSummaryPanel = ({ summary, words }: LogSummaryPanelProps) => (
  <div className="grid gap-4 lg:grid-cols-2">
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="text-base">
          <Row label="Events" value={summary.total} />
          <Row label="Uses composition" value={summary.usesComposition ? 'yes' : 'no'} />
          <Row label="compositionstart / update / end" value={`${summary.byType.compositionstart} / ${summary.byType.compositionupdate} / ${summary.byType.compositionend}`} />
          <Row label="keydown / input" value={`${summary.byType.keydown} / ${summary.byType.input}`} />
          <Row label="deleteContentBackward inputs" value={summary.backspaceInputs} />
          <Row label="keydown with keyCode 229" value={summary.keyCode229} />
          <Row label="keydown keys" value={summary.keydownKeys.join(' ') || '—'} />
          <Row
            label="inputType counts"
            value={Object.entries(summary.inputTypes).map(([type, count]) => `${type}: ${count}`).join(', ') || '—'}
          />
        </dl>
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Finished words ({words.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {words.length === 0 ? (
          <p className="text-base text-muted-foreground">Type a word followed by a space or punctuation.</p>
        ) : (
          <ol className="max-h-64 space-y-1 overflow-auto text-base">
            {words.map((word, position) => (
              <li key={position} className="flex justify-between gap-4 font-mono">
                <span>
                  {word.index + 1}. {word.word}
                </span>
                <span className="text-muted-foreground">{Math.round(word.committedAt - word.startedAt)} ms</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  </div>
);
