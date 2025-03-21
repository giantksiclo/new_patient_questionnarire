import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Session, User } from '@supabase/supabase-js';

// 컨텍스트의 타입 정의
type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
};

// 기본값으로 초기화된 컨텍스트 생성
const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  resetPassword: async () => ({ error: null }),
});

// 컨텍스트 훅
export const useAuth = () => useContext(AuthContext);

// 컨텍스트 제공자 컴포넌트
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // 현재 세션 가져오기
    const getSession = async () => {
      setLoading(true);
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('세션 조회 오류:', error);
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    // URL 해시에 토큰이 있는지 확인하고 처리
    const handleHashChange = async () => {
      if (window.location.hash && window.location.hash.includes('access_token')) {
        try {
          await supabase.auth.getSession();
          // 페이지 리로드 없이 해시 제거
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
          console.error('해시 파라미터 처리 오류:', err);
        }
      }
    };

    handleHashChange();

    // 인증 상태 변경 리스너 설정
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 컴포넌트 언마운트 시 리스너 제거
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 회원가입 함수
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'https://giantksiclo.github.io/new_patient_questionnarire/#/auth/callback'
      }
    });
    return { error };
  };

  // 로그인 함수
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  // 로그아웃 함수
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // 비밀번호 재설정 함수
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://giantksiclo.github.io/new_patient_questionnarire/#/auth/callback',
    });
    return { error };
  };

  // 컨텍스트 값 정의
  const value = {
    session,
    user,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 