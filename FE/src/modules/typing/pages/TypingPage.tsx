import { CheckCircle2, Keyboard, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/shared/components/page-header';
import { StatCard } from '@/shared/components/stat-card';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Textarea } from '@/shared/components/ui/textarea';
import { PassageView } from '../components/PassageView';
import { ResultsPanel } from '../components/ResultsPanel';
import { typingPassage } from '../typing.config';
import { accuracyOf, checkWords, splitTyped, summarizeErrors, toWords } from '../utils/typing-session';

const targetWords = toWords(typingPassage);

export const TypingPage = () => {
  const [text, setText] = useState('');

  const { done } = useMemo(() => splitTyped(text), [text]);
  const results = useMemo(() => checkWords(targetWords, done), [done]);
  const stats = useMemo(() => summarizeErrors(results), [results]);
  const isFinished = results.length >= targetWords.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Typing"
        description="Type the passage with your Vietnamese input method. A word is checked when you press space."
        actions={
          <Button variant="outline" onClick={() => setText('')} disabled={text === ''}>
            <RotateCcw className="size-4" /> Restart
          </Button>
        }
      />

      <Card className="space-y-4 p-5">
        <PassageView words={targetWords} results={results} />
        <Textarea
          aria-label="Typing area"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onPaste={(event) => event.preventDefault()}
          onDrop={(event) => event.preventDefault()}
          disabled={isFinished}
          spellCheck={false}
          autoComplete="off"
          rows={4}
          placeholder="Start typing here…"
        />
        {isFinished && (
          <p className="flex items-center gap-2 font-medium text-primary">
            <CheckCircle2 className="size-5" /> Finished. Press Restart to try again.
          </p>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Words checked" value={`${results.length} / ${targetWords.length}`} icon={Keyboard} />
        <StatCard label="Accuracy" value={`${accuracyOf(results)}%`} icon={CheckCircle2} hint="Words typed without any error" />
      </div>

      <ResultsPanel results={results} stats={stats} />
    </div>
  );
};
