import { Link } from 'react-router-dom';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import type { LearnerPassage } from '../types/passage.types';

interface LearnerPassageCardProps {
  passage: LearnerPassage;
  /** Shows the Delete chip: only for the learner's own private passages. */
  onDelete?: (passage: LearnerPassage) => void;
  /** Shows the Request public chip: an own private passage that is not waiting for review. */
  onRequestPublic?: (passage: LearnerPassage) => void;
  /** Shows the Withdraw request chip: an own passage waiting for review. */
  onWithdraw?: (passage: LearnerPassage) => void;
}

// The chips look like the badges but are a link and buttons, like the Edit chip of `PassageCard`.
const chipClass = 'cursor-pointer hover:bg-primary/80';

/** Where one of the learner's own passages stands (SCRUM-176), as its badge says it. */
const ownStatus = (passage: LearnerPassage) => {
  if (passage.visibility === 'public') return 'Public';
  if (passage.status === 'pending') return 'Pending review';
  return passage.reviewNote ? 'Rejected' : 'Private';
};

/**
 * One passage of the Passages page, in the look of `PassageCard`. Practice opens it on the Typing page. The learner's own
 * passages also show where they stand, the reason of a refusal, and the chips to ask for them to become public.
 */
export const LearnerPassageCard = ({ passage, onDelete, onRequestPublic, onWithdraw }: LearnerPassageCardProps) => (
  <Card className="flex h-full flex-col border-0 bg-primary/15 text-primary shadow-none">
    <CardHeader className="p-4 pb-2">
      <CardTitle className="line-clamp-2 text-[1.5rem] leading-tight text-primary/80">{passage.title}</CardTitle>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-0">
      <p className="truncate text-base text-muted-foreground">by {passage.ownerName}</p>
      {passage.isOwn && passage.reviewNote && (
        <p className="text-sm text-destructive">Reason: {passage.reviewNote}</p>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="text-sm text-primary/70">{passage.wordCount} words</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* A state, not an action: outlined, unlike the chips. */}
          {passage.isOwn && (
            <Badge variant="outline" className="border-primary/40 text-primary">
              {ownStatus(passage)}
            </Badge>
          )}
          <Badge asChild className={chipClass}>
            <Link to={`/typing?passage=${passage._id}`} aria-label={`Practice ${passage.title}`}>
              Practice
            </Link>
          </Badge>
          {onRequestPublic && (
            <Badge asChild className={chipClass}>
              <button type="button" onClick={() => onRequestPublic(passage)} aria-label={`Request public ${passage.title}`}>
                Request public
              </button>
            </Badge>
          )}
          {onWithdraw && (
            <Badge asChild className={chipClass}>
              <button type="button" onClick={() => onWithdraw(passage)} aria-label={`Withdraw request ${passage.title}`}>
                Withdraw request
              </button>
            </Badge>
          )}
          {onDelete && (
            <Badge asChild className={chipClass}>
              <button type="button" onClick={() => onDelete(passage)} aria-label={`Delete ${passage.title}`}>
                Delete
              </button>
            </Badge>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);
