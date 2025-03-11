import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { ThemeProvider } from './components/ThemeProvider';
import { ThemeToggle } from './components/ThemeToggle';
import { Search } from 'lucide-react';
import { Toast } from './components/Toast';

// 환자 설문 데이터 타입 정의
interface PatientQuestionnaire {
  id?: number;
  created_at: string;
  
  // 폼 공통
  at_clinic: boolean;
  consent: boolean;
  name: string;
  resident_id: string;
  gender: string;
  phone: string;
  address: string;

  // 사보험 관련
  has_private_insurance: boolean;
  private_insurance_period: string;
  insurance_company: string;

  // 긴급연락처
  emergency_contact_name: string;
  emergency_contact_relation: string;
  emergency_contact_phone: string;

  // 내원 정보
  visit_reason: string;
  treatment_area: string;
  referral_source: string;
  referrer_name: string;
  referrer_phone: string;
  referrer_birth_year: string;
  last_visit: string;

  // 복용 약물
  medications: string;
  other_medication: string;

  // 질환
  medical_conditions: string;
  other_condition: string;

  // 알레르기
  allergies: string;
  other_allergy: string;

  // 임신/수유
  pregnancy_status: string;
  pregnancy_week: string;

  // 흡연
  smoking_status: string;
  smoking_amount: string;

  // 치과 불안감
  dental_fears: string;

  // 기타
  additional_info: string;

  // 제출 시각
  submitted_at: string;
}

