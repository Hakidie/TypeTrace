import { AlertTriangle, Bot, Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { Button } from '@/shared/components/ui/button';
import { chatConfig } from '../chat.config';
import type { useChat } from '../hooks/use-chat';
import { ChatComposer } from './ChatComposer';
import { ChatMessageBubble } from './ChatMessageBubble';

interface ChatPanelProps {
  chat: ReturnType<typeof useChat>;
}

/** Messages, suggestions, errors and the message box. Used inside the chat popup. */
export const ChatPanel = ({ chat }: ChatPanelProps) => {
  const { messages, send, retry, isThinking, error } = chat;
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isThinking, error]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-10 items-center justify-center bg-primary/10 text-primary">
              <Bot className="size-5" />
            </div>
            <p className="text-base text-muted-foreground">{chatConfig.welcomeMessage}</p>
            <div className="flex flex-col gap-2">
              {chatConfig.suggestions.map((suggestion) => (
                <Button key={suggestion} variant="outline" size="sm" className="h-auto whitespace-normal py-1.5" onClick={() => send(suggestion)}>
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => <ChatMessageBubble key={index} message={message} />)
        )}

        {isThinking && (
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {chatConfig.botName} is thinking…
          </div>
        )}

        {error && (
          <div role="alert" className="space-y-2 border border-destructive/40 p-3 text-base">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              {getApiErrorMessage(error, 'The AI did not answer. Please try again.')}
            </p>
            <Button variant="outline" size="sm" onClick={retry}>
              <RotateCcw className="size-4" />
              Try again
            </Button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3">
        <ChatComposer disabled={isThinking} onSend={send} />
      </div>
    </div>
  );
};
