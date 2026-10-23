import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';
import type { Passage, ReviewDecision } from '../types/passage.types';

/** What a card of the review queue needs (SCRUM-176). */
interface PassageReview {
  /** Ticked for a decision on many passages at once. */
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  /** Opens the whole text and its source. */
  onView: (passage: Passage) => void;
  onDecide: (passage: Passage, decision: ReviewDecision) => void;
}

interface PassageCardProps {
  passage: Passage;
  /** Shows the Edit chip when given. The status is changed in the form that opens, not on the card. */
  onEdit?: (passage: Passage) => void;
  /**
   * A card of the review queue: it also says who asked, the source and when, has a box to tick it for a decision on
   * many at once, and the View, Approve and Reject chips.
   */
  review?: PassageReview;
}

// The chips look like the badges, but are buttons.
const chipClass = 'cursor-pointer hover:bg-primary/80';
const rejectChipClass = 'cursor-pointer hover:bg-destructive/80';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const PassageCard = ({ passage, onEdit, review }: PassageCardProps) => (
  <Card className="flex h-full flex-col border-0 bg-primary/15 text-primary shadow-none">
    <CardHeader className={cn('p-4 pb-2', review && 'flex-row items-start justify-between gap-2 space-y-0')}>
      <CardTitle className="line-clamp-2 min-w-0 text-[1.5rem] leading-tight text-primary/80">{passage.title}</CardTitle>
      {review && (
        <input
          type="checkbox"
          aria-label={`Select ${passage.title}`}
          checked={review.selected}
          onChange={(event) => review.onSelectedChange(event.target.checked)}
          className="mt-1.5 size-4 shrink-0 cursor-pointer accent-primary"
        />
      )}
    </CardHeader>
    <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-0">
      {review && (
        // A request is a learner's own text: check where it comes from before it becomes public.
        <p className="truncate text-sm text-primary/70" title={passage.source}>
          by {passage.ownerName} · {passage.source} · asked {formatDate(passage.updatedAt)}
        </p>
      )}
      <p className="line-clamp-4 text-base text-muted-foreground">{passage.content}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="text-sm text-primary/70">{passage.wordCount} words</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {passage.isPlacement && <Badge>Placement</Badge>}
          <Badge className="capitalize">{passage.status}</Badge>
          {onEdit && (
            <Badge asChild className={chipClass}>
              <button type="button" onClick={() => onEdit(passage)} aria-label={`Edit ${passage.title}`}>
                Edit
              </button>
            </Badge>
          )}
          {review && (
            <>
              <Badge asChild className={chipClass}>
                <button type="button" onClick={() => review.onView(passage)} aria-label={`View ${passage.title}`}>
                  View
                </button>
              </Badge>
              <Badge asChild className={chipClass}>
                <button type="button" onClick={() => review.onDecide(passage, 'approve')} aria-label={`Approve ${passage.title}`}>
                  Approve
                </button>
              </Badge>
              <Badge asChild variant="destructive" className={rejectChipClass}>
                <button type="button" onClick={() => review.onDecide(passage, 'reject')} aria-label={`Reject ${passage.title}`}>
                  Reject
                </button>
              </Badge>
            </>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);
