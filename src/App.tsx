import { useEffect, useState, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { ThemeProvider } from './components/ThemeProvider';
import { ThemeToggle } from './components/ThemeToggle';
import { Search } from 'lucide-react';
import { Toast } from './components/Toast';
import { createBrowserRouter, RouterProvider, Navigate, Route, createRoutesFromElements, Link } from 'react-router-dom';
import PatientConsultation from './components/PatientConsultation';

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
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [startDateInput, setStartDateInput] = useState<string>('');
  const [endDateInput, setEndDateInput] = useState<string>('');
  const [expandedAddresses, setExpandedAddresses] = useState<Record<string, boolean>>({});
  const [expandedTreatmentAreas, setExpandedTreatmentAreas] = useState<Record<string, boolean>>({});
  const [expandedAdditionalInfos, setExpandedAdditionalInfos] = useState<Record<string, boolean>>({});
  const [expandedReferrers, setExpandedReferrers] = useState<Record<string, boolean>>({});
  const [expandedMedicalHistories, setExpandedMedicalHistories] = useState<Record<string, boolean>>({});
  const [expandedPregnancySmoking, setExpandedPregnancySmoking] = useState<Record<string, boolean>>({});
  const [expandedEmergencyContacts, setExpandedEmergencyContacts] = useState<Record<string, boolean>>({});
  const [expandedInsurance, setExpandedInsurance] = useState<Record<string, boolean>>({});
  const [consultationCounts, setConsultationCounts] = useState<Record<string, number>>({});
  const [consultationConsultants, setConsultationConsultants] = useState<Record<string, string[]>>({});
  const [uniqueConsultants, setUniqueConsultants] = useState<string[]>([]);
  const [selectedConsultant, setSelectedConsultant] = useState<string>('');
  
  useEffect(() => {
    // 초기 데이터 로드
    fetchQuestionnaires();
    
    // 상담자 목록 불러오기 (직접 호출)
    fetchConsultants();
  }, []);

  // 상담자 목록만 별도로 불러오는 함수
  async function fetchConsultants() {
    try {
      console.log('상담자 목록을 가져오는 중...');
      const { data, error } = await supabase
        .from('patient_consultations')
        .select('consultant')
        .not('consultant', 'is', null);
      
      if (error) {
        console.error('상담자 목록 가져오기 실패:', error);
        return;
      }
      
      if (data && data.length > 0) {
        console.log('상담자 데이터 로드 완료:', data.length);
        
        // 고유한 상담자 목록 추출
        const allConsultants = new Set<string>();
        data.forEach(item => {
          if (item.consultant && item.consultant.trim() !== '') {
            allConsultants.add(item.consultant.trim());
          }
        });
        
        // 상담자가 없는 경우를 위한 직접 입력 옵션 추가
        if (allConsultants.size === 0) {
          // 테스트 데이터 추가 (실제 환경에서는 제거해야 합니다)
          allConsultants.add('김의사');
          allConsultants.add('이의사');
          allConsultants.add('박의사');
          console.log('상담자 데이터가 없어 테스트 데이터를 추가합니다.');
        }
        
        // 전체 상담자 목록 정렬하여 설정
        const sortedConsultants = Array.from(allConsultants).sort();
        console.log('로드된 상담자 목록:', sortedConsultants);
        setUniqueConsultants(sortedConsultants);
      }
    } catch (error) {
      console.error('상담자 목록 가져오기 중 오류 발생:', error);
    }
  }

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
        
        // 환자 데이터를 로드한 후 상담 횟수도 가져오기
        fetchConsultationCounts(data.map(item => item.resident_id));
        
        // 상담자 목록도 새로 가져오기
        fetchConsultants();
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

  // 각 환자별 상담 횟수를 가져오는 함수
  async function fetchConsultationCounts(residentIds: string[]) {
    if (!residentIds || residentIds.length === 0) return;
    
    try {
      console.log('상담 정보 가져오기 시작:', residentIds.length, '명의 환자 데이터 요청');
      
      // Supabase에서 상담 정보 가져오기 (상담자 정보 포함)
      const { data, error } = await supabase
        .from('patient_consultations')
        .select('patient_id, id, consultant')
        .in('patient_id', residentIds);
      
      if (error) {
        console.error('상담 정보 가져오기 실패:', error);
        return;
      }
      
      if (data) {
        console.log('상담 데이터 수신 완료:', data.length, '개의 상담 기록');
        
        // 환자별 상담 기록 수 계산
        const counts: Record<string, number> = {};
        // 환자별 상담자 목록 (중복 제거)
        const consultants: Record<string, string[]> = {};
        // 전체 상담자 목록 (중복 제거)
        const allConsultants = new Set<string>();
        
        data.forEach(item => {
          if (item.patient_id) {
            // 상담 횟수 카운트
            counts[item.patient_id] = (counts[item.patient_id] || 0) + 1;
            
            // 상담자 정보 저장 (비어있지 않은 경우)
            if (item.consultant && item.consultant.trim() !== '') {
              // 전체 상담자 목록에 추가
              allConsultants.add(item.consultant.trim());
              
              if (!consultants[item.patient_id]) {
                consultants[item.patient_id] = [];
              }
              // 동일한 상담자는 중복 저장하지 않음
              if (!consultants[item.patient_id].includes(item.consultant)) {
                consultants[item.patient_id].push(item.consultant);
              }
            }
          }
        });
        
        // 상담자가 없는 경우를 위한 직접 입력 옵션 추가
        if (allConsultants.size === 0) {
          // 테스트 데이터 추가 (실제 환경에서는 제거해야 합니다)
          allConsultants.add('김의사');
          allConsultants.add('이의사');
          allConsultants.add('박의사');
          console.log('상담자 데이터가 없어 테스트 데이터를 추가합니다.');
        }
        
        setConsultationCounts(counts);
        setConsultationConsultants(consultants);
        
        // 전체 상담자 목록 정렬하여 설정
        const sortedConsultants = Array.from(allConsultants).sort();
        console.log('로드된 상담자 목록:', sortedConsultants);
        setUniqueConsultants(sortedConsultants);
      }
    } catch (error) {
      console.error('상담 정보 가져오기 중 오류 발생:', error);
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

  // 보험기간 표시 함수 (/ / 형식일 경우 가운데 부분만 표시)
  const renderInsurancePeriod = (value: string | null | undefined) => {
    if (!value) return '-';
    
    const text = value.trim();
    if (text.length === 0) return '-';
    
    // 이메일이 포함된 경우 '-' 반환
    if (text.includes('@')) return '-';
    
    // "/ /" 형식인지 확인
    const parts = text.split('/').map(part => part.trim());
    
    if (parts.length === 3) {
      // "/ /" 형식인 경우 가운데 부분만 반환
      return parts[1] || '-';
    }
    
    // 그 외의 경우 원본 값 반환
    return text;
  };

  // 보험회사 표시 함수 (/ / 형식일 경우 마지막 부분만 표시)
  const renderInsuranceCompany = (value: string | null | undefined) => {
    if (!value) return '-';
    
    const text = value.trim();
    if (text.length === 0) return '-';
    
    // 이메일이 포함된 경우 '-' 반환
    if (text.includes('@')) return '-';
    
    // "/ /" 형식인지 확인
    const parts = text.split('/').map(part => part.trim());
    
    if (parts.length >= 2) {
      // "/ /" 형식인 경우 마지막 부분만 반환
      return parts[parts.length - 1] || '-';
    }
    
    // 그 외의 경우 원본 값 반환
    return text;
  };

  // 소개자명 표시 함수 (/ 구분자가 있을 경우 첫 번째 부분만 표시)
  const renderReferrerName = (value: string | null | undefined) => {
    if (!value) return '-';
    
    const text = value.trim();
    if (text.length === 0) return '-';
    
    // "/" 구분자가 있는지 확인
    if (text.includes('/')) {
      // "/"로 구분하여 첫 번째 부분만 반환
      const parts = text.split('/').map(part => part.trim());
      return parts[0] || '-';
    }
    
    // 그 외의 경우 원본 값 반환
    return text;
  };

  // 소개자 연락처 표시 함수
  const renderReferrerPhone = (value: string | null | undefined) => {
    if (!value) return '-';
    
    const text = value.trim();
    if (text.length === 0) return '-';
    
    // "/"로 구분
    const parts = text.split('/').map(part => part.trim());
    
    // 형식에 따라 다르게 표시
    if (parts.length === 3) {
      // "이름 / 연락처 / 관계" 형식일 경우 가운데 부분 반환
      return parts[1] || '-';
    } else if (parts.length === 2) {
      // "이름 / 연락처" 형식일 경우 뒷부분 반환
      return parts[1] || '-';
    }
    
    // 그 외의 경우 원본 값 반환
    return text;
  };

  // 소개자 생년 표시 함수
  const renderReferrerBirthYear = (value: string | null | undefined) => {
    if (!value) return '-';
    
    const text = value.trim();
    if (text.length === 0) return '-';
    
    // "/"가 포함된 경우 '-' 반환
    if (text.includes('/')) {
      return '-';
    }
    
    // 그 외의 경우 원본 값 반환
    return text;
  };

  // 주소 표시 함수 (클릭하면 펼쳐짐)
  const renderAddress = (value: string | null | undefined, index: number) => {
    if (!value) return '-';
    
    const address = value.trim();
    if (address.length === 0) return '-';
    
    // 주소가 짧은 경우 그대로 표시
    if (address.length <= 30) {
      return address;
    }
    
    const isExpanded = expandedAddresses[`address-${index}`] || false;
    
    if (isExpanded) {
      // 펼쳐진 상태: 전체 주소 표시
      return (
        <div 
          className="cursor-pointer whitespace-pre-wrap break-words"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedAddresses(prev => ({
              ...prev,
              [`address-${index}`]: false
            }));
          }}
          title="접기"
        >
          <div className="flex flex-col">
            <span>{address}</span>
            <span className="text-blue-500 mt-1">▲ 접기</span>
          </div>
        </div>
      );
    } else {
      // 접힌 상태: 두 줄로 제한하여 표시
      let firstLine = '';
      let secondLine = '';
      
      // 줄 바꿈이 있는 경우
      if (address.includes('\n')) {
        const lines = address.split('\n');
        firstLine = lines[0];
        if (lines.length > 1) {
          secondLine = lines.length > 2 ? `${lines[1]}...` : lines[1];
        }
      } else {
        // 적절한 위치에서 자르기
        const breakPoint = Math.min(30, Math.floor(address.length / 2));
        let breakPosition = breakPoint;
        
        // 공백, 쉼표 등 자연스러운 위치에서 자르기
        for (let i = breakPoint; i > breakPoint - 10 && i > 0; i--) {
          if ([' ', ',', '.', ';', ':', '-'].includes(address[i])) {
            breakPosition = i + 1;
            break;
          }
        }
        
        firstLine = address.substring(0, breakPosition).trim();
        secondLine = address.length > breakPosition + 30 ? 
          `${address.substring(breakPosition, breakPosition + 27).trim()}...` : 
          address.substring(breakPosition).trim();
      }
      
      return (
        <div 
          className="cursor-pointer hover:text-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedAddresses(prev => ({
              ...prev,
              [`address-${index}`]: true
            }));
          }}
          title="펼쳐서 전체 주소 보기"
        >
          <div className="flex flex-col">
            <span>{firstLine}</span>
            <span>{secondLine} <span className="text-blue-500 text-sm">▼</span></span>
          </div>
        </div>
      );
    }
  };

  // 불편부위 표시 함수 (쉼표로 구분된 문자열을 포맷팅하고 클릭하면 펼쳐짐)
  const renderTreatmentArea = (value: string | null | undefined, index: number) => {
    if (!value) return '-';
    
    // 쉼표로 구분하여 배열로 변환하고 각 항목의 앞뒤 공백 제거
    const areas = value.split(',').map(item => item.trim()).filter(Boolean);
    
    // 항목이 없거나 빈 문자열만 있는 경우
    if (areas.length === 0) return '-';
    
    // 2개 이하일 경우 그대로 표시
    if (areas.length <= 2) {
      return areas.join(', ');
    }
    
    const isExpanded = expandedTreatmentAreas[`treatment-${index}`] || false;
    
    if (isExpanded) {
      // 펼쳐진 상태: 모든 항목 표시
      return (
        <div 
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedTreatmentAreas(prev => ({
              ...prev,
              [`treatment-${index}`]: false
            }));
          }}
          title="접기"
        >
          <div className="flex flex-col">
            {areas.map((area, i) => (
              <span key={i}>{area}{i < areas.length - 1 ? ',' : ''}</span>
            ))}
            <span className="text-blue-500 mt-1">▲ 접기</span>
          </div>
        </div>
      );
    } else {
      // 접힌 상태: 첫 두 항목만 표시하고 나머지는 +n개 표시
      return (
        <div 
          className="cursor-pointer hover:text-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedTreatmentAreas(prev => ({
              ...prev,
              [`treatment-${index}`]: true
            }));
          }}
          title="펼쳐서 모든 불편부위 보기"
        >
          <div className="flex flex-col">
            <span>{areas[0]}</span>
            <span>{areas[1]}{areas.length > 2 ? ` 외 ${areas.length - 2}개 `:''}
              <span className="text-blue-500 text-sm">▼</span>
            </span>
          </div>
        </div>
      );
    }
  };

  // 부가정보 표시 함수 (길이가 긴 텍스트를 표시하고 클릭하면 펼쳐짐)
  const renderAdditionalInfo = (value: string | null | undefined, index: number) => {
    if (!value) return '-';
    
    const text = value.trim();
    if (text.length === 0) return '-';
    
    // 텍스트가 짧으면 그대로 표시
    if (text.length <= 30) {
      return text;
    }
    
    const isExpanded = expandedAdditionalInfos[`additional-${index}`] || false;
    
    if (isExpanded) {
      // 펼쳐진 상태: 전체 텍스트 표시
      return (
        <div 
          className="cursor-pointer whitespace-pre-wrap break-words"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedAdditionalInfos(prev => ({
              ...prev,
              [`additional-${index}`]: false
            }));
          }}
          title="접기"
        >
          <div className="flex flex-col">
            <span>{text}</span>
            <span className="text-blue-500 mt-1">▲ 접기</span>
          </div>
        </div>
      );
    } else {
      // 접힌 상태: 두 줄로 제한하여 표시
      let firstLine = '';
      let secondLine = '';
      
      // 줄 바꿈이 있는 경우
      if (text.includes('\n')) {
        const lines = text.split('\n');
        firstLine = lines[0];
        if (lines.length > 1) {
          secondLine = lines.length > 2 ? `${lines[1]}...` : lines[1];
        }
      } else {
        // 적절한 위치에서 자르기
        const breakPoint = Math.min(40, Math.floor(text.length / 2));
        let breakPosition = breakPoint;
        
        // 공백, 쉼표 등 자연스러운 위치에서 자르기
        for (let i = breakPoint; i > breakPoint - 10 && i > 0; i--) {
          if ([' ', ',', '.', ';', ':', '-'].includes(text[i])) {
            breakPosition = i + 1;
            break;
          }
        }
        
        firstLine = text.substring(0, breakPosition).trim();
        secondLine = text.length > breakPosition + 40 ? 
          `${text.substring(breakPosition, breakPosition + 37).trim()}...` : 
          text.substring(breakPosition).trim();
      }
      
      return (
        <div 
          className="cursor-pointer hover:text-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedAdditionalInfos(prev => ({
              ...prev,
              [`additional-${index}`]: true
            }));
          }}
          title="펼쳐서 전체 내용 보기"
        >
          <div className="flex flex-col">
            <span>{firstLine}</span>
            <span>{secondLine} <span className="text-blue-500 text-sm">▼</span></span>
          </div>
        </div>
      );
    }
  };

  // 날짜 시간 표시 함수 - 변환 없이 원본 그대로 표시
  const renderDateTime = (dateTimeString: string | null | undefined) => {
    if (!dateTimeString) return '-';
    
    // ISO 형식 타임스탬프에서 날짜와 시간 부분만 추출
    const parts = dateTimeString.split('T');
    if (parts.length === 2) {
      // YYYY-MM-DD 형식의 날짜
      const datePart = parts[0].replace(/-/g, '/');
      
      // 시간 부분 (초까지만)
      const timePart = parts[1].substring(0, 8);
      
      return (
        <div className="flex flex-col">
          <span>{datePart}</span>
          <span>{timePart}</span>
        </div>
      );
    }
    
    // ISO 형식이 아닌 경우 원본 문자열 그대로 표시
    // "2025-03-12 20:03:57+00" 와 같은 형식
    const spaceParts = dateTimeString.split(' ');
    if (spaceParts.length >= 2) {
      const datePart = spaceParts[0].replace(/-/g, '/');
      
      // 시간 부분에서 타임존 정보(+00 등) 제거
      const timePart = spaceParts[1].substring(0, 8);
      
      return (
        <div className="flex flex-col">
          <span>{datePart}</span>
          <span>{timePart}</span>
        </div>
      );
    }
    
    // 그 외의 형식은 그대로 표시
    return dateTimeString;
  };

  // 주민번호로 성별 판정 함수
  const determineGenderFromResidentId = (residentId: string | null | undefined) => {
    if (!residentId || residentId.trim() === '') return '-';
    
    // 주민번호 형식 확인 (7번째 자리가 성별 식별 번호)
    const idParts = residentId.split('-');
    let genderDigit = '';
    
    if (idParts.length === 2 && idParts[1].length > 0) {
      // 하이픈으로 구분된 경우 (000000-0000000)
      genderDigit = idParts[1][0];
    } else if (residentId.length >= 7) {
      // 하이픈 없이 연속된 숫자인 경우 (0000000000000)
      genderDigit = residentId[6];
    } else {
      return '-'; // 판별 불가
    }
    
    // 성별 판정
    // 1, 3, 5, 7, 9: 남성
    // 2, 4, 6, 8, 0: 여성
    const maleDigits = ['1', '3', '5', '7', '9'];
    const femaleDigits = ['2', '4', '6', '8', '0'];
    
    if (maleDigits.includes(genderDigit)) {
      return '남성';
    } else if (femaleDigits.includes(genderDigit)) {
      return '여성';
    } else {
      return '-'; // 판별 불가
    }
  };

  // 성별 표시 함수
  const renderGender = (gender: string | null | undefined, residentId: string | null | undefined) => {
    // 성별이 이미 있으면 형식에 맞게 변환
    if (gender && gender.trim() !== '') {
      // '남', '여'를 '남성', '여성'으로 변환
      if (gender.trim() === '남') return '남성';
      if (gender.trim() === '여') return '여성';
      return gender;
    }
    
    // 성별이 없으면 주민번호로 판정
    return determineGenderFromResidentId(residentId);
  };

  // 날짜 기간 검색 실행 함수
  const applyDateFilter = () => {
    setStartDate(startDateInput);
    setEndDate(endDateInput);
  };

  // 이번 달, 지난 달 설정 함수
  const setCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    // 이번 달의 시작일 (1일)
    const startOfMonth = new Date(Date.UTC(year, month, 1));
    
    // 이번 달의 마지막 날 (해당 월의 일수에 맞게 자동 계산)
    // month+1의 0일은 전 달의 마지막 날을 의미함
    const endOfMonth = new Date(Date.UTC(year, month + 1, 0));
    
    // YYYY-MM-DD 형식으로 변환
    const newStartDate = startOfMonth.toISOString().split('T')[0];
    const newEndDate = endOfMonth.toISOString().split('T')[0];
    
    setStartDateInput(newStartDate);
    setEndDateInput(newEndDate);
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };
  
  const setPreviousMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() - 1; // 이전 달 (음수가 되면 자동으로 이전 년도로 처리됨)
    
    // 지난 달의 시작일 (1일)
    const startOfMonth = new Date(Date.UTC(year, month, 1));
    
    // 지난 달의 마지막 날 (해당 월의 일수에 맞게 자동 계산)
    const endOfMonth = new Date(Date.UTC(year, month + 1, 0));
    
    // YYYY-MM-DD 형식으로 변환
    const newStartDate = startOfMonth.toISOString().split('T')[0];
    const newEndDate = endOfMonth.toISOString().split('T')[0];
    
    setStartDateInput(newStartDate);
    setEndDateInput(newEndDate);
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  // 필터링 및 정렬 함수
  const filteredAndSortedData = useMemo(() => {
    // 검색어 필터링
    const filtered = questionnaires.filter(item => {
      // 검색어 필터링을 위한 텍스트 배열 생성
      const searchableValues = [
        item.name, 
        item.phone, 
        item.resident_id,
        item.address,
        item.emergency_contact_name,
        item.emergency_contact_phone,
        item.visit_reason, 
        item.treatment_area,
        item.referral_source,
        item.referrer_name,
        item.referrer_phone,
        item.medical_conditions,
        item.allergies,
        item.medications,
        item.dental_fears,
        item.additional_info
      ].filter(Boolean);
      
      const searchableText = searchableValues.join(' ').toLowerCase();
      
      // 날짜 필터링
      let passDateFilter = true;
      
      // 시작 날짜 또는 종료 날짜가 설정된 경우에만 필터링 적용
      if (startDate || endDate) {
        passDateFilter = false;
        
        // 단순하게 문자열 추출
        const extractDateString = (isoString: string) => {
          if (!isoString) return '';
          
          // ISO 문자열에서 날짜 부분만 추출 (YYYY-MM-DD)
          if (isoString.includes('T')) {
            return isoString.split('T')[0];
          }
          
          // 날짜만 포함된 문자열이면 그대로 반환
          if (isoString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return isoString;
          }
          
          // 그 외의 경우 빈 문자열 반환
          return '';
        };
        
        // submitted_at 날짜 확인
        if (item.submitted_at) {
          // 단순히 날짜 부분만 추출
          const rawDate = item.submitted_at;
          const itemDateString = extractDateString(rawDate);
          
          console.log('비교 (제출일):', {
            원본: rawDate,
            추출날짜: itemDateString,
            시작일: startDate,
            종료일: endDate,
            조건1: !startDate || itemDateString >= startDate,
            조건2: !endDate || itemDateString <= endDate,
            통과여부: (!startDate || itemDateString >= startDate) && (!endDate || itemDateString <= endDate)
          });
          
          // 시작 날짜와 종료 날짜 검사 (날짜 문자열 직접 비교)
          if (itemDateString && 
              (!startDate || itemDateString >= startDate) && 
              (!endDate || itemDateString <= endDate)) {
            passDateFilter = true;
          }
        }
        
        // created_at 날짜 확인 (submitted_at이 없거나 일치하지 않을 경우)
        if (!passDateFilter && item.created_at) {
          // 단순히 날짜 부분만 추출
          const rawDate = item.created_at;
          const itemDateString = extractDateString(rawDate);
          
          console.log('비교 (생성일):', {
            원본: rawDate,
            추출날짜: itemDateString,
            시작일: startDate,
            종료일: endDate,
            조건1: !startDate || itemDateString >= startDate,
            조건2: !endDate || itemDateString <= endDate,
            통과여부: (!startDate || itemDateString >= startDate) && (!endDate || itemDateString <= endDate)
          });
          
          // 시작 날짜와 종료 날짜 검사 (날짜 문자열 직접 비교)
          if (itemDateString && 
              (!startDate || itemDateString >= startDate) && 
              (!endDate || itemDateString <= endDate)) {
            passDateFilter = true;
          }
        }
      }
      
      // 상담자 필터링
      let passConsultantFilter = true;
      
      // 선택된 상담자가 있는 경우에만 필터링 적용
      if (selectedConsultant) {
        passConsultantFilter = false;
        
        // 환자 ID에 해당하는 상담자 목록 확인
        const patientConsultants = consultationConsultants[item.resident_id] || [];
        
        // 상담자 목록에 선택된 상담자가 포함되어 있는지 확인
        if (patientConsultants.includes(selectedConsultant)) {
          passConsultantFilter = true;
        }
      }
      
      return searchableText.includes(filterText.toLowerCase()) && passDateFilter && passConsultantFilter;
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
  }, [questionnaires, filterText, sortField, sortOrder, startDate, endDate, selectedConsultant, consultationConsultants]);

  // 소개자 정보 묶음 표시 함수
  const renderReferrerInfo = (item: PatientQuestionnaire, index: number) => {
    const name = renderReferrerName(item.referrer_name);
    const phone = renderReferrerPhone(item.referrer_phone);
    const birthYear = renderReferrerBirthYear(item.referrer_birth_year);
    
    const isExpanded = expandedReferrers[`referrer-${index}`] || false;
    
    if (isExpanded) {
      // 펼쳐진 상태
      return (
        <div 
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedReferrers(prev => ({
              ...prev,
              [`referrer-${index}`]: false
            }));
          }}
          title="접기"
        >
          <div className="flex flex-col">
            <div><strong>이름:</strong> {name}</div>
            <div><strong>연락처:</strong> {phone}</div>
            <div><strong>생년:</strong> {birthYear}</div>
            <span className="text-blue-500 mt-1">▲ 접기</span>
          </div>
        </div>
      );
    } else {
      // 접힌 상태: 요약 정보만 표시
      return (
        <div 
          className="cursor-pointer hover:text-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedReferrers(prev => ({
              ...prev,
              [`referrer-${index}`]: true
            }));
          }}
          title="펼쳐서 모든 정보 보기"
        >
          <div className="flex flex-col">
            <span>{name}</span>
            {(phone !== '-' || birthYear !== '-') && 
              <span className="text-sm text-gray-500">더보기 <span className="text-blue-500 text-sm">▼</span></span>
            }
          </div>
        </div>
      );
    }
  };

  // 과거 병력 정보 묶음 표시 함수
  const renderMedicalHistory = (item: PatientQuestionnaire, index: number) => {
    const medications = item.medications || '-';
    const otherMedication = item.other_medication || '-';
    const conditions = item.medical_conditions || '-';
    const otherCondition = item.other_condition || '-';
    const allergies = item.allergies || '-';
    const otherAllergy = item.other_allergy || '-';
    
    // 모든 값이 '-'인 경우 '-' 반환
    if ([medications, otherMedication, conditions, otherCondition, allergies, otherAllergy].every(val => val === '-')) {
      return '-';
    }
    
    const isExpanded = expandedMedicalHistories[`medical-${index}`] || false;
    
    if (isExpanded) {
      // 펼쳐진 상태
      return (
        <div 
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedMedicalHistories(prev => ({
              ...prev,
              [`medical-${index}`]: false
            }));
          }}
          title="접기"
        >
          <div className="flex flex-col">
            {medications !== '-' && <div><strong>복용약물:</strong> {medications}</div>}
            {otherMedication !== '-' && <div><strong>기타약물:</strong> {otherMedication}</div>}
            {conditions !== '-' && <div><strong>질환:</strong> {conditions}</div>}
            {otherCondition !== '-' && <div><strong>기타질환:</strong> {otherCondition}</div>}
            {allergies !== '-' && <div><strong>알레르기:</strong> {allergies}</div>}
            {otherAllergy !== '-' && <div><strong>기타알레르기:</strong> {otherAllergy}</div>}
            <span className="text-blue-500 mt-1">▲ 접기</span>
          </div>
        </div>
      );
    } else {
      // 접힌 상태: 중요 정보 요약
      const summary = [];
      if (medications !== '-') summary.push(`약물: ${medications.substring(0, 10)}${medications.length > 10 ? '...' : ''}`);
      if (conditions !== '-') summary.push(`질환: ${conditions.substring(0, 10)}${conditions.length > 10 ? '...' : ''}`);
      if (allergies !== '-') summary.push(`알레르기: ${allergies.substring(0, 10)}${allergies.length > 10 ? '...' : ''}`);
      
      const displaySummary = summary.length > 0 ? summary[0] : (otherMedication !== '-' ? `기타약물: ${otherMedication.substring(0, 10)}...` : '병력 있음');
      
      return (
        <div 
          className="cursor-pointer hover:text-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedMedicalHistories(prev => ({
              ...prev,
              [`medical-${index}`]: true
            }));
          }}
          title="펼쳐서 모든 정보 보기"
        >
          <div className="flex flex-col">
            <span>{displaySummary}</span>
            <span className="text-sm text-gray-500">더보기 <span className="text-blue-500 text-sm">▼</span></span>
          </div>
        </div>
      );
    }
  };

  // 임신/흡연 정보 묶음 표시 함수
  const renderPregnancySmoking = (item: PatientQuestionnaire, index: number) => {
    const pregnancyStatus = item.pregnancy_status || '-';
    const pregnancyWeek = item.pregnancy_week || '-';
    const smokingStatus = item.smoking_status || '-';
    const smokingAmount = item.smoking_amount || '-';
    
    // 모든 값이 '-'인 경우 '-' 반환
    if ([pregnancyStatus, pregnancyWeek, smokingStatus, smokingAmount].every(val => val === '-')) {
      return '-';
    }
    
    const isExpanded = expandedPregnancySmoking[`pregnancy-smoking-${index}`] || false;
    
    if (isExpanded) {
      // 펼쳐진 상태
      return (
        <div 
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedPregnancySmoking(prev => ({
              ...prev,
              [`pregnancy-smoking-${index}`]: false
            }));
          }}
          title="접기"
        >
          <div className="flex flex-col">
            {pregnancyStatus !== '-' && <div><strong>임신상태:</strong> {pregnancyStatus}</div>}
            {pregnancyWeek !== '-' && <div><strong>임신주차:</strong> {pregnancyWeek}</div>}
            {smokingStatus !== '-' && <div><strong>흡연여부:</strong> {smokingStatus}</div>}
            {smokingAmount !== '-' && <div><strong>흡연량:</strong> {smokingAmount}</div>}
            <span className="text-blue-500 mt-1">▲ 접기</span>
          </div>
        </div>
      );
    } else {
      // 접힌 상태: 중요 정보 하나만 요약
      let summary = '';
      
      // 임신 정보가 있으면 임신 정보를 우선적으로 표시
      if (pregnancyStatus !== '-' && pregnancyStatus !== '없음') {
        summary = `임신: ${pregnancyStatus}`;
      } 
      // 임신 정보가 없고 흡연 정보가 있으면 흡연 정보 표시
      else if (smokingStatus !== '-' && smokingStatus !== '없음') {
        summary = `흡연: ${smokingStatus}`;
      }
      // 그 외의 경우 어떤 정보든 있는 것 표시
      else {
        summary = pregnancyStatus !== '-' ? pregnancyStatus : smokingStatus;
      }
      
      return (
        <div 
          className="cursor-pointer hover:text-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedPregnancySmoking(prev => ({
              ...prev,
              [`pregnancy-smoking-${index}`]: true
            }));
          }}
          title="펼쳐서 모든 정보 보기"
        >
          <div className="flex flex-col">
            <span>{summary}</span>
            <span className="text-sm text-gray-500">더보기 <span className="text-blue-500 text-sm">▼</span></span>
          </div>
        </div>
      );
    }
  };

  // 비상연락처 정보 묶음 표시 함수
  const renderEmergencyContact = (item: PatientQuestionnaire, index: number) => {
    const name = item.emergency_contact_name || '-';
    const relation = item.emergency_contact_relation || '-';
    const phone = item.emergency_contact_phone || '-';
    
    // 모든 값이 '-'인 경우 '-' 반환
    if ([name, relation, phone].every(val => val === '-')) {
      return '-';
    }
    
    const isExpanded = expandedEmergencyContacts[`emergency-${index}`] || false;
    
    if (isExpanded) {
      // 펼쳐진 상태
      return (
        <div 
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedEmergencyContacts(prev => ({
              ...prev,
              [`emergency-${index}`]: false
            }));
          }}
          title="접기"
        >
          <div className="flex flex-col">
            {name !== '-' && <div><strong>이름:</strong> {name}</div>}
            {relation !== '-' && <div><strong>관계:</strong> {relation}</div>}
            {phone !== '-' && <div><strong>연락처:</strong> {phone}</div>}
            <span className="text-blue-500 mt-1">▲ 접기</span>
          </div>
        </div>
      );
    } else {
      // 접힌 상태: 이름만 표시
      const summary = name !== '-' ? name : '비상연락처 있음';
      
      return (
        <div 
          className="cursor-pointer hover:text-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedEmergencyContacts(prev => ({
              ...prev,
              [`emergency-${index}`]: true
            }));
          }}
          title="펼쳐서 모든 정보 보기"
        >
          <div className="flex flex-col">
            <span>{summary}</span>
            <span className="text-sm text-gray-500">더보기 <span className="text-blue-500 text-sm">▼</span></span>
          </div>
        </div>
      );
    }
  };

  // 치아보험 정보 묶음 표시 함수
  const renderInsurance = (item: PatientQuestionnaire, index: number) => {
    const hasInsurance = renderBoolean(item.has_private_insurance);
    const period = renderInsurancePeriod(item.private_insurance_period);
    const company = renderInsuranceCompany(item.insurance_company);
    
    // 모든 값이 '-'인 경우 또는 보험가입이 '아니오'인 경우 간단 표시
    if ((hasInsurance === '-' || hasInsurance === '아니오') && period === '-' && company === '-') {
      return hasInsurance === '아니오' ? '미가입' : '-';
    }
    
    const isExpanded = expandedInsurance[`insurance-${index}`] || false;
    
    if (isExpanded) {
      // 펼쳐진 상태
      return (
        <div 
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedInsurance(prev => ({
              ...prev,
              [`insurance-${index}`]: false
            }));
          }}
          title="접기"
        >
          <div className="flex flex-col">
            <div><strong>가입여부:</strong> {hasInsurance}</div>
            {period !== '-' && <div><strong>보험기간:</strong> {period}</div>}
            {company !== '-' && <div><strong>보험회사:</strong> {company}</div>}
            <span className="text-blue-500 mt-1">▲ 접기</span>
          </div>
        </div>
      );
    } else {
      // 접힌 상태: 중요 정보 하나만 요약
      let summary = '';
      
      // 보험 가입 상태가 '예'일 경우 보험회사 표시, 없으면 보험기간, 둘 다 없으면 가입여부 표시
      if (hasInsurance === '예') {
        if (company !== '-') {
          summary = company;
        } else if (period !== '-') {
          summary = period;
        } else {
          summary = '가입';
        }
      } else {
        summary = hasInsurance;
      }
      
      return (
        <div 
          className="cursor-pointer hover:text-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedInsurance(prev => ({
              ...prev,
              [`insurance-${index}`]: true
            }));
          }}
          title="펼쳐서 모든 정보 보기"
        >
          <div className="flex flex-col">
            <span>{summary}</span>
            {hasInsurance === '예' && (company !== '-' || period !== '-') && 
              <span className="text-sm text-gray-500">더보기 <span className="text-blue-500 text-sm">▼</span></span>
            }
          </div>
        </div>
      );
    }
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
        <h1 className="text-2xl font-bold">샤인치과 환자 관리프로그램 v1.0</h1>
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
      
      <div className="controls flex flex-wrap gap-2 mb-4 items-end">
        {/* 검색 필터 */}
        <div className="filter-container relative flex-1 min-w-[200px]">
          <div className="text-xs text-gray-500 mb-1">검색어</div>
          <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
          <input
            type="text"
            placeholder="검색어를 입력하세요"
            value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="filter-input pl-10 w-full py-2 px-3 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 h-[38px]"
          />
          </div>
        </div>
        
        {/* 상담자 필터 */}
        <div className="consultant-filter-container flex-none min-w-[170px]">
          <div className="text-xs text-gray-500 mb-1">상담자 필터 ({uniqueConsultants.length}명)
            {uniqueConsultants.length === 0 && (
              <button 
                onClick={fetchConsultants} 
                className="ml-1 text-indigo-500 hover:text-indigo-700"
                title="상담자 목록 새로고침"
              >
                ↻
              </button>
            )}
          </div>
          <div>
            <select
              value={selectedConsultant}
              onChange={(e) => setSelectedConsultant(e.target.value)}
              className={`w-full py-2 px-3 border rounded-md dark:bg-gray-800 dark:text-white h-[38px] ${
                selectedConsultant
                  ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/30'
                  : 'border-gray-300 dark:border-gray-700'
              }`}
              aria-label="상담자 선택"
            >
              <option value="">모든 상담자</option>
              {uniqueConsultants.length > 0 ? (
                uniqueConsultants.map((consultant) => (
                  <option key={consultant} value={consultant}>
                    {consultant}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  상담자 데이터 로드 중...
                </option>
              )}
            </select>
            {selectedConsultant && (
              <button
                onClick={() => setSelectedConsultant('')}
                className="text-xs mt-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 py-1 rounded-md w-full"
                title="상담자 필터 초기화"
              >
                초기화
              </button>
            )}
          </div>
        </div>
        
        {/* 날짜 기간 필터 */}
        <div className="date-filter-container flex-1 min-w-[260px]">
          <div className="text-xs text-gray-500 mb-1">날짜 필터</div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white h-[38px]"
                max={endDateInput || undefined}
                aria-label="시작 날짜 선택"
                placeholder="YYYY-MM-DD"
              />
              {startDateInput && (
                <button
                  onClick={() => setStartDateInput('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="시작 날짜 지우기"
                >
                  ✕
                </button>
              )}
            </div>
            
            <span className="flex items-center text-gray-500">~</span>
            
            <div className="relative flex-1">
              <input
                type="date"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white h-[38px]"
                min={startDateInput || undefined}
                aria-label="종료 날짜 선택"
                placeholder="YYYY-MM-DD"
              />
              {endDateInput && (
                <button
                  onClick={() => setEndDateInput('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="종료 날짜 지우기"
                >
                  ✕
                </button>
              )}
            </div>
            
            <button
              onClick={applyDateFilter}
              className="bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded-md h-[38px]"
              title="설정한 날짜 범위로 검색"
              disabled={!startDateInput && !endDateInput}
            >
              검색
            </button>
          </div>
        </div>
        
        {/* 새로고침 버튼 */}
        <div className="flex-none min-w-[100px]">
          <div className="text-xs text-gray-500 mb-1">데이터 갱신</div>
        <button
          onClick={() => fetchQuestionnaires()}
          disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded disabled:bg-emerald-300 h-[38px]"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              새로고침 중...
            </div>
            ) : (
              '새로고침'
            )}
        </button>
        </div>
      </div>
      
      {/* 날짜 빠른 선택 버튼 */}
      <div className="flex gap-2 mb-4 mt-1">
        <button
          onClick={setCurrentMonth}
          className="text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 py-1 rounded-md"
          title="이번 달 데이터 보기"
        >
          이번달
        </button>
        <button
          onClick={setPreviousMonth}
          className="text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 py-1 rounded-md"
          title="지난 달 데이터 보기"
        >
          지난달
        </button>
        {(startDate || endDate) && (
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setStartDateInput('');
              setEndDateInput('');
            }}
            className="text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 py-1 rounded-md"
            title="모든 날짜 필터 초기화"
          >
            초기화
          </button>
        )}
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
                
                {/* 상담자 열 추가 */}
                <th>상담자</th>
                
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
                <th onClick={() => handleSort('has_private_insurance')}>
                  치아보험 {sortField === 'has_private_insurance' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('gender')}>
                  성별 {sortField === 'gender' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('address')}>
                  주소 {sortField === 'address' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('referrer_name')}>
                  소개자 {sortField === 'referrer_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('medical_conditions')}>
                  PMH {sortField === 'medical_conditions' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('pregnancy_status')}>
                  임신/흡연 {sortField === 'pregnancy_status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('emergency_contact_name')}>
                  비상연락처 {sortField === 'emergency_contact_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('last_visit')}>
                  최근방문 {sortField === 'last_visit' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('consent')}>
                  정보동의 {sortField === 'consent' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('additional_info')}>
                  부가정보 {sortField === 'additional_info' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedData.length > 0 ? (
                filteredAndSortedData.map((item, index) => (
                  <tr key={index} className="group hover:bg-accent/50">
                    <td className="sticky left-0 bg-background group-hover:bg-accent/50 text-center">
                      <div className="flex flex-col gap-1">
                        <Link
                          to={`/consultation/${item.resident_id}`}
                          className="bg-blue-500 hover:bg-blue-600 text-white p-1 rounded text-sm flex items-center justify-center gap-1"
                          aria-label="상담"
                          title="상담 기록 보기/추가"
                        >
                          <span>상담</span>
                          {consultationCounts[item.resident_id] > 0 && (
                            <span className="bg-white text-blue-600 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                              {consultationCounts[item.resident_id]}
                            </span>
                          )}
                        </Link>
                      </div>
                    </td>
                    <td>{renderDateTime(item.submitted_at)}</td>
                    
                    {/* 상담자 정보 표시 */}
                    <td>
                      {consultationConsultants[item.resident_id] && consultationConsultants[item.resident_id].length > 0 ? (
                        <div className="text-sm">
                          {consultationConsultants[item.resident_id].join(', ')}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    
                    <td>{renderBoolean(item.at_clinic)}</td>
                    <td>{item.name || '-'}</td>
                    <td>{item.resident_id || '-'}</td>
                    <td>{item.visit_reason || '-'}</td>
                    <td>{renderTreatmentArea(item.treatment_area, index)}</td>
                    <td>{item.referral_source || '-'}</td>
                    <td>{item.phone || '-'}</td>
                    <td>{item.dental_fears || '-'}</td>
                    <td>{renderInsurance(item, index)}</td>
                    <td>{renderGender(item.gender, item.resident_id)}</td>
                    <td>{renderAddress(item.address, index)}</td>
                    <td>{renderReferrerInfo(item, index)}</td>
                    <td>{renderMedicalHistory(item, index)}</td>
                    <td>{renderPregnancySmoking(item, index)}</td>
                    <td>{renderEmergencyContact(item, index)}</td>
                    <td>{item.last_visit || '-'}</td>
                    <td>{renderBoolean(item.consent)}</td>
                    <td>{renderAdditionalInfo(item.additional_info, index)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={20} className="text-center py-4">
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

// 라우터 설정
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<PatientQuestionnaireTable />} />
      <Route path="/consultation/:residentId" element={<PatientConsultation />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </>
  )
);

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App;
