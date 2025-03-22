import { Link, useLocation } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../utils/AuthContext';
import { LogOut, User } from 'lucide-react';

type HeaderProps = {
  openTestDataModal?: () => void;
  showTestDataButton?: boolean;
  pageTitle?: string;
};

const Header = ({ openTestDataModal, showTestDataButton = true, pageTitle }: HeaderProps) => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  // 현재 경로에 따라 기본 페이지 제목 설정
  const getDefaultPageTitle = () => {
    if (location.pathname === '/' || location.pathname === '') {
      return '환자목록';
    } else if (location.pathname === '/recent') {
      return '최근상담목록';
    } else if (location.pathname === '/dashboard') {
      return '상담통계';
    }
    return '';
  };

  const currentPageTitle = pageTitle || getDefaultPageTitle();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="flex flex-col mb-6">
      {/* 앱 제목 */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">샤인치과 환자 관리프로그램 v1.0</h1>
        
        {user && (
          <div className="flex items-center gap-2 ml-2">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center gap-1">
              <User size={16} className="text-gray-600 dark:text-gray-300" />
              <span className="text-sm text-gray-800 dark:text-gray-200 max-w-[120px] truncate">
                {user.email}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm flex items-center gap-1"
              title="로그아웃"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          </div>
        )}
      </div>
      
      {/* 페이지 제목과 네비게이션 버튼들 */}
      <div className="flex justify-between items-center py-3 border-b-2 border-gray-300 dark:border-gray-700">
        {currentPageTitle && (
          <h2 className="text-2xl font-bold">
            {currentPageTitle}
          </h2>
        )}
        
        <div className="flex gap-2 items-center">
          {showTestDataButton && openTestDataModal && (
            <button 
              onClick={openTestDataModal}
              className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
            >
              구환 데이터 추가
            </button>
          )}
          <Link 
            to="/"
            className="p-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 text-sm"
          >
            환자목록
          </Link>
          <Link 
            to="/recent"
            className="p-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 text-sm"
          >
            최근상담목록
          </Link>
          <Link 
            to="/dashboard"
            className="p-2 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm flex items-center gap-1"
          >
            <span>상담통계</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 9h6v6H9z"/><path d="M9 3v6"/><path d="M15 3v6"/><path d="M9 15v6"/><path d="M15 15v6"/><path d="M3 9h6"/><path d="M3 15h6"/><path d="M15 9h6"/><path d="M15 15h6"/></svg>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
};

export default Header; 