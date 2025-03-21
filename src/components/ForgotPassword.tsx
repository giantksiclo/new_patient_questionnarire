import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { ThemeToggle } from './ThemeToggle';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('이메일을 입력해주세요.');
      return;
    }
    
    try {
      setError(null);
      setLoading(true);
      
      const { error } = await resetPassword(email);
      
      if (error) {
        setError('비밀번호 재설정 이메일 전송에 실패했습니다. 이메일 주소를 확인해주세요.');
        console.error('비밀번호 재설정 오류:', error.message);
        return;
      }
      
      setSuccess('비밀번호 재설정 이메일이 전송되었습니다. 이메일을 확인해주세요.');
      setEmail('');
    } catch (err) {
      console.error('비밀번호 재설정 처리 중 오류 발생:', err);
      setError('비밀번호 재설정 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="flex-1 flex justify-center items-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">비밀번호 찾기</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              계정에 등록된 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
            </p>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              {success}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label 
                htmlFor="email" 
                className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="이메일 주소 입력"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md
                     font-medium disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? '처리 중...' : '재설정 링크 전송'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <Link 
                to="/login" 
                className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium"
              >
                로그인 페이지로 돌아가기
              </Link>
            </p>
          </div>
        </div>
      </div>
      
      <footer className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
        © {new Date().getFullYear()} 샤인치과. All rights reserved.
      </footer>
    </div>
  );
};

export default ForgotPassword; 