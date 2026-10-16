import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import type { Passage } from '../types/passage.types';

interface PassageCardProps {
  passage: Passage;
  /** Shows the Edit chip when given. */
  onEdit?: (passage: Passage) => void;
  /** Shows the Archive chip on a published passage when given. */
  onArchive?: (passage: Passage) => void;
  /** An archive request is running: the Archive chip waits. */
  archivePending?: boolean;
}

// Edit and Archive are chips that look like the Placement badge, but are buttons.
const chipClass = 'cursor-pointer hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50';

export const PassageCard = ({ passage, onEdit, onArchive, archivePending }: PassageCardProps) => (
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
          {onArchive && passage.status === 'published' && (
            <Badge asChild className={chipClass}>
              <button
                type="button"
                // A placement passage can never be archived (SCRUM-32).
                disabled={archivePending || passage.isPlacement}
                title={passage.isPlacement ? 'A placement passage cannot be archived.' : undefined}
                onClick={() => onArchive(passage)}
                aria-label={`Archive ${passage.title}`}
              >
                Archive
              </button>
            </Badge>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);
