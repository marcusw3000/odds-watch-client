import { useState, useEffect, useContext, createContext, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface AuthBootstrap {
  isAdmin: boolean;
  user: User | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string, cpf?: string, phone?: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({
  children,
  initialAuth,
}: {
  children: ReactNode;
  initialAuth?: AuthBootstrap;
}) {
  const [user, setUser] = useState<User | null>(initialAuth?.user ?? null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(initialAuth?.isAdmin ?? false);
  const [loading, setLoading] = useState(initialAuth?.user ? false : true);
  const adminCheckRef = useRef<string | null>(initialAuth?.user?.id ?? null);

  useEffect(() => {
    let mounted = true;

    const checkAdminRole = async (userId: string) => {
      if (adminCheckRef.current === userId) return;
      adminCheckRef.current = userId;
      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: userId,
          _role: 'admin'
        });
        if (!mounted) return;
        if (error) {
          console.error('Error checking admin role:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data === true);
        }
      } catch (error) {
        if (!mounted) return;
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Set up auth state listener FIRST (single listener for entire app)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        console.log('[Auth] State change:', event, session?.user?.email);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            setTimeout(() => {
              if (mounted) checkAdminRole(session.user.id);
            }, 0);
          } else {
            setLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          adminCheckRef.current = null;
          setLoading(false);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
          if (!session?.user) {
            setLoading(false);
          }
        }
      }
    );

    // Check for existing session
    const checkSession = async () => {
      if (!mounted) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      console.log('[Auth] Initial session check:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        checkAdminRole(session.user.id);
      } else {
        setLoading(false);
      }
    };

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName?: string, cpf?: string, phone?: string) => {
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
        }
      }
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
