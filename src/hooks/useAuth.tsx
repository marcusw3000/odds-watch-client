import { useState, useContext, createContext, useMemo, useRef } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { User, Session } from '@supabase/supabase-js';

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

interface AuthActions {
  signIn: AuthState['signIn'];
  signUp: AuthState['signUp'];
  signOut: AuthState['signOut'];
}

interface AuthController {
  adminCheckRef: React.MutableRefObject<string | null>;
  setActions: Dispatch<SetStateAction<AuthActions>>;
  setIsAdmin: Dispatch<SetStateAction<boolean>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setSession: Dispatch<SetStateAction<Session | null>>;
  setUser: Dispatch<SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthState | null>(null);
const AuthControllerContext = createContext<AuthController | null>(null);

const unavailableError = () => new Error('Auth sync is not available on this route yet.');

export const unavailableAuthActions: AuthActions = {
  signIn: async () => ({ error: unavailableError() }),
  signUp: async () => ({ error: unavailableError() }),
  signOut: async () => ({ error: unavailableError() }),
};

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
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<AuthActions>(unavailableAuthActions);
  const adminCheckRef = useRef<string | null>(initialAuth?.user?.id ?? null);

  const authState = useMemo<AuthState>(
    () => ({
      user,
      session,
      isAdmin,
      loading,
      signIn: actions.signIn,
      signUp: actions.signUp,
      signOut: actions.signOut,
    }),
    [actions, isAdmin, loading, session, user]
  );

  const controller = useMemo<AuthController>(
    () => ({
      adminCheckRef,
      setActions,
      setIsAdmin,
      setLoading,
      setSession,
      setUser,
    }),
    []
  );

  return (
    <AuthControllerContext.Provider value={controller}>
      <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
    </AuthControllerContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export function useAuthController(): AuthController {
  const ctx = useContext(AuthControllerContext);
  if (!ctx) {
    throw new Error('useAuthController must be used within an AuthProvider');
  }
  return ctx;
}
