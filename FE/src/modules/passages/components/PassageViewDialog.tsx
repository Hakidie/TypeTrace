import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import type { Passage, ReviewDecision } from '../types/passage.types';

interface PassageViewDialogProps {
  /** The passage to read; the dialog is closed without one. */
  passage?: Passage;
  onClose: () => void;
  /** Shows Reject and Approve, for a passage waiting for review. */
  onReview?: (passage: Passage, decision: ReviewDecision) => void;
}

/** The whole text of a passage and where it comes from, so an admin can read a learner's request before deciding. */
export const PassageViewDialog = ({ passage, onClose, onReview }: PassageViewDialogProps) => (
  <Dialog open={passage !== undefined} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-w-2xl">
      {passage && (
        <>
          <DialogHeader>
            <DialogTitle>{passage.title}</DialogTitle>
            <DialogDescription>
              by {passage.ownerName} · {passage.wordCount} words
            </DialogDescription>
            {/* Before a passage becomes public, check that its source allows it to be reused. */}
            <p className="break-words text-base text-muted-foreground">Source: {passage.source}</p>
          </DialogHeader>
          <p className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap border border-border p-3 text-base">{passage.content}</p>
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
  </Dialog>
);
