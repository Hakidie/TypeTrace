import { cn } from '@/shared/lib/utils';
import type { WordResult } from '../utils/typing-session';

interface PassageViewProps {
  words: string[];
  results: WordResult[];
}

/** The passage word by word: finished words are coloured, the next word to type is highlighted. */
export const PassageView = ({ words, results }: PassageViewProps) => (
  <p className="flex flex-wrap gap-x-2 gap-y-1 text-xl leading-relaxed" aria-label="Passage to type">
    {words.map((word, index) => {
      const result = results[index];
      return (
        <span
          key={index}
          className={cn(
            index === results.length && 'bg-primary/10 text-primary underline underline-offset-4',
            result && result.errors.length === 0 && 'text-muted-foreground',
            result && result.errors.length > 0 && 'text-destructive line-through',
            !result && index !== results.length && 'text-foreground',
          )}
        >
          {word}
        </span>
      );
    })}
  </p>
);
