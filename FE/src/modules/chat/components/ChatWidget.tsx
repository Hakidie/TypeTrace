import { Bot, SquarePen, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/components/ui/button';
import { chatConfig } from '../chat.config';
import { useChat } from '../hooks/use-chat';
import { chatPopupStore, useChatPopupOpen } from '../store/chat-popup.store';
import { ChatPanel } from './ChatPanel';

/**
 * The chat popup under the header, on the right, opened by "AI chat" in the account menu (`chatPopupStore`). It is drawn
 * in `document.body`: the header blurs what is behind it, which would make a fixed popup follow the header. Closing the
 * popup keeps the conversation (the widget stays mounted). Registered as a widget in chat.module.ts.
 */
export const ChatWidget = () => {
  const open = useChatPopupOpen();
  const chat = useChat();

  // Escape closes the popup.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && chatPopupStore.set(false);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
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
              <Button variant="ghost" size="sm" aria-label="Close chat" onClick={() => chatPopupStore.set(false)}>
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
