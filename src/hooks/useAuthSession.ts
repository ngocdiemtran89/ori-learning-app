import { useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';

export interface AuthSessionState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuthSession(): AuthSessionState {
  const [sessionState, setSessionState] = useState<AuthSessionState>({
    session: null,
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (mounted) {
          setSessionState({
            session: data.session,
            user: data.session?.user ?? null,
            loading: false,
            error: null,
          });
        }
      } catch (err: unknown) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Lỗi lấy phiên làm việc Supabase';
          setSessionState({
            session: null,
            user: null,
            loading: false,
            error: errorMessage,
          });
        }
      }
    }

    getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSessionState({
          session,
          user: session?.user ?? null,
          loading: false,
          error: null,
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return sessionState;
}
