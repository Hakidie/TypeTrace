import { Bot, User } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { ChatMessage } from '../types/chat.types';

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

export const ChatMessageBubble = ({ message }: ChatMessageBubbleProps) => {
  const fromUser = message.role === 'user';
  const Icon = fromUser ? User : Bot;

  return (
    <div className={cn('flex items-start gap-2', fromUser && 'flex-row-reverse')}>
      <div className="flex size-8 shrink-0 items-center justify-center bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div
        className={cn(
          'max-w-[80%] whitespace-pre-wrap break-words px-4 py-2 text-base',
          fromUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        )}
      >
        {message.text}
      </div>
    </div>
  );
};
