import { Trophy } from 'lucide-react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { BotSprite } from '@/modules/tutorial/components/BotSprite';
import { cn } from '@/shared/lib/utils';
import { useWordChainBoard } from '../hooks/use-word-chain';

/**
 * A sample game: the bot's word, the player's answer (with the time it earned), the bot's answer, then answers that cost time,
 * one typed with a hint (−3s) and a word the bot refuses (struck through, −3s); the sides alternate.
 */
const SAMPLE = [
  { by: 'bot', first: 'học', second: 'sinh' },
  { by: 'me', first: 'sinh', second: 'viên', bonus: '+5s' },
  { by: 'bot', first: 'viên', second: 'chức' },
  { by: 'me', first: 'chức', second: 'vụ', penalty: 'Hint −3s' },
  { by: 'bot', first: 'vụ', second: 'án' },
  { by: 'me', first: 'án', second: 'xa', penalty: 'Wrong −3s', refused: true },
] as const;

/**
 * How Nối từ is played, drawn with the pieces of the game (decorative, for the Minigames tile): the bot Nhịp on the left, the
 * player's avatar on the right, each word in its bubble with the linking syllable in red, the first syllable of the next word
 * underlined with a dashed red line (it is the red one before), and the time bonus of the player's answer.
 */
export const WordChainPreview = () => {
  const { data: me } = useCurrentUser();
  return (
    <span aria-hidden="true" className="relative grid gap-1">
      {SAMPLE.map((word, i) => {
        const mine = word.by === 'me';
        return (
          <span key={word.second} className="flex flex-col">
            <span className={cn('flex items-end gap-3', i > 0 && 'mt-1', mine && 'flex-row-reverse')}>
              {mine ? (
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden border border-primary/30 bg-primary/10">
                  <AvatarSprite look={me?.avatar ?? DEFAULT_AVATAR} crop="head" scale={1} label="" />
                </span>
              ) : (
                <span className="flex size-10 shrink-0 justify-center overflow-hidden border border-border bg-background/40">
                  {/* the top of the bot's strip (its head), a little smaller */}
                  <span className="-mt-1 origin-top scale-[0.7]">
                    <BotSprite level="medium" move={i === 0 ? 'idle' : 'typing'} />
                  </span>
                </span>
              )}
              <span
                className={cn(
                  'relative border px-4 py-1 text-xl transition-transform duration-300 sm:text-2xl',
                  mine ? 'border-primary/50 bg-primary/10 group-hover:-translate-x-1' : 'border-border bg-background/50 group-hover:translate-x-1',
                )}
              >
                <span className={cn(i > 0 && 'underline decoration-primary/50 decoration-dashed underline-offset-4')}>{word.first}</span>{' '}
                <span className={cn('font-semibold text-primary', 'refused' in word && 'text-destructive line-through decoration-2')}>{word.second}</span>
                {'penalty' in word && (
                  <span className="absolute -top-3 -left-3 border border-destructive/50 bg-background px-1.5 text-xs font-bold text-destructive">{word.penalty}</span>
                )}
                {'bonus' in word && (
                  <span className="absolute -top-3 -left-3 border border-primary/40 bg-background px-1.5 text-xs font-bold text-primary">{word.bonus}</span>
                )}
              </span>
            </span>
          </span>
        );
      })}
    </span>
  );
};

/** The player's place on this week's board, as a small badge (nothing before their first game of the week). */
export const WordChainWeekBadge = () => {
  const board = useWordChainBoard('week');
  const me = board.data?.me;
  if (!me) return null;
  return (
    <span className="flex shrink-0 items-center gap-2 border border-primary/30 bg-primary/10 px-3 py-1.5">
      <Trophy className="size-4 text-primary" aria-hidden="true" />
      <span className="text-sm">
        <span className="font-bold text-primary">#{me.rank}</span> <span className="text-muted-foreground">this week, {me.score} pts</span>
      </span>
    </span>
  );
};
