import { useEffect, useState, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { ThemeProvider } from './components/ThemeProvider';
import { Search, X } from 'lucide-react';
import { Toast } from './components/Toast';
import { createHashRouter, RouterProvider, Navigate, Route, createRoutesFromElements, Link } from 'react-router-dom';
import PatientConsultation from './components/PatientConsultation';
import ConsultationDashboard from './components/ConsultationDashboard';
import RecentConsultations from './components/RecentConsultations';
import React, { useRef } from 'react';
import moment from 'moment-timezone';
import { AuthProvider } from './utils/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Signup from './components/Signup';
import ForgotPassword from './components/ForgotPassword';
import Header from './components/Header';
import AuthCallback from './components/AuthCallback';

// Modal 컴포넌트 직접 정의
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  closeOnOutsideClick?: boolean; // 외부 클릭 시 닫기 여부를 선택할 수 있는 prop 추가
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, closeOnOutsideClick = true }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // ESC 키를 누르면 모달 닫기
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // 모달이 열리면 body 스크롤 방지
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // 모달 외부 클릭 시 닫기 - closeOnOutsideClick이 true일 때만 실행
  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOutsideClick && modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50 p-4"
      onClick={handleOutsideClick}
    >
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-4 right-4">
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};

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

// 주민등록번호 검증 함수
const isValidResidentId = (value: string) => {
  // 형식만 검사하고 항상 유효하다고 간주
  const digits = value.replace(/-/g, '');
  return digits.length === 13; // 13자리면 유효하다고 간주

  /* 유효성 검증 로직 주석 처리
  const digits = value.replace(/-/g, '');
  if (digits.length !== 13) return false;
  
  // 성별 자리(7번째 자리) 검증 - 1~9, 0 모두 유효
  const genderDigit = parseInt(digits[6], 10);
  if (isNaN(genderDigit) || genderDigit < 0 || genderDigit > 9) return false;
  
  // 외국인 등록번호(5, 6)인 경우 체크섬 검증을 건너뜁니다
  if (genderDigit === 5 || genderDigit === 6) {
    return true; // 외국인 등록번호는 자릿수와 형식만 검사
  }
  
  // 체크섬 검증 로직 (한국인 주민등록번호)
  const multipliers = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * multipliers[i];
  }
  const remainder = (11 - (sum % 11)) % 10;
  const checkDigit = parseInt(digits[12], 10);
  return remainder === checkDigit;
  */
};

// 한국 휴대폰 번호 검증 함수
const isValidKoreanPhoneNumber = (phone: string) => {
  const pattern = /^(010|011|016|017|018|019)-\d{3,4}-\d{4}$/;
  return pattern.test(phone);
};

