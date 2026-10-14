import { EmptyState } from '@/shared/components/empty-state';
import { Card } from '@/shared/components/ui/card';
import { errorLabels } from '../typing.config';
import type { ErrorStat, WordResult } from '../utils/typing-session';

interface ResultsPanelProps {
  results: WordResult[];
  stats: ErrorStat[];
}

/** Mistakes so far (target word | typed word | error types) and how often each error type happened. */
export const ResultsPanel = ({ results, stats }: ResultsPanelProps) => {
  const mistakes = results.filter((result) => result.errors.length > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold">Mistakes</h2>
        {mistakes.length === 0 ? (
          <EmptyState title="No mistakes yet" description="Words you type wrongly show up here with their error type." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-base">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Target</th>
                  <th className="py-2 pr-4 font-medium">Typed</th>
                  <th className="py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {mistakes.map((result) => (
                  <tr key={result.index} className="border-t">
                    <td className="py-2 pr-4">{result.target}</td>
                    <td className="py-2 pr-4 text-destructive">{result.typed}</td>
                    <td className="py-2">{result.errors.map((type) => errorLabels[type]).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold">Error rate by type</h2>
        {stats.length === 0 ? (
          <p className="text-muted-foreground">Finish a word to see the rates.</p>
        ) : (
          <ul className="space-y-2">
            {stats.map(({ type, count, chances }) => (
              <li key={type} className="flex items-center justify-between gap-4">
                <span>{errorLabels[type]}</span>
                <span className="text-muted-foreground">
                  {count} / {chances} ({Math.round((count / chances) * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
