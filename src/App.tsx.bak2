import { useEffect, useState, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { ThemeProvider } from './components/ThemeProvider';
import { ThemeToggle } from './components/ThemeToggle';
import { Search, X } from 'lucide-react';
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

// 모달 컴포넌트 - X 버튼에 title 속성 추가
function Modal({ isOpen, onClose, children }: { isOpen: boolean, onClose: () => void, children: React.ReactNode }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">환자 정보 추가</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" title="닫기">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// 입력 필드 컴포넌트 확장
function InputField({ 
  label, 
  name, 
  value, 
  onChange, 
  type = 'text', 
  placeholder = '', 
  required = false,
  disabled = false,
  multiple = false,
  error = '',
  children
}: { 
  label: string, 
  name: string, 
  value: string | boolean, 
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void, 
  type?: string,
  placeholder?: string,
  required?: boolean,
  disabled?: boolean,
  multiple?: boolean,
  error?: string,
  children?: React.ReactNode
}) {
  // ARIA 속성을 위한 문자열
  const ariaInvalid = error ? "true" : "false";

  if (type === 'textarea') {
    return (
      <div className="mb-4">
        <label className="block mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
        <textarea
          name={name}
          value={value as string}
          onChange={onChange}
          className={`w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 ${error ? 'border-red-500' : ''}`}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          title={label}
        />
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>
    );
  }
  
  if (type === 'checkbox') {
    return (
      <div className="mb-4 flex items-center">
        <input
          type="checkbox"
          name={name}
          checked={value as boolean}
          onChange={onChange}
          className="mr-2"
          required={required}
          disabled={disabled}
          title={label}
        />
        <label>{label} {required && <span className="text-red-500">*</span>}</label>
      </div>
    );
  }
  
  if (type === 'select') {
    return (
      <div className="mb-4">
        <label className="block mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
        <select
          name={name}
          value={value as string}
          onChange={onChange}
          className={`w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 ${error ? 'border-red-500' : ''}`}
          required={required}
          disabled={disabled}
          multiple={multiple}
          aria-invalid={ariaInvalid}
          title={label}
        >
          {children}
        </select>
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>
    );
  }
  
  return (
    <div className="mb-4">
      <label className="block mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
      <input
        type={type}
        name={name}
        value={value as string}
        onChange={onChange}
        className={`w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 ${error ? 'border-red-500' : ''}`}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        title={label}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}

// 유효성 검사 함수들
// 주민등록번호 검증
const isValidResidentId = (value: string) => {
  const digits = value.replace('-', '');
  if (digits.length !== 13) return false;
  const multipliers = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * multipliers[i];
  }
  const remainder = (11 - (sum % 11)) % 10;
  const checkDigit = parseInt(digits[12], 10);
  return remainder === checkDigit;
};

// 한국 휴대폰 번호만 허용 (010,011,016,017,018,019)
const isValidKoreanPhoneNumber = (phone: string) => {
  const pattern = /^(010|011|016|017|018|019)-\d{3,4}-\d{4}$/;
  return pattern.test(phone);
};

// 날짜시각 포매팅 (YYYY-MM-DD HH:mm:ss)
const formatDateTime = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
};

// 환자 정보 입력 폼 컴포넌트
function PatientForm({ onSubmit, onCancel }: { onSubmit: (data: PatientQuestionnaire) => void, onCancel: () => void }) {
  // 폼 데이터 구조 변경
  const initialFormData: PatientQuestionnaire = {
    id: undefined,
    created_at: new Date().toISOString(),
    at_clinic: true,
    consent: true,
    name: '',
    resident_id: '',
    gender: '',
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
  
  const [formData, setFormData] = useState<PatientQuestionnaire>(initialFormData);
  const [activeSection, setActiveSection] = useState<number>(0);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  
  // 유효성 검사 실행하는 함수
  const validateField = (name: string, value: string | boolean): string => {
    switch(name) {
      case 'name':
        return value ? '' : '이름을 입력해주세요';
      case 'resident_id':
        if (!value) return '주민등록번호를 입력해주세요';
        return isValidResidentId(value as string) ? '' : '유효하지 않은 주민등록번호입니다';
      case 'phone':
        if (!value) return '전화번호를 입력해주세요';
        return isValidKoreanPhoneNumber(value as string) ? '' : '유효하지 않은 전화번호 형식입니다';
      case 'emergency_contact_phone':
        if (!value) return '';
        return isValidKoreanPhoneNumber(value as string) ? '' : '유효하지 않은 전화번호 형식입니다';
      case 'referrer_phone':
        if (!value) return '';
        return isValidKoreanPhoneNumber(value as string) ? '' : '유효하지 않은 전화번호 형식입니다';
      default:
        return '';
    }
  };
  
  // 입력값 변경 처리 (주민번호, 전화번호 특별 처리 포함)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    let newValue: string | boolean = type === 'checkbox' ? checked : value;
    
    // 주민번호 형식 처리
    if (name === 'resident_id') {
      let formattedValue = value.replace(/[^0-9]/g, '');
      if (formattedValue.length > 6) {
        formattedValue = `${formattedValue.slice(0, 6)}-${formattedValue.slice(6, 13)}`;
      }
      
      // 성별 추론
      if (formattedValue.length >= 8) {
        const genderDigit = formattedValue.charAt(7);
        let gender = '';
        if (['1', '3', '5', '7'].includes(genderDigit)) gender = '남성';
        if (['2', '4', '6', '8'].includes(genderDigit)) gender = '여성';
        
        setFormData(prev => ({
          ...prev,
          gender
        }));
      }
      
      newValue = formattedValue;
    }
    
    // 전화번호 형식 처리
    if (name === 'phone' || name === 'emergency_contact_phone' || name === 'referrer_phone') {
      let digits = value.replace(/[^0-9]/g, '');
      if (digits.length <= 3) {
        // 그대로
      } else if (digits.length <= 6) {
        digits = digits.replace(/^(\d{3})(\d{1,3})$/, '$1-$2');
      } else if (digits.length <= 10) {
        digits = digits.replace(/^(\d{3})(\d{3,4})(\d{1,4})$/, '$1-$2-$3');
      } else {
        digits = digits.slice(0, 11);
        digits = digits.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
      }
      
      newValue = digits;
    }
    
    // 새 값 설정
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
    
    // 유효성 검사 실행
    const error = validateField(name, newValue);
    setValidationErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };
  
  // 폼 제출 전 유효성 검사
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // 필수 필드 검사
    if (!formData.name) errors.name = '이름을 입력해주세요';
    if (!formData.resident_id) errors.resident_id = '주민등록번호를 입력해주세요';
    else if (!isValidResidentId(formData.resident_id)) errors.resident_id = '유효하지 않은 주민등록번호입니다';
    
    if (!formData.phone) errors.phone = '전화번호를 입력해주세요';
    else if (!isValidKoreanPhoneNumber(formData.phone)) errors.phone = '유효하지 않은 전화번호 형식입니다';
    
    if (formData.emergency_contact_phone && !isValidKoreanPhoneNumber(formData.emergency_contact_phone)) {
      errors.emergency_contact_phone = '유효하지 않은 전화번호 형식입니다';
    }
    
    if (formData.referrer_phone && !isValidKoreanPhoneNumber(formData.referrer_phone)) {
      errors.referrer_phone = '유효하지 않은 전화번호 형식입니다';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      setLoading(true);
      
      // 제출 시간 추가
      const submittedData = {
        ...formData,
        submitted_at: formatDateTime(new Date())
      };
      
      onSubmit(submittedData);
    }
  };
  
  const sections = [
    {
      title: "기본 정보",
      fields: (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <InputField 
                label="이름" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                required 
                error={validationErrors.name}
              />
            </div>
            <div>
              <InputField 
                label="주민번호" 
                name="resident_id" 
                value={formData.resident_id} 
                onChange={handleChange} 
                placeholder="123456-1234567" 
                required 
                error={validationErrors.resident_id}
              />
            </div>
            <div>
              <InputField 
                label="성별" 
                name="gender" 
                value={formData.gender} 
                onChange={handleChange} 
                type="select"
              >
                <option value="">선택하세요</option>
                <option value="남성">남성</option>
                <option value="여성">여성</option>
              </InputField>
            </div>
            <div>
              <InputField 
                label="전화번호" 
                name="phone" 
                value={formData.phone} 
                onChange={handleChange} 
                placeholder="010-1234-5678" 
                required 
                error={validationErrors.phone}
              />
            </div>
            <div className="md:col-span-2">
              <InputField 
                label="주소" 
                name="address" 
                value={formData.address} 
                onChange={handleChange} 
                type="textarea"
              />
            </div>
            <div>
              <InputField 
                label="내원여부" 
                name="at_clinic" 
                value={formData.at_clinic} 
                onChange={handleChange} 
                type="checkbox"
              />
            </div>
            <div>
              <InputField 
                label="정보이용동의" 
                name="consent" 
                value={formData.consent} 
                onChange={handleChange} 
                type="checkbox" 
                required
              />
            </div>
          </div>
        </>
      )
    },
    {
      title: "내원 정보",
      fields: (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <InputField 
                label="내원목적" 
                name="visit_reason" 
                value={formData.visit_reason} 
                onChange={handleChange} 
                type="select"
              >
                <option value="">선택하세요</option>
                <option value="정기검진">정기검진</option>
                <option value="이가 아파요">이가 아파요</option>
                <option value="이가 시려요">이가 시려요</option>
                <option value="잇몸이 부었어요">잇몸이 부었어요</option>
                <option value="이빼러 왔어요">이빼러 왔어요</option>
                <option value="치아에 구멍이 난 것 같아요">치아에 구멍이 난 것 같아요</option>
                <option value="충치가 생긴 것 같아요">충치가 생긴 것 같아요</option>
                <option value="임플란트 상담">임플란트 상담</option>
                <option value="교정상담">교정상담</option>
                <option value="미백">미백</option>
                <option value="앞니성형">앞니성형</option>
                <option value="기타">기타</option>
              </InputField>
            </div>
            <div>
              <InputField 
                label="불편부위 (쉼표로 구분)" 
                name="treatment_area" 
                value={formData.treatment_area} 
                onChange={handleChange}
                placeholder="예: 오른쪽 위 어금니, 아래 앞니"
              />
            </div>
            <div>
              <InputField 
                label="내원경로" 
                name="referral_source" 
                value={formData.referral_source} 
                onChange={handleChange} 
                type="select"
              >
                <option value="">선택하세요</option>
                <option value="인터넷 검색">인터넷 검색</option>
                <option value="SNS">SNS</option>
                <option value="지인 소개">지인 소개</option>
                <option value="가까운 위치">가까운 위치</option>
                <option value="간판/현수막">간판/현수막</option>
                <option value="광고">광고</option>
                <option value="기타">기타</option>
              </InputField>
            </div>
            <div>
              <InputField 
                label="최근방문" 
                name="last_visit" 
                value={formData.last_visit} 
                onChange={handleChange}
                type="select"
              >
                <option value="">선택하세요</option>
                <option value="6개월 이내">6개월 이내</option>
                <option value="6개월~1년">6개월~1년</option>
                <option value="1년~2년">1년~2년</option>
                <option value="2년~5년">2년~5년</option>
                <option value="5년 이상">5년 이상</option>
                <option value="처음 방문">처음 방문</option>
              </InputField>
            </div>
          </div>
        </>
      )
    },
    {
      title: "소개자 정보",
      fields: (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <InputField 
                label="소개자 이름" 
                name="referrer_name" 
                value={formData.referrer_name} 
                onChange={handleChange}
              />
            </div>
            <div>
              <InputField 
                label="소개자 연락처" 
                name="referrer_phone" 
                value={formData.referrer_phone} 
                onChange={handleChange}
                placeholder="010-1234-5678"
                error={validationErrors.referrer_phone}
              />
            </div>
            <div>
              <InputField 
                label="소개자 생년" 
                name="referrer_birth_year" 
                value={formData.referrer_birth_year} 
                onChange={handleChange}
                placeholder="예: 1985"
              />
            </div>
          </div>
        </>
      )
    },
    {
      title: "의료 정보",
      fields: (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <InputField 
                label="복용 중인 약물" 
                name="medications" 
                value={formData.medications} 
                onChange={handleChange}
                type="select"
                multiple={true}
              >
                <option value="복용 약물 없음">복용 약물 없음</option>
                <option value="아스피린/항응고제">아스피린/항응고제</option>
                <option value="골다공증약">골다공증약</option>
                <option value="혈압약">혈압약</option>
                <option value="당뇨약">당뇨약</option>
                <option value="스테로이드">스테로이드</option>
                <option value="혈전방지제">혈전방지제</option>
                <option value="기타">기타</option>
              </InputField>
            </div>
            <div>
              <InputField 
                label="기타 약물" 
                name="other_medication" 
                value={formData.other_medication} 
                onChange={handleChange}
              />
            </div>
            <div>
              <InputField 
                label="질환" 
                name="medical_conditions" 
                value={formData.medical_conditions} 
                onChange={handleChange}
                type="select"
                multiple={true}
              >
                <option value="해당사항 없음">해당사항 없음</option>
                <option value="고혈압">고혈압</option>
                <option value="당뇨">당뇨</option>
                <option value="심장질환">심장질환</option>
                <option value="뇌졸중">뇌졸중</option>
                <option value="간질환">간질환</option>
                <option value="신장질환">신장질환</option>
                <option value="갑상선질환">갑상선질환</option>
                <option value="암">암</option>
                <option value="기타">기타</option>
              </InputField>
            </div>
            <div>
              <InputField 
                label="기타 질환" 
                name="other_condition" 
                value={formData.other_condition} 
                onChange={handleChange}
              />
            </div>
            <div>
              <InputField 
                label="알레르기" 
                name="allergies" 
                value={formData.allergies} 
                onChange={handleChange}
                type="select"
                multiple={true}
              >
                <option value="알러지 없음">알러지 없음</option>
                <option value="페니실린">페니실린</option>
                <option value="항생제">항생제</option>
                <option value="마취제">마취제</option>
                <option value="라텍스">라텍스</option>
                <option value="금속">금속</option>
                <option value="기타">기타</option>
              </InputField>
            </div>
            <div>
              <InputField 
                label="기타 알레르기" 
                name="other_allergy" 
                value={formData.other_allergy} 
                onChange={handleChange}
              />
            </div>
          </div>
        </>
      )
    },
    {
      title: "임신/흡연 정보",
      fields: (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <InputField 
                label="임신여부" 
                name="pregnancy_status" 
                value={formData.pregnancy_status} 
                onChange={handleChange}
                type="select"
              >
                <option value="">선택하세요</option>
                <option value="아니오">아니오</option>
                <option value="임신 중">임신 중</option>
                <option value="수유 중">수유 중</option>
                <option value="해당 없음">해당 없음</option>
              </InputField>
            </div>
            <div>
              <InputField 
                label="임신주차" 
                name="pregnancy_week" 
                value={formData.pregnancy_week} 
                onChange={handleChange}
                type="select"
                disabled={formData.pregnancy_status !== "임신 중"}
              >
                <option value="">선택하세요</option>
                <option value="1-12주">1-12주</option>
                <option value="13-24주">13-24주</option>
                <option value="25-36주">25-36주</option>
                <option value="37주 이상">37주 이상</option>
              </InputField>
            </div>
            <div>
              <InputField 
                label="흡연여부" 
                name="smoking_status" 
                value={formData.smoking_status} 
                onChange={handleChange}
                type="select"
              >
                <option value="">선택하세요</option>
                <option value="비흡연">비흡연</option>
                <option value="흡연">흡연</option>
                <option value="과거 흡연">과거 흡연</option>
              </InputField>
            </div>
            <div>
              <InputField 
                label="흡연량" 
                name="smoking_amount" 
                value={formData.smoking_amount} 
                onChange={handleChange}
                type="select"
                disabled={formData.smoking_status !== "흡연"}
              >
                <option value="">선택하세요</option>
                <option value="반갑 미만/일">반갑 미만/일</option>
                <option value="반갑~한갑/일">반갑~한갑/일</option>
                <option value="한갑 이상/일">한갑 이상/일</option>
              </InputField>
            </div>
          </div>
        </>
      )
    },
    {
      title: "치아보험 정보",
      fields: (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <InputField 
                label="보험가입" 
                name="has_private_insurance" 
                value={formData.has_private_insurance} 
                onChange={handleChange}
                type="checkbox"
              />
            </div>
            <div>
              <InputField 
                label="보험기간" 
                name="private_insurance_period" 
                value={formData.private_insurance_period} 
                onChange={handleChange}
                type="select"
                disabled={!formData.has_private_insurance}
              >
                <option value="">선택하세요</option>
                <option value="6개월 미만">6개월 미만</option>
                <option value="6개월 ~ 1년">6개월 ~ 1년</option>
                <option value="1년 ~ 2년">1년 ~ 2년</option>
                <option value="2년 이상">2년 이상</option>
              </InputField>
            </div>
            <div>
              <InputField 
                label="보험회사" 
                name="insurance_company" 
                value={formData.insurance_company} 
                onChange={handleChange}
                disabled={!formData.has_private_insurance}
                placeholder="예: ○○손해보험, ○○화재 등"
              />
            </div>
          </div>
        </>
      )
    },
    {
      title: "비상연락처",
      fields: (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <InputField 
                label="비상연락처 이름" 
                name="emergency_contact_name" 
                value={formData.emergency_contact_name} 
                onChange={handleChange}
              />
            </div>
            <div>
              <InputField 
                label="비상연락처 관계" 
                name="emergency_contact_relation" 
                value={formData.emergency_contact_relation} 
                onChange={handleChange}
                type="select"
              >
                <option value="">관계 선택</option>
                <option value="배우자">배우자</option>
                <option value="부모">부모</option>
                <option value="자녀">자녀</option>
                <option value="형제/자매">형제/자매</option>
                <option value="기타">기타</option>
              </InputField>
            </div>
            <div>
              <InputField 
                label="비상연락처 전화번호" 
                name="emergency_contact_phone" 
                value={formData.emergency_contact_phone} 
                onChange={handleChange}
                placeholder="010-1234-5678"
                error={validationErrors.emergency_contact_phone}
              />
            </div>
          </div>
        </>
      )
    },
    {
      title: "기타 정보",
      fields: (
        <>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <InputField 
                label="치과 공포" 
                name="dental_fears" 
                value={formData.dental_fears} 
                onChange={handleChange}
                type="select"
              >
                <option value="">선택하세요</option>
                <option value="없음">없음</option>
                <option value="약간 있음">약간 있음</option>
                <option value="보통">보통</option>
                <option value="심함">심함</option>
                <option value="매우 심함">매우 심함</option>
              </InputField>
            </div>
            <div>
              <InputField 
                label="추가 정보" 
                name="additional_info" 
                value={formData.additional_info} 
                onChange={handleChange}
                type="textarea"
                placeholder="의사선생님께 알려드리고 싶은 내용을 자유롭게 작성해주세요."
              />
            </div>
          </div>
        </>
      )
    }
  ];
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex overflow-x-auto mb-4 pb-2">
        {sections.map((section, index) => (
          <button
            key={index}
            type="button"
            className={`px-4 py-2 mr-2 rounded-md whitespace-nowrap ${
              activeSection === index 
                ? "bg-blue-500 text-white" 
                : "bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
            }`}
            onClick={() => setActiveSection(index)}
            title={section.title}
          >
            {section.title}
          </button>
        ))}
      </div>
      
      <div className="mb-6">
        {sections[activeSection].fields}
      </div>
      
      <div className="flex justify-between">
        <div>
          {activeSection > 0 && (
            <button
              type="button"
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-4 py-2 rounded mr-2"
              onClick={() => setActiveSection(prev => prev - 1)}
            >
              이전
            </button>
          )}
          {activeSection < sections.length - 1 && (
            <button
              type="button"
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              onClick={() => setActiveSection(prev => prev + 1)}
            >
              다음
            </button>
          )}
        </div>
        
        <div>
          <button
            type="button"
            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-4 py-2 rounded mr-2"
            onClick={onCancel}
          >
            취소
          </button>
          {activeSection === sections.length - 1 && (
            <button
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              disabled={loading}
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          )}
        </div>
      </div>
    </form>
  );
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
  const [expandedAddresses, setExpandedAddresses] = useState<Record<string, boolean>>({});
  const [expandedTreatmentAreas, setExpandedTreatmentAreas] = useState<Record<string, boolean>>({});
  const [expandedAdditionalInfos, setExpandedAdditionalInfos] = useState<Record<string, boolean>>({});
  const [expandedReferrers, setExpandedReferrers] = useState<Record<string, boolean>>({});
  const [expandedMedicalHistories, setExpandedMedicalHistories] = useState<Record<string, boolean>>({});
  const [expandedPregnancySmoking, setExpandedPregnancySmoking] = useState<Record<string, boolean>>({});
  const [expandedEmergencyContacts, setExpandedEmergencyContacts] = useState<Record<string, boolean>>({});
  const [expandedInsurance, setExpandedInsurance] = useState<Record<string, boolean>>({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [consultationCounts, setConsultationCounts] = useState<Record<string, number>>({});
  
  // 환자별 상담 기록 수를 가져오는 함수
  async function fetchConsultationCounts(patientIds?: string[]) {
    try {
      // 환자 주민번호 목록을 파라미터로 받거나 현재 상태에서 추출
      const ids = patientIds || questionnaires.map(q => q.resident_id).filter(Boolean);
      
      if (ids.length === 0) return;
      
      // 각 환자별로 상담 기록 수를 조회
      const counts: Record<string, number> = {};
      
      // 환자 ID별로 상담 기록 수를 하나씩 조회
      for (const patientId of ids) {
        const { count, error } = await supabase
          .from('patient_consultations')
          .select('*', { count: 'exact', head: true })
          .eq('patient_id', patientId);
        
        if (error) {
          console.error(`환자 ${patientId}의 상담 기록 수 조회 오류:`, error);
          continue;
        }
        
        if (count !== null) {
          counts[patientId] = count;
        }
      }
      
      setConsultationCounts(counts);
    } catch (error) {
      console.error('상담 기록 수 조회 중 오류 발생:', error);
    }
  }

  // 페이지 로드 시와 데이터 변경 시 함수 실행을 관리하는 useEffect
  useEffect(() => {
    // 설문 데이터 로드 후 상담 기록 수도 가져오기
    const loadData = async () => {
      try {
        // 설문 데이터 로드
        const patientIds = await fetchQuestionnaires(true);
        // 설문 데이터 로드 후 상담 기록 수 가져오기
        if (patientIds && patientIds.length > 0) {
          await fetchConsultationCounts(patientIds);
        }
      } catch (error) {
        console.error('데이터 로딩 중 오류 발생:', error);
      }
    };
    
    loadData();
    
    // 기존 날짜 필터 설정 (이전에 있던 코드 유지)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(startOfMonth.toISOString().split('T')[0]);
    setEndDate(endOfMonth.toISOString().split('T')[0]);
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
        if (!silent) {
        setToast({ message: `${data.length}개의 설문 데이터를 로드했습니다.`, type: 'success' });
      }
        
        // 데이터가 로드되면 환자 ID 배열 반환
        return data.map(q => q.resident_id).filter(Boolean);
      }
      return [];
    } catch (error) {
      console.error('설문 데이터를 가져오는 중 오류 발생:', error);
      setError('데이터를 불러오는데 실패했습니다.');
      if (!silent) {
      setToast({ 
        message: `데이터 로드 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, 
          type: 'error' 
        });
      }
      return [];
    } finally {
      setLoading(false);
    }
  }

  // 실제 데이터 추가 함수
  async function addPatientData(patientData: PatientQuestionnaire) {
    try {
      setLoading(true);
      console.log('환자 데이터 추가 시도 중...', patientData);
      
      const { data, error, status } = await supabase
        .from('patient_questionnaire')
        .insert([patientData])
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
        setToast({ message: '환자 데이터가 추가되었습니다!', type: 'success' });
        setIsAddModalOpen(false);
      } else {
        // 데이터가 반환되지 않았지만 오류도 없는 경우
        setToast({ message: '데이터가 추가되었으나, 반환된 데이터가 없습니다.', type: 'info' });
        // 데이터 새로고침
        fetchQuestionnaires();
        setIsAddModalOpen(false);
      }
    } catch (error) {
      console.error('환자 데이터 추가 중 오류 발생:', error);
      setToast({ 
        message: `환자 데이터 추가 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`, 
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

  // 날짜 문자열을 YYYY-MM-DD 형식으로 변환 (달력 입력용)
  const formatDateForInput = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const koreanDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    return koreanDate.toISOString().split('T')[0];
  };

  // YYYY-MM-DD 형식을 YYYY/MM/DD로 변환 (표시용)
  const formatDateForDisplay = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    return dateStr.replace(/-/g, '/');
  };

  // 날짜를 YYYY/MM/DD 형식의 문자열로 변환
  const dateToYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
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
    setStartDate(startOfMonth.toISOString().split('T')[0]);
    setEndDate(endOfMonth.toISOString().split('T')[0]);
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
    setStartDate(startOfMonth.toISOString().split('T')[0]);
    setEndDate(endOfMonth.toISOString().split('T')[0]);
  };

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
        const startDateObj = startDate ? new Date(startDate) : null;
        const endDateObj = endDate ? new Date(endDate) : null;
        
        if (startDateObj) startDateObj.setHours(0, 0, 0, 0);
        if (endDateObj) endDateObj.setHours(23, 59, 59, 999);
        
        passDateFilter = false;
        
        // submitted_at 날짜 확인
        if (item.submitted_at) {
          const date = new Date(item.submitted_at);
          const koreanDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
          
          const isAfterStart = !startDateObj || koreanDate >= startDateObj;
          const isBeforeEnd = !endDateObj || koreanDate <= endDateObj;
          
          if (isAfterStart && isBeforeEnd) {
            passDateFilter = true;
          }
        }
        
        // created_at 날짜 확인 (submitted_at이 없거나 일치하지 않을 경우)
        if (!passDateFilter && item.created_at) {
          const date = new Date(item.created_at);
          const koreanDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
          
          const isAfterStart = !startDateObj || koreanDate >= startDateObj;
          const isBeforeEnd = !endDateObj || koreanDate <= endDateObj;
          
          if (isAfterStart && isBeforeEnd) {
            passDateFilter = true;
          }
        }
      }
      
      return searchableText.includes(filterText.toLowerCase()) && passDateFilter;
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
  }, [questionnaires, filterText, sortField, sortOrder, startDate, endDate]);

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
        <h1 className="text-2xl font-bold">샤인치과 환자 관리 프로그램 V1.0 </h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
          >
            환자 정보 추가
          </button>
          <button 
            onClick={addTestData}
            className="p-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
          >
            테스트 데이터 추가
          </button>
          <ThemeToggle />
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="controls flex flex-wrap gap-2 mb-4">
        {/* 검색 필터 */}
        <div className="filter-container relative flex-1 min-w-[200px] flex flex-col justify-end">
          <div className="mb-2 h-[26px]">
            {/* 상단 여백을 날짜 선택기의 버튼과 동일한 높이로 맞춤 */}
          </div>
          <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
          <input
            type="text"
            placeholder="검색어를 입력하세요"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="filter-input pl-10 w-full py-2 px-3 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700"
          />
          </div>
        </div>
        
        {/* 날짜 기간 필터 */}
        <div className="date-filter-container flex-1 min-w-[260px] flex flex-col">
          <div className="flex gap-2 mb-2 h-[26px]">
        <button
              onClick={setCurrentMonth}
              className="text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 py-1 rounded-md"
              title="이번 달 데이터 보기"
            >
              이번 달
            </button>
            <button
              onClick={setPreviousMonth}
              className="text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 py-1 rounded-md"
              title="지난 달 데이터 보기"
            >
              지난 달
            </button>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 py-1 rounded-md ml-auto"
                title="모든 날짜 필터 초기화"
              >
                초기화
              </button>
            )}
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                max={endDate || undefined}
                aria-label="시작 날짜 선택"
                placeholder="YYYY-MM-DD"
              />
              {startDate && (
                <button
                  onClick={() => setStartDate('')}
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
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                min={startDate || undefined}
                aria-label="종료 날짜 선택"
                placeholder="YYYY-MM-DD"
              />
              {endDate && (
                <button
                  onClick={() => setEndDate('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="종료 날짜 지우기"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* 새로고침 버튼 */}
        <div className="flex-none min-w-[100px] flex flex-col justify-end">
          <div className="mb-2 h-[26px]">
            {/* 상단 여백 */}
          </div>
        <button
          onClick={async () => {
            const patientIds = await fetchQuestionnaires();
            if (patientIds && patientIds.length > 0) {
              await fetchConsultationCounts(patientIds);
            }
          }}
          disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:bg-blue-300 h-[38px]"
          title="새로고침 및 상담 내역 갱신"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              새로고침 중...
            </div>
          ) : '새로고침'}
        </button>
        </div>
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
                          className="bg-blue-500 hover:bg-blue-600 text-white p-1 rounded text-sm"
                          aria-label="상담"
                          title="상담 기록 보기/추가"
                        >
                          {consultationCounts[item.resident_id] ? `상담 (${consultationCounts[item.resident_id]}회)` : '상담'}
                        </Link>
                      </div>
                    </td>
                    <td>{renderDateTime(item.submitted_at)}</td>
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
      
      {/* 환자 정보 추가 모달 */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
        <PatientForm 
          onSubmit={addPatientData}
          onCancel={() => setIsAddModalOpen(false)}
        />
      </Modal>
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
