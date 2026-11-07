import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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

  const laatstBekendeUserId = useRef<string | null>(null);
  const rollenVerzoek = useRef(0);

  useEffect(() => {
    let actief = true;

    // INITIAL_SESSION volgt op het herstellen van een bewaarde Supabase-sessie.
    // Gebruik één eventbron in plaats van daarnaast getSession() aan te roepen:
    // dat voorkwam eerder niet dat rollenqueries elkaar konden inhalen.
    const { data: sub } = supabase.auth.onAuthStateChange((event, nieuweSession) => {
      if (!actief) return;

      const verzoek = ++rollenVerzoek.current;
      const nieuweUserId = nieuweSession?.user.id ?? null;
      const andereGebruiker = nieuweUserId !== laatstBekendeUserId.current;
      laatstBekendeUserId.current = nieuweUserId;
      setSession(nieuweSession);
      setUser(nieuweSession?.user ?? null);

      if (!nieuweUserId) {
        setRollen([]);
        setLoading(false);
        return;
      }

      // Bij opstarten of gebruikerswissel wachten totdat de rollen bekend zijn.
      // Bij een refresh tonen we de bestaande rollen terwijl we ze verversen.
      if (andereGebruiker) setRollen([]);
      if (event === 'INITIAL_SESSION' || andereGebruiker) setLoading(true);

      // Binnen onAuthStateChange geen Supabase-query awaiten.
      setTimeout(() => {
        void (async () => {
          let volgendeRollen: Rol[] = [];
          try {
            const { data, error } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', nieuweUserId);
            if (error) {
              console.warn('Rollen konden niet worden geladen');
            } else {
              volgendeRollen = (data ?? []).map(r => r.role as Rol);
            }
          } catch {
            console.warn('Rollen konden niet worden geladen');
          }

          // Een ouder verzoek mag rollen niet terugzetten na uitloggen of
          // een gebruikerswissel.
          if (!actief || verzoek !== rollenVerzoek.current) return;
          setRollen(volgendeRollen);
          setLoading(false);
        })();
      }, 0);
    });

    return () => {
      actief = false;
      rollenVerzoek.current++;
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
