import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';
import { Profile } from '../lib/supabase/types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  isActive: boolean;
  isExpired: boolean;
  isDisabled: boolean;
  isAdmin: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Helper calculation for access expiry
  const now = new Date();
  const expiresAt = profile?.access_expires_at ? new Date(profile.access_expires_at) : null;
  const isDateValid = expiresAt ? expiresAt > now : true;

  const isActive = !!(user && profile?.status === 'active' && isDateValid);
  const isExpired = !!(user && profile?.status === 'active' && expiresAt && expiresAt <= now);
  const isDisabled = !!(user && profile?.status === 'disabled');
  const isAdmin = !!(user && profile?.role === 'admin' && profile?.status === 'active');

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) {
        console.error('[ORI Auth] Error fetching profile:', profileErr.message);
        setError(profileErr.message);
        setProfile(null);
      } else {
        setProfile(data as Profile | null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error reading profile';
      console.error('[ORI Auth] Profile exception:', msg);
      setError(msg);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);

          if (data.session?.user) {
            await fetchProfile(data.session.user.id);
          }
        }
      } catch (err: unknown) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : 'Auth initialization failed';
          setError(msg);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    setError(null);
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (authErr) {
        console.error('[ORI Auth Error]', authErr.message);
        const rawMsg = authErr.message.toLowerCase();
        if (
          rawMsg.includes('failed to fetch') ||
          rawMsg.includes('fetcherror') ||
          rawMsg.includes('networkerror') ||
          rawMsg.includes('load failed')
        ) {
          return {
            error: 'Không thể kết nối đến hệ thống. Vui lòng thử lại hoặc liên hệ Giáo vụ ORI.',
          };
        }
        if (
          rawMsg.includes('invalid login credentials') ||
          rawMsg.includes('invalid credentials') ||
          rawMsg.includes('invalid email or password')
        ) {
          return { error: 'Email hoặc mật khẩu chưa đúng.' };
        }
        return {
          error: 'Không thể kết nối đến hệ thống. Vui lòng thử lại hoặc liên hệ Giáo vụ ORI.',
        };
      }

      if (data.user) {
        await fetchProfile(data.user.id);
      }
      return { error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập không thành công';
      console.error('[ORI Auth Exception]', msg);
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('configuration error') ||
        msg.includes('FetchError')
      ) {
        return {
          error: 'Không thể kết nối đến hệ thống. Vui lòng thử lại hoặc liên hệ Giáo vụ ORI.',
        };
      }
      return {
        error: 'Không thể kết nối đến hệ thống. Vui lòng thử lại hoặc liên hệ Giáo vụ ORI.',
      };
    }
  };

  const signOut = async () => {
    setError(null);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        error,
        isActive,
        isExpired,
        isDisabled,
        isAdmin,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
