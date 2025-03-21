import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // 현재 URL에서 해시 파라미터 확인
    const handleRedirect = async () => {
      try {
        // 해시에서 access_token이 있는지 확인
        if (window.location.hash && window.location.hash.includes('access_token')) {
          // Supabase 세션 설정 시도
          const { error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('세션 설정 오류:', error);
          } else {
            console.log('인증 성공, 메인 페이지로 이동합니다.');
          }
          
          // 성공 또는 실패 상관없이 메인 페이지로 이동
          navigate('/');
        }
      } catch (err) {
        console.error('인증 콜백 처리 오류:', err);
        navigate('/');
      }
    };

    handleRedirect();
  }, [navigate]);

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p>인증 처리 중입니다...</p>
      </div>
    </div>
  );
};

export default AuthCallback; 