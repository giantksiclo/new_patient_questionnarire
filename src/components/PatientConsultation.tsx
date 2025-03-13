import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

interface ConsultationRecord {
  id?: number;
  patient_id: string;
  consultation_date: string | null;   // 날짜는 string으로 관리 (YYYY-MM-DD)
  patient_type: '신환' | '구환';
  doctor: string;
  consultant: string;
  treatment_details: string;
  consultation_result: '비동의' | '부분동의' | '전체동의' | '보류' | '환불';
  // 숫자 필드는 실제 DB 저장 시 number이지만, 폼 단계에서는 string으로 관리해도 됩니다.
  diagnosis_amount: string;   
  consultation_amount: string;
  payment_amount: string;
  remaining_payment: string;
  non_consent_reason: string;
  ip_count: string;
  ipd_count: string;
  ipb_count: string;
  bg_count: string;
  cr_count: string;
  in_count: string;
  r_count: string;
  ca_count: string;
  first_contact_date: string | null;
  first_contact_type: '방문' | '전화';
  second_contact_date: string | null;
  second_contact_type: '방문' | '전화';
  third_contact_date: string | null;
  third_contact_type: '방문' | '전화';
  consultation_memo: string;
  today_treatment: string;
  next_treatment: string;
  appointment_date: string | null;
  appointment_time: string;
  created_at?: string;
}

interface PatientInfo {
  name: string;
  resident_id: string;
  phone: string;
  referral_source: string;
  submitted_at: string;
}

