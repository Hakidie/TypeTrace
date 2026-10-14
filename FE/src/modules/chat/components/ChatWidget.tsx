import { Bot, MessageCircle, SquarePen, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { chatConfig } from '../chat.config';
import { useChat } from '../hooks/use-chat';
import { ChatPanel } from './ChatPanel';

/**
 * Floating chat: a framed button at the bottom center (same frame and height as the typing page's word count and timer) that opens a small
 * chat popup above it. Closing the popup keeps the conversation. Shown on every
 * page of the app through `widgets` in chat.module.ts.
 */
export const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const chat = useChat();

  // Escape closes the popup.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-3">
      {open && (
        <section
          role="dialog"
          aria-label={chatConfig.botName}
          className="flex h-[min(560px,calc(100vh-9rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden border bg-card shadow-2xl"
        >
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <div className="flex size-8 items-center justify-center bg-primary/10 text-primary">
              <Bot className="size-4" />
            </div>
            <p className="flex-1 font-semibold">{chatConfig.botName}</p>
            <Button variant="ghost" size="sm" aria-label="New chat" disabled={chat.messages.length === 0} onClick={chat.reset}>
              <SquarePen className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" aria-label="Close chat" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </Button>
          </header>
          <ChatPanel chat={chat} />
        </section>
      )}

      <Button
        className="h-auto gap-2 bg-primary/15 px-3 py-1.5 text-[1.125rem] text-primary hover:bg-primary/25 hover:opacity-100"
        aria-label={open ? 'Close chat' : 'Open chat'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
        {open ? 'Close' : 'AI chat'}
      </Button>
    </div>
  );
};
