import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type Rol = 'admin' | 'medewerker';

interface AuthState {
  session: Session | null;
  user: User | null;
  rollen: Rol[];
  isAdmin: boolean;
  heeftToegang: boolean;
  loading: boolean;
  signIn: (email: string, wachtwoord: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, wachtwoord: string, naam: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [rollen, setRollen] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(true);

  const haalRollenOp = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    if (error) {
      console.error('Rollen ophalen mislukt', error);
      setRollen([]);
      return;
    }
    setRollen((data ?? []).map(r => r.role as Rol));
  };

  useEffect(() => {
    // Listener eerst registreren
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Niet awaiten in callback
        setTimeout(() => haalRollenOp(newSession.user.id), 0);
      } else {
        setRollen([]);
      }
    });

    // Dan bestaande sessie ophalen
    supabase.auth.getSession().then(({ data: { session: huidige } }) => {
      setSession(huidige);
      setUser(huidige?.user ?? null);
      if (huidige?.user) {
        haalRollenOp(huidige.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, wachtwoord: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
    return { error };
  };

  const signUp = async (email: string, wachtwoord: string, naam: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password: wachtwoord,
      options: {
        emailRedirectTo: redirectUrl,
        data: { volledige_naam: naam },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRollen([]);
  };

  const isAdmin = rollen.includes('admin');
  const heeftToegang = rollen.length > 0;

  return (
    <AuthContext.Provider
      value={{ session, user, rollen, isAdmin, heeftToegang, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth moet binnen AuthProvider gebruikt worden');
  return ctx;
}
