import { Fragment } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { diffWords } from '../lib/text-diff';
import { countWords } from '../passages.config';
import type { Passage, ReviewDecision } from '../types/passage.types';

interface PassageViewDialogProps {
  /** The passage to read; the dialog is closed without one. */
  passage?: Passage;
  onClose: () => void;
  /** Shows Reject and Approve, for a passage waiting for review. */
  onReview?: (passage: Passage, decision: ReviewDecision) => void;
}

/** `before` → `after` with the words that change marked: taken out struck through in red, put in highlighted. */
const Diff = ({ before, after }: { before: string; after: string }) => (
  <>
    {diffWords(before, after).map((part, index, parts) => {
      if (part.kind === 'removed') {
        // The last word of a text has no space after it: keep the word put in from sticking to it.
        const gap = parts[index + 1]?.kind === 'added' && !/\s$/.test(part.text) ? ' ' : '';
        return (
          <Fragment key={index}>
            <del className="bg-destructive/15 text-destructive">{part.text}</del>
            {gap}
          </Fragment>
        );
      }
      if (part.kind === 'added') {
        return (
          <ins key={index} className="bg-primary/25 font-semibold text-primary no-underline">
            {part.text}
          </ins>
        );
      }
      return <span key={index}>{part.text}</span>;
    })}
  </>
);

/**
 * The whole text of a passage and where it comes from, so an admin can read a learner's request before deciding. For a
 * learner's edit of a public passage it shows what changes (title, source and text) against the approved version.
 */
export const PassageViewDialog = ({ passage, onClose, onReview }: PassageViewDialogProps) => {
  const edit = passage?.pendingEdit;
  return (
  <Dialog open={passage !== undefined} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-w-2xl">
      {passage && (
        <>
          <DialogHeader>
            {/* The name stays the proposed title for screen readers; the marks are for the eyes. */}
            <DialogTitle aria-label={edit?.title ?? passage.title}>
              {edit ? <Diff before={passage.title} after={edit.title} /> : passage.title}
            </DialogTitle>
            <DialogDescription>
              by {passage.ownerName} · {edit ? countWords(edit.content) : passage.wordCount} words
            </DialogDescription>
            {/* Before a passage becomes public, check that its source allows it to be reused. */}
            <p className="break-words text-base text-muted-foreground">
              Source: {edit ? <Diff before={passage.source} after={edit.source} /> : passage.source}
            </p>
          </DialogHeader>
          {/* An edit of a public passage: what it changes is marked against the approved text, which everyone reads until then. */}
          <p
            role={edit ? 'group' : undefined}
            aria-label={edit ? 'Changes' : undefined}
            className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap border border-border p-3 text-base"
          >
            {edit ? <Diff before={passage.content} after={edit.content} /> : passage.content}
          </p>
          {onReview && (
            <DialogFooter className="gap-2">
              <Button variant="destructive" onClick={() => onReview(passage, 'reject')}>
                Reject
              </Button>
              <Button onClick={() => onReview(passage, 'approve')}>Approve</Button>
            </DialogFooter>
          )}
        </>
      )}
    </DialogContent>
  </Dialog>  );
};
