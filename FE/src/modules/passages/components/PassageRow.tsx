import { FileText, Globe, Keyboard, Pencil, Trash2, Undo2, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ListRow, ListRowStat } from '@/shared/components/list-row';
import { Badge } from '@/shared/components/ui/badge';
import type { LearnerPassage } from '../types/passage.types';

interface PassageRowProps {
  passage: LearnerPassage;
  /** Shows the Edit button: an own private passage that is not waiting for review. */
  onEdit?: (passage: LearnerPassage) => void;
  /** Shows the Delete button: only for the learner's own private passages. The caller asks for confirmation. */
  onDelete?: (passage: LearnerPassage) => void;
  /** Shows the Request public button: an own private passage that is not waiting for review. */
  onRequestPublic?: (passage: LearnerPassage) => void;
  /** Shows the Withdraw request button: an own passage waiting for review. */
  onWithdraw?: (passage: LearnerPassage) => void;
}

// Square icon buttons in the red of the row; the name is in `aria-label`, the hint in `title`.
const iconButtonClass =
  'flex size-8 shrink-0 items-center justify-center text-primary/80 transition-colors hover:bg-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const IconButton = ({ icon: Icon, hint, label, onClick }: { icon: LucideIcon; hint: string; label: string; onClick: () => void }) => (
  <button type="button" aria-label={label} title={hint} onClick={onClick} className={iconButtonClass}>
    <Icon className="size-4" aria-hidden />
  </button>
);

/** Where one of the learner's own passages stands (SCRUM-176), as its tag says it. */
const ownStatus = (passage: LearnerPassage) => {
  if (passage.visibility === 'public') return 'Public';
  if (passage.status === 'pending') return 'Pending review';
  return passage.status === 'rejected' ? 'Rejected' : 'Private';
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * One passage of the Passages page, in the two-tier look of the admin users list (`UserRow`): the title and the source
 * on the left, the word count and the icon buttons on the right (Practice opens it on the Typing page; Edit, Request
 * public or Withdraw request, and Delete on the learner's own private passages); below, where it stands, the reason of a
 * refusal and the day it was added.
 */
export const PassageRow = ({ passage, onEdit, onDelete, onRequestPublic, onWithdraw }: PassageRowProps) => (
  <ListRow
    identity={
      <div className="flex min-w-0 items-center gap-3">
        {/* 61px, like the avatar of `UserRow`. */}
        <div className="flex size-[61px] shrink-0 items-center justify-center bg-primary/25 text-primary" aria-hidden>
          <FileText className="size-7" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-2xl font-extrabold text-primary/80">{passage.title}</h3>
          <p className="truncate text-lg text-muted-foreground">{passage.source}</p>
        </div>
      </div>
    }
    extra={
      <div className="flex justify-end">
        <ListRowStat label="WORDS" value={String(passage.wordCount)} />
      </div>
    }
    action={
      <div className="flex items-center">
        <Link to={`/typing?passage=${passage._id}`} aria-label={`Practice ${passage.title}`} title="Practice" className={iconButtonClass}>
          <Keyboard className="size-4" aria-hidden />
        </Link>
        {onEdit && <IconButton icon={Pencil} hint="Edit" label={`Edit ${passage.title}`} onClick={() => onEdit(passage)} />}
        {onRequestPublic && (
          <IconButton icon={Globe} hint="Request public" label={`Request public ${passage.title}`} onClick={() => onRequestPublic(passage)} />
        )}
        {onWithdraw && (
          <IconButton icon={Undo2} hint="Withdraw request" label={`Withdraw request ${passage.title}`} onClick={() => onWithdraw(passage)} />
        )}
        {onDelete && <IconButton icon={Trash2} hint="Delete" label={`Delete ${passage.title}`} onClick={() => onDelete(passage)} />}
      </div>
    }
    tags={
      passage.isOwn && (
        <>
          <Badge>{ownStatus(passage)}</Badge>
          {passage.reviewNote && <span className="text-sm text-destructive">Reason: {passage.reviewNote}</span>}
        </>
      )
    }
    meta={formatDate(passage.createdAt)}
  />
);
