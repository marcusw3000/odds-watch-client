import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ChatMessageItem } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useGlobalChat } from '@/hooks/useGlobalChat';
import { cn } from '@/lib/utils';

export function GlobalChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  const {
    messages,
    isConnected,
    sendMessage,
    reportMessage,
    isAuthenticated,
    currentUserId,
  } = useGlobalChat();

  // Track unread when closed
  useEffect(() => {
    if (!isOpen && messages.length > prevLengthRef.current) {
      setUnreadCount(prev => prev + (messages.length - prevLengthRef.current));
    }
    prevLengthRef.current = messages.length;
  }, [messages.length, isOpen]);

  // Clear unread on open
  useEffect(() => {
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  // Auto-scroll
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      const el = scrollRef.current;
      // Only auto-scroll if user is near bottom
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (isNearBottom) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    }
  }, [messages.length, isOpen]);

  return (
    <>
      {/* Floating button */}
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        className={cn(
          'fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg lg:bottom-6',
          isOpen && 'hidden'
        )}
      >
        <MessageCircle className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] flex items-center justify-center"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Chat panel */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="flex flex-col p-0 w-full sm:max-w-[400px] gap-0">
          <SheetHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border space-y-0">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base">Chat Global</SheetTitle>
              {isConnected ? (
                <Wifi className="h-3.5 w-3.5 text-success" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          </SheetHeader>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3"
          >
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground text-center">
                  Nenhuma mensagem ainda.<br />
                  Seja o primeiro a dizer algo! 💬
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

          {/* Input */}
          <ChatInput onSend={sendMessage} disabled={!isAuthenticated} />
        </SheetContent>
      </Sheet>
    </>
  );
}
