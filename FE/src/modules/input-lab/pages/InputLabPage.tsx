import { Copy, Download, Eraser } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { completedWords } from '@typetrace/shared';
import { FilterSelect } from '@/shared/components/data-table';
import { EmptyState } from '@/shared/components/empty-state';
import { PageHeader } from '@/shared/components/page-header';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { EventLogTable } from '../components/EventLogTable';
import { LogSummaryPanel } from '../components/LogSummaryPanel';
import { useInputLog } from '../hooks/use-input-log';
import { SAMPLE_TEXTS } from '../input-lab.config';
import type { TargetKind } from '../types/input-lab.types';
import { buildExport, detectWordCommits, summarize } from '../utils/input-log';

const imeOptions = ['Unikey', 'EVKey', 'macOS Vietnamese', 'Windows Vietnamese', 'Other'].map((label) => ({
  value: label,
  label,
}));
const methodOptions = ['Telex', 'Simple Telex', 'VNI'].map((label) => ({ value: label, label }));
const targetKinds: TargetKind[] = ['input', 'textarea', 'contenteditable'];

const targetClass = 'min-h-24 w-full border border-input bg-background px-3 py-2 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export const InputLabPage = () => {
  const { targetRef, entries, clear } = useInputLog();
  const [targetKind, setTargetKind] = useState<TargetKind>('input');
  const [ime, setIme] = useState('');
  const [method, setMethod] = useState('');
  const [note, setNote] = useState('');
  const [sampleId, setSampleId] = useState(SAMPLE_TEXTS[0].id);
  const sample = SAMPLE_TEXTS.find((item) => item.id === sampleId) ?? SAMPLE_TEXTS[0];
  const sampleWordCount = completedWords(`${sample.text} `).length;

  const summary = useMemo(() => summarize(entries), [entries]);
  const words = useMemo(() => detectWordCommits(entries), [entries]);

  const exportJson = () => JSON.stringify(buildExport(entries, { ime, method, note, sample: sample.id }, targetKind), null, 2);

  const copyJson = () => {
    if (!navigator.clipboard) {
      toast.error('Clipboard needs HTTPS or localhost. Use Download instead.');
      return;
    }
    navigator.clipboard.writeText(exportJson()).then(
      () => toast.success('Log copied as JSON'),
      () => toast.error('Could not copy. Use Download instead.'),
    );
  };

  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `input-log-${ime || 'ime'}-${method || 'method'}-${targetKind}-${sample.id}.json`.replace(/\s+/g, '-');
    link.click();
    URL.revokeObjectURL(url);
  };

  const changeTarget = (kind: TargetKind) => {
    setTargetKind(kind);
    clear();
  };

  const targetProps = { ref: targetRef, 'aria-label': 'Typing area', spellCheck: false, autoComplete: 'off' };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Input lab"
        description="Records keyboard, input and composition events while you type with a Vietnamese IME."
        actions={
          <>
            <Button variant="outline" onClick={clear} disabled={entries.length === 0}>
              <Eraser className="size-4" /> Clear
            </Button>
            <Button variant="outline" onClick={copyJson} disabled={entries.length === 0}>
              <Copy className="size-4" /> Copy JSON
            </Button>
            <Button onClick={downloadJson} disabled={entries.length === 0}>
              <Download className="size-4" /> Download
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <FilterSelect label="IME" value={ime} options={imeOptions} onChange={setIme} allLabel="Choose…" />
            <FilterSelect label="Method" value={method} options={methodOptions} onChange={setMethod} allLabel="Choose…" />
            <div className="flex items-center gap-2" role="group" aria-label="Target">
              <span className="text-base text-muted-foreground">Target</span>
              {targetKinds.map((kind) => (
                <Button
                  key={kind}
                  size="sm"
                  variant={kind === targetKind ? 'default' : 'outline'}
                  aria-pressed={kind === targetKind}
                  onClick={() => changeTarget(kind)}
                >
                  {kind}
                </Button>
              ))}
            </div>
          </div>
          <Input placeholder="Note (IME version, settings, OS...)" value={note} onChange={(event) => setNote(event.target.value)} />

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sample text">
            <span className="text-base text-muted-foreground">Sample</span>
            {SAMPLE_TEXTS.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={item.id === sampleId ? 'default' : 'outline'}
                aria-pressed={item.id === sampleId}
                onClick={() => setSampleId(item.id)}
              >
                {item.label}
              </Button>
            ))}
            <span className="text-sm text-muted-foreground">{sampleWordCount} words, end with a space</span>
          </div>
          <p className="text-base leading-relaxed">
            Type exactly: <span className="font-medium">{sample.text}</span>
          </p>

          {targetKind === 'input' && <input key="input" className={targetClass} {...targetProps} />}
          {targetKind === 'textarea' && <Textarea key="textarea" className={targetClass} {...targetProps} />}
          {targetKind === 'contenteditable' && (
            <div key="contenteditable" className={targetClass} contentEditable suppressContentEditableWarning role="textbox" {...targetProps} />
          )}
        </CardContent>
      </Card>

      {entries.length === 0 ? (
        <EmptyState title="No events yet" description="Click the typing area and start typing." />
      ) : (
        <>
          <LogSummaryPanel summary={summary} words={words} />
          <EventLogTable entries={entries} />
        </>
      )}
    </div>
  );
};