const PatientConsultation = () => {
  const { residentId } = useParams<{ residentId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);

  // (1) 각 숫자 필드를 문자열로 초기화
  const [newConsultation, setNewConsultation] = useState<ConsultationRecord>({
    patient_id: residentId || '',
    consultation_date: new Date().toISOString().split('T')[0],
    patient_type: '신환',
    doctor: '',
    consultant: '',
    treatment_details: '',
    consultation_result: '보류',
    consultation_amount: '0',
    payment_amount: '0',
    remaining_payment: '0',
    diagnosis_amount: '0',
    non_consent_reason: '',
    ip_count: '0',
    ipd_count: '0',
    ipb_count: '0',
    bg_count: '0',
    cr_count: '0',
    in_count: '0',
    r_count: '0',
    ca_count: '0',
    first_contact_date: null,
    first_contact_type: '전화',
    second_contact_date: null,
    second_contact_type: '전화',
    third_contact_date: null,
    third_contact_type: '전화',
    consultation_memo: '',
    today_treatment: '',
    next_treatment: '',
    appointment_date: null,
    appointment_time: ''
  });

  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);

  // 환자 정보 가져오기
  useEffect(() => {
    async function fetchPatientInfo() {
      if (!residentId) {
        setError('주민등록번호가 제공되지 않았습니다.');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('patient_questionnaire')
          .select('name, resident_id, phone, referral_source, submitted_at')
          .eq('resident_id', residentId)
          .single();

        if (error) throw error;
        if (data) {
          setPatientInfo(data);
        } else {
          setError('환자 정보를 찾을 수 없습니다.');
        }
      } catch (error) {
        console.error('환자 정보 불러오기 실패:', error);
        setError('환자 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    // 기존 상담 기록 가져오기
    async function fetchConsultations() {
      if (!residentId) return;

      try {
        const { data, error } = await supabase
          .from('patient_consultations')
          .select('*')
          .eq('patient_id', residentId)
          .order('consultation_date', { ascending: false });

        if (error) throw error;
        if (data) {
          // 상담 기록도 useState에 담을 때는 string 변환이 필요한 경우가 있지만,
          // 여기서는 단순 조회용이므로 그대로 둡니다.
          setConsultations(data);
        }
      } catch (error) {
        console.error('상담 기록 불러오기 실패:', error);
        setError('상담 기록을 불러오는 중 오류가 발생했습니다.');
      }
    }

    fetchPatientInfo();
    fetchConsultations();
  }, [residentId]);

  // 숫자에 천단위 콤마를 추가하는 함수
  const formatNumber = (value: string) => {
    // 앞의 0 제거 후 숫자만 추출
    const number = value.replace(/[^\d]/g, '');
    if (number === '') return '';
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // 문자열에서 숫자만 추출하는 함수 (콤마 제거)
  const parseNumber = (value: string) => {
    if (!value) return 0;
    return parseInt(value.replace(/[^\d]/g, ''), 10) || 0;
  };

  // 수량 증감 핸들러
  const handleQuantityChange = (name: string, increment: boolean) => {
    const currentValue = parseInt(newConsultation[name as keyof ConsultationRecord] as string || '0', 10);
    const newValue = increment ? currentValue + 1 : Math.max(0, currentValue - 1);
    setNewConsultation(prev => ({
      ...prev,
      [name]: newValue.toString()
    }));
  };

  // 입력값 변경 핸들러
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    // 금액 필드인 경우 천단위 콤마 처리
    if (
      name === 'consultation_amount' || 
      name === 'payment_amount' ||
      name === 'diagnosis_amount'
    ) {
      const formattedValue = formatNumber(value);
      
      setNewConsultation((prev) => {
        const updated = { 
          ...prev, 
          [name]: formattedValue 
        };
        
        // 상담금액이나 수납금액이 변경된 경우 잔여금액 자동계산
        if (name === 'consultation_amount' || name === 'payment_amount') {
          const consultAmount = parseNumber(updated.consultation_amount);
          const paymentAmount = parseNumber(updated.payment_amount);
          const remaining = Math.max(0, consultAmount - paymentAmount);
          updated.remaining_payment = remaining > 0 ? formatNumber(remaining.toString()) : '0';
        }
        
        return updated;
      });
    } else {
      setNewConsultation((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // 예: 날짜 필드만 따로 처리해서 YYYY-MM-DD 포맷을 강제 적용하고 싶다면 이런 식으로 할 수도 있습니다.
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // 유효한 날짜인지 확인
    const dateObj = new Date(value);
    const isValid = !isNaN(dateObj.getTime());
    setNewConsultation(prev => ({
      ...prev,
      [name]: isValid ? dateObj.toISOString().split('T')[0] : ''
    }));
  };

  // (3) form submit 시에만 숫자로 변환하여 DB에 insert
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // 문자열을 숫자로 변환하는 함수 - 정확한 변환 보장
      const toNumber = (str: string) => {
        if (str === '' || str === null || str === undefined) return 0;
        // 콤마를 제거하고 숫자만 추출
        const cleanStr = str.replace(/[^\d]/g, '');
        const num = parseInt(cleanStr, 10);
        return isNaN(num) ? 0 : num;
      };
      
      // 날짜 형식 검증 함수
      const formatDate = (str: string | null) => {
        if (!str) return null;
        try {
          const date = new Date(str);
          if (isNaN(date.getTime())) return null;
          return str;
        } catch (e) {
          return null;
        }
      };
      
      // 준비된 데이터 출력
      console.log('===== 폼 데이터 =====');
      console.log('진단비 (원본):', newConsultation.diagnosis_amount);
      console.log('상담비 (원본):', newConsultation.consultation_amount);
      console.log('결제금액 (원본):', newConsultation.payment_amount);
      console.log('IP 개수 (원본):', newConsultation.ip_count);
      
      // 모든 숫자 필드를 명시적으로 숫자로 변환
      const consultationData = {
        patient_id: residentId || '',
        consultation_date: formatDate(newConsultation.consultation_date),
        patient_type: newConsultation.patient_type,
        doctor: newConsultation.doctor || '',
        consultant: newConsultation.consultant || '',
        treatment_details: newConsultation.treatment_details || '',
        consultation_result: newConsultation.consultation_result,
        diagnosis_amount: toNumber(newConsultation.diagnosis_amount),
        consultation_amount: toNumber(newConsultation.consultation_amount),
        payment_amount: toNumber(newConsultation.payment_amount),
        remaining_payment: toNumber(newConsultation.remaining_payment),
        non_consent_reason: newConsultation.non_consent_reason || '',
        ip_count: toNumber(newConsultation.ip_count),
        ipd_count: toNumber(newConsultation.ipd_count),
        ipb_count: toNumber(newConsultation.ipb_count),
        bg_count: toNumber(newConsultation.bg_count),
        cr_count: toNumber(newConsultation.cr_count),
        in_count: toNumber(newConsultation.in_count),
        r_count: toNumber(newConsultation.r_count),
        ca_count: toNumber(newConsultation.ca_count),
        first_contact_date: formatDate(newConsultation.first_contact_date),
        first_contact_type: newConsultation.first_contact_type,
        second_contact_date: formatDate(newConsultation.second_contact_date),
        second_contact_type: newConsultation.second_contact_type,
        third_contact_date: formatDate(newConsultation.third_contact_date),
        third_contact_type: newConsultation.third_contact_type,
        consultation_memo: newConsultation.consultation_memo || '',
        today_treatment: newConsultation.today_treatment || '',
        next_treatment: newConsultation.next_treatment || '',
        appointment_date: formatDate(newConsultation.appointment_date),
        appointment_time: newConsultation.appointment_time || ''
      };
      
      // 변환된 데이터 출력
      console.log('===== 변환된 데이터 =====');
      console.log('진단비 (변환):', consultationData.diagnosis_amount);
      console.log('상담비 (변환):', consultationData.consultation_amount);
      console.log('결제금액 (변환):', consultationData.payment_amount);
      console.log('IP 개수 (변환):', consultationData.ip_count);
      
      // 필수 필드 검증
      if (!consultationData.patient_id) {
        throw new Error('환자 ID가 없습니다.');
      }
      
      if (!consultationData.consultation_date) {
        throw new Error('상담 일자가 올바르지 않습니다.');
      }
      
      const { data, error } = await supabase
        .from('patient_consultations')
        .insert(consultationData)
        .select()
        .single();
      
      if (error) {
        console.error('Supabase 오류 상세:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new Error(`상담 기록 저장 실패: ${error.message}`);
      }
      
      if (data) {
        console.log('===== 저장된 데이터 =====');
        console.log(data);
        setConsultations([data, ...consultations]);
        
        // 폼 일부 초기화 - 날짜와 상담자 정보 유지
        setNewConsultation(prev => ({
          ...prev,
          treatment_details: '',
          consultation_memo: '',
          non_consent_reason: '',
          diagnosis_amount: '0',
          consultation_amount: '0',
          payment_amount: '0',
          remaining_payment: '0',
          ip_count: '0',
          ipd_count: '0',
          ipb_count: '0',
          bg_count: '0',
          cr_count: '0',
          in_count: '0',
          r_count: '0',
          ca_count: '0',
          today_treatment: '',
          next_treatment: '',
          appointment_date: null,
          appointment_time: ''
        }));
        
        alert('상담 기록이 저장되었습니다.');
      }
    } catch (error) {
      console.error('상담 기록 저장 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      console.error('에러 상세:', errorMessage);
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">데이터를 불러오는 중...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <button
          onClick={() => navigate('/')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          메인 페이지로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">환자 상담 기록</h1>
        <button
          onClick={() => navigate('/')}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          목록으로 돌아가기
        </button>
      </div>

      {patientInfo && (
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-3">환자 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">접수일</p>
              <p>{new Date(patientInfo.submitted_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">이름</p>
              <p>{patientInfo.name}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">주민등록번호</p>
              <p>{patientInfo.resident_id}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">전화번호</p>
              <p>{patientInfo.phone}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">내원경로</p>
              <p>{patientInfo.referral_source}</p>
            </div>
          </div>
        </div>
      )}

      {/* 치료 및 예약 정보 섹션을 여기로 이동 */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">치료 및 예약 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">당일치료내용</label>
            <select
              name="today_treatment"
              value={newConsultation.today_treatment}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
              title="당일 치료 내용을 선택하세요"
            >
              <option value="">선택하세요</option>
              <option value="구강검진">구강검진</option>
              <option value="스케일링">스케일링</option>
              <option value="치아우식증치료">치아우식증치료</option>
              <option value="신경치료">신경치료</option>
              <option value="발치">발치</option>
              <option value="충치치료">충치치료</option>
              <option value="크라운/인레이">크라운/인레이</option>
              <option value="임플란트상담">임플란트상담</option>
              <option value="임플란트식립">임플란트식립</option>
              <option value="보철치료">보철치료</option>
              <option value="교정상담">교정상담</option>
              <option value="교정치료">교정치료</option>
              <option value="잇몸치료">잇몸치료</option>
              <option value="미백치료">미백치료</option>
              <option value="기타">기타</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">다음진료내용</label>
            <select
              name="next_treatment"
              value={newConsultation.next_treatment}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
              title="다음 진료 내용을 선택하세요"
            >
              <option value="">선택하세요</option>
              <option value="구강검진">구강검진</option>
              <option value="스케일링">스케일링</option>
              <option value="치아우식증치료">치아우식증치료</option>
              <option value="신경치료">신경치료</option>
              <option value="발치">발치</option>
              <option value="충치치료">충치치료</option>
              <option value="크라운/인레이">크라운/인레이</option>
              <option value="임플란트상담">임플란트상담</option>
              <option value="임플란트식립">임플란트식립</option>
              <option value="보철치료">보철치료</option>
              <option value="교정상담">교정상담</option>
              <option value="교정치료">교정치료</option>
              <option value="잇몸치료">잇몸치료</option>
              <option value="미백치료">미백치료</option>
              <option value="기타">기타</option>
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">예약일</label>
              <input
                type="date"
                name="appointment_date"
                value={newConsultation.appointment_date || ''}
                onChange={handleDateChange}
                className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                title="예약일을 선택하세요"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">예약시간</label>
              <input
                type="time"
                name="appointment_time"
                value={newConsultation.appointment_time}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                title="예약시간을 선택하세요"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">새 상담 기록</h2>
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 디버깅용 */}
          <details>
            <summary>현재 입력 상태 확인 (디버깅용)</summary>
            <pre>{JSON.stringify(newConsultation, null, 2)}</pre>
          </details>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">상담 일자</label>
              <input
                type="date"
                name="consultation_date"
                value={newConsultation.consultation_date || ''}
                onChange={handleDateChange} // 날짜만 따로 처리
                className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                required
                title="상담 일자를 선택하세요"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">신환/구환</label>
              <select
                name="patient_type"
                value={newConsultation.patient_type}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                required
                title="환자 유형을 선택하세요"
              >
                <option value="신환">신환</option>
                <option value="구환">구환</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">진단원장</label>
              <select
                name="doctor"
                value={newConsultation.doctor}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                required
                title="진단원장을 선택하세요"
              >
                <option value="">선택하세요</option>
                <option value="공성배">공성배</option>
                <option value="남호진">남호진</option>
                <option value="박대웅">박대웅</option>
                <option value="전경원">전경원</option>
                <option value="장성진">장성진</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">상담자</label>
              <select
                name="consultant"
                value={newConsultation.consultant}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                required
                title="상담자를 선택하세요"
              >
                <option value="">선택하세요</option>
                <option value="김은정">김은정</option>
                <option value="임예지">임예지</option>
                <option value="송도원">송도원</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">상담결과</label>
              <select
                name="consultation_result"
                value={newConsultation.consultation_result}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                required
                title="상담 결과를 선택하세요"
              >
                <option value="비동의">비동의</option>
                <option value="부분동의">부분동의</option>
                <option value="전체동의">전체동의</option>
                <option value="보류">보류</option>
                <option value="환불">환불</option>
              </select>
            </div>

            {/* 금액 정보 */}
            <div>
              <label className="block text-sm font-medium mb-1">진단 금액</label>
              <input
                type="text"
                name="diagnosis_amount"
                value={newConsultation.diagnosis_amount === '0' ? '' : newConsultation.diagnosis_amount}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">상담 금액</label>
              <input
                type="text"
                name="consultation_amount"
                value={newConsultation.consultation_amount === '0' ? '' : newConsultation.consultation_amount}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">수납 금액</label>
              <input
                type="text"
                name="payment_amount"
                value={newConsultation.payment_amount === '0' ? '' : newConsultation.payment_amount}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">남은 수납 금액</label>
              <input
                type="text"
                name="remaining_payment"
                value={newConsultation.remaining_payment}
                readOnly
                className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700 bg-gray-100"
                title="남은 수납 금액"
              />
            </div>
          </div>

          {/* 치료 항목 수량 */}
          <div className="mt-4">
            <h3 className="text-lg font-medium mb-3">치료 항목 수량</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'ip_count', label: 'IP' },
                { name: 'ipd_count', label: 'IPD' },
                { name: 'ipb_count', label: 'IPB' },
                { name: 'bg_count', label: 'BG' },
                { name: 'cr_count', label: 'CR' },
                { name: 'in_count', label: 'IN' },
                { name: 'r_count', label: 'R' },
                { name: 'ca_count', label: 'CA' }
              ].map(({ name, label }) => (
                <div key={name} className="mb-2">
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(name, false)}
                      className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-l"
                    >
                      -
                    </button>
                    <input
                      type="text"
                      name={name}
                      value={newConsultation[name as keyof ConsultationRecord] || '0'}
                      onChange={handleInputChange}
                      className="w-16 p-2 text-center border border-gray-300 text-black bg-white"
                      readOnly
                      title={`${label} 수량`}
                    />
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(name, true)}
                      className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-r"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1">치료 계획 및 상세 사항</label>
              <textarea
                name="treatment_details"
                value={newConsultation.treatment_details}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700 min-h-[100px]"
                title="치료 계획 및 상세 사항"
                placeholder="치료 계획이나 상세 내용을 입력하세요"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">비동의 사유</label>
              <textarea
                name="non_consent_reason"
                value={newConsultation.non_consent_reason}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700 min-h-[100px]"
                title="비동의 사유"
                placeholder="비동의 사유를 입력하세요"
              />
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-lg font-medium mb-3">연락 기록</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">1차 연락일</label>
                <input
                  type="date"
                  name="first_contact_date"
                  value={newConsultation.first_contact_date || ''}
                  onChange={handleDateChange}
                  className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                  title="1차 연락일을 선택하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">1차 연락방법</label>
                <select
                  name="first_contact_type"
                  value={newConsultation.first_contact_type}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                  title="1차 연락방법을 선택하세요"
                >
                  <option value="전화">전화</option>
                  <option value="방문">방문</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1">2차 연락일</label>
                <input
                  type="date"
                  name="second_contact_date"
                  value={newConsultation.second_contact_date || ''}
                  onChange={handleDateChange}
                  className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                  title="2차 연락일을 선택하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">2차 연락방법</label>
                <select
                  name="second_contact_type"
                  value={newConsultation.second_contact_type}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                  title="2차 연락방법을 선택하세요"
                >
                  <option value="전화">전화</option>
                  <option value="방문">방문</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1">3차 연락일</label>
                <input
                  type="date"
                  name="third_contact_date"
                  value={newConsultation.third_contact_date || ''}
                  onChange={handleDateChange}
                  className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                  title="3차 연락일을 선택하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">3차 연락방법</label>
                <select
                  name="third_contact_type"
                  value={newConsultation.third_contact_type}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                  title="3차 연락방법을 선택하세요"
                >
                  <option value="전화">전화</option>
                  <option value="방문">방문</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">상담 메모</label>
            <textarea
              name="consultation_memo"
              value={newConsultation.consultation_memo}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700 min-h-[120px]"
              title="상담 메모"
              placeholder="상담 내용에 대한 메모를 입력하세요"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded disabled:bg-blue-300"
            >
              {loading ? '저장 중...' : '상담 기록 저장'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">상담 기록 내역</h2>
        {consultations.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            아직 기록된 상담 내역이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300 dark:border-gray-700">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="p-2 border border-gray-300 dark:border-gray-700">상담일</th>
                  <th className="p-2 border border-gray-300 dark:border-gray-700">진단원장</th>
                  <th className="p-2 border border-gray-300 dark:border-gray-700">상담자</th>
                  <th className="p-2 border border-gray-300 dark:border-gray-700">상담결과</th>
                  <th className="p-2 border border-gray-300 dark:border-gray-700">진단금액</th>
                  <th className="p-2 border border-gray-300 dark:border-gray-700">수납금액</th>
                  <th className="p-2 border border-gray-300 dark:border-gray-700">당일치료</th>
                  <th className="p-2 border border-gray-300 dark:border-gray-700">다음진료</th>
                  <th className="p-2 border border-gray-300 dark:border-gray-700">예약정보</th>
                  <th className="p-2 border border-gray-300 dark:border-gray-700">상담메모</th>
                </tr>
              </thead>
              <tbody>
                {consultations.map((consultation) => (
                  <tr key={consultation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="p-2 border border-gray-300 dark:border-gray-700">
                      {consultation.consultation_date
                        ? new Date(consultation.consultation_date).toLocaleDateString()
                        : ''}
                    </td>
                    <td className="p-2 border border-gray-300 dark:border-gray-700">
                      {consultation.doctor}
                    </td>
                    <td className="p-2 border border-gray-300 dark:border-gray-700">
                      {consultation.consultant}
                    </td>
                    <td className="p-2 border border-gray-300 dark:border-gray-700">
                      {consultation.consultation_result}
                    </td>
                    <td className="p-2 border border-gray-300 dark:border-gray-700">
                      {consultation.diagnosis_amount?.toLocaleString()}원
                    </td>
                    <td className="p-2 border border-gray-300 dark:border-gray-700">
                      {consultation.payment_amount?.toLocaleString()}원
                    </td>
                    <td className="p-2 border border-gray-300 dark:border-gray-700">
                      {consultation.today_treatment || '-'}
                    </td>
                    <td className="p-2 border border-gray-300 dark:border-gray-700">
                      {consultation.next_treatment || '-'}
                    </td>
                    <td className="p-2 border border-gray-300 dark:border-gray-700">
                      {consultation.appointment_date ? (
                        <>
                          {new Date(consultation.appointment_date).toLocaleDateString()} 
                          {consultation.appointment_time ? ` ${consultation.appointment_time}` : ''}
                        </>
                      ) : '-'}
                    </td>
                    <td className="p-2 border border-gray-300 dark:border-gray-700">
                      {consultation.consultation_memo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientConsultation;
