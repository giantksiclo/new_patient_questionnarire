import { useEffect, useState, useMemo } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField] = useState<keyof PatientQuestionnaire>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  
  useEffect(() => {
    // 초기 데이터 로드
    fetchQuestionnaires();
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
        const currentIds = questionnaires.map(q => q.resident_id);
        const newItems = data.filter(item => !currentIds.includes(item.resident_id));
        
        if (newItems.length > 0 && !silent) {
          setToast({ message: `${newItems.length}개의 새 데이터가 추가되었습니다!`, type: 'success' });
        }
        setQuestionnaires(data);
        setToast({ message: `${data.length}개의 설문 데이터를 로드했습니다.`, type: 'success' });
      }
    } catch (error) {
      console.error('설문 데이터를 가져오는 중 오류 발생:', error);
      setError('데이터를 불러오는데 실패했습니다.');
      setToast({ 
        message: `데이터 로드 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, 
        type: 'error' 
      });
    } finally {
      setLoading(false);
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
        resident_id: `T${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
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

  // 불리언 값 표시 함수
  const renderBoolean = (value: boolean | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return value ? '예' : '아니오';
  };

  // 테이블에 보여줄 데이터 필터링 및 정렬
  const filteredAndSortedData = useMemo(() => {
    // 검색어로 필터링
    let filtered = questionnaires.filter(item => {
      const searchableValues = [
        item.name, 
        item.phone, 
        item.resident_id,
        item.address,
        item.emergency_contact_name,
        item.visit_reason, 
        item.treatment_area,
        item.additional_info
      ];
      
      const searchableText = searchableValues.join(' ').toLowerCase();
      return searchableText.includes(filterText.toLowerCase());
    });
    
    // 정렬
    return [...filtered].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      // null, undefined 처리
      if (aValue === null || aValue === undefined) return sortOrder === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return sortOrder === 'asc' ? 1 : -1;
      
      // 문자열 비교
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      // 불리언 비교
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return sortOrder === 'asc' 
          ? (aValue === bValue ? 0 : aValue ? 1 : -1)
          : (aValue === bValue ? 0 : aValue ? -1 : 1);
      }
      
      // 그 외 (숫자 등)
      return sortOrder === 'asc' 
        ? (aValue > bValue ? 1 : -1)
        : (aValue > bValue ? -1 : 1);
    });
  }, [questionnaires, filterText, sortField, sortOrder]);

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
            onClick={addTestData}
            className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
          >
            테스트 데이터 추가
          </button>
          <ThemeToggle />
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="controls flex flex-wrap gap-2 mb-4">
        {/* 검색 필터 */}
        <div className="filter-container relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
          <input
            type="text"
            placeholder="검색어를 입력하세요"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="filter-input pl-10 w-full py-2 px-3 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
        
        <button
          onClick={() => fetchQuestionnaires()}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:bg-blue-300"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              새로고침 중...
            </div>
          ) : '새로고침'}
        </button>
      </div>
      
      <div className="text-sm mb-2">
        총 {filteredAndSortedData.length}개 데이터 표시 중 (전체 {questionnaires.length}개)
      </div>
      
      {loading ? (
        <div className="loading-container">
          <div className="loader"></div>
          <p>데이터를 불러오는 중...</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>동작</th>
                
                {/* 제출시간 */}
                <th onClick={() => handleSort('submitted_at')}>
                  제출시간 {sortField === 'submitted_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('at_clinic')}>
                  내원유무 {sortField === 'at_clinic' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('name')}>
                  이름 {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('resident_id')}>
                  주민번호 {sortField === 'resident_id' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('visit_reason')}>
                  내원목적 {sortField === 'visit_reason' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('treatment_area')}>
                  불편부위 {sortField === 'treatment_area' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('referral_source')}>
                  내원경로 {sortField === 'referral_source' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('phone')}>
                  전화번호 {sortField === 'phone' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('dental_fears')}>
                  치과공포 {sortField === 'dental_fears' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('additional_info')}>
                  부가정보 {sortField === 'additional_info' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('has_private_insurance')}>
                  보험가입 {sortField === 'has_private_insurance' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('private_insurance_period')}>
                  보험기간 {sortField === 'private_insurance_period' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('insurance_company')}>
                  보험회사 {sortField === 'insurance_company' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('gender')}>
                  성별 {sortField === 'gender' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('address')}>
                  주소 {sortField === 'address' && (sortOrder === 'asc' ? '↑' : '↓')}
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
                  최근방문 {sortField === 'last_visit' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('medications')}>
                  복용약물 {sortField === 'medications' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('other_medication')}>
                  기타약물 {sortField === 'other_medication' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('medical_conditions')}>
                  질환 {sortField === 'medical_conditions' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('other_condition')}>
                  기타질환 {sortField === 'other_condition' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('allergies')}>
                  알레르기 {sortField === 'allergies' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('other_allergy')}>
                  기타알레르기 {sortField === 'other_allergy' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('pregnancy_status')}>
                  임신상태 {sortField === 'pregnancy_status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('pregnancy_week')}>
                  임신주차 {sortField === 'pregnancy_week' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('smoking_status')}>
                  흡연여부 {sortField === 'smoking_status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('smoking_amount')}>
                  흡연량 {sortField === 'smoking_amount' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('emergency_contact_name')}>
                  비상연락처이름 {sortField === 'emergency_contact_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('emergency_contact_relation')}>
                  비상연락처관계 {sortField === 'emergency_contact_relation' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('emergency_contact_phone')}>
                  비상연락처번호 {sortField === 'emergency_contact_phone' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('consent')}>
                  정보동의 {sortField === 'consent' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('created_at')}>
                  생성시간 {sortField === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedData.length > 0 ? (
                filteredAndSortedData.map((item, index) => (
                  <tr key={index} className="group hover:bg-accent/50">
                    <td className="sticky left-0 bg-background group-hover:bg-accent/50 text-center">
                      <button
                        onClick={() => item.id && deleteQuestionnaire(item.id)}
                        className="bg-red-500 hover:bg-red-600 text-white p-1 rounded text-sm"
                        aria-label="삭제"
                        disabled={!item.id}
                        title={item.id ? `삭제` : '삭제할 수 없음'}
                      >
                        삭제
                      </button>
                    </td>
                    <td>{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '-'}</td>
                    <td>{renderBoolean(item.at_clinic)}</td>
                    <td>{item.name || '-'}</td>
                    <td>{item.resident_id || '-'}</td>
                    <td>{item.visit_reason || '-'}</td>
                    <td>{item.treatment_area || '-'}</td>
                    <td>{item.referral_source || '-'}</td>
                    <td>{item.phone || '-'}</td>
                    <td>{item.dental_fears || '-'}</td>
                    <td>{item.additional_info || '-'}</td>
                    <td>{renderBoolean(item.has_private_insurance)}</td>
                    <td>{item.private_insurance_period || '-'}</td>
                    <td>{item.insurance_company || '-'}</td>
                    <td>{item.gender || '-'}</td>
                    <td>{item.address || '-'}</td>
                    <td>{item.referrer_name || '-'}</td>
                    <td>{item.referrer_phone || '-'}</td>
                    <td>{item.referrer_birth_year || '-'}</td>
                    <td>{item.last_visit || '-'}</td>
                    <td>{item.medications || '-'}</td>
                    <td>{item.other_medication || '-'}</td>
                    <td>{item.medical_conditions || '-'}</td>
                    <td>{item.other_condition || '-'}</td>
                    <td>{item.allergies || '-'}</td>
                    <td>{item.other_allergy || '-'}</td>
                    <td>{item.pregnancy_status || '-'}</td>
                    <td>{item.pregnancy_week || '-'}</td>
                    <td>{item.smoking_status || '-'}</td>
                    <td>{item.smoking_amount || '-'}</td>
                    <td>{item.emergency_contact_name || '-'}</td>
                    <td>{item.emergency_contact_relation || '-'}</td>
                    <td>{item.emergency_contact_phone || '-'}</td>
                    <td>{renderBoolean(item.consent)}</td>
                    <td>{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={35} className="text-center py-4">
                    표시할 데이터가 없습니다.
                  </td>
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