function PatientQuestionnaireTable() {
  const [questionnaires, setQuestionnaires] = useState<PatientQuestionnaire[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField] = useState<keyof PatientQuestionnaire>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedAddresses, setExpandedAddresses] = useState<Record<string, boolean>>({});
  const [expandedTreatmentAreas, setExpandedTreatmentAreas] = useState<Record<string, boolean>>({});
  const [expandedAdditionalInfos, setExpandedAdditionalInfos] = useState<Record<string, boolean>>({});
  const [expandedReferrers, setExpandedReferrers] = useState<Record<string, boolean>>({});
  const [expandedMedicalHistories, setExpandedMedicalHistories] = useState<Record<string, boolean>>({});
  const [expandedPregnancySmoking, setExpandedPregnancySmoking] = useState<Record<string, boolean>>({});
  const [expandedEmergencyContacts, setExpandedEmergencyContacts] = useState<Record<string, boolean>>({});
  const [expandedInsurance, setExpandedInsurance] = useState<Record<string, boolean>>({});
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testInputData, setTestInputData] = useState({
    name: '',
    resident_id: '',
    phone: '',
    gender: '',
    referral_source: ''
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [consultationCounts, setConsultationCounts] = useState<Record<string, number>>({});
  const [consultationStatuses, setConsultationStatuses] = useState<Record<string, string>>({});
  const [consultationConsultants, setConsultationConsultants] = useState<Record<string, string[]>>({});
  const [uniqueConsultants, setUniqueConsultants] = useState<string[]>([]);
  const [selectedConsultant, setSelectedConsultant] = useState('');
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // 환자정보 상세보기 모달 관련 상태
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientQuestionnaire | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedPatient, setEditedPatient] = useState<PatientQuestionnaire | null>(null);
  
  // 환자 삭제 관련 상태
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // useState 부분에 statusFilter 상태 변수 추가
  const [statusFilter, setStatusFilter] = useState<string>('');

  // 날짜 필터 선택 상태를 추적하는 변수 추가
  const [activeDateFilter, setActiveDateFilter] = useState('');
  
  // 내원목적 확장 상태
  const [expandedVisitReasons, setExpandedVisitReasons] = useState<Record<string, boolean>>({});

  // 환자정보 상세보기 함수
  const openDetailModal = (patient: PatientQuestionnaire) => {
    setSelectedPatient(patient);
    setEditedPatient({...patient});
    setIsEditMode(false);
    setIsDetailModalOpen(true);
  };

  // 환자정보 수정 모드 전환
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    // 편집 모드 취소 시 원래 데이터로 복원
    if (isEditMode && selectedPatient) {
      setEditedPatient({...selectedPatient});
    }
  };

  // 환자정보 입력값 변경 핸들러
  const handlePatientInfoChange = (field: keyof PatientQuestionnaire, value: any) => {
    if (editedPatient) {
      setEditedPatient({
        ...editedPatient,
        [field]: value
      });
    }
  };

  // 환자정보 저장 함수
  const savePatientInfo = async () => {
    if (!editedPatient || !editedPatient.resident_id) return;
    
    try {
      const { error } = await supabase
        .from('patient_questionnaire')
        .update(editedPatient)
        .eq('resident_id', editedPatient.resident_id);
      
      if (error) {
        console.error('환자정보 업데이트 오류:', error);
        alert(`환자정보 저장 중 오류가 발생했습니다: ${error.message}`);
        return;
      }
      
      // 수정된 정보로 선택된 환자정보 업데이트
      setSelectedPatient({...editedPatient});
      setIsEditMode(false);
      
      // 환자 목록 갱신
      fetchQuestionnaires(true);
      
      alert('환자정보가 성공적으로 저장되었습니다.');
    } catch (err) {
      console.error('환자정보 저장 중 예외 발생:', err);
      alert('환자정보 저장 중 오류가 발생했습니다.');
    }
  };

  // 마우스 다운 이벤트 핸들러
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tableContainerRef.current) return;
    
    // 텍스트 선택 등의 상황에서는 드래그 스크롤 방지
    if ((e.target as HTMLElement).tagName === 'INPUT' || 
        (e.target as HTMLElement).tagName === 'BUTTON' ||
        (e.target as HTMLElement).tagName === 'A' ||
        (e.target as HTMLElement).tagName === 'SELECT') {
      return;
    }
    
    setIsDragging(true);
    setStartX(e.pageX - tableContainerRef.current.offsetLeft);
    setStartY(e.pageY - tableContainerRef.current.offsetTop);
    setScrollLeft(tableContainerRef.current.scrollLeft);
    setScrollTop(tableContainerRef.current.scrollTop);
    
    // 텍스트 선택 방지
    e.preventDefault();
  };

  // 마우스 이동 이벤트 핸들러
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !tableContainerRef.current) return;
    
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const y = e.pageY - tableContainerRef.current.offsetTop;
    
    // 이동 거리 계산
    const walkX = (x - startX) * 1.5; // 스크롤 속도 조절 가능
    const walkY = (y - startY) * 1.5;
    
    // 스크롤 위치 업데이트
    tableContainerRef.current.scrollLeft = scrollLeft - walkX;
    tableContainerRef.current.scrollTop = scrollTop - walkY;
  };

  // 마우스 업 이벤트 핸들러
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 마우스 나가기 이벤트 핸들러
  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  // 이벤트 리스너 등록 및 제거
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startX, startY, scrollLeft, scrollTop]);
  
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
        .select('patient_id, id, consultant, treatment_status, consultation_date')
        .in('patient_id', residentIds)
        .order('consultation_date', { ascending: false });
      
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
        // 환자별 최신 상담 상태
        const statuses: Record<string, string> = {};
        // 전체 상담자 목록 (중복 제거)
        const allConsultants = new Set<string>();
        
        // 환자별로 가장 최근 상담 레코드 저장
        const latestConsultations: Record<string, any> = {};
        
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
            
            // 최신 상담 정보 저장 (정렬이 이미 최신순이므로 처음 나오는 것이 최신)
            if (!latestConsultations[item.patient_id]) {
              latestConsultations[item.patient_id] = item;
              
              // 치료 상태가 있으면 저장
              if (item.treatment_status) {
                statuses[item.patient_id] = item.treatment_status;
              }
            }
          }
        });
        
        setConsultationCounts(counts);
        setConsultationConsultants(consultants);
        setConsultationStatuses(statuses); // 최신 상담 상태 설정
        
        console.log('상담 상태 정보:', statuses);
        
        // 전체 상담자 목록 정렬하여 설정
        const sortedConsultants = Array.from(allConsultants).sort();
        console.log('로드된 상담자 목록:', sortedConsultants);
        setUniqueConsultants(sortedConsultants);
      }
    } catch (error) {
      console.error('상담 정보 가져오기 중 오류 발생:', error);
    }
  }

  // 테스트용 데이터 추가 함수 - 사용자 입력 모달 열기
  const openTestDataModal = () => {
    setTestInputData({
      name: '',
      resident_id: '',
      phone: '',
      gender: '',
      referral_source: ''
    });
    setValidationErrors({});
    setIsTestModalOpen(true);
  };

  // 테스트 데이터 입력 처리 함수 (select 요소도 처리할 수 있도록 수정)
  const handleTestInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    // 주민등록번호 처리 및 성별 추론
    if (name === 'resident_id') {
      let formattedValue = value.replace(/[^0-9-]/g, '');
      if (formattedValue.length > 6 && !formattedValue.includes('-')) {
        formattedValue = `${formattedValue.slice(0, 6)}-${formattedValue.slice(6, 13)}`;
      }
      
      // 성별 추론 (주민번호 뒷자리 첫번째 숫자로)
      let gender = '';
      const genderDigit = formattedValue.length >= 8 ? formattedValue.charAt(7) : '';
      if (['1', '3', '5', '7', '9'].includes(genderDigit)) {
        gender = '남';
      } else if (['2', '4', '6', '8', '0'].includes(genderDigit)) {
        gender = '여';
      }
      
      setTestInputData(prev => ({
        ...prev,
        resident_id: formattedValue,
        gender: gender || prev.gender
      }));
      
      // 유효성 검사
      if (formattedValue.length === 14) {
        if (!isValidResidentId(formattedValue)) {
          setValidationErrors(prev => ({
            ...prev,
            resident_id: '유효하지 않은 주민등록번호입니다'
          }));
        } else {
          setValidationErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.resident_id;
            return newErrors;
          });
        }
      } else {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.resident_id;
          return newErrors;
        });
      }
      
      return;
    }
    
    // 전화번호 자동 하이픈 처리
    else if (name === 'phone') {
      let digits = value.replace(/[^0-9]/g, '');
      let formattedValue = '';
      
      if (digits.length <= 3) {
        formattedValue = digits;
      } else if (digits.length <= 7) {
        formattedValue = `${digits.slice(0, 3)}-${digits.slice(3)}`;
      } else {
        formattedValue = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
      }
      
      setTestInputData(prev => ({
        ...prev,
        phone: formattedValue
      }));
      
      // 유효성 검사
      if (formattedValue && !isValidKoreanPhoneNumber(formattedValue)) {
        setValidationErrors(prev => ({
          ...prev,
          phone: '유효하지 않은 전화번호입니다. 예) 010-1234-5678'
        }));
      } else {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.phone;
          return newErrors;
        });
      }
      
      return;
    }
    
    // 일반 필드 처리 (드롭다운 포함)
    else {
      setTestInputData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // 테스트용 데이터 추가 함수 - 실제 데이터 저장
  async function addTestData() {
    try {
      // 유효성 검사
      const errors: Record<string, string> = {};
      
      if (testInputData.resident_id && testInputData.resident_id.length === 14) {
        if (!isValidResidentId(testInputData.resident_id)) {
          errors.resident_id = '유효하지 않은 주민등록번호입니다';
        }
      }
      
      if (testInputData.phone && !isValidKoreanPhoneNumber(testInputData.phone)) {
        errors.phone = '유효하지 않은 전화번호입니다. 예) 010-1234-5678';
      }
      
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }
      
      // 주민번호 중복 확인 (입력된 주민번호가 있는 경우에만)
      if (testInputData.resident_id) {
        console.log('주민번호 중복 확인 중...');
        
        const { data: existingData, error: checkError } = await supabase
          .from('patient_questionnaire')
          .select('id, name')
          .eq('resident_id', testInputData.resident_id)
          .maybeSingle();
        
        if (checkError) {
          console.error('주민번호 중복 확인 중 오류 발생:', checkError);
        }
        
        if (existingData) {
          console.log('중복된 주민번호 발견:', existingData);
          setValidationErrors(prev => ({
            ...prev,
            resident_id: `이미 등록된 주민번호입니다 (환자명: ${existingData.name || '미상'})`
          }));
          setToast({ 
            message: `이미 등록된 주민번호입니다: ${testInputData.resident_id}`, 
            type: 'error' 
          });
          return;
        }
      }
      
      console.log('테스트 데이터 추가 시도 중...');
      
      // 테스트 데이터 - 필수 필드만 포함
      const koreanTime = moment().tz('Asia/Seoul').format('YYYY-MM-DDTHH:mm:ss.SSSZ'); // 한국 시간 ISO 포맷으로 지정
      console.log('한국 시간으로 설정된 시간:', koreanTime);
      
      const testData = {
        name: testInputData.name || `테스트 ${Math.floor(Math.random() * 1000)}`,
        created_at: koreanTime,
        at_clinic: true,
        consent: true,
        resident_id: testInputData.resident_id || `T${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
        gender: testInputData.gender || '남',
        phone: testInputData.phone || '',
        address: '',
        has_private_insurance: false,
        private_insurance_period: '',
        insurance_company: '',
        emergency_contact_name: '',
        emergency_contact_relation: '',
        emergency_contact_phone: '',
        visit_reason: '',
        treatment_area: '',
        referral_source: testInputData.referral_source || '',
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
        submitted_at: koreanTime
      };

      console.log('추가할 데이터:', testData);
      
      const { data, error, status } = await supabase
        .from('patient_questionnaire')
        .insert([testData])
        .select();

      console.log('Supabase 응답 상태 코드:', status);
      console.log('Supabase 응답:', { data, error });
      
      if (data && data.length > 0) {
        console.log('저장된 데이터의 submitted_at:', data[0].submitted_at);
        console.log('저장된 데이터의 created_at:', data[0].created_at);
      }
      
      if (error) {
        console.error('Supabase 오류 상세:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        // 주민번호 중복 관련 오류인 경우 (Supabase에서 고유 제약 조건 위반 오류 코드)
        if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
          setValidationErrors(prev => ({
            ...prev,
            resident_id: '이미 등록된 주민번호입니다'
          }));
          setToast({ 
            message: '이미 등록된 주민번호입니다', 
            type: 'error' 
          });
          return;
        }
        
        throw error;
      }
      
      if (data && data.length > 0) {
        console.log('데이터 추가 성공:', data[0]);
        // 테이블의 맨 위에 새 데이터 추가
        setQuestionnaires(prev => [data[0] as PatientQuestionnaire, ...prev]);
        setToast({ message: '테스트 데이터가 추가되었습니다!', type: 'success' });
        setIsTestModalOpen(false); // 모달 닫기
      } else {
        // 데이터가 반환되지 않았지만 오류도 없는 경우
        setToast({ message: '데이터가 추가되었으나, 반환된 데이터가 없습니다.', type: 'info' });
        // 데이터 새로고침
        fetchQuestionnaires();
        setIsTestModalOpen(false); // 모달 닫기
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
  const renderAddress = (value: string | null | undefined, index: number, isModal: boolean = false) => {
    if (!value) return '-';
    
    const address = value.trim();
    if (address.length === 0) return '-';
    
    // 모달에서는 항상 전체 내용 표시
    if (isModal) {
      return <div className="whitespace-pre-wrap break-words">{address}</div>;
    }
    
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
  const renderTreatmentArea = (value: string | null | undefined, index: number, isModal: boolean = false) => {
    if (!value) return '-';
    
    // 쉼표로 구분하여 배열로 변환하고 각 항목의 앞뒤 공백 제거
    const areas = value.split(',').map(item => item.trim()).filter(Boolean);
    
    // 항목이 없거나 빈 문자열만 있는 경우
    if (areas.length === 0) return '-';
    
    // 모달에서는 항상 전체 내용 표시
    if (isModal) {
      return (
        <div className="flex flex-col gap-1">
          {areas.map((area, i) => (
            <span key={i} className="break-words whitespace-normal">{area}</span>
          ))}
        </div>
      );
    }
    
    // 각 항목을 줄바꿈 처리하고 긴 텍스트는 잘라서 표시
    const processAreaText = (text: string) => {
      // 30자 이상인 경우 자동 줄바꿈 처리를 위한 클래스 적용
      if (text.length > 30) {
        return <span className="break-words whitespace-normal">{text}</span>;
      }
      return <span>{text}</span>;
    };
    
    // 2개 이하일 경우 줄바꿈하여 표시
    if (areas.length <= 2) {
      return (
        <div className="flex flex-col gap-1">
          {areas.map((area, i) => (
            <div key={i} className="break-words whitespace-normal">
              {processAreaText(area)}
            </div>
          ))}
        </div>
      );
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
          <div className="flex flex-col gap-1">
            {areas.map((area, i) => (
              <div key={i} className="break-words whitespace-normal">
                {processAreaText(area)}
              </div>
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
          <div className="flex flex-col gap-1">
            <div className="break-words whitespace-normal">
              {processAreaText(areas[0])}
            </div>
            <div className="break-words whitespace-normal">
              {processAreaText(areas[1])}
              {areas.length > 2 ? ` 외 ${areas.length - 2}개 `:''}
              <span className="text-blue-500 text-sm">▼</span>
            </div>
          </div>
        </div>
      );
    }
  };

  // 내원목적 표시 함수
  const renderVisitReason = (value: string | null | undefined, index: number, isModal: boolean = false) => {
    if (!value) return '-';
    
    const reason = value.trim();
    if (reason.length === 0) return '-';
    
    // 모달에서는 항상 전체 내용 표시
    if (isModal) {
      return <div className="whitespace-pre-wrap break-words">{reason}</div>;
    }
    
    // 내용이 짧은 경우 그대로 표시
    if (reason.length <= 15) {
      return reason;
    }
    
    const isExpanded = expandedVisitReasons[`visit-${index}`] || false;
    
    if (isExpanded) {
      // 펼쳐진 상태: 전체 텍스트 표시
      return (
        <div 
          className="cursor-pointer whitespace-pre-wrap break-words"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedVisitReasons(prev => ({
              ...prev,
              [`visit-${index}`]: false
            }));
          }}
          title="접기"
        >
          <div className="flex flex-col">
            <span>{reason}</span>
            <span className="text-blue-500 mt-1">▲ 접기</span>
          </div>
        </div>
      );
    } else {
      // 접힌 상태: 첫 부분만 표시
      const shortReason = reason.length > 15 ? reason.substring(0, 15) + '...' : reason;
      
      return (
        <div 
          className="cursor-pointer hover:text-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedVisitReasons(prev => ({
              ...prev,
              [`visit-${index}`]: true
            }));
          }}
          title="펼쳐서 전체 내용 보기"
        >
          <div className="flex flex-col">
            <span>{shortReason}</span>
            <span className="text-blue-500 text-sm">▼ 더보기</span>
          </div>
        </div>
      );
    }
  };

  // 부가정보 표시 함수 (길이가 긴 텍스트를 표시하고 클릭하면 펼쳐짐)
  const renderAdditionalInfo = (value: string | null | undefined, index: number, isModal: boolean = false) => {
    if (!value) return '-';
    
    const info = value.trim();
    if (info.length === 0) return '-';
    
    // 모달에서는 항상 전체 내용 표시
    if (isModal) {
      return <div className="whitespace-pre-wrap break-words">{info}</div>;
    }
    
    // 내용이 짧은 경우 그대로 표시
    if (info.length <= 30) {
      return info;
    }
    
    const isExpanded = expandedAdditionalInfos[`info-${index}`] || false;
    
    if (isExpanded) {
      // 펼쳐진 상태: 전체 텍스트 표시
      return (
        <div 
          className="cursor-pointer whitespace-pre-wrap break-words"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedAdditionalInfos(prev => ({
              ...prev,
              [`info-${index}`]: false
            }));
          }}
          title="접기"
        >
          <div className="flex flex-col">
            <span>{info}</span>
            <span className="text-blue-500 mt-1">▲ 접기</span>
          </div>
        </div>
      );
    } else {
      // 접힌 상태: 두 줄로 제한하여 표시
      let firstLine = '';
      let secondLine = '';
      
      // 줄 바꿈이 있는 경우
      if (info.includes('\n')) {
        const lines = info.split('\n');
        firstLine = lines[0];
        if (lines.length > 1) {
          secondLine = lines.length > 2 ? `${lines[1]}...` : lines[1];
        }
      } else {
        // 적절한 위치에서 자르기
        const breakPoint = Math.min(40, Math.floor(info.length / 2));
        let breakPosition = breakPoint;
        
        // 공백, 쉼표 등 자연스러운 위치에서 자르기
        for (let i = breakPoint; i > breakPoint - 10 && i > 0; i--) {
          if ([' ', ',', '.', ';', ':', '-'].includes(info[i])) {
            breakPosition = i + 1;
            break;
          }
        }
        
        firstLine = info.substring(0, breakPosition).trim();
        secondLine = info.length > breakPosition + 40 ? 
          `${info.substring(breakPosition, breakPosition + 37).trim()}...` : 
          info.substring(breakPosition).trim();
      }
      
      return (
        <div 
          className="cursor-pointer hover:text-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedAdditionalInfos(prev => ({
              ...prev,
              [`info-${index}`]: true
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

  // 날짜 시간 표시 함수 - ISO 타임스탬프를 한국 시간으로 변환하여 표시
  const renderDateTime = (dateTimeString: string | null | undefined) => {
    if (!dateTimeString) return '-';
    
    try {
      // moment를 사용하여 타임스탬프를 한국 시간대로 변환
      const koreaTime = moment(dateTimeString).tz('Asia/Seoul');
      
      // 날짜 형식: YYYY/MM/DD
      const datePart = koreaTime.format('YYYY/MM/DD');
      
      // 시간 형식: HH:mm:ss
      const timePart = koreaTime.format('HH:mm:ss');
      
      return (
        <div className="flex flex-col">
          <span>{datePart}</span>
          <span>{timePart} (KST)</span>
        </div>
      );
    } catch (error) {
      console.error('날짜 변환 오류:', error);
      // 오류 발생 시 원본 문자열 반환
      return dateTimeString;
    }
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
    setActiveDateFilter('custom'); // 수동 날짜 선택일 경우 'custom'으로 설정
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
    setActiveDateFilter('current-month'); // 활성 필터 설정
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
    setActiveDateFilter('previous-month'); // 활성 필터 설정
  };

  // 이번주, 지난주, 오늘, 어제 설정 함수 추가
  const setCurrentWeek = () => {
    const now = new Date();
    const day = now.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
    
    // 이번 주의 시작일(월요일)을 계산 - 현재 날짜에서 요일 값을 빼고 1을 더함
    const mondayOffset = day === 0 ? -6 : 1 - day; // 일요일인 경우 특별 처리
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + mondayOffset);
    
    // 이번 주의 마지막 날(일요일)을 계산
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    // YYYY-MM-DD 형식으로 변환
    const newStartDate = startOfWeek.toISOString().split('T')[0];
    const newEndDate = endOfWeek.toISOString().split('T')[0];
    
    setStartDateInput(newStartDate);
    setEndDateInput(newEndDate);
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setActiveDateFilter('current-week'); // 활성 필터 설정
  };
  
  const setPreviousWeek = () => {
    const now = new Date();
    const day = now.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
    
    // 이번 주의 시작일(월요일)을 계산
    const mondayOffset = day === 0 ? -6 : 1 - day; // 일요일인 경우 특별 처리
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() + mondayOffset);
    
    // 지난 주의 시작일(월요일)을 계산 - 이번 주 월요일에서 7일 뺌
    const startOfPrevWeek = new Date(startOfThisWeek);
    startOfPrevWeek.setDate(startOfThisWeek.getDate() - 7);
    
    // 지난 주의 마지막 날(일요일)을 계산
    const endOfPrevWeek = new Date(startOfPrevWeek);
    endOfPrevWeek.setDate(startOfPrevWeek.getDate() + 6);
    
    // YYYY-MM-DD 형식으로 변환
    const newStartDate = startOfPrevWeek.toISOString().split('T')[0];
    const newEndDate = endOfPrevWeek.toISOString().split('T')[0];
    
    setStartDateInput(newStartDate);
    setEndDateInput(newEndDate);
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setActiveDateFilter('previous-week'); // 활성 필터 설정
  };
  
  const setToday = () => {
    const today = new Date();
    
    // YYYY-MM-DD 형식으로 변환
    const todayString = today.toISOString().split('T')[0];
    
    setStartDateInput(todayString);
    setEndDateInput(todayString);
    setStartDate(todayString);
    setEndDate(todayString);
    setActiveDateFilter('today'); // 활성 필터 설정
  };
  
  const setYesterday = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    // YYYY-MM-DD 형식으로 변환
    const yesterdayString = yesterday.toISOString().split('T')[0];
    
    setStartDateInput(yesterdayString);
    setEndDateInput(yesterdayString);
    setStartDate(yesterdayString);
    setEndDate(yesterdayString);
    setActiveDateFilter('yesterday'); // 활성 필터 설정
  };

  // 상담 상태 필터 함수
  const filterByStatus = (status: string) => {
    // 현재 필터가 선택된 상태라면 초기화
    if (statusFilter === status) {
      setStatusFilter('');
    } else {
      setStatusFilter(status);
    }
  };

  // 종결 필터
  const setCompletedFilter = () => {
    filterByStatus('종결');
  };

  // 중단 필터
  const setPausedFilter = () => {
    filterByStatus('중단 중');
  };

  // 치료중 필터 추가
  const setInTreatmentFilter = () => {
    filterByStatus('치료중');
  };

  // 필터 초기화
  const resetStatusFilter = () => {
    setStatusFilter('');
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
      
      // passConsultantFilter 바로 아래에 상담 상태 필터 추가
      // 상담 상태 필터링
      let passStatusFilter = true;
      
      // 선택된 상태 필터가 있는 경우에만 필터링 적용
      if (statusFilter) {
        passStatusFilter = false;
        
        // '치료중' 필터인 경우 특별 처리
        if (statusFilter === '치료중') {
          // 상담 상태가 있고, '중단 중'이나 '종결'이 아닌 경우
          const status = consultationStatuses[item.resident_id];
          if (status && status !== '중단 중' && status !== '종결') {
            passStatusFilter = true;
          }
        } 
        // 다른 상태 필터는 정확히 일치하는지 확인
        else if (consultationStatuses[item.resident_id] === statusFilter) {
          passStatusFilter = true;
        }
      }
      
      return searchableText.includes(filterText.toLowerCase()) && passDateFilter && passConsultantFilter && passStatusFilter;
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
  }, [questionnaires, filterText, sortField, sortOrder, startDate, endDate, selectedConsultant, consultationConsultants, statusFilter, consultationStatuses]);

  // 소개자 정보 묶음 표시 함수
  const renderReferrerInfo = (item: PatientQuestionnaire, index: number, isModal: boolean = false) => {
    const name = renderReferrerName(item.referrer_name);
    const phone = renderReferrerPhone(item.referrer_phone);
    const birthYear = renderReferrerBirthYear(item.referrer_birth_year);
    
    // 모달에서는 항상 전체 내용 표시
    if (isModal) {
      return (
        <div className="flex flex-col">
          <div><strong>이름:</strong> {name}</div>
          <div><strong>연락처:</strong> {phone}</div>
          <div><strong>생년:</strong> {birthYear}</div>
        </div>
      );
    }
    
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
  const renderMedicalHistory = (item: PatientQuestionnaire, index: number, isModal: boolean = false) => {
    // 정보가 없는 경우
    if (!item.medications && !item.other_medication && !item.medical_conditions && !item.other_condition && !item.allergies && !item.other_allergy) {
      return '-';
    }
    
    // 모달에서는 항상 전체 내용 표시
    if (isModal) {
      return (
        <div className="flex flex-col">
          {item.medications && <div><strong>복용약물:</strong> {item.medications}</div>}
          {item.other_medication && <div><strong>기타 복용약물:</strong> {item.other_medication}</div>}
          {item.medical_conditions && <div><strong>질환:</strong> {item.medical_conditions}</div>}
          {item.other_condition && <div><strong>기타 질환:</strong> {item.other_condition}</div>}
          {item.allergies && <div><strong>알레르기:</strong> {item.allergies}</div>}
          {item.other_allergy && <div><strong>기타 알레르기:</strong> {item.other_allergy}</div>}
        </div>
      );
    }
    
    const isExpanded = expandedMedicalHistories[`medical-${index}`] || false;
    const medications = item.medications || '-';
    const conditions = item.medical_conditions || '-';
    const allergies = item.allergies || '-';
    
    if (isExpanded) {
      // 펼쳐진 상태: 모든 정보 표시
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
            {item.other_medication && <div><strong>기타 복용약물:</strong> {item.other_medication}</div>}
            {conditions !== '-' && <div><strong>질환:</strong> {conditions}</div>}
            {item.other_condition && <div><strong>기타 질환:</strong> {item.other_condition}</div>}
            {allergies !== '-' && <div><strong>알레르기:</strong> {allergies}</div>}
            {item.other_allergy && <div><strong>기타 알레르기:</strong> {item.other_allergy}</div>}
            <span className="text-blue-500 mt-1">▲ 접기</span>
          </div>
        </div>
      );
    } else {
      // 접힌 상태: 간단한 요약 정보만 표시
      let summary = '-';
      
      // 복용약물, 질환, 알레르기 중 하나라도 있으면 표시
      if (medications !== '-') {
        summary = medications;
      } else if (conditions !== '-') {
        summary = conditions;
      } else if (allergies !== '-') {
        summary = allergies;
      } else if (item.other_medication) {
        summary = item.other_medication;
      } else if (item.other_condition) {
        summary = item.other_condition;
      } else if (item.other_allergy) {
        summary = item.other_allergy;
      }
      
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
          <div className="flex flex-col gap-1">
            <span>{summary}</span>
            {(medications !== '-' || conditions !== '-' || allergies !== '-' || item.other_medication || item.other_condition || item.other_allergy) && 
              <span className="text-sm text-gray-500">더보기 <span className="text-blue-500 text-sm">▼</span></span>
            }
          </div>
        </div>
      );
    }
  };

  // 임신/흡연 정보 묶음 표시 함수
  const renderPregnancySmoking = (item: PatientQuestionnaire, index: number, isModal: boolean = false) => {
    // 정보가 없는 경우
    if (!item.pregnancy_status && !item.pregnancy_week && !item.smoking_status && !item.smoking_amount) {
      return '-';
    }
    
    // 모달에서는 항상 전체 내용 표시
    if (isModal) {
      return (
        <div className="flex flex-col">
          {item.pregnancy_status && <div><strong>임신여부:</strong> {item.pregnancy_status}</div>}
          {item.pregnancy_week && <div><strong>임신주수:</strong> {item.pregnancy_week}주</div>}
          {item.smoking_status && <div><strong>흡연여부:</strong> {item.smoking_status}</div>}
          {item.smoking_amount && <div><strong>흡연량:</strong> {item.smoking_amount}</div>}
        </div>
      );
    }
    
    const isExpanded = expandedPregnancySmoking[`pregnancy-${index}`] || false;
    const pregnancyStatus = item.pregnancy_status || '-';
    const pregnancyWeek = item.pregnancy_week;
    const smokingStatus = item.smoking_status || '-';
    const smokingAmount = item.smoking_amount || '-';
    
    if (isExpanded) {
      // 펼쳐진 상태: 모든 정보 표시
      return (
        <div 
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedPregnancySmoking(prev => ({
              ...prev,
              [`pregnancy-${index}`]: false
            }));
          }}
          title="접기"
        >
          <div className="flex flex-col gap-1">
            {pregnancyStatus !== '-' && <div><strong>임신여부:</strong> {pregnancyStatus}</div>}
            {pregnancyWeek && <div><strong>임신주수:</strong> {pregnancyWeek}주</div>}
            {smokingStatus !== '-' && <div><strong>흡연여부:</strong> {smokingStatus}</div>}
            {smokingAmount !== '-' && <div><strong>흡연량:</strong> {smokingAmount}</div>}
            <span className="text-blue-500 mt-1">▲ 접기</span>
          </div>
        </div>
      );
    } else {
      // 접힌 상태: 간단한 요약 정보만 표시
      let summary = '-';
      
      // 임신여부, 임신주수, 흡연여부 중 하나라도 있으면 표시
      if (pregnancyStatus !== '-') {
        summary = pregnancyStatus;
      } else if (pregnancyWeek) {
        summary = `${pregnancyWeek}주`;
      } else if (smokingStatus !== '-') {
        summary = smokingStatus;
      } else if (smokingAmount !== '-') {
        summary = smokingAmount;
      }
      
      return (
        <div 
          className="cursor-pointer hover:text-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedPregnancySmoking(prev => ({
              ...prev,
              [`pregnancy-${index}`]: true
            }));
          }}
          title="펼쳐서 모든 정보 보기"
        >
          <div className="flex flex-col gap-1">
            <span>{summary}</span>
            {(pregnancyStatus !== '-' || pregnancyWeek || smokingStatus !== '-' || smokingAmount !== '-') && 
              <span className="text-sm text-gray-500">더보기 <span className="text-blue-500 text-sm">▼</span></span>
            }
          </div>
        </div>
      );
    }
  };

  // 비상연락처 정보 묶음 표시 함수
  const renderEmergencyContact = (item: PatientQuestionnaire, index: number, isModal: boolean = false) => {
    // 정보가 없는 경우
    if (!item.emergency_contact_name && !item.emergency_contact_relation && !item.emergency_contact_phone) {
      return '-';
    }
    
    // 모달에서는 항상 전체 내용 표시
    if (isModal) {
      return (
        <div className="flex flex-col">
          {item.emergency_contact_name && <div><strong>이름:</strong> {item.emergency_contact_name}</div>}
          {item.emergency_contact_relation && <div><strong>관계:</strong> {item.emergency_contact_relation}</div>}
          {item.emergency_contact_phone && <div><strong>전화번호:</strong> {item.emergency_contact_phone}</div>}
        </div>
      );
    }
    
    const isExpanded = expandedEmergencyContacts[`emergency-${index}`] || false;
    const contactName = item.emergency_contact_name || '-';
    const contactRelation = item.emergency_contact_relation || '-';
    const contactPhone = item.emergency_contact_phone || '-';
    
    if (isExpanded) {
      // 펼쳐진 상태: 모든 정보 표시
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
          <div className="flex flex-col gap-1">
            {contactName !== '-' && <div><strong>이름:</strong> {contactName}</div>}
            {contactRelation !== '-' && <div><strong>관계:</strong> {contactRelation}</div>}
            {contactPhone !== '-' && <div><strong>연락처:</strong> {contactPhone}</div>}
            <span className="text-blue-500 mt-1">▲ 접기</span>
          </div>
        </div>
      );
    } else {
      // 접힌 상태: 이름만 표시
      const summary = contactName !== '-' ? contactName : '비상연락처 있음';
      
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
          <div className="flex flex-col gap-1">
            <span>{summary}</span>
            <span className="text-sm text-gray-500">더보기 <span className="text-blue-500 text-sm">▼</span></span>
          </div>
        </div>
      );
    }
  };

  // 치아보험 정보 묶음 표시 함수
  const renderInsurance = (item: PatientQuestionnaire, index: number, isModal: boolean = false) => {
    // 정보가 없는 경우
    if (!item.has_private_insurance && !item.private_insurance_period && !item.insurance_company) {
      return '-';
    }
    
    // 모달에서는 항상 전체 내용 표시
    if (isModal) {
      return (
        <div className="flex flex-col">
          <div><strong>가입여부:</strong> {renderBoolean(item.has_private_insurance)}</div>
          {item.private_insurance_period && <div><strong>보험기간:</strong> {renderInsurancePeriod(item.private_insurance_period)}</div>}
          {item.insurance_company && <div><strong>보험회사:</strong> {renderInsuranceCompany(item.insurance_company)}</div>}
        </div>
      );
    }
    
    const isExpanded = expandedInsurance[`insurance-${index}`] || false;
    const hasInsurance = renderBoolean(item.has_private_insurance);
    const period = renderInsurancePeriod(item.private_insurance_period);
    const company = renderInsuranceCompany(item.insurance_company);
    
    if (isExpanded) {
      // 펼쳐진 상태: 모든 정보 표시
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
          <div className="flex flex-col gap-1">
            <div><strong>가입여부:</strong> {hasInsurance}</div>
            {period !== '-' && <div><strong>보험기간:</strong> {period}</div>}
            {company !== '-' && <div><strong>보험회사:</strong> {company}</div>}
            <span className="text-blue-500 mt-1">▲ 접기</span>
          </div>
        </div>
      );
    } else {
      // 접힌 상태: 간단한 요약 정보만 표시
      let summary = '-';
      
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
          <div className="flex flex-col gap-1">
            <span>{summary}</span>
            {hasInsurance === '예' && (company !== '-' || period !== '-') && 
              <span className="text-sm text-gray-500">더보기 <span className="text-blue-500 text-sm">▼</span></span>
            }
          </div>
        </div>
      );
    }
  };

  // 환자 삭제 확인 모달 열기
  const openDeleteConfirmModal = () => {
    setIsDeleteModalOpen(true);
  };

  // 환자 삭제 확인 모달 닫기
  const closeDeleteConfirmModal = () => {
    setIsDeleteModalOpen(false);
  };

  // 환자 삭제 함수
  const deletePatient = async () => {
    if (!selectedPatient) return;
    
    console.log('환자 삭제 시도:', selectedPatient.resident_id);
    
    try {
      // 1. 먼저 해당 환자의 상담 기록을 삭제
      const { error: consultationError } = await supabase
        .from('patient_consultations')
        .delete()
        .eq('patient_id', selectedPatient.resident_id);
      
      if (consultationError) {
        console.error('상담 기록 삭제 오류:', consultationError);
        throw new Error('환자의 상담 기록 삭제에 실패했습니다: ' + consultationError.message);
      }
      
      console.log('환자 관련 상담 기록 삭제 성공');
      
      // 2. 환자 정보 삭제
      const { error } = await supabase
        .from('patient_questionnaire')
        .delete()
        .eq('resident_id', selectedPatient.resident_id);
      
      if (error) {
        console.error('Supabase 삭제 오류:', error);
        throw new Error('환자 삭제에 실패했습니다: ' + error.message);
      }
      
      console.log('Supabase에서 환자 삭제 성공');
      
      // 환자 목록에서 삭제된 환자 제거 (UI 업데이트)
      setQuestionnaires(prevData => prevData.filter(patient => patient.resident_id !== selectedPatient.resident_id));
      
      // 모달 닫기
      setIsDeleteModalOpen(false);
      setIsDetailModalOpen(false);
      
      // 알림 표시
      setToast({
        message: '환자와 관련된 모든 상담 기록이 성공적으로 삭제되었습니다.',
        type: 'success'
      });
    } catch (error) {
      console.error('환자 삭제 오류:', error);
      setToast({
        message: '환자 삭제 중 오류가 발생했습니다.',
        type: 'error'
      });
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
      
      <Header openTestDataModal={openTestDataModal} />
      
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
                onChange={(e) => {
                  setStartDateInput(e.target.value);
                  setActiveDateFilter(''); // 날짜 직접 변경 시 활성 필터 초기화
                }}
                className="w-full py-2 px-3 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white h-[38px]"
                max={endDateInput || undefined}
                aria-label="시작 날짜 선택"
                placeholder="YYYY-MM-DD"
              />
              {startDateInput && (
                <button
                  onClick={() => {
                    setStartDateInput('');
                    if (!endDateInput) setActiveDateFilter(''); // 종료 날짜도 비어있으면 필터 초기화
                  }}
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
                onChange={(e) => {
                  setEndDateInput(e.target.value);
                  setActiveDateFilter(''); // 날짜 직접 변경 시 활성 필터 초기화
                }}
                className="w-full py-2 px-3 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white h-[38px]"
                min={startDateInput || undefined}
                aria-label="종료 날짜 선택"
                placeholder="YYYY-MM-DD"
              />
              {endDateInput && (
                <button
                  onClick={() => {
                    setEndDateInput('');
                    if (!startDateInput) setActiveDateFilter(''); // 시작 날짜도 비어있으면 필터 초기화
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="종료 날짜 지우기"
                >
                  ✕
                </button>
              )}
            </div>
            
            <button
              onClick={applyDateFilter}
              className={`${
                activeDateFilter === 'custom'
                  ? 'bg-blue-500 hover:bg-blue-600'
                  : 'bg-indigo-500 hover:bg-indigo-600'
              } text-white py-2 px-4 rounded-md h-[38px]`}
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
      <div className="flex gap-2 mb-4 mt-1 flex-wrap">
        <button
          onClick={setToday}
          className={`text-xs ${
            activeDateFilter === 'today' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
          } px-2 py-1 rounded-md`}
          title="오늘 데이터 보기"
        >
          오늘
        </button>
        <button
          onClick={setYesterday}
          className={`text-xs ${
            activeDateFilter === 'yesterday' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
          } px-2 py-1 rounded-md`}
          title="어제 데이터 보기"
        >
          어제
        </button>
        <button
          onClick={setCurrentWeek}
          className={`text-xs ${
            activeDateFilter === 'current-week' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
          } px-2 py-1 rounded-md`}
          title="이번 주 데이터 보기"
        >
          이번주
        </button>
        <button
          onClick={setPreviousWeek}
          className={`text-xs ${
            activeDateFilter === 'previous-week' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
          } px-2 py-1 rounded-md`}
          title="지난 주 데이터 보기"
        >
          지난주
        </button>
        <button
          onClick={setCurrentMonth}
          className={`text-xs ${
            activeDateFilter === 'current-month' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
          } px-2 py-1 rounded-md`}
          title="이번 달 데이터 보기"
        >
          이번달
        </button>
        <button
          onClick={setPreviousMonth}
          className={`text-xs ${
            activeDateFilter === 'previous-month' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
          } px-2 py-1 rounded-md`}
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
              setActiveDateFilter(''); // 필터 초기화 시 활성 필터도 초기화
            }}
            className="text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 py-1 rounded-md"
            title="모든 날짜 필터 초기화"
          >
            초기화
          </button>
        )}
        
        {/* 구분선 */}
        <div className="mx-1 border-l border-gray-300 dark:border-gray-600"></div>
        
        {/* 상담 상태 필터 버튼 */}
        <button
          onClick={setCompletedFilter}
          className={`text-xs ${
            statusFilter === '종결' 
              ? 'bg-purple-500 text-white' 
              : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
          } px-2 py-1 rounded-md`}
          title="종결된 환자만 보기"
        >
          종결
        </button>
        <button
          onClick={setPausedFilter}
          className={`text-xs ${
            statusFilter === '중단 중' 
              ? 'bg-red-500 text-white' 
              : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
          } px-2 py-1 rounded-md`}
          title="중단된 환자만 보기"
        >
          중단
        </button>
        <button
          onClick={setInTreatmentFilter}
          className={`text-xs ${
            statusFilter === '치료중' 
              ? 'bg-yellow-500 text-white' 
              : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
          } px-2 py-1 rounded-md`}
          title="치료중인 환자만 보기"
        >
          치료중
        </button>
        {statusFilter && (
          <button
            onClick={resetStatusFilter}
            className="text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 py-1 rounded-md"
            title="상담 상태 필터 초기화"
          >
            상태 초기화
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
        <div 
          ref={tableContainerRef}
          className="table-container overflow-auto max-h-[calc(100vh-300px)] relative cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
        >
          <table>
            <thead className="sticky top-0 z-20">
              <tr className="bg-white dark:bg-gray-800 shadow-sm">
                <th className="sticky left-0 z-30 bg-white dark:bg-gray-800">동작</th>
                
                {/* 제출시간 */}
                <th onClick={() => handleSort('submitted_at')}>
                  제출시간 {sortField === 'submitted_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                
                <th 
                  onClick={() => handleSort('name')}
                  className="sticky left-[80px] z-30 bg-white dark:bg-gray-800"
                >
                  <div className="max-w-[5em]">
                    이름 {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                
                {/* 상담자 열 */}
                <th>상담자</th>
                
                <th onClick={() => handleSort('at_clinic')}>
                  내원유무 {sortField === 'at_clinic' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                
                <th onClick={() => handleSort('resident_id')}>
                  주민번호 {sortField === 'resident_id' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                
                <th onClick={() => handleSort('visit_reason')}>
                  <div className="w-24">
                    내원목적 {sortField === 'visit_reason' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                
                <th onClick={() => handleSort('treatment_area')}>
                  <div className="w-44">
                    불편부위 {sortField === 'treatment_area' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                
                <th onClick={() => handleSort('referral_source')}>
                  내원경로 {sortField === 'referral_source' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                
                <th onClick={() => handleSort('phone')}>
                  전화번호 {sortField === 'phone' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedData.length > 0 ? (
                filteredAndSortedData.map((item, index) => (
                  <tr key={index} className="group hover:bg-accent/50">
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 group-hover:bg-accent/50 text-center">
                      <div className="flex flex-col gap-1">
                        <Link
                          to={`/consultation/${item.resident_id}`}
                          className={`${
                            consultationStatuses[item.resident_id] === "중단 중" 
                              ? "bg-red-500 hover:bg-red-600" 
                              : consultationStatuses[item.resident_id] === "종결" 
                                ? "bg-purple-500 hover:bg-purple-600" 
                                : consultationStatuses[item.resident_id] && consultationStatuses[item.resident_id] !== "중단 중" && consultationStatuses[item.resident_id] !== "종결"
                                  ? "bg-yellow-500 hover:bg-yellow-600"
                                  : "bg-blue-500 hover:bg-blue-600"
                          } text-white p-1 rounded text-sm flex items-center justify-center gap-1`}
                          aria-label="상담"
                          title={
                            consultationStatuses[item.resident_id] === "중단 중" 
                              ? "상담이 중단된 환자" 
                              : consultationStatuses[item.resident_id] === "종결" 
                                ? "상담이 종결된 환자" 
                                : consultationStatuses[item.resident_id] && consultationStatuses[item.resident_id] !== "중단 중" && consultationStatuses[item.resident_id] !== "종결"
                                  ? `치료중인 환자 (${consultationStatuses[item.resident_id]})`
                                  : "상담 기록 보기/추가"
                          }
                        >
                          <span>
                            {consultationStatuses[item.resident_id] === "중단 중" 
                              ? "중단" 
                              : consultationStatuses[item.resident_id] === "종결" 
                                ? "종결" 
                                : consultationStatuses[item.resident_id] && consultationStatuses[item.resident_id] !== "중단 중" && consultationStatuses[item.resident_id] !== "종결"
                                  ? "치료중"
                                  : "상담"
                            }
                          </span>
                          {consultationCounts[item.resident_id] > 0 && (
                            <span className="bg-white text-blue-600 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                              {consultationCounts[item.resident_id]}
                            </span>
                          )}
                        </Link>
                        
                        {/* 환자정보 버튼 추가 */}
                        <button
                          onClick={() => openDetailModal(item)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white p-1 rounded text-sm mt-1"
                          aria-label="환자정보"
                          title="환자정보 상세보기"
                        >
                          환자정보
                        </button>
                      </div>
                    </td>
                    <td>{renderDateTime(item.submitted_at)}</td>
                    <td className="sticky left-[80px] z-10 bg-white dark:bg-gray-900 group-hover:bg-accent/50">
                      <div className="max-w-[5em] break-words whitespace-normal">
                        {item.name || '-'}
                      </div>
                    </td>
                    
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
                    <td>{item.resident_id || '-'}</td>
                    <td className="py-2">
                      <div className="w-24 leading-snug break-words whitespace-normal">
                        {renderVisitReason(item.visit_reason, index)}
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="w-44 leading-snug">
                        {renderTreatmentArea(item.treatment_area, index)}
                      </div>
                    </td>
                    <td>{item.referral_source || '-'}</td>
                    <td>{item.phone || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="text-center py-4">
                    표시할 데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 테스트 데이터 입력 모달 */}
      <Modal isOpen={isTestModalOpen} onClose={() => setIsTestModalOpen(false)}>
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">테스트 데이터 입력</h2>
          <p className="text-sm text-gray-500 mb-4">입력하지 않은 필드는 자동으로 생성됩니다.</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">이름</label>
              <input
                type="text"
                name="name"
                value={testInputData.name}
                onChange={handleTestInputChange}
                className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700"
                placeholder="이름을 입력하세요"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">주민등록번호</label>
              <input
                type="text"
                name="resident_id"
                value={testInputData.resident_id}
                onChange={handleTestInputChange}
                className={`w-full p-2 border ${validationErrors.resident_id ? 'border-red-500' : 'border-gray-300'} rounded-md dark:bg-gray-800 dark:border-gray-700`}
                placeholder="주민등록번호를 입력하세요 (예: 123456-1234567)"
                maxLength={14}
              />
              {validationErrors.resident_id && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.resident_id}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">하이픈(-)은 자동으로 입력됩니다</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">성별</label>
              <input
                type="text"
                value={testInputData.gender}
                readOnly
                className="w-full p-2 bg-gray-100 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                placeholder="주민번호 입력 시 자동 설정됩니다"
              />
              <p className="text-xs text-gray-500 mt-1">주민등록번호로부터 자동 설정됩니다</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">전화번호</label>
              <input
                type="text"
                name="phone"
                value={testInputData.phone}
                onChange={handleTestInputChange}
                className={`w-full p-2 border ${validationErrors.phone ? 'border-red-500' : 'border-gray-300'} rounded-md dark:bg-gray-800 dark:border-gray-700`}
                placeholder="전화번호를 입력하세요 (예: 010-1234-5678)"
                maxLength={13}
              />
              {validationErrors.phone && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.phone}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">하이픈(-)은 자동으로 입력됩니다</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">내원경로</label>
              <select
                name="referral_source"
                value={testInputData.referral_source}
                onChange={handleTestInputChange}
                className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 h-[42px]"
                aria-label="내원경로 선택"
              >
                <option value="" className="dark:bg-gray-800">내원경로 선택</option>
                <option value="인터넷 검색" className="dark:bg-gray-800">인터넷 검색</option>
                <option value="SNS" className="dark:bg-gray-800">SNS</option>
                <option value="지인 소개" className="dark:bg-gray-800">지인 소개</option>
                <option value="가까운 위치" className="dark:bg-gray-800">가까운 위치</option>
                <option value="간판/현수막" className="dark:bg-gray-800">간판/현수막</option>
                <option value="광고" className="dark:bg-gray-800">광고</option>
                <option value="기타" className="dark:bg-gray-800">기타</option>
              </select>
            </div>
            
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded"
              >
                취소
              </button>
              <button
                onClick={addTestData}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                disabled={Object.keys(validationErrors).length > 0}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      </Modal>
      
      {/* 환자정보 상세보기 모달 */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} closeOnOutsideClick={false}>
        {selectedPatient && (
          <div className="h-full flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">환자정보 상세보기</h2>
              <div className="flex gap-2">
                {isEditMode ? (
                  <>
                    <button
                      onClick={savePatientInfo}
                      className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded"
                    >
                      저장
                    </button>
                    <button
                      onClick={toggleEditMode}
                      className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={openDeleteConfirmModal}
                      className="px-4 py-2 mr-2 bg-red-500 hover:bg-red-600 text-white rounded"
                    >
                      환자 삭제
                    </button>
                    <button
                      onClick={toggleEditMode}
                      className="px-4 py-2 mr-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => setIsDetailModalOpen(false)}
                      className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded"
                    >
                      닫기
                    </button>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex-1 p-6 overflow-auto">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">이름</dt>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editedPatient?.name || ''}
                      onChange={(e) => handlePatientInfoChange('name', e.target.value)}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <dd className="mt-1 text-lg font-semibold">{selectedPatient.name || '-'}</dd>
                  )}
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">주민등록번호</dt>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editedPatient?.resident_id || ''}
                      onChange={(e) => handlePatientInfoChange('resident_id', e.target.value)}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                      placeholder="000000-0000000"
                      maxLength={14}
                    />
                  ) : (
                    <dd className="mt-1">{selectedPatient.resident_id || '-'}</dd>
                  )}
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">성별</dt>
                  <dd className="mt-1">{renderGender(selectedPatient.gender, selectedPatient.resident_id)}</dd>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">전화번호</dt>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editedPatient?.phone || ''}
                      onChange={(e) => handlePatientInfoChange('phone', e.target.value)}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                      placeholder="010-0000-0000"
                    />
                  ) : (
                    <dd className="mt-1">{selectedPatient.phone || '-'}</dd>
                  )}
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg col-span-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">주소</dt>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editedPatient?.address || ''}
                      onChange={(e) => handlePatientInfoChange('address', e.target.value)}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <dd className="mt-1">{renderAddress(selectedPatient.address, 0, true)}</dd>
                  )}
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">내원유무</dt>
                  <dd className="mt-1">{renderBoolean(selectedPatient.at_clinic)}</dd>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">내원목적</dt>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editedPatient?.visit_reason || ''}
                      onChange={(e) => handlePatientInfoChange('visit_reason', e.target.value)}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <dd className="mt-1">{renderVisitReason(selectedPatient.visit_reason, 0, true)}</dd>
                  )}
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">불편부위</dt>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editedPatient?.treatment_area || ''}
                      onChange={(e) => handlePatientInfoChange('treatment_area', e.target.value)}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <dd className="mt-1">{renderTreatmentArea(selectedPatient.treatment_area, 0, true)}</dd>
                  )}
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">내원경로</dt>
                  {isEditMode ? (
                    <select
                      value={editedPatient?.referral_source || ''}
                      onChange={(e) => handlePatientInfoChange('referral_source', e.target.value)}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value="">내원경로 선택</option>
                      <option value="인터넷 검색">인터넷 검색</option>
                      <option value="SNS">SNS</option>
                      <option value="지인 소개">지인 소개</option>
                      <option value="가까운 위치">가까운 위치</option>
                      <option value="간판/현수막">간판/현수막</option>
                      <option value="광고">광고</option>
                      <option value="기타">기타</option>
                    </select>
                  ) : (
                    <dd className="mt-1">{selectedPatient.referral_source || '-'}</dd>
                  )}
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg col-span-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">소개자 정보</dt>
                  {isEditMode ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <div>
                        <label className="block text-sm">이름</label>
                        <input
                          type="text"
                          value={editedPatient?.referrer_name || ''}
                          onChange={(e) => handlePatientInfoChange('referrer_name', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm">연락처</label>
                        <input
                          type="text"
                          value={editedPatient?.referrer_phone || ''}
                          onChange={(e) => handlePatientInfoChange('referrer_phone', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm">생년</label>
                        <input
                          type="text"
                          value={editedPatient?.referrer_birth_year || ''}
                          onChange={(e) => handlePatientInfoChange('referrer_birth_year', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                    </div>
                  ) : (
                    <dd className="mt-1">{renderReferrerInfo(selectedPatient, 0, true)}</dd>
                  )}
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg col-span-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">의료 정보</dt>
                  {isEditMode ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <div>
                        <label className="block text-sm">복용약물</label>
                        <input
                          type="text"
                          value={editedPatient?.medications || ''}
                          onChange={(e) => handlePatientInfoChange('medications', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm">기타 약물</label>
                        <input
                          type="text"
                          value={editedPatient?.other_medication || ''}
                          onChange={(e) => handlePatientInfoChange('other_medication', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm">질환</label>
                        <input
                          type="text"
                          value={editedPatient?.medical_conditions || ''}
                          onChange={(e) => handlePatientInfoChange('medical_conditions', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm">기타 질환</label>
                        <input
                          type="text"
                          value={editedPatient?.other_condition || ''}
                          onChange={(e) => handlePatientInfoChange('other_condition', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm">알레르기</label>
                        <input
                          type="text"
                          value={editedPatient?.allergies || ''}
                          onChange={(e) => handlePatientInfoChange('allergies', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm">기타 알레르기</label>
                        <input
                          type="text"
                          value={editedPatient?.other_allergy || ''}
                          onChange={(e) => handlePatientInfoChange('other_allergy', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                    </div>
                  ) : (
                    <dd className="mt-1">{renderMedicalHistory(selectedPatient, 0, true)}</dd>
                  )}
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">임신/흡연</dt>
                  <dd className="mt-1">{renderPregnancySmoking(selectedPatient, 0, true)}</dd>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">비상연락처</dt>
                  {isEditMode ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <div>
                        <label className="block text-sm">이름</label>
                        <input
                          type="text"
                          value={editedPatient?.emergency_contact_name || ''}
                          onChange={(e) => handlePatientInfoChange('emergency_contact_name', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm">관계</label>
                        <input
                          type="text"
                          value={editedPatient?.emergency_contact_relation || ''}
                          onChange={(e) => handlePatientInfoChange('emergency_contact_relation', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm">연락처</label>
                        <input
                          type="text"
                          value={editedPatient?.emergency_contact_phone || ''}
                          onChange={(e) => handlePatientInfoChange('emergency_contact_phone', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                    </div>
                  ) : (
                    <dd className="mt-1">{renderEmergencyContact(selectedPatient, 0, true)}</dd>
                  )}
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">치아보험</dt>
                  {isEditMode ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <div>
                        <label className="block text-sm">보험 가입 여부</label>
                        <select
                          value={editedPatient?.has_private_insurance ? 'true' : 'false'}
                          onChange={(e) => handlePatientInfoChange('has_private_insurance', e.target.value === 'true')}
                          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        >
                          <option value="true">예</option>
                          <option value="false">아니오</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm">보험 기간</label>
                        <input
                          type="text"
                          value={editedPatient?.private_insurance_period || ''}
                          onChange={(e) => handlePatientInfoChange('private_insurance_period', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm">보험 회사</label>
                        <input
                          type="text"
                          value={editedPatient?.insurance_company || ''}
                          onChange={(e) => handlePatientInfoChange('insurance_company', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                    </div>
                  ) : (
                    <dd className="mt-1">{renderInsurance(selectedPatient, 0, true)}</dd>
                  )}
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">치과공포</dt>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editedPatient?.dental_fears || ''}
                      onChange={(e) => handlePatientInfoChange('dental_fears', e.target.value)}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                    />
                  ) : (
                    <dd className="mt-1">{selectedPatient.dental_fears || '-'}</dd>
                  )}
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">최근방문</dt>
                  <dd className="mt-1">{selectedPatient.last_visit || '-'}</dd>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">정보동의</dt>
                  <dd className="mt-1">{renderBoolean(selectedPatient.consent)}</dd>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg col-span-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">부가정보</dt>
                  {isEditMode ? (
                    <textarea
                      value={editedPatient?.additional_info || ''}
                      onChange={(e) => handlePatientInfoChange('additional_info', e.target.value)}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                      rows={3}
                    />
                  ) : (
                    <dd className="mt-1">{renderAdditionalInfo(selectedPatient.additional_info, 0, true)}</dd>
                  )}
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">제출시간</dt>
                  <dd className="mt-1">{renderDateTime(selectedPatient.submitted_at)}</dd>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t flex justify-end">
              {isEditMode ? (
                <>
                  <button
                    onClick={savePatientInfo}
                    className="px-4 py-2 mr-2 bg-green-500 hover:bg-green-600 text-white rounded"
                  >
                    저장
                  </button>
                  <button
                    onClick={toggleEditMode}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded"
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={openDeleteConfirmModal}
                    className="px-4 py-2 mr-2 bg-red-500 hover:bg-red-600 text-white rounded"
                  >
                    환자 삭제
                  </button>
                  <button
                    onClick={toggleEditMode}
                    className="px-4 py-2 mr-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded"
                  >
                    닫기
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 환자 삭제 확인 모달 */}
      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteConfirmModal} closeOnOutsideClick={false}>
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4">환자 삭제 확인</h3>
          <p className="mb-6">
            정말로 이 환자를 삭제하시겠습니까? 이 작업은 돌이킬 수 없으며, 환자와 관련된 모든 기록이 삭제됩니다.
          </p>
          <div className="flex justify-end">
            <button
              onClick={closeDeleteConfirmModal}
              className="px-4 py-2 mr-2 bg-gray-500 hover:bg-gray-600 text-white rounded"
            >
              취소
            </button>
            <button
              onClick={deletePatient}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
            >
              삭제
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// 라우터 설정 (HashRouter 사용)
const router = createHashRouter(
  createRoutesFromElements(
    <>
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <PatientQuestionnaireTable />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/consultation/:residentId" 
        element={
          <ProtectedRoute>
            <PatientConsultation />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <ConsultationDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/recent" 
        element={
          <ProtectedRoute>
            <RecentConsultations />
          </ProtectedRoute>
        } 
      />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      
      {/* 인증 콜백 라우트 추가 */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </>
  )
);

// 자동 새로고침 컴포넌트
const AutoRefresh: React.FC = () => {
  useEffect(() => {
    const checkPathAndRefresh = () => {
      // 현재 URL의 해시 부분 확인 (HashRouter 사용 중)
      const currentHash = window.location.hash;
      
      // 대시보드 페이지인 경우 새로고침 타이머 설정하지 않음
      if (currentHash.includes('/dashboard')) {
        console.log('대시보드 페이지에서는 자동 새로고침을 설정하지 않습니다.');
        return () => {}; // 타이머 설정 안함
      }
      
      // 메인 페이지인 경우에만 새로고침 타이머 설정
      // 메인 페이지는 "/" 또는 "#/" 또는 "#"으로 끝남
      if (currentHash === '' || currentHash === '#' || currentHash === '#/') {
        console.log('메인 페이지에서 새로고침 타이머 설정');
        
        // 5분마다 새로고침 실행
        const refreshInterval = setInterval(() => {
          console.log('5분이 지나 메인 페이지를 새로고침합니다.');
          window.location.reload();
        }, 300000); // 300000 밀리초 = 5분
        
        // 정리 함수 반환
        return () => {
          console.log('새로고침 타이머 제거');
          clearInterval(refreshInterval);
        };
      }
      
      // 메인 페이지가 아닌 경우 정리 함수만 반환 (타이머 설정 안함)
      return () => {};
    };
    
    // 해시 변경 이벤트 리스너 등록
    window.addEventListener('hashchange', checkPathAndRefresh);
    
    // 초기 체크 및 타이머 설정
    const cleanupTimer = checkPathAndRefresh();
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      window.removeEventListener('hashchange', checkPathAndRefresh);
      cleanupTimer();
    };
  }, []);

  return null; // UI에 아무것도 렌더링하지 않음
};

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <AuthProvider>
        <AutoRefresh />
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