function PatientQuestionnaireTable() {
  const [questionnaires, setQuestionnaires] = useState<PatientQuestionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof PatientQuestionnaire>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterText, setFilterText] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [previousCount, setPreviousCount] = useState<number>(0);

  useEffect(() => {
    // 초기 데이터 로드
    fetchQuestionnaires();
    
    // 15초마다 데이터 폴링 (실시간 구독 대신)
    const pollingInterval = setInterval(() => {
      console.log('데이터 폴링 중...');
      fetchQuestionnaires(true); // 조용한 업데이트 모드로 호출
    }, 15000);
    
    return () => {
      clearInterval(pollingInterval);
    };
  }, []);

  async function fetchQuestionnaires(silent = false) {
    try {
      if (!silent) setLoading(true);
      
      // Supabase에서 환자 설문 데이터 가져오기
      const { data, error, status } = await supabase
        .from('patient_questionnaire')
        .select('*');
      
      console.log('Supabase 응답 상태 코드:', status);
      
      if (error) {
        console.error('Supabase 오류 상세:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log('Fetched data:', data); // 데이터 구조 확인을 위한 로그
      
      // 이전 데이터와 비교해서 새로운 데이터가 있는지 확인
      if (data) {
        const currentIds = questionnaires.map(q => q.id);
        const newItems = data.filter(item => !currentIds.includes(item.id));
        
        if (newItems.length > 0 && !silent) {
          setToast({ message: `${newItems.length}개의 새 데이터가 추가되었습니다!`, type: 'success' });
        }
      }
      
      // 모의 데이터로 폴백 (실제 데이터를 못 가져올 경우)
      if (!data || data.length === 0) {
        console.log('데이터가 없어 모의 데이터를 표시합니다.');
        const mockData: PatientQuestionnaire[] = [
          {
            id: 1,
            name: '김환자',
            created_at: new Date().toISOString(),
            at_clinic: true,
            consent: true,
            resident_id: '000101-1234567',
            gender: '남',
            phone: '010-1234-5678',
            address: '서울시 강남구',
            has_private_insurance: true,
            private_insurance_period: '2년',
            insurance_company: '삼성생명',
            emergency_contact_name: '김가족',
            emergency_contact_relation: '배우자',
            emergency_contact_phone: '010-8765-4321',
            visit_reason: '정기검진',
            treatment_area: '앞니',
            referral_source: '지인소개',
            referrer_name: '이소개',
            referrer_phone: '010-3333-4444',
            referrer_birth_year: '1980',
            last_visit: '2023-01-01',
            medications: '고혈압약',
            other_medication: '',
            medical_conditions: '당뇨',
            other_condition: '',
            allergies: '페니실린',
            other_allergy: '',
            pregnancy_status: '해당없음',
            pregnancy_week: '',
            smoking_status: '비흡연',
            smoking_amount: '',
            dental_fears: '주사바늘',
            additional_info: '',
            submitted_at: new Date().toISOString()
          }
        ];
        setQuestionnaires(mockData);
        setToast({ message: '데이터베이스에서 데이터를 찾을 수 없어 모의 데이터를 표시합니다.', type: 'info' });
      } else {
        setQuestionnaires(data);
        setToast({ message: `${data.length}개의 설문 데이터를 로드했습니다.`, type: 'success' });
      }
    } catch (error) {
      console.error('설문 데이터를 가져오는 중 오류 발생:', error);
      setError('데이터를 불러오는데 실패했습니다.');
      
      // 오류 발생 시 모의 데이터로 폴백
      const mockData: PatientQuestionnaire[] = [
        {
          id: 1,
          name: '김환자 (모의 데이터)',
          created_at: new Date().toISOString(),
          at_clinic: true,
          consent: true,
          resident_id: '000101-1234567',
          gender: '남',
          phone: '010-1234-5678',
          address: '서울시 강남구',
          has_private_insurance: true,
          private_insurance_period: '2년',
          insurance_company: '삼성생명',
          emergency_contact_name: '김가족',
          emergency_contact_relation: '배우자',
          emergency_contact_phone: '010-8765-4321',
          visit_reason: '정기검진',
          treatment_area: '앞니',
          referral_source: '지인소개',
          referrer_name: '이소개',
          referrer_phone: '010-3333-4444',
          referrer_birth_year: '1980',
          last_visit: '2023-01-01',
          medications: '고혈압약',
          other_medication: '',
          medical_conditions: '당뇨',
          other_condition: '',
          allergies: '페니실린',
          other_allergy: '',
          pregnancy_status: '해당없음',
          pregnancy_week: '',
          smoking_status: '비흡연',
          smoking_amount: '',
          dental_fears: '주사바늘',
          additional_info: '',
          submitted_at: new Date().toISOString()
        }
      ];
      
      setQuestionnaires(mockData);
      setToast({ 
        message: `데이터 로드 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  }

  // 데이터베이스 연결 테스트 함수
  async function testDatabaseConnection() {
    try {
      console.log('데이터베이스 연결 테스트 중...');
      setToast({ message: '데이터베이스 연결 테스트 중...', type: 'info' });
      
      // Supabase 접속 정보 확인 (비밀키는 마스킹)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      console.log('Supabase URL:', supabaseUrl);
      console.log('Supabase Key (마스킹):', supabaseKey ? `${supabaseKey.substring(0, 5)}...${supabaseKey.substring(supabaseKey.length - 5)}` : '없음');
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
      }
      
      // 1. DB 연결 확인 - 단순 쿼리 사용
      const { data: connectionTest, error: connectionError, status } = await supabase
        .from('patient_questionnaire')
        .select('id')
        .limit(1);
      
      console.log('연결 테스트 응답 상태 코드:', status);
      console.log('연결 테스트 결과:', { connectionTest, connectionError });
      
      if (connectionError) {
        console.error('Supabase 오류 상세:', {
          message: connectionError.message,
          details: connectionError.details,
          hint: connectionError.hint,
          code: connectionError.code
        });
        throw connectionError;
      }
      
      setToast({ message: '데이터베이스 연결 성공!', type: 'success' });
    } catch (error) {
      console.error('데이터베이스 연결 실패:', error);
      setToast({ 
        message: `데이터베이스 연결 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, 
        type: 'error' 
      });
    }
  }

  // 테스트용 데이터 추가 함수
  async function addTestData() {
    try {
      console.log('테스트 데이터 추가 시도 중...');
      
      // 테스트 데이터 - 필수 필드만 포함
      const testData = {
        name: `테스트 ${Math.floor(Math.random() * 1000)}`,
        created_at: new Date().toISOString(),
        at_clinic: true,
        consent: true,
        resident_id: '',
        gender: '남',
        phone: '',
        address: '',
        has_private_insurance: false,
        private_insurance_period: '',
        insurance_company: '',
        emergency_contact_name: '',
        emergency_contact_relation: '',
        emergency_contact_phone: '',
        visit_reason: '',
        treatment_area: '',
        referral_source: '',
        referrer_name: '',
        referrer_phone: '',
        referrer_birth_year: '',
        last_visit: '',
        medications: '',
        other_medication: '',
        medical_conditions: '',
        other_condition: '',
        allergies: '',
        other_allergy: '',
        pregnancy_status: '',
        pregnancy_week: '',
        smoking_status: '',
        smoking_amount: '',
        dental_fears: '',
        additional_info: '',
        submitted_at: new Date().toISOString()
      };

      console.log('추가할 데이터:', testData);
      
      const { data, error, status } = await supabase
        .from('patient_questionnaire')
        .insert([testData])
        .select();

      console.log('Supabase 응답 상태 코드:', status);
      console.log('Supabase 응답:', { data, error });

      if (error) {
        console.error('Supabase 오류 상세:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      if (data && data.length > 0) {
        console.log('데이터 추가 성공:', data[0]);
        // 테이블의 맨 위에 새 데이터 추가
        setQuestionnaires(prev => [data[0] as PatientQuestionnaire, ...prev]);
        setToast({ message: '테스트 데이터가 추가되었습니다!', type: 'success' });
      } else {
        // 데이터가 반환되지 않았지만 오류도 없는 경우
        setToast({ message: '데이터가 추가되었으나, 반환된 데이터가 없습니다.', type: 'info' });
        // 데이터 새로고침
        fetchQuestionnaires();
      }
    } catch (error) {
      console.error('테스트 데이터 추가 중 오류 발생:', error);
      setToast({ 
        message: `테스트 데이터 추가 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, 
        type: 'error' 
      });
    }
  }

  // 데이터 삭제 함수
  async function deleteQuestionnaire(id: number | undefined) {
    console.log('삭제 시도 ID:', id);
    
    if (!id) {
      console.error('삭제할 데이터의 ID가 없습니다.');
      setToast({ message: '삭제할 데이터의 ID가 없습니다.', type: 'error' });
      return;
    }

    try {
      const { error, status } = await supabase
        .from('patient_questionnaire')
        .delete()
        .eq('id', id);
      
      console.log('Supabase 응답 상태 코드:', status);
      console.log('삭제 응답:', { error });
      
      if (error) {
        console.error('Supabase 오류 상세:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log('데이터 삭제 성공, ID:', id);
      // UI 업데이트
      setQuestionnaires(prev => prev.filter(item => item.id !== id));
      setToast({ message: '환자 설문 데이터가 삭제되었습니다.', type: 'success' });
    } catch (error) {
      console.error('데이터 삭제 중 오류 발생:', error);
      setToast({ 
        message: `데이터 삭제 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, 
        type: 'error' 
      });
    }
  }

  // 정렬 함수
  const handleSort = (field: keyof PatientQuestionnaire) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 정렬된 데이터
  const sortedData = [...questionnaires].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (aValue === null || aValue === undefined) return sortOrder === 'asc' ? -1 : 1;
    if (bValue === null || bValue === undefined) return sortOrder === 'asc' ? 1 : -1;
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue);
    }
    
    return sortOrder === 'asc' 
      ? (aValue > bValue ? 1 : -1) 
      : (aValue > bValue ? -1 : 1);
  });

  // 필터링된 데이터
  const filteredData = sortedData.filter(item => {
    return Object.values(item).some(value => 
      value !== null && 
      value !== undefined && 
      value.toString().toLowerCase().includes(filterText.toLowerCase())
    );
  });

  // 불리언 값 표시 함수
  const renderBoolean = (value: boolean | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return value ? '예' : '아니오';
  };

  return (
    <div className="app-container">
      {toast && (
        <Toast 
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">환자 설문 데이터</h1>
        <div className="flex gap-2">
          <button 
            onClick={testDatabaseConnection}
            className="p-2 bg-blue-300 text-blue-900 rounded-md hover:bg-blue-400 text-sm"
          >
            DB 연결 테스트
          </button>
          <button 
            onClick={addTestData}
            className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
          >
            테스트 데이터 추가
          </button>
          <ThemeToggle />
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="controls">
        <div className="filter-container relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
          <input
            type="text"
            placeholder="검색어를 입력하세요"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="filter-input pl-10"
          />
        </div>
        
        <button
          onClick={() => fetchQuestionnaires()}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mr-2 disabled:bg-blue-300"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              새로고침 중...
            </div>
          ) : '새로고침'}
        </button>
      </div>
      
      {loading ? (
        <div className="loading">데이터를 불러오는 중...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {/* 기본 정보 */}
                <th onClick={() => handleSort('name')}>
                  환자명 {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('created_at')}>
                  작성일시 {sortField === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('at_clinic')}>
                  내원여부 {sortField === 'at_clinic' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('consent')}>
                  동의여부 {sortField === 'consent' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('resident_id')}>
                  주민번호 {sortField === 'resident_id' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('gender')}>
                  성별 {sortField === 'gender' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('phone')}>
                  연락처 {sortField === 'phone' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('address')}>
                  주소 {sortField === 'address' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>

                {/* 사보험 정보 */}
                <th onClick={() => handleSort('has_private_insurance')}>
                  실손보험 {sortField === 'has_private_insurance' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('private_insurance_period')}>
                  보험기간 {sortField === 'private_insurance_period' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('insurance_company')}>
                  보험회사 {sortField === 'insurance_company' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>

                {/* 긴급연락처 */}
                <th onClick={() => handleSort('emergency_contact_name')}>
                  긴급연락처명 {sortField === 'emergency_contact_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('emergency_contact_relation')}>
                  긴급연락처관계 {sortField === 'emergency_contact_relation' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('emergency_contact_phone')}>
                  긴급연락처번호 {sortField === 'emergency_contact_phone' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>

                {/* 내원 정보 */}
                <th onClick={() => handleSort('visit_reason')}>
                  내원이유 {sortField === 'visit_reason' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('treatment_area')}>
                  치료부위 {sortField === 'treatment_area' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('referral_source')}>
                  소개경로 {sortField === 'referral_source' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('referrer_name')}>
                  소개자명 {sortField === 'referrer_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('referrer_phone')}>
                  소개자연락처 {sortField === 'referrer_phone' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('referrer_birth_year')}>
                  소개자생년 {sortField === 'referrer_birth_year' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('last_visit')}>
                  마지막내원 {sortField === 'last_visit' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>

                {/* 복용약물 */}
                <th onClick={() => handleSort('medications')}>
                  복용약물 {sortField === 'medications' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('other_medication')}>
                  기타약물 {sortField === 'other_medication' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>

                {/* 질환 */}
                <th onClick={() => handleSort('medical_conditions')}>
                  질환 {sortField === 'medical_conditions' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('other_condition')}>
                  기타질환 {sortField === 'other_condition' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>

                {/* 알레르기 */}
                <th onClick={() => handleSort('allergies')}>
                  알레르기 {sortField === 'allergies' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('other_allergy')}>
                  기타알레르기 {sortField === 'other_allergy' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>

                {/* 임신/수유 */}
                <th onClick={() => handleSort('pregnancy_status')}>
                  임신상태 {sortField === 'pregnancy_status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('pregnancy_week')}>
                  임신주차 {sortField === 'pregnancy_week' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>

                {/* 흡연 */}
                <th onClick={() => handleSort('smoking_status')}>
                  흡연여부 {sortField === 'smoking_status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('smoking_amount')}>
                  흡연량 {sortField === 'smoking_amount' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>

                {/* 치과 불안감 */}
                <th onClick={() => handleSort('dental_fears')}>
                  치과불안감 {sortField === 'dental_fears' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>

                {/* 기타 */}
                <th onClick={() => handleSort('additional_info')}>
                  추가정보 {sortField === 'additional_info' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>

                {/* 제출시각 */}
                <th onClick={() => handleSort('submitted_at')}>
                  제출시각 {sortField === 'submitted_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>

                {/* 작업 열 추가 */}
                <th className="text-center">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? (
                filteredData.map((item, index) => (
                  <tr key={index} className="group hover:bg-accent/50">
                    {/* 기본 정보 */}
                    <td>
                      {item.name || '-'} 
                      <span className="text-xs text-muted-foreground ml-1">(ID: {item.id || '없음'})</span>
                    </td>
                    <td>{new Date(item.created_at).toLocaleString()}</td>
                    <td>{renderBoolean(item.at_clinic)}</td>
                    <td>{renderBoolean(item.consent)}</td>
                    <td>{item.resident_id || '-'}</td>
                    <td>{item.gender || '-'}</td>
                    <td>{item.phone || '-'}</td>
                    <td>{item.address || '-'}</td>

                    {/* 사보험 정보 */}
                    <td>{renderBoolean(item.has_private_insurance)}</td>
                    <td>{item.private_insurance_period || '-'}</td>
                    <td>{item.insurance_company || '-'}</td>

                    {/* 긴급연락처 */}
                    <td>{item.emergency_contact_name || '-'}</td>
                    <td>{item.emergency_contact_relation || '-'}</td>
                    <td>{item.emergency_contact_phone || '-'}</td>

                    {/* 내원 정보 */}
                    <td>{item.visit_reason || '-'}</td>
                    <td>{item.treatment_area || '-'}</td>
                    <td>{item.referral_source || '-'}</td>
                    <td>{item.referrer_name || '-'}</td>
                    <td>{item.referrer_phone || '-'}</td>
                    <td>{item.referrer_birth_year || '-'}</td>
                    <td>{item.last_visit || '-'}</td>

                    {/* 복용약물 */}
                    <td>{item.medications || '-'}</td>
                    <td>{item.other_medication || '-'}</td>

                    {/* 질환 */}
                    <td>{item.medical_conditions || '-'}</td>
                    <td>{item.other_condition || '-'}</td>

                    {/* 알레르기 */}
                    <td>{item.allergies || '-'}</td>
                    <td>{item.other_allergy || '-'}</td>

                    {/* 임신/수유 */}
                    <td>{item.pregnancy_status || '-'}</td>
                    <td>{item.pregnancy_week || '-'}</td>

                    {/* 흡연 */}
                    <td>{item.smoking_status || '-'}</td>
                    <td>{item.smoking_amount || '-'}</td>

                    {/* 치과 불안감 */}
                    <td>{item.dental_fears || '-'}</td>

                    {/* 기타 */}
                    <td>{item.additional_info || '-'}</td>

                    {/* 제출시각 */}
                    <td>{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '-'}</td>

                    {/* 작업 버튼 */}
                    <td className="text-center">
                      {item.id ? (
                        <button 
                          onClick={() => deleteQuestionnaire(item.id)}
                          className="p-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                          title="삭제"
                        >
                          삭제 #{item.id}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">ID 없음</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={36} className="text-center py-4 text-muted-foreground">표시할 데이터가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <div className="min-h-screen bg-background">
        <PatientQuestionnaireTable />
      </div>
    </ThemeProvider>
  );
}

export default App;
