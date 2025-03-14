import React, { useState, useEffect, useCallback } from 'react';
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

  const [messageLoading, setMessageLoading] = useState<Record<number, boolean>>({});
  const [messageStatus, setMessageStatus] = useState<Record<number, string>>({});
  const [generatedMessages, setGeneratedMessages] = useState<Record<number, { custom_message?: string, next_visit_message?: string }>>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<{ custom_message?: string, next_visit_message?: string } | null>(null);
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageIsSent, setMessageIsSent] = useState(false);
  const [sendingNextVisitMessage, setSendingNextVisitMessage] = useState(false);
  const [nextVisitMessageIsSent, setNextVisitMessageIsSent] = useState(false);

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

  // 메시지 생성 상태 확인 함수
  const checkMessageGenerationStatus = useCallback(async () => {
    if (!residentId || consultations.length === 0) return;
    
    try {
      const consultationIds = consultations.map(c => c.id).filter(Boolean);
      
      // 1. message_generation 테이블에서 이미 요청된 메시지 전체 확인
      const { data: allRequests, error: requestError } = await supabase
        .from('message_generation')
        .select('id, consultation_id, message_requested_at')
        .in('consultation_id', consultationIds as number[]);
      
      if (requestError) throw requestError;
      
      // 요청된 메시지가 있으면 상태 업데이트
      if (allRequests && allRequests.length > 0) {
        // 기존 상태 복사
        const newMessageStatus = { ...messageStatus };
        const messageIds = allRequests.map(req => req.id);
        
        // 2. message_storage 테이블에서 생성된 메시지 확인
        const { data: storedMessages, error: storageError } = await supabase
          .from('message_storage')
          .select('id, custom_message, next_visit_message, message_send, next_message_send')
          .in('id', messageIds);
        
        if (storageError) throw storageError;
        
        // 생성된 메시지 ID 세트 생성
        const generatedMessageIds = new Set(storedMessages?.map(msg => msg.id) || []);
        
        // 각 메시지 요청에 대해 상태 업데이트
        allRequests.forEach(request => {
          if (request.consultation_id) {
            // 메시지 스토리지에 데이터가 있는지 확인
            if (generatedMessageIds.has(request.id)) {
              newMessageStatus[request.consultation_id] = '이미 생성됨';
            } 
            // 요청만 되고 아직 생성되지 않은 경우
            else if (request.message_requested_at) {
              newMessageStatus[request.consultation_id] = '신청 완료';
            }
          }
        });
        
        setMessageStatus(newMessageStatus);
        
        // 3. 생성된 메시지 내용 업데이트
        if (storedMessages && storedMessages.length > 0) {
          const newGeneratedMessages = { ...generatedMessages };
          
          // message_generation 테이블의 consultation_id와 message_storage 테이블의 id를 연결
          allRequests.forEach(request => {
            const storedMessage = storedMessages.find(msg => msg.id === request.id);
            if (storedMessage && request.consultation_id) {
              newGeneratedMessages[request.consultation_id] = {
                custom_message: storedMessage.custom_message,
                next_visit_message: storedMessage.next_visit_message
              };
            }
          });
          
          setGeneratedMessages(newGeneratedMessages);
        }
      }
      
      return true;
    } catch (error) {
      console.error('메시지 상태 확인 중 오류 발생:', error);
      return false;
    }
  }, [residentId, consultations, messageStatus, generatedMessages]);

  // 주기적으로 메시지 생성 상태 확인
  useEffect(() => {
    // 컴포넌트 마운트 시 초기 상태 확인
    checkMessageGenerationStatus();
    
    // 30초마다 상태 확인
    const interval = setInterval(() => {
      checkMessageGenerationStatus();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [checkMessageGenerationStatus]);

  // 메시지 보기 모달
  const viewMessage = async (consultationId: number) => {
    try {
      if (!generatedMessages[consultationId]) {
        // 메시지 내용이 캐시되어 있지 않으면 조회
        const { data: generationData, error: generationError } = await supabase
          .from('message_generation')
          .select('id')
          .eq('consultation_id', consultationId)
          .single();
          
        if (generationError) throw generationError;
        
        // message_storage 테이블에서 생성된 메시지와 전송 상태 조회
        const { data: storageData, error: storageError } = await supabase
          .from('message_storage')
          .select('custom_message, next_visit_message, message_send, next_message_send')
          .eq('id', generationData.id)
          .single();
          
        if (storageError) throw storageError;
        
        // 메시지 내용 캐싱
        setGeneratedMessages(prev => ({ 
          ...prev, 
          [consultationId]: {
            custom_message: storageData.custom_message,
            next_visit_message: storageData.next_visit_message
          }
        }));
        
        // 메시지 전송 상태 설정
        setMessageIsSent(storageData.message_send || false);
        setNextVisitMessageIsSent(storageData.next_message_send || false);
        
        setSelectedMessage(storageData);
      } else {
        // 이미 캐시된 메시지가 있는 경우 사용
        setSelectedMessage(generatedMessages[consultationId]);
        
        // 전송 상태 확인
        const { data: generationData, error: generationError } = await supabase
          .from('message_generation')
          .select('id')
          .eq('consultation_id', consultationId)
          .single();
          
        if (!generationError && generationData) {
          const { data: storageData, error: storageError } = await supabase
            .from('message_storage')
            .select('message_send, next_message_send')
            .eq('id', generationData.id)
            .single();
            
          if (!storageError && storageData) {
            setMessageIsSent(storageData.message_send || false);
            setNextVisitMessageIsSent(storageData.next_message_send || false);
          }
        }
      }
      
      // 선택된 상담 ID 저장
      setSelectedConsultationId(consultationId);
      // 모달 열기
      setIsModalOpen(true);
    } catch (error) {
      console.error('메시지 조회 중 오류 발생:', error);
      alert('메시지 조회에 실패했습니다.');
    }
  };
  
  // 맞춤 메시지 전송 함수 
  const sendMessage = async () => {
    if (!selectedConsultationId) return;
    
    try {
      setSendingMessage(true);
      
      // 1. message_generation 테이블에서 ID 가져오기
      const { data: generationData, error: generationError } = await supabase
        .from('message_generation')
        .select('id')
        .eq('consultation_id', selectedConsultationId)
        .single();
        
      if (generationError) throw generationError;
      
      if (!generationData) {
        throw new Error('메시지 생성 정보를 찾을 수 없습니다.');
      }
      
      // 2. message_storage 테이블의 message_send 필드 업데이트
      const { /* data, */ error } = await supabase
        .from('message_storage')
        .update({ 
          message_send: true,
          next_message_send: false   // 다음 방문 메시지는 false로 설정
        })
        .eq('id', generationData.id)
        .select();
        
      if (error) throw error;
      
      // 업데이트 성공
      setMessageIsSent(true);
      setNextVisitMessageIsSent(false);  // 다음 방문 메시지 상태도 업데이트
      alert('맞춤 메시지 전송 요청이 완료되었습니다!');
      
    } catch (error) {
      console.error('맞춤 메시지 전송 요청 오류:', error);
      alert('맞춤 메시지 전송 요청 중 오류가 발생했습니다.');
    } finally {
      setSendingMessage(false);
    }
  };

  // 다음 방문 메시지 전송 함수
  const sendNextVisitMessage = async () => {
    if (!selectedConsultationId) return;
    
    try {
      setSendingNextVisitMessage(true);
      
      // 1. message_generation 테이블에서 ID 가져오기
      const { data: generationData, error: generationError } = await supabase
        .from('message_generation')
        .select('id')
        .eq('consultation_id', selectedConsultationId)
        .single();
        
      if (generationError) throw generationError;
      
      console.log('메시지 생성 ID:', generationData?.id);
      
      if (!generationData) {
        throw new Error('메시지 생성 정보를 찾을 수 없습니다.');
      }
      
      // 2. 테이블 구조 확인을 위해 먼저 데이터 조회
      const { data: checkData, /* checkError */ } = await supabase
        .from('message_storage')
        .select('*')
        .eq('id', generationData.id)
        .single();
        
      console.log('기존 데이터:', checkData);
      console.log('기존 next_message_send 값:', checkData?.next_message_send);
      
      // 3. message_storage 테이블의 next_message_send 필드 업데이트
      const { data, error } = await supabase
        .from('message_storage')
        .update({ 
          message_send: false,     // 맞춤 메시지는 false로 설정
          next_message_send: true
        })
        .eq('id', generationData.id)
        .select();
      
      console.log('업데이트 결과:', data);
      console.log('업데이트 오류:', error);
        
      if (error) {
        console.error('업데이트 중 오류 발생:', error);
        throw error;
      }
      
      if (!data) {
        console.log('업데이트 결과가 없습니다.');
      }
      
      if (data && data.length > 0) {
        console.log('업데이트 후 next_message_send 값:', data[0].next_message_send);
      }
      
      // 업데이트 성공
      setMessageIsSent(false);  // 맞춤 메시지 상태도 업데이트
      setNextVisitMessageIsSent(true);
      alert('다음 방문 메시지 전송 요청이 완료되었습니다!');
      
    } catch (error) {
      console.error('다음 방문 메시지 전송 요청 오류:', error);
      alert('다음 방문 메시지 전송 요청 중 오류가 발생했습니다.');
    } finally {
      setSendingNextVisitMessage(false);
    }
  };

  // 메시지 생성 요청 함수
  const createMessageGenerationRequest = async (consultationId: number) => {
    if (!patientInfo || !residentId) {
      alert('환자 정보를 찾을 수 없습니다.');
      return;
    }
    
    try {
      setMessageLoading(prev => ({ ...prev, [consultationId]: true }));
      
      // 0. 이미 메시지 생성 요청이 있는지 확인
      const { data: existingRequest } = await supabase
        .from('message_generation')
        .select('id')
        .eq('consultation_id', consultationId)
        .single();
      
      if (existingRequest) {
        console.log('이미 요청된 메시지가 있습니다:', existingRequest);
        
        // message_storage 테이블 확인
        const { data: storageData } = await supabase
          .from('message_storage')
          .select('custom_message, next_visit_message')
          .eq('id', existingRequest.id)
          .single();
        
        if (storageData) {
          // 이미 생성된 메시지가 있는 경우
          setMessageStatus(prev => ({ ...prev, [consultationId]: '이미 생성됨' }));
          
          // 메시지 내용 저장
          setGeneratedMessages(prev => ({ 
            ...prev, 
            [consultationId]: {
              custom_message: storageData.custom_message,
              next_visit_message: storageData.next_visit_message
            }
          }));
        } else {
          // 요청만 되고 아직 생성되지 않은 경우
          setMessageStatus(prev => ({ ...prev, [consultationId]: '신청 완료' }));
        }
        
        return existingRequest;
      }
      
      // 1. 해당 상담 정보 가져오기
      const { data: consultationData } = await supabase
        .from('patient_consultations')
        .select('*')
        .eq('id', consultationId)
        .single();
      
      if (!consultationData) {
        console.error('상담 정보 조회 오류:', new Error('상담 정보를 찾을 수 없습니다.'));
        throw new Error('상담 정보를 찾을 수 없습니다.');
      }
      
      // 2. 환자 정보 가져오기 (이미 patientInfo에 있지만 전체 정보를 위해 다시 조회)
      const { data: patientData } = await supabase
        .from('patient_questionnaire')
        .select('*')
        .eq('resident_id', residentId)
        .single();
      
      if (!patientData) {
        console.error('환자 정보 조회 오류:', new Error('환자 정보를 찾을 수 없습니다.'));
        throw new Error('환자 정보를 찾을 수 없습니다.');
      }
      
      console.log('메시지 생성 데이터 준비:', {
        patient_id: residentId,
        consultation_id: consultationId,
        consultation_result: consultationData.consultation_result
      });
      
      // 3. message_generation 테이블에 데이터 삽입
      const { data, error } = await supabase
        .from('message_generation')
        .insert({
          patient_id: residentId,
          consultation_id: consultationId,
          
          // 환자 기본 정보
          patient_name: patientData.name,
          phone: patientData.phone,
          
          // 보험 정보
          has_private_insurance: patientData.has_private_insurance,
          private_insurance_period: patientData.private_insurance_period,
          insurance_company: patientData.insurance_company,
          
          // 내원 관련 정보
          visit_reason: patientData.visit_reason,
          treatment_area: patientData.treatment_area,
          
          // 의료 정보
          medications: patientData.medications,
          medical_conditions: patientData.medical_conditions,
          
          // 기타 건강 정보
          pregnancy_status: patientData.pregnancy_status,
          smoking_status: patientData.smoking_status,
          dental_fears: patientData.dental_fears,
          
          // 추가 정보
          additional_info: patientData.additional_info,
          
          // 상담 정보
          consultation_result: consultationData.consultation_result,
          today_treatment: consultationData.today_treatment,
          next_treatment: consultationData.next_treatment,
          appointment_date: consultationData.appointment_date,
          appointment_time: consultationData.appointment_time,
          consultation_memo: consultationData.consultation_memo,
          
          // 메시지 요청 정보
          message_requested: true,
          message_requested_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error('메시지 생성 요청 저장 오류:', error);
        console.error('자세한 오류 정보:', JSON.stringify(error, null, 2));
        
        // 중복 키 오류 처리 (이미 같은 consultation_id로 요청이 있는 경우)
        if (error.code === '23505') {
          setMessageStatus(prev => ({ ...prev, [consultationId]: '신청 완료' }));
          return;
        }
        
        throw error;
      }
      
      console.log('메시지 생성 요청 성공:', data);
      
      // 4. Supabase 함수 직접 호출 시도 (선택적)
      try {
        // Supabase 함수 직접 호출 (함수 이름은 실제 함수명으로 변경)
        const { data: funcData, error: funcError } = await supabase.rpc('process_message_request', {
          message_id: data.id
        });
        
        if (funcError) {
          console.warn('함수 호출 오류 (무시됨):', funcError);
          // 함수 오류는 무시하고 계속 진행 (비동기적으로 처리될 것이므로)
        } else {
          console.log('함수 호출 성공:', funcData);
        }
      } catch (funcCallError) {
        console.warn('함수 호출 예외 (무시됨):', funcCallError);
        // 함수 호출 예외도 무시 (메시지 생성 자체는 성공했으므로)
      }
      
      setMessageStatus(prev => ({ ...prev, [consultationId]: '신청 완료' }));
      return data;
    } catch (error: any) { // 타입 명시로 TypeScript 오류 해결
      console.error('메시지 생성 요청 중 오류 발생:', error);
      
      // 오류 유형에 따라 다른 메시지 표시
      if (error.code === '23505') {
        setMessageStatus(prev => ({ ...prev, [consultationId]: '신청 완료' }));
      } else if (error.code === 'PGRST') {
        setMessageStatus(prev => ({ ...prev, [consultationId]: 'DB 오류' }));
      } else if (error.message) {
        setMessageStatus(prev => ({ ...prev, [consultationId]: '오류: ' + error.message.substring(0, 15) + '...' }));
      } else {
        setMessageStatus(prev => ({ ...prev, [consultationId]: '요청 실패' }));
      }
      
      throw error;
    } finally {
      setMessageLoading(prev => ({ ...prev, [consultationId]: false }));
      
      // 5초 후 상태 메시지 초기화 (신청 완료 상태는 유지)
      setTimeout(() => {
        setMessageStatus(prev => {
          const newState = { ...prev };
          // 신청 완료, 이미 생성됨 상태는 유지
          if (newState[consultationId] && 
              newState[consultationId] !== '신청 완료' &&
              newState[consultationId] !== '이미 생성됨') {
            delete newState[consultationId];
          }
          return newState;
        });
      }, 5000);
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
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>대시보드</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            목록으로 돌아가기
          </button>
        </div>
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
              <option value="인레이">인레이</option>
              <option value="크라운">크라운</option>
              <option value="브릿지">브릿지</option>
              <option value="라미네이트">라미네이트</option>
              <option value="레진">레진</option>
              <option value="치경부마모증">치경부마모증</option>
              <option value="임플란트 수술">임플란트 수술</option>
              <option value="임플란트 2차수술">임플란트 2차수술</option>
              <option value="상악동 거상술">상악동 거상술</option>
              <option value="임플란트 인상채득">임플란트 인상채득</option>
              <option value="임시치아 장착">임시치아 장착</option>
              <option value="보철물 장착">보철물 장착</option>
              <option value="임시틀니 장착">임시틀니 장착</option>
              <option value="임시틀니 조정">임시틀니 조정</option>
              <option value="스케일링">스케일링</option>
              <option value="실밥제거">실밥제거</option>
              <option value="잇몸치료">잇몸치료</option>
              <option value="사랑니 발치">사랑니 발치</option>
              <option value="소독">소독</option>
              <option value="교합조정">교합조정</option>
              <option value="check up">check up</option>
              <option value="구강검진">구강검진</option>
              <option value="교정상담">교정상담</option>
              <option value="교정정밀진단">교정정밀진단</option>
              <option value="교정월진료">교정월진료</option>
              <option value="교정본딩">교정본딩</option>
              <option value="교정디본딩">교정디본딩</option>
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
              <option value="인레이">인레이</option>
              <option value="크라운">크라운</option>
              <option value="브릿지">브릿지</option>
              <option value="라미네이트">라미네이트</option>
              <option value="레진">레진</option>
              <option value="치경부마모증">치경부마모증</option>
              <option value="임플란트 수술">임플란트 수술</option>
              <option value="임플란트 2차수술">임플란트 2차수술</option>
              <option value="상악동 거상술">상악동 거상술</option>
              <option value="임플란트 인상채득">임플란트 인상채득</option>
              <option value="임시치아 장착">임시치아 장착</option>
              <option value="보철물 장착">보철물 장착</option>
              <option value="임시틀니 장착">임시틀니 장착</option>
              <option value="임시틀니 조정">임시틀니 조정</option>
              <option value="스케일링">스케일링</option>
              <option value="실밥제거">실밥제거</option>
              <option value="잇몸치료">잇몸치료</option>
              <option value="사랑니 발치">사랑니 발치</option>
              <option value="소독">소독</option>
              <option value="교합조정">교합조정</option>
              <option value="check up">check up</option>
              <option value="구강검진">구강검진</option>
              <option value="교정상담">교정상담</option>
              <option value="교정정밀진단">교정정밀진단</option>
              <option value="교정월진료">교정월진료</option>
              <option value="교정본딩">교정본딩</option>
              <option value="교정디본딩">교정디본딩</option>
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
                  <th className="p-2 border border-gray-300 dark:border-gray-700">메시지 생성</th>
                  <th className="p-2 border border-gray-300 dark:border-gray-700">상담일자</th>
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
                      {messageLoading[consultation.id!] ? (
                        <div className="flex items-center justify-center space-x-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75"></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150"></div>
                        </div>
                      ) : generatedMessages[consultation.id!] ? (
                        <button
                          onClick={() => consultation.id && viewMessage(consultation.id)}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded text-sm"
                        >
                          메시지 보기
                        </button>
                      ) : messageStatus[consultation.id!] ? (
                        <div className={`text-sm ${messageStatus[consultation.id!].includes('오류') || messageStatus[consultation.id!].includes('실패') ? 'text-red-500' : 'text-green-500'}`}>
                              {messageStatus[consultation.id!]}
                            </div>
                          ) : (
                            <button
                              onClick={() => consultation.id && createMessageGenerationRequest(consultation.id)}
                              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-1 px-2 rounded text-sm"
                              disabled={messageLoading[consultation.id!]}
                            >
                              메시지 생성
                            </button>
                          )}
                    </td>
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

      {/* 메시지 보기 모달 */}
      {isModalOpen && selectedMessage && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white text-black rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">생성된 메시지</h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedMessage(null);
                  setSelectedConsultationId(null);
                  setSendingMessage(false);
                  setMessageIsSent(false);
                  setSendingNextVisitMessage(false);
                  setNextVisitMessageIsSent(false);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                닫기
              </button>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-gray-900">맞춤 메시지:</h4>
                <div>
                  {messageIsSent ? (
                    <span className="inline-block bg-green-500 text-white px-2 py-1 rounded text-sm">
                      전송 완료
                    </span>
                  ) : (
                    <button
                      onClick={sendMessage}
                      disabled={sendingMessage}
                      className={`px-3 py-1 rounded text-white text-sm ${
                        sendingMessage
                          ? "bg-blue-300 cursor-wait"
                          : "bg-blue-500 hover:bg-blue-600"
                      }`}
                    >
                      {sendingMessage ? "전송 중..." : "맞춤 메시지 전송"}
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-gray-900">
                {selectedMessage.custom_message || "맞춤 메시지가 생성되지 않았습니다."}
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-gray-900">다음 방문 메시지:</h4>
                <div>
                  {nextVisitMessageIsSent ? (
                    <span className="inline-block bg-green-500 text-white px-2 py-1 rounded text-sm">
                      전송 완료
                    </span>
                  ) : (
                    <button
                      onClick={sendNextVisitMessage}
                      disabled={sendingNextVisitMessage}
                      className={`px-3 py-1 rounded text-white text-sm ${
                        sendingNextVisitMessage
                          ? "bg-blue-300 cursor-wait"
                          : "bg-blue-500 hover:bg-blue-600"
                      }`}
                    >
                      {sendingNextVisitMessage ? "전송 중..." : "방문 메시지 전송"}
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-gray-900">
                {selectedMessage.next_visit_message || "다음 방문 메시지가 생성되지 않았습니다."}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientConsultation;
