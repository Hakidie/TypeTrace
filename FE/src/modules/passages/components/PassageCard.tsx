import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import type { Passage } from '../types/passage.types';

interface PassageCardProps {
  passage: Passage;
  /** Shows the Edit chip when given. The status is changed in the form that opens, not on the card. */
  onEdit?: (passage: Passage) => void;
}

// The Edit chip looks like the badges, but is a button.
const chipClass = 'cursor-pointer hover:bg-primary/80';

export const PassageCard = ({ passage, onEdit }: PassageCardProps) => (
  <Card className="flex h-full flex-col border-0 bg-primary/15 text-primary shadow-none">
    <CardHeader className="p-4 pb-2">
      <CardTitle className="line-clamp-2 text-[1.5rem] leading-tight text-primary/80">{passage.title}</CardTitle>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-0">
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
        </div>
      </div>
    </CardContent>
  </Card>
);
