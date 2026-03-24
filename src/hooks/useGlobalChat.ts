import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

const RATE_LIMIT_MS = 2000;
const MAX_MESSAGE_LENGTH = 300;

export function useGlobalChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const lastSentRef = useRef(0);
  const messageIdsRef = useRef(new Set<string>());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch display name
  useEffect(() => {
    if (!user) {
      setUsername(null);
      return;
    }
    const fetchName = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('display_name, full_name')
          .eq('id', user.id)
          .single();
        setUsername(data?.display_name || data?.full_name || 'Anônimo');
      } catch {
        setUsername('Anônimo');
      }
    };
    fetchName();
  }, [user]);

  // Load history (last 6 hours)
  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        const { data, error: fetchError } = await supabase
          .from('messages')
          .select('*')
          .gte('created_at', sixHoursAgo)
          .order('created_at', { ascending: true })
          .limit(200);

        if (fetchError) throw fetchError;

        const msgs = (data || []) as ChatMessage[];
        messageIdsRef.current = new Set(msgs.map(m => m.id));
        setMessages(msgs);
      } catch (err: any) {
        console.error('[GlobalChat] Failed to load history:', err);
        setError('Erro ao carregar mensagens');
      } finally {
        setIsLoading(false);
      }
    };
    loadHistory();
  }, []);

  // Realtime subscription (postgres_changes)
  useEffect(() => {
    const channel = supabase
      .channel('global-chat-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          // Deduplicate
          if (messageIdsRef.current.has(newMsg.id)) return;
          messageIdsRef.current.add(newMsg.id);
          setMessages(prev => [...prev.slice(-199), newMsg]);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!user || !username) return;

    const trimmed = content.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return;

    const now = Date.now();
    if (now - lastSentRef.current < RATE_LIMIT_MS) {
      toast.error('Aguarde antes de enviar outra mensagem');
      return;
    }
    lastSentRef.current = now;

    try {
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          user_id: user.id,
          username: username,
          content: trimmed,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Add to local state immediately for optimistic UX (deduplicated by realtime)
      if (data && !messageIdsRef.current.has(data.id)) {
        messageIdsRef.current.add(data.id);
        setMessages(prev => [...prev.slice(-199), data as ChatMessage]);
      }
    } catch (err: any) {
      console.error('[GlobalChat] Failed to send:', err);
      toast.error('Erro ao enviar mensagem');
    }
  }, [user, username]);

  const reportMessage = useCallback(async (messageId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('chat_reports')
        .insert({ message_id: messageId, reporter_id: user.id });
      if (error?.code === '23505') {
        toast.info('Você já reportou esta mensagem');
      } else if (error) {
        throw error;
      } else {
        toast.success('Mensagem reportada. Obrigado!');
      }
    } catch (err) {
      console.error('[GlobalChat] Report failed:', err);
      toast.error('Erro ao reportar mensagem');
    }
  }, [user]);

  return {
    messages,
    isLoading,
    error,
    isConnected,
    sendMessage,
    reportMessage,
    isAuthenticated: !!user,
    currentUserId: user?.id ?? null,
  };
}
