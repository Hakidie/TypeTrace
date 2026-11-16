import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import type { LearnerPassage } from '../types/passage.types';

interface RejectionReasonDialogProps {
  /** The turned-down passage to explain; the dialog is closed without one. */
  passage?: LearnerPassage;
  onClose: () => void;
}

/** Why an admin turned down the request to make a passage public (SCRUM-176): opened by the Rejected badge of its card. */
export const RejectionReasonDialog = ({ passage, onClose }: RejectionReasonDialogProps) => {
  const { t } = useTranslation('passages');
  return (
  <Dialog open={passage !== undefined} onOpenChange={(open) => !open && onClose()}>
    <DialogContent>
      {passage && (
        <DialogHeader>
          <DialogTitle>{passage.visibility === 'public' ? t('reason.editRejected') : t('reason.requestRejected')}</DialogTitle>
          <DialogDescription>
            {passage.visibility === 'public'
              ? t('reason.editDescription', { title: passage.title })
              : t('reason.requestDescription', { title: passage.title })}
          </DialogDescription>
          <p className="break-words whitespace-pre-wrap border border-border p-3 text-base">{passage.reviewNote}</p>
        </DialogHeader>
      )}
    </DialogContent>
  </Dialog>
  );
};
