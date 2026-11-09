import {
  Archive,
  Check,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Clock,
  Eye,
  FileText,
  Globe,
  Keyboard,
  Languages,
  Lock,
  Pencil,
  PencilLine,
  Trash2,
  Trophy,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { LabeledTag } from '@/shared/components/labeled-tag';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { useFitLines } from '@/shared/hooks/use-fit-lines';
import { cn } from '@/shared/lib/utils';
import { canHardDelete, type LearnerPassage, type Passage, type ReviewDecision } from '../types/passage.types';

/** What a card of the review queue needs (SCRUM-176). */
interface PassageReview {
  /** Chosen (by clicking the card) for a decision on many passages at once. */
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  /** Opens the whole text and its source. */
  onView: (passage: Passage) => void;
  onDecide: (passage: Passage, decision: ReviewDecision) => void;
}

/** What a card of the learner's Passages page can do with a passage (SCRUM-176). Each one is an icon button when given. */
interface OwnPassageActions {
  /** An own private passage that is not waiting for review. */
  onEdit?: (passage: LearnerPassage) => void;
  /** Only the learner's own private passages. The caller asks for confirmation. */
  onDelete?: (passage: LearnerPassage) => void;
  /** An own private passage that is not waiting for review. */
  onRequestPublic?: (passage: LearnerPassage) => void;
  /** An own passage waiting for review. */
  onWithdraw?: (passage: LearnerPassage) => void;
  /** Makes the Rejected badge a button that opens the reason of the refusal. */
  onShowReason?: (passage: LearnerPassage) => void;
}

interface PassageCardProps {
  /** An admin's `Passage` (with its text), or one of the learner list (`LearnerPassage`, no text). */
  passage: Passage | LearnerPassage;
  /** Shows the Edit chip when given. The status is changed in the form that opens, not on the card. */
  onEdit?: (passage: Passage) => void;
  /** The bank's hard delete, offered only where `canHardDelete` allows it (archived, not a placement passage). */
  onDelete?: (passage: Passage) => void;
  /**
   * A card of the review queue (a request, or a learner's edit of a public passage, which shows the proposed text and an
   * Edited badge): it also says who asked, the source and when, is chosen by a click for a decision on
   * many at once, and the View, Approve and Reject icon buttons at the top right.
   */
  review?: PassageReview;
  /** A card of the learner's Passages page: the icon buttons at the top right (Practice always, the others when given). */
  own?: OwnPassageActions;
}

/**
 * What kind of passage this is (Rank, Placement or Regular: one of them), as an icon before the title with a tooltip, without a background; as big and as red as the title text (24px, `text-primary/80`), in the height of one title line (`leading-tight`).
 */
const PassageTag = ({ icon: Icon, label }: { icon: LucideIcon; label: string }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={label}
          tabIndex={0}
          className="inline-flex h-[1.875rem] items-center justify-center text-primary/80 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon className="size-6" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

/** The icon of each state a passage can be in, shown before its name in the status badge. */
const statusIcons: Record<string, LucideIcon> = {
  draft: FileText,
  published: CircleCheck,
  archived: Archive,
  pending: Clock,
  rejected: CircleX,
};

/** The icon and the name of a state, as the content of the status badge. */
const StatusContent = ({ status }: { status: string }) => {
  const Icon = statusIcons[status.toLowerCase()] ?? FileText;
  return (
    <>
      <Icon className="mr-1.5 size-4" aria-hidden />
      {status}
    </>
  );
};

const chipClass = 'cursor-pointer hover:bg-primary/80';

// Square icon buttons in the red of the card; the name is in `aria-label`, the hint in `title`.
const iconButtonClass =
  'flex size-8 shrink-0 items-center justify-center text-primary/80 transition-colors hover:bg-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const IconButton = ({
  icon: Icon,
  hint,
  label,
  onClick,
  className,
}: {
  icon: LucideIcon;
  hint: string;
  label: string;
  onClick: () => void;
  className?: string;
}) => (
  <button type="button" aria-label={label} title={hint} onClick={onClick} className={cn(iconButtonClass, className)}>
    <Icon className="size-4" aria-hidden />
  </button>
);

