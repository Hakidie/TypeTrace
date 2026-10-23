import { Bot, MessageCircle, SquarePen, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { chatConfig } from '../chat.config';
import { useChat } from '../hooks/use-chat';
import { ChatPanel } from './ChatPanel';

/**
 * The chat button in the top navigation (a tab like the others, highlighted while the chat is open) that opens a small
 * chat popup under the header, on the right. The popup is drawn in `document.body`: the header blurs what is behind it,
 * which would make a fixed popup follow the header. Closing the popup keeps the conversation. Registered as a nav
 * widget in chat.module.ts.
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
    <>
      <button
        type="button"
        aria-label={open ? 'Close chat' : 'Open chat'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <MessageCircle className="size-4" />
        <span className="hidden sm:inline">AI chat</span>
      </button>

      {open &&
        createPortal(
          <section
            role="dialog"
            aria-label={chatConfig.botName}
            className="fixed top-[4.5rem] right-4 z-50 flex h-[min(560px,calc(100vh-6rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden border bg-card shadow-2xl md:right-8"
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
          </section>,
          document.body,
        )}
    </>
  );
};
