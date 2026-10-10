// Reference module: copy this folder when creating a new feature (or run `npm run gen:module <name>`).
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import type { Note } from '../types/note.types';

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  onTagClick: (tag: string) => void;
}

export const NoteCard = ({ note, onEdit, onDelete, onTagClick }: NoteCardProps) => (
  <Card className="flex h-full flex-col">
    <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-2">
      <CardTitle className="line-clamp-2 text-base">{note.title}</CardTitle>
      <div className="flex shrink-0">
        <Button variant="ghost" size="sm" aria-label={`Edit ${note.title}`} onClick={() => onEdit(note)}>
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" aria-label={`Delete ${note.title}`} onClick={() => onDelete(note)}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col gap-3">
      {note.content && <p className="line-clamp-4 whitespace-pre-line text-base text-muted-foreground">{note.content}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {note.tags.map((tag) => (
          <button key={tag} type="button" onClick={() => onTagClick(tag)}>
            <Badge variant="secondary">#{tag}</Badge>
          </button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground">
          {new Date(note.updatedAt).toLocaleDateString()}
        </span>
      </div>
    </CardContent>
  </Card>
);
