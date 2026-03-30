import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ChatMessageItem } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useGlobalChat } from '@/hooks/useGlobalChat';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export function GlobalChat() {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  const {
    messages,
    isLoading,
    error,
    isConnected,
    sendMessage,
    reportMessage,
    isAuthenticated,
    currentUserId,
  } = useGlobalChat();

  const isChatVisible = !isMobile || isOpen;

  useEffect(() => {
    if (isMobile && !isOpen && messages.length > prevLengthRef.current) {
      setUnreadCount((prev) => prev + (messages.length - prevLengthRef.current));
    }
    prevLengthRef.current = messages.length;
  }, [messages.length, isMobile, isOpen]);

  useEffect(() => {
    if (!isMobile || isOpen) {
      setUnreadCount(0);
    }
  }, [isMobile, isOpen]);

  useEffect(() => {
    if (isChatVisible && scrollRef.current) {
      const el = scrollRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;

      if (isNearBottom) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    }
  }, [messages.length, isChatVisible]);

  const chatPanel = (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Chat Global</h2>
          {isConnected ? (
            <Wifi className="h-3.5 w-3.5 text-primary" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3"
      >
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-sm text-destructive">{error}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-sm text-muted-foreground">
              Nenhuma mensagem ainda.
              <br />
              Seja o primeiro a dizer algo.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              isOwn={msg.user_id === currentUserId}
              onReport={reportMessage}
            />
          ))
        )}
      </div>

      <ChatInput onSend={sendMessage} disabled={!isAuthenticated} />
    </div>
  );

  return (
    <>
      {!isMobile && (
        <aside className="hidden md:block md:w-[340px] md:shrink-0 xl:w-[360px]">
          <div className="sticky top-24 h-[calc(100vh-8rem)]">
            {chatPanel}
          </div>
        </aside>
      )}

      {isMobile && (
        <>
          <Button
            onClick={() => setIsOpen(true)}
            size="icon"
            className={cn(
              'fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg',
              isOpen && 'hidden'
            )}
          >
            <MessageCircle className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center px-1 text-[10px]"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetContent side="right" className="w-full p-0 sm:max-w-[400px]">
              <SheetHeader className="sr-only">
                <SheetTitle>Chat Global</SheetTitle>
              </SheetHeader>
              {chatPanel}
            </SheetContent>
          </Sheet>
        </>
      )}
    </>
  );
}
