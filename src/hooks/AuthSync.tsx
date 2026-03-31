import { useCallback, useEffect } from 'react';

import { unavailableAuthActions, useAuthController } from './useAuth';

async function getSupabaseClient() {
  const { supabase } = await import('@/integrations/supabase/client');
  return supabase;
}

export function AuthSync() {
  const {
    adminCheckRef,
    setActions,
    setIsAdmin,
    setLoading,
    setSession,
    setUser,
  } = useAuthController();

  const checkAdminRole = useCallback(
    async (userId: string, clientArg?: Awaited<ReturnType<typeof getSupabaseClient>>) => {
      const client = clientArg ?? (await getSupabaseClient());
      if (adminCheckRef.current === userId) {
        setLoading(false);
        return;
      }

      adminCheckRef.current = userId;

      try {
        const { data, error } = await client.rpc('has_role', {
          _user_id: userId,
          _role: 'admin',
        });

        if (error) {
          console.error('Error checking admin role:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data === true);
        }
      } catch (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    },
    [adminCheckRef, setIsAdmin, setLoading]
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName?: string, cpf?: string, phone?: string) => {
      const supabase = await getSupabaseClient();
      const redirectUrl = typeof window === 'undefined' ? undefined : `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          ...(redirectUrl ? { emailRedirectTo: redirectUrl } : {}),
          data: {
            full_name: fullName || '',
            cpf: cpf ? cpf.replace(/\D/g, '') : null,
            phone: phone ? phone.replace(/\D/g, '') : null,
          },
        },
      });

      return { error };
    },
    []
  );

  const signOut = useCallback(async () => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  useEffect(() => {
    setActions({ signIn, signUp, signOut });

    return () => {
      setActions(unavailableAuthActions);
    };
  }, [setActions, signIn, signOut, signUp]);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const setupAuth = async () => {
      const client = await getSupabaseClient();
      if (!mounted) {
        return;
      }

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((event, session) => {
        if (!mounted) {
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            setTimeout(() => {
              if (mounted) {
                void checkAdminRole(session.user.id, client);
              }
            }, 0);
          } else {
            adminCheckRef.current = null;
            setIsAdmin(false);
            setLoading(false);
          }

          return;
        }

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          adminCheckRef.current = null;
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (!session?.user) {
          adminCheckRef.current = null;
          setIsAdmin(false);
          setLoading(false);
        }
      });

      unsubscribe = () => subscription.unsubscribe();

      const {
        data: { session },
      } = await client.auth.getSession();

      if (!mounted) {
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        void checkAdminRole(session.user.id, client);
      } else {
        adminCheckRef.current = null;
        setIsAdmin(false);
        setLoading(false);
      }
    };

    void setupAuth();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [adminCheckRef, checkAdminRole, setIsAdmin, setLoading, setSession, setUser]);

  return null;
}
