import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Textarea } from '@/shared/components/ui/textarea';
import { useReviewPassages } from '../hooks/use-passages';
import { REVIEW_NOTE_MAX } from '../passages.config';
import type { Passage, ReviewDecision } from '../types/passage.types';

interface ReviewDialogProps {
  decision: ReviewDecision;
  /** The requests to decide on: one row, or the selected ones. */
  passages: Passage[];
  onClose: () => void;
  /** Called once the decision is saved (or there was nothing left to decide), before the dialog closes. */
  onDone?: () => void;
}

/**
 * 409: another admin decided first, or the learner withdrew the request; 404: the learner deleted the passage. Nothing
 * is left to try again, and the queue has been asked for again (`useReviewPassages`).
 */
const isNoLongerWaiting = (error: unknown) => {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 409 || status === 404;
};

/**
 * Asks before approving or turning down learners' requests to make passages public (SCRUM-176). Turning down needs a
 * reason, which the learners see. Mount it with a `key` per decision, so the reason starts empty.
 */
export const ReviewDialog = ({ decision, passages, onClose, onDone }: ReviewDialogProps) => {
  const { t } = useTranslation('passages');
  const review = useReviewPassages();
  const [reason, setReason] = useState('');
  const reject = decision === 'reject';
  const one = passages.length === 1;
  const what = one
    ? t('admin.review.quoted', { title: passages[0].pendingEdit?.title ?? passages[0].title })
    : t('admin.review.passages', { count: passages.length });

  // Edits of public passages are decided here too: approved they replace the text, turned down the approved text stays.
  const edits = passages.every((passage) => passage.pendingEdit !== undefined);
  const description = edits
    ? reject
      ? t(one ? 'admin.review.editRejectOne' : 'admin.review.editRejectMany')
      : t(one ? 'admin.review.editApproveOne' : 'admin.review.editApproveMany')
    : reject
    ? t(one ? 'admin.review.rejectOne' : 'admin.review.rejectMany')
    : t(one ? 'admin.review.approveOne' : 'admin.review.approveMany');

  const finish = () => {
    onDone?.();
    onClose();
  };

  // Another failure (network, server) keeps the dialog open to try again; the backend message is toasted either way.
  const confirm = () =>
    review.mutate(
      { ids: passages.map((passage) => passage._id), decision, reason: reason.trim() },
      {
        onSuccess: finish,
        onError: (error) => {
          if (isNoLongerWaiting(error)) finish();
        },
      },
    );

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t(reject ? 'admin.review.rejectTitle' : 'admin.review.approveTitle', { what })}
      description={description}
      confirmLabel={reject ? t('admin.card.reject') : t('admin.card.approve')}
      destructive={reject}
      pending={review.isPending}
      confirmDisabled={reject && reason.trim() === ''}
      onConfirm={confirm}
    >
      {reject && (
        <div className="space-y-1">
          <Textarea
            aria-label={t('admin.review.reasonLabel')}
            placeholder={t('admin.review.reasonPlaceholder')}
            maxLength={REVIEW_NOTE_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="text-right text-sm text-muted-foreground">
            {reason.length}/{REVIEW_NOTE_MAX}
          </p>
        </div>
      )}
    </ConfirmDialog>
  );
};
