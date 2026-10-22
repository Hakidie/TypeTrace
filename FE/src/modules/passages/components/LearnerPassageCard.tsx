import { Link } from 'react-router-dom';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import type { LearnerPassage } from '../types/passage.types';

interface LearnerPassageCardProps {
  passage: LearnerPassage;
  /** Shows the Delete chip: only for the learner's own passages. */
  onDelete?: (passage: LearnerPassage) => void;
}

// The chips look like the badges but are a link and a button, like the Edit chip of `PassageCard`.
const chipClass = 'cursor-pointer hover:bg-primary/80';

/** One passage of the Passages page, in the look of `PassageCard`. Practice opens it on the Typing page. */
export const LearnerPassageCard = ({ passage, onDelete }: LearnerPassageCardProps) => (
  <Card className="flex h-full flex-col border-0 bg-primary/15 text-primary shadow-none">
    <CardHeader className="p-4 pb-2">
      <CardTitle className="line-clamp-2 text-[1.5rem] leading-tight text-primary/80">{passage.title}</CardTitle>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-0">
      <p className="truncate text-base text-muted-foreground">by {passage.ownerName}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="text-sm text-primary/70">{passage.wordCount} words</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {passage.visibility === 'private' && <Badge>Mine</Badge>}
          <Badge asChild className={chipClass}>
            <Link to={`/typing?passage=${passage._id}`} aria-label={`Practice ${passage.title}`}>
              Practice
            </Link>
          </Badge>
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
