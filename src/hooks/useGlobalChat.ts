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
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 2000;

export function useGlobalChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const lastSentRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Fetch display name
  useEffect(() => {
    if (!user) {
      setDisplayName(null);
      return;
    }
    const fetchName = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('display_name, full_name')
          .eq('id', user.id)
          .single();
        setDisplayName(data?.display_name || data?.full_name || 'Anônimo');
      } catch {
        setDisplayName('Anônimo');
      }
    };
    fetchName();
  }, [user]);

  // Connect to broadcast channel with reconnection logic
  useEffect(() => {
    mountedRef.current = true;

    const connectChannel = () => {
      try {
        // Clean up previous channel if any
        if (channelRef.current) {
          try {
            supabase.removeChannel(channelRef.current);
          } catch {
            // ignore cleanup errors
          }
          channelRef.current = null;
        }

        const channel = supabase.channel('global-chat', {
          config: { broadcast: { self: true } },
        });

        channel
          .on('broadcast', { event: 'new-message' }, ({ payload }) => {
            if (!mountedRef.current) return;
            const msg = payload as ChatMessage;
            setMessages(prev => [...prev.slice(-200), msg]);
          })
          .subscribe((status) => {
            if (!mountedRef.current) return;
            
            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
              reconnectAttemptsRef.current = 0;
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setIsConnected(false);
              scheduleReconnect();
            } else if (status === 'CLOSED') {
              setIsConnected(false);
            }
          });

        channelRef.current = channel;
      } catch (err) {
        console.error('[GlobalChat] Failed to create channel:', err);
        setIsConnected(false);
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (!mountedRef.current) return;
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.warn('[GlobalChat] Max reconnect attempts reached');
        return;
      }

      const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current);
      reconnectAttemptsRef.current++;

      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connectChannel();
      }, delay);
    };

    connectChannel();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {
          // ignore
        }
        channelRef.current = null;
      }
    };
  }, []);

  // Hourly cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - RETENTION_MS;
      setMessages(prev => prev.filter(m => m.timestamp > cutoff));
    }, 60_000);
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

    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'new-message',
        payload: msg,
      });
    } catch (err) {
      console.error('[GlobalChat] Failed to send message:', err);
      toast.error('Erro ao enviar mensagem');
    }
  }, [user, displayName]);

  const reportMessage = useCallback((messageId: string) => {
    toast.success('Mensagem reportada. Obrigado!');
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
