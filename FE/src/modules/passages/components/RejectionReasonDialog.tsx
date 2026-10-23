import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import type { LearnerPassage } from '../types/passage.types';

interface RejectionReasonDialogProps {
  /** The turned-down passage to explain; the dialog is closed without one. */
  passage?: LearnerPassage;
  onClose: () => void;
}

/** Why an admin turned down the request to make a passage public (SCRUM-176): opened by the Rejected badge of its card. */
export const RejectionReasonDialog = ({ passage, onClose }: RejectionReasonDialogProps) => (
  <Dialog open={passage !== undefined} onOpenChange={(open) => !open && onClose()}>
    <DialogContent>
      {passage && (
        <DialogHeader>
          <DialogTitle>{passage.visibility === 'public' ? 'Edit rejected' : 'Request rejected'}</DialogTitle>
          <DialogDescription>
            {passage.visibility === 'public'
              ? `An admin turned down your edit of "${passage.title}". The approved text is still public; you can edit it again.`
              : `An admin turned down "${passage.title}". You can edit it and ask again.`}
          </DialogDescription>
          <p className="break-words whitespace-pre-wrap border border-border p-3 text-base">{passage.reviewNote}</p>
        </DialogHeader>
      )}
    </DialogContent>
  </Dialog>
);
