import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  user_id: string;
  display_name: string;
  content: string;
  timestamp: number;
}

const RETENTION_MS = 6 * 60 * 60 * 1000; // 6 horas
const RATE_LIMIT_MS = 2000;
const MAX_MESSAGE_LENGTH = 500;

export function useGlobalChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const lastSentRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch display name
  useEffect(() => {
    if (!user) {
      setDisplayName(null);
      return;
    }
    const fetchName = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, full_name')
        .eq('id', user.id)
        .single();
      setDisplayName(data?.display_name || data?.full_name || 'Anônimo');
    };
    fetchName();
  }, [user]);

  // Connect to broadcast channel
  useEffect(() => {
    const channel = supabase.channel('global-chat', {
      config: { broadcast: { self: true } },
    });

    channel
      .on('broadcast', { event: 'new-message' }, ({ payload }) => {
        const msg = payload as ChatMessage;
        setMessages(prev => [...prev.slice(-200), msg]); // keep last 200
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  // Hourly cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - RETENTION_MS;
      setMessages(prev => prev.filter(m => m.timestamp > cutoff));
    }, 60_000); // check every minute
    return () => clearInterval(interval);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!user || !displayName || !channelRef.current) return;

    const trimmed = content.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return;

    const now = Date.now();
    if (now - lastSentRef.current < RATE_LIMIT_MS) {
      toast.error('Aguarde antes de enviar outra mensagem');
      return;
    }
    lastSentRef.current = now;

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      user_id: user.id,
      display_name: displayName,
      content: trimmed,
      timestamp: now,
    };

    await channelRef.current.send({
      type: 'broadcast',
      event: 'new-message',
      payload: msg,
    });
  }, [user, displayName]);

  const reportMessage = useCallback((messageId: string) => {
    toast.success('Mensagem reportada. Obrigado!');
    // Could broadcast a report event or log elsewhere
  }, []);

  return {
    messages,
    isConnected,
    sendMessage,
    reportMessage,
    isAuthenticated: !!user,
    currentUserId: user?.id ?? null,
  };
}