/** Where one of the learner's own passages stands (SCRUM-176), as its badge says it. */
const ownStatus = (passage: LearnerPassage) => {
  // A public passage waits again while an edit of it does, and shows Rejected when the last edit was turned down.
  if (passage.visibility === 'public') {
    if (passage.editPending) return 'Pending';
    return passage.reviewNote ? 'Rejected' : 'Published';
  }
  if (passage.status === 'pending') return 'Pending';
  return passage.status === 'rejected' ? 'Rejected' : 'Draft';
};

/**
 * The start of the text in a card of the learner's Passages page: it shows as many lines as the card has room for (the
 * page gives the cards the height of the panel), 2 at least; 4 on a phone, where the page grows instead.
 */
const FitText = ({ children }: { children: string }) => {
  const { ref, lines } = useFitLines<HTMLDivElement>(2);
  return (
    <div ref={ref} className="min-h-24 flex-1 overflow-hidden text-base text-muted-foreground lg:min-h-12">
      <p className="line-clamp-4" style={{ WebkitLineClamp: lines }}>
        {children}
      </p>
    </div>
  );
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const PassageCard = ({ passage, onEdit, onDelete, review, own }: PassageCardProps) => {
  // The admin's passage has `updatedAt`; the learner's list item has not. `review` and `onEdit` come with the first, `own`
  // with the second.
  const full = 'updatedAt' in passage ? passage : undefined;
  // A review card of a learner's edit shows the proposed text, not the approved one that is public meanwhile.
  const shown = full?.pendingEdit ?? passage;
  const learner = passage as LearnerPassage;
  // The learner's list only holds Vietnamese passages that are not for the placement test or the ranked duels, so its items
  // (which do not say it) are shown as such: the cards of both lists look the same.
  const isPlacement = full?.isPlacement ?? false;
  const isRanked = full?.isRanked ?? false;
  const isEnglish = full?.language === 'en';
  return (
    <Card
      role="article"
      className={cn(
        'group flex h-full flex-col border-0 bg-primary/15 text-primary shadow-none',
        // The learner's own list has no background: the tint shows on hover, like the rows of My Sessions.
        own && 'bg-transparent transition-colors hover:bg-primary/15',
        review && 'cursor-pointer transition-colors hover:bg-primary/20',
        review?.selected && 'bg-primary/25 ring-2 ring-primary',
        // Past the limit of the owner's plan (US11.1): dimmed.
        own && learner.locked && 'opacity-60',
      )}
      // A card of the review queue is chosen by clicking it (or Space / Enter on it), for a decision on many at once.
      {...(review && {
        tabIndex: 0,
        onClick: (event: MouseEvent<HTMLDivElement>) => {
          if (!(event.target as HTMLElement).closest('button, a')) review.onSelectedChange(!review.selected);
        },
        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
          if (event.target === event.currentTarget && (event.key === ' ' || event.key === 'Enter')) {
            event.preventDefault();
            review.onSelectedChange(!review.selected);
          }
        },
      })}
    >
      {review?.selected && <span className="sr-only">Selected</span>}
      <CardHeader className={cn('p-4 pb-2', (review || own || onEdit || onDelete) && 'flex-row items-start justify-between gap-2 space-y-0')}>
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex shrink-0 items-center gap-1">
            {/* One icon for the kind of passage, the icons of the Typing tabs: Rank (used in ranked duels), else Placement, else Regular (Practice). */}
            {isRanked ? (
              <PassageTag icon={Trophy} label="Rank: used in ranked duels" />
            ) : isPlacement ? (
              <PassageTag icon={ClipboardCheck} label="Placement passage" />
            ) : (
              <PassageTag icon={Keyboard} label="Regular passage" />
            )}
          </div>
          <CardTitle className="line-clamp-2 min-w-0 text-[1.5rem] leading-tight text-primary/80">{shown.title}</CardTitle>
        </div>
        {review && full && (
          <div className="-mr-1 -mt-1 flex shrink-0 items-center">
            {/* Shown on hover or keyboard focus; always on touch screens, which cannot hover. */}
            <div className="flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
              <IconButton icon={Eye} hint="View" label={`View ${shown.title}`} onClick={() => review.onView(full)} />
              <IconButton icon={Check} hint="Approve" label={`Approve ${shown.title}`} onClick={() => review.onDecide(full, 'approve')} />
              <IconButton
                icon={X}
                hint="Reject"
                label={`Reject ${shown.title}`}
                onClick={() => review.onDecide(full, 'reject')}
                className="hover:bg-destructive/20 hover:text-destructive"
              />
            </div>
          </div>
        )}
        {(onEdit || onDelete) && full && !review && (
          // Shown on hover or keyboard focus; always on touch screens, which cannot hover.
          <div className="-mr-1 -mt-1 flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
            {onEdit && <IconButton icon={Pencil} hint="Edit" label={`Edit ${passage.title}`} onClick={() => onEdit(full)} />}
            {onDelete && canHardDelete(full) && (
              <IconButton
                icon={Trash2}
                hint="Delete"
                label={`Delete ${passage.title}`}
                onClick={() => onDelete(full)}
                className="hover:bg-destructive/20 hover:text-destructive"
              />
            )}
          </div>
        )}
        {own && (
          // Shown on hover or keyboard focus; always on touch screens, which cannot hover.
          <div className="-mr-1 -mt-1 flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
            {!learner.locked && (
              <Link to={`/typing?passage=${passage._id}`} aria-label={`Practice ${passage.title}`} title="Practice" className={iconButtonClass}>
                <Keyboard className="size-4" aria-hidden />
              </Link>
            )}
            {own.onEdit && <IconButton icon={Pencil} hint="Edit" label={`Edit ${passage.title}`} onClick={() => own.onEdit?.(learner)} />}
            {own.onRequestPublic && (
              <IconButton icon={Globe} hint="Request public" label={`Request public ${passage.title}`} onClick={() => own.onRequestPublic?.(learner)} />
            )}
            {own.onWithdraw && (
              <IconButton icon={Undo2} hint="Withdraw request" label={`Withdraw request ${passage.title}`} onClick={() => own.onWithdraw?.(learner)} />
            )}
            {own.onDelete && <IconButton icon={Trash2} hint="Delete" label={`Delete ${passage.title}`} onClick={() => own.onDelete?.(learner)} />}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4 pt-0">
        {review && full && (
          // A request is a learner's own text: check where it comes from before it becomes public.
          <p className="truncate text-sm text-primary/70" title={shown.source}>
            by {passage.ownerName} · {shown.source} · asked {formatDate(full.updatedAt)}
          </p>
        )}
        {shown.content &&
          (own ? <FitText>{shown.content}</FitText> : <p className="line-clamp-3 min-h-[4.5rem] text-base text-muted-foreground">{shown.content}</p>)}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="text-sm text-primary/70">{passage.wordCount} words</span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isEnglish ? (
              <LabeledTag icon={Languages} text="English" hint="English passage, used in ranked duels" />
            ) : (
              <LabeledTag icon={Languages} text="Vietnamese" hint="Vietnamese passage, for practice and the placement test" />
            )}
            {review && full?.pendingEdit && <LabeledTag icon={PencilLine} text="Edited" />}
            {own && learner.locked && <LabeledTag icon={Lock} text="Locked" hint="Over your plan's limit: upgrade to Premium or delete some passages to open it again" />}
            {own ? (
              own.onShowReason && learner.reviewNote ? (
                <Badge asChild className={chipClass}>
                  <button type="button" onClick={() => own.onShowReason?.(learner)} aria-label={`Show reason ${passage.title}`} title="Show the reason">
                    <StatusContent status={ownStatus(learner)} />
                  </button>
                </Badge>
              ) : (
                <Badge>
                  <StatusContent status={ownStatus(learner)} />
                </Badge>
              )
            ) : (
              <Badge className="capitalize">
                <StatusContent status={passage.status} />
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
