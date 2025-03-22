import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import moment from 'moment';
import Header from './Header';

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
  treatment_status?: string;  // 치료진행 상황
  suspension_reason?: string; // 중단 사유
  created_at?: string;
  last_modified_at?: string; // 마지막 수정 날짜와 시간
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
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);

  // 인터벌 ID를 저장할 ref 추가
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // 메시지 생성 요청이 진행 중인 상담 ID를 추적
  const [pendingMessageRequests, setPendingMessageRequests] = useState<Set<number>>(new Set());

  // (1) 각 숫자 필드를 문자열로 초기화
  const [newConsultation, setNewConsultation] = useState<ConsultationRecord>({
    patient_id: residentId || '',
    consultation_date: new Date().toISOString().split('T')[0],
    patient_type: '신환',
    doctor: '',
    consultant: '',
    treatment_details: '',
    consultation_result: '전체동의',
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
  const [treatmentFieldsExpanded, setTreatmentFieldsExpanded] = useState(false);
  const [contactFieldsExpanded, setContactFieldsExpanded] = useState(false);
  
  // 수정/삭제 관련 상태 추가
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<ConsultationRecord | null>(null);
  const [isEditModeEnabled, setIsEditModeEnabled] = useState(false); // 수정 모드 활성화 상태
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingConsultationId, setDeletingConsultationId] = useState<number | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

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
  
  // 메시지 수정을 위한 상태 변수 추가
  const [isEditingCustomMessage, setIsEditingCustomMessage] = useState(false);
  const [isEditingNextVisitMessage, setIsEditingNextVisitMessage] = useState(false);
  const [editedCustomMessage, setEditedCustomMessage] = useState('');
  const [editedNextVisitMessage, setEditedNextVisitMessage] = useState('');
  const [savingCustomMessage, setSavingCustomMessage] = useState(false);
  const [savingNextVisitMessage, setSavingNextVisitMessage] = useState(false);

  const resetForm = useCallback(() => {
    setNewConsultation({
      patient_id: residentId || '',
      consultation_date: new Date().toISOString().split('T')[0],
      patient_type: '신환',
      doctor: '',
      consultant: '',
      treatment_details: '',
      consultation_result: '전체동의',
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
      first_contact_type: '방문',
      second_contact_date: null,
      second_contact_type: '방문',
      third_contact_date: null,
      third_contact_type: '방문',
      consultation_memo: '',
      today_treatment: '',
      next_treatment: '',
      appointment_date: null,
      appointment_time: ''
    });
    setTreatmentFieldsExpanded(false);
    setContactFieldsExpanded(false);
  }, [residentId]);

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
  const formatNumber = (value: string | number) => {
    // 값이 없거나 undefined인 경우 빈 문자열 반환
    if (value === undefined || value === null || value === '') return '';
    
    // 문자열로 변환
    const strValue = String(value);
    
    // 앞의 0 제거 후 숫자만 추출
    const number = strValue.replace(/[^\d]/g, '');
    if (number === '') return '';
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // 문자열에서 숫자만 추출하는 함수 (콤마 제거)
  const parseNumber = (value: string | number) => {
    // 값이 없거나 undefined인 경우 0 반환
    if (value === undefined || value === null || value === '') return 0;
    
    // 문자열로 변환
    const strValue = String(value);
    
    return parseInt(strValue.replace(/[^\d]/g, ''), 10) || 0;
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
        resetForm();
        
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
        
        // 추적 중인 요청 상태를 위한 임시 저장소
        const stillPending = new Set(pendingMessageRequests);
        
        // 각 메시지 요청에 대해 상태 업데이트
        allRequests.forEach(request => {
          if (request.consultation_id) {
            // 메시지 스토리지에 데이터가 있는지 확인
            if (generatedMessageIds.has(request.id)) {
              newMessageStatus[request.consultation_id] = '이미 생성됨';
              
              // 이 상담 ID에 대한 요청이 완료되었으므로 추적 목록에서 제거
              stillPending.delete(request.consultation_id);
            } 
            // 요청만 되고 아직 생성되지 않은 경우
            else if (request.message_requested_at) {
              newMessageStatus[request.consultation_id] = '신청 완료';
            }
          }
        });
        
        // 추적 중인 요청 목록 업데이트
        setPendingMessageRequests(stillPending);
        
        // 더 이상 추적할 요청이 없으면 인터벌 정리
        if (stillPending.size === 0 && statusCheckIntervalRef.current) {
          console.log('모든 메시지 생성 요청이 완료되어 인터벌을 중지합니다.');
          clearInterval(statusCheckIntervalRef.current);
          statusCheckIntervalRef.current = null;
        }
        
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
  }, [residentId, consultations, messageStatus, generatedMessages, pendingMessageRequests]);

  // 주기적으로 메시지 생성 상태 확인
  useEffect(() => {
    // 컴포넌트 마운트 시 초기 상태 확인 (기존 메시지 상태는 한 번만 확인)
    checkMessageGenerationStatus();
    
    // 컴포넌트 언마운트 시 인터벌 정리
    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
        statusCheckIntervalRef.current = null;
      }
    };
  }, [checkMessageGenerationStatus]);

  // 메시지 보기 모달
  const viewMessage = async (consultationId: number) => {
    try {
      // 수정 모드 초기화
      setIsEditingCustomMessage(false);
      setIsEditingNextVisitMessage(false);
      
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
        setMessageIsSent(storageData.message_send === true || storageData.message_send === null);
        setNextVisitMessageIsSent(storageData.next_message_send === true || storageData.next_message_send === null);
        
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
            // true나 null은 전송 완료 상태로 설정
            setMessageIsSent(storageData.message_send === true || storageData.message_send === null);
            setNextVisitMessageIsSent(storageData.next_message_send === true || storageData.next_message_send === null);
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
      
      // 2. 전송 상태 확인 및 업데이트 준비
      const { data: checkData } = await supabase
        .from('message_storage')
        .select('message_send, next_message_send')
        .eq('id', generationData.id)
        .single();
        
      // 3. message_storage 테이블의 필드 업데이트
      const updateData: { message_send: boolean, next_message_send: boolean | null } = {
        message_send: true,
        next_message_send: checkData?.next_message_send || false
      };
      
      // 다른 메시지가 true인 경우 null로 변경
      if (updateData.next_message_send === true) {
        updateData.next_message_send = null;
      }
      
      const { error } = await supabase
        .from('message_storage')
        .update(updateData)
        .eq('id', generationData.id)
        .select();
        
      if (error) throw error;
      
      // 업데이트 성공 - 상태 변수 업데이트
      setMessageIsSent(true);
      
      // 다른 메시지 상태도 업데이트
      if (checkData?.next_message_send === true) {
        setNextVisitMessageIsSent(true); // null도 '전송 완료'로 표시되므로 true로 유지
      }
      
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
      
      // 2. 전송 상태 확인 및 업데이트 준비
      const { data: checkData, /* checkError */ } = await supabase
        .from('message_storage')
        .select('message_send, next_message_send')
        .eq('id', generationData.id)
        .single();
        
      console.log('기존 데이터:', checkData);
      
      // 3. message_storage 테이블의 필드 업데이트
      const updateData: { message_send: boolean | null, next_message_send: boolean } = {
        message_send: checkData?.message_send || false,
        next_message_send: true
      };
      
      // 다른 메시지가 true인 경우 null로 변경
      if (updateData.message_send === true) {
        updateData.message_send = null;
      }
      
      const { data, error } = await supabase
        .from('message_storage')
        .update(updateData)
        .eq('id', generationData.id)
        .select();
      
      console.log('업데이트 결과:', data);
      console.log('업데이트 오류:', error);
        
      if (error) {
        console.error('업데이트 중 오류 발생:', error);
        throw error;
      }
      
      // 업데이트 성공 - 상태 변수 업데이트
      setNextVisitMessageIsSent(true);
      
      // 다른 메시지 상태도 업데이트
      if (checkData?.message_send === true) {
        setMessageIsSent(true); // null도 '전송 완료'로 표시되므로 true로 유지
      }
      
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
          
          // 이 상담 ID를 추적 목록에 추가
          setPendingMessageRequests(prev => new Set(prev).add(consultationId));
          
          // 상태 확인 인터벌 시작 (이미 실행 중이 아닌 경우에만)
          if (!statusCheckIntervalRef.current) {
            console.log('메시지 생성 상태를 주기적으로 확인하기 시작합니다.');
            statusCheckIntervalRef.current = setInterval(() => {
              checkMessageGenerationStatus();
            }, 5000); // 5초마다 확인 (더 빠르게 상태 변화를 감지)
          }
        }
        
        setMessageLoading(prev => ({ ...prev, [consultationId]: false }));
        return;
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
          setMessageLoading(prev => ({ ...prev, [consultationId]: false }));
          return;
        }
        
        throw error;
      }
      
      // 성공 시 상태 업데이트
      console.log('메시지 생성 요청 성공:', data);
      setMessageStatus(prev => ({ ...prev, [consultationId]: '신청 완료' }));
      
      // 이 상담 ID를 추적 목록에 추가
      setPendingMessageRequests(prev => new Set(prev).add(consultationId));
      
      // 상태 확인 인터벌 시작 (이미 실행 중이 아닌 경우에만)
      if (!statusCheckIntervalRef.current) {
        console.log('메시지 생성 상태를 주기적으로 확인하기 시작합니다.');
        statusCheckIntervalRef.current = setInterval(() => {
          checkMessageGenerationStatus();
        }, 5000); // 5초마다 확인 (더 빠르게 상태 변화를 감지)
      }
    } catch (error: any) {
      console.error('메시지 생성 요청 오류:', error);
      alert(`메시지 생성 요청 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
      setMessageStatus(prev => ({ ...prev, [consultationId]: `오류: ${error.message || '알 수 없는 오류'}` }));
    } finally {
      setMessageLoading(prev => ({ ...prev, [consultationId]: false }));
    }
  };

  // 맞춤 메시지 수정 함수
  const saveEditedCustomMessage = async () => {
    if (!selectedConsultationId) return;
    
    try {
      setSavingCustomMessage(true);
      
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
      
      // 2. message_storage 테이블의 custom_message 필드 업데이트
      const { error } = await supabase
        .from('message_storage')
        .update({ 
          custom_message: editedCustomMessage
        })
        .eq('id', generationData.id)
        .select();
        
      if (error) throw error;
      
      // 업데이트 성공
      setSelectedMessage(prev => ({
        ...prev!,
        custom_message: editedCustomMessage
      }));
      
      // 캐시된 메시지도 업데이트
      if (selectedConsultationId) {
        setGeneratedMessages(prev => ({
          ...prev,
          [selectedConsultationId]: {
            ...prev[selectedConsultationId],
            custom_message: editedCustomMessage
          }
        }));
      }
      
      setIsEditingCustomMessage(false);
      alert('맞춤 메시지가 수정되었습니다.');
      
    } catch (error) {
      console.error('맞춤 메시지 수정 오류:', error);
      alert('맞춤 메시지 수정 중 오류가 발생했습니다.');
    } finally {
      setSavingCustomMessage(false);
    }
  };
  
  // 다음 방문 메시지 수정 함수
  const saveEditedNextVisitMessage = async () => {
    if (!selectedConsultationId) return;
    
    try {
      setSavingNextVisitMessage(true);
      
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
      
      // 2. message_storage 테이블의 next_visit_message 필드 업데이트
      const { error } = await supabase
        .from('message_storage')
        .update({ 
          next_visit_message: editedNextVisitMessage
        })
        .eq('id', generationData.id)
        .select();
        
      if (error) throw error;
      
      // 업데이트 성공
      setSelectedMessage(prev => ({
        ...prev!,
        next_visit_message: editedNextVisitMessage
      }));
      
      // 캐시된 메시지도 업데이트
      if (selectedConsultationId) {
        setGeneratedMessages(prev => ({
          ...prev,
          [selectedConsultationId]: {
            ...prev[selectedConsultationId],
            next_visit_message: editedNextVisitMessage
          }
        }));
      }
      
      setIsEditingNextVisitMessage(false);
      alert('다음 방문 메시지가 수정되었습니다.');
      
    } catch (error) {
      console.error('다음 방문 메시지 수정 오류:', error);
      alert('다음 방문 메시지 수정 중 오류가 발생했습니다.');
    } finally {
      setSavingNextVisitMessage(false);
    }
  };

  // 상담 기록 수정 모달 열기 (읽기 전용 모드 지원)
  const openEditModal = (consultation: ConsultationRecord, isEditMode: boolean = true) => {
    // 수정용 데이터 복사 (필드 타입은 이미 string이므로 추가 변환 불필요)
    const consultationForEdit = {
      ...consultation,
      // 빈 값에 대한 기본값 처리 및 금액 필드 포맷팅
      diagnosis_amount: formatNumber(consultation.diagnosis_amount || '0'),
      consultation_amount: formatNumber(consultation.consultation_amount || '0'),
      payment_amount: formatNumber(consultation.payment_amount || '0'),
      remaining_payment: formatNumber(consultation.remaining_payment || '0'),
      // 다른 수량 필드 기본값 처리
      ip_count: consultation.ip_count || '0',
      ipd_count: consultation.ipd_count || '0',
      ipb_count: consultation.ipb_count || '0',
      bg_count: consultation.bg_count || '0',
      cr_count: consultation.cr_count || '0',
      in_count: consultation.in_count || '0',
      r_count: consultation.r_count || '0',
      ca_count: consultation.ca_count || '0',
      // 치료진행 상황과 중단 사유 필드 초기화
      treatment_status: consultation.treatment_status || '',
      suspension_reason: consultation.suspension_reason || ''
    };
    
    setEditingConsultation(consultationForEdit);
    setIsEditModeEnabled(isEditMode); // 수정 모드 상태 설정
    setIsEditModalOpen(true);
  };

  // 수정 모드 전환 핸들러
  const toggleEditMode = () => {
    setIsEditModeEnabled(prev => !prev);
  };

  // 상담 기록 수정 처리
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingConsultation || !editingConsultation.id) return;
    
    try {
      setEditSubmitting(true);
      
      // 숫자 필드 변환 함수
      const toNumber = (str: string | any) => {
        // null, undefined 등 falsy 값이거나 empty 문자열 처리
        if (!str || str === '' || str === 'empty') return 0;
        
        // 이미 숫자인 경우 바로 반환
        if (typeof str === 'number') return str;
        
        // 문자열이 아닌 경우 문자열로 변환 시도
        if (typeof str !== 'string') {
          try {
            str = String(str);
          } catch (e) {
            console.warn('숫자 변환 실패:', str);
            return 0;
          }
        }
        
        // 콤마(,) 제거 후 숫자 변환
        try {
          return parseFloat(str.replace(/,/g, '')) || 0;
        } catch (e) {
          console.warn('숫자 변환 오류:', e);
          return 0;
        }
      };
      
      // 날짜 포맷 변환 (날짜 필드가 문자열이 아닌 경우 처리)
      const formatDate = (str: string | null) => {
        if (!str) return null;
        return str;
      };
      
      // 현재 한국 시간을 ISO 형식으로 생성 (타임존 정보 포함)
      const currentDateTime = moment().tz('Asia/Seoul').toISOString();
      
      // 수정할 데이터 준비 (숫자 필드는 숫자로 변환)
      // 타입 에러를 방지하기 위해 any 타입 사용
      const updatedConsultation: any = {
        patient_id: editingConsultation.patient_id,
        consultation_date: formatDate(editingConsultation.consultation_date),
        patient_type: editingConsultation.patient_type,
        doctor: editingConsultation.doctor,
        consultant: editingConsultation.consultant,
        treatment_details: editingConsultation.treatment_details,
        consultation_result: editingConsultation.consultation_result,
        diagnosis_amount: toNumber(editingConsultation.diagnosis_amount),
        consultation_amount: toNumber(editingConsultation.consultation_amount),
        payment_amount: toNumber(editingConsultation.payment_amount),
        remaining_payment: toNumber(editingConsultation.remaining_payment),
        non_consent_reason: editingConsultation.non_consent_reason,
        ip_count: toNumber(editingConsultation.ip_count),
        ipd_count: toNumber(editingConsultation.ipd_count),
        ipb_count: toNumber(editingConsultation.ipb_count),
        bg_count: toNumber(editingConsultation.bg_count),
        cr_count: toNumber(editingConsultation.cr_count),
        in_count: toNumber(editingConsultation.in_count),
        r_count: toNumber(editingConsultation.r_count),
        ca_count: toNumber(editingConsultation.ca_count),
        first_contact_date: formatDate(editingConsultation.first_contact_date),
        first_contact_type: editingConsultation.first_contact_type,
        second_contact_date: formatDate(editingConsultation.second_contact_date),
        second_contact_type: editingConsultation.second_contact_type,
        third_contact_date: formatDate(editingConsultation.third_contact_date),
        third_contact_type: editingConsultation.third_contact_type,
        consultation_memo: editingConsultation.consultation_memo,
        today_treatment: editingConsultation.today_treatment,
        next_treatment: editingConsultation.next_treatment,
        appointment_date: formatDate(editingConsultation.appointment_date),
        appointment_time: editingConsultation.appointment_time,
        treatment_status: editingConsultation.treatment_status,
        suspension_reason: editingConsultation.treatment_status === '중단 중' ? editingConsultation.suspension_reason : null,
        last_modified_at: currentDateTime // 마지막 수정 날짜와 시간 추가
      };
      
      // Supabase 업데이트 요청
      const { data, error } = await supabase
        .from('patient_consultations')
        .update(updatedConsultation)
        .eq('id', editingConsultation.id)
        .select();
      
      if (error) throw error;
      
      // 업데이트 성공 시 consultations 상태 업데이트
      // 실제 DB에 저장된 데이터와 UI 표시 데이터 타입이 다르므로 타입 변환 필요
      setConsultations(prev => prev.map(c => {
        if (c.id === editingConsultation.id) {
          // 서버에서 반환된 데이터가 있다면 그것을 사용, 없다면 로컬 업데이트 데이터 사용
          const serverData = data && data.length > 0 ? data[0] : null;
          
          if (serverData) {
            return serverData as ConsultationRecord;
          } else {
            // DB에 저장된 숫자 필드들은 UI에서는 다시 문자열로 표시
            return {
              ...c,
              ...updatedConsultation,
              // 숫자를 문자열로 변환하여 UI에 표시
              diagnosis_amount: updatedConsultation.diagnosis_amount.toString(),
              consultation_amount: updatedConsultation.consultation_amount.toString(),
              payment_amount: updatedConsultation.payment_amount.toString(),
              remaining_payment: updatedConsultation.remaining_payment.toString(),
              ip_count: updatedConsultation.ip_count.toString(),
              ipd_count: updatedConsultation.ipd_count.toString(),
              ipb_count: updatedConsultation.ipb_count.toString(),
              bg_count: updatedConsultation.bg_count.toString(),
              cr_count: updatedConsultation.cr_count.toString(),
              in_count: updatedConsultation.in_count.toString(),
              r_count: updatedConsultation.r_count.toString(),
              ca_count: updatedConsultation.ca_count.toString(),
              id: c.id
            };
          }
        }
        return c;
      }));
      
      // 수정 모달 닫기
      setIsEditModalOpen(false);
      setEditingConsultation(null);
      
      // 성공 알림
      alert('상담 기록이 성공적으로 수정되었습니다.');
    } catch (error) {
      console.error('상담 기록 수정 실패:', error);
      alert('상담 기록 수정 중 오류가 발생했습니다.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // 수정 폼에서 입력값 변경 핸들러
  const handleEditInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    if (!editingConsultation) return;
    
    // 금액 필드인 경우 천단위 콤마 처리
    if (
      name === 'consultation_amount' || 
      name === 'payment_amount' ||
      name === 'diagnosis_amount'
    ) {
      const formattedValue = formatNumber(value);
      
      setEditingConsultation((prev) => {
        if (!prev) return null;
        
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
      setEditingConsultation((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          [name]: value,
        };
      });
    }
  };

  // 수정 폼에서 날짜 변경 핸들러
  const handleEditDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (!editingConsultation) return;
    
    // 유효한 날짜인지 확인
    const dateObj = new Date(value);
    const isValid = !isNaN(dateObj.getTime());
    
    setEditingConsultation(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [name]: isValid ? dateObj.toISOString().split('T')[0] : ''
      };
    });
  };

  // 수정 모달 닫기
  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingConsultation(null);
    setIsEditModeEnabled(true); // 모달을 닫을 때 다음에는 수정 모드로 설정되도록 초기화
  };

  // 삭제 모달 열기
  const openDeleteModal = (consultationId: number) => {
    setDeletingConsultationId(consultationId);
    setIsDeleteModalOpen(true);
  };

  // 상담 기록 삭제 처리
  const handleDeleteConfirm = async () => {
    if (!deletingConsultationId) return;
    
    try {
      setDeleteSubmitting(true);
      
      // Supabase 삭제 요청
      const { error } = await supabase
        .from('patient_consultations')
        .delete()
        .eq('id', deletingConsultationId);
      
      if (error) throw error;
      
      // 삭제 성공 시 consultations 상태 업데이트
      setConsultations(prev => prev.filter(c => c.id !== deletingConsultationId));
      
      // 삭제 모달 닫기
      setIsDeleteModalOpen(false);
      setDeletingConsultationId(null);
      
      // 성공 알림
      alert('상담 기록이 성공적으로 삭제되었습니다.');
    } catch (error) {
      console.error('상담 기록 삭제 실패:', error);
      alert('상담 기록 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // 삭제 모달 닫기
  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeletingConsultationId(null);
  };

  // URL 쿼리 파라미터에서 consultationId 확인
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const consultationId = params.get('consultationId');
    
    if (consultationId && consultations.length > 0) {
      // 해당 ID의 상담 기록 찾기
      const consultation = consultations.find(c => c.id === parseInt(consultationId));
      if (consultation) {
        openEditModal(consultation, false); // 읽기 전용 모드로 열기
      }
    }
  }, [consultations, location.search]);

  // 날짜 포맷팅 함수 추가 (YYYY.MM.DD 형식)
  const formatDateDisplay = (dateString: string | undefined | null): string => {
    if (!dateString) return '-';
    // ISO 형식 날짜를 YYYY.MM.DD 형식으로 변환
    return moment(dateString).format('YYYY.MM.DD');
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
      <Header showTestDataButton={false} pageTitle="환자 상담 기록" />

      {/* 상담 기록 내역 섹션을 가장 상단으로 이동 */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-semibold">상담 기록 내역</h2>
          {consultations.length > 0 && consultations[0]?.treatment_status && (
            <>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                consultations[0].treatment_status === '중단 중' 
                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                  : consultations[0].treatment_status === '종결' 
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    : consultations[0].treatment_status === '진행중'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : consultations[0].treatment_status.includes('대기')
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : consultations[0].treatment_status === '근관치료 중'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
              }`}>
                {consultations[0].treatment_status}
              </span>
              {consultations[0].treatment_status === '중단 중' && consultations[0].suspension_reason && (
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-red-50 text-red-600 dark:bg-red-800/30 dark:text-red-300">
                  중단 사유: {consultations[0].suspension_reason}
                </span>
              )}
            </>
          )}
        </div>
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
                  <th className="p-2 border border-gray-300 dark:border-gray-700 sticky right-0 z-10 bg-gray-100 dark:bg-gray-800 shadow-md">액션</th>
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
                      {/* 마지막 수정일 표시 */}
                      {consultation.last_modified_at && (
                        <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                          <span className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            {formatDateDisplay(consultation.last_modified_at)}
                          </span>
                        </div>
                      )}
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
                      {/* 진단금액 - 천단위 콤마 적용 */}
                      {formatNumber(consultation.diagnosis_amount) || '0'}원
                    </td>
                    <td className="p-2 border border-gray-300 dark:border-gray-700">
                      {/* 수납금액 - 천단위 콤마 적용 */}
                      {formatNumber(consultation.payment_amount) || '0'}원
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
                    <td className="p-2 border border-gray-300 dark:border-gray-700 sticky right-0 z-10 bg-white dark:bg-gray-900 shadow-md">
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => consultation.id && openEditModal(consultation)}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-2 rounded text-sm"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => consultation.id && openDeleteModal(consultation.id)}
                          className="bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded text-sm"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                <option value="서지희">서지희</option>
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
                <option value="김소정">김소정</option>
                <option value="정두리">정두리</option>
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
            <div className="flex justify-between items-center mb-3 cursor-pointer" 
                 onClick={() => setTreatmentFieldsExpanded(!treatmentFieldsExpanded)}>
              <h3 className="text-lg font-medium">치료 항목 수량</h3>
              <div className="text-blue-500">
                {treatmentFieldsExpanded ? '접기 ▲' : '펼치기 ▼'}
              </div>
            </div>
            
            {treatmentFieldsExpanded && (
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
            )}
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
            <h3 className="text-lg font-medium mb-3">
              연락 기록
              <button
                type="button"
                className="ml-2 text-sm text-blue-500 hover:text-blue-700 focus:outline-none"
                onClick={() => setContactFieldsExpanded(!contactFieldsExpanded)}
              >
                {contactFieldsExpanded ? '접기 ▲' : '펼치기 ▼'}
              </button>
            </h3>
            
            {contactFieldsExpanded && (
              <>
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
              </>
            )}
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
                  // 수정 모드 초기화
                  setIsEditingCustomMessage(false);
                  setIsEditingNextVisitMessage(false);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                닫기
              </button>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-gray-900">맞춤 메시지:</h4>
                <div className="flex gap-2">
                  {isEditingCustomMessage ? (
                    <>
                      <button
                        onClick={saveEditedCustomMessage}
                        disabled={savingCustomMessage}
                        className={`px-3 py-1 rounded text-white text-sm ${
                          savingCustomMessage
                            ? "bg-green-300 cursor-wait"
                            : "bg-green-500 hover:bg-green-600"
                        }`}
                      >
                        {savingCustomMessage ? "저장 중..." : "저장"}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingCustomMessage(false);
                          setEditedCustomMessage(selectedMessage.custom_message || '');
                        }}
                        className="px-3 py-1 rounded text-white text-sm bg-gray-500 hover:bg-gray-600"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      {/* 메시지 전송 상태가 false일 때만 수정 버튼 표시 */}
                      {!messageIsSent && messageIsSent !== null && (
                        <button
                          onClick={() => {
                            setIsEditingCustomMessage(true);
                            setEditedCustomMessage(selectedMessage.custom_message || '');
                          }}
                          className="px-3 py-1 rounded text-white text-sm bg-yellow-500 hover:bg-yellow-600 mr-2"
                        >
                          수정
                        </button>
                      )}
                      {messageIsSent || messageIsSent === null ? (
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
                    </>
                  )}
                </div>
              </div>
              {isEditingCustomMessage ? (
                <textarea
                  value={editedCustomMessage}
                  onChange={(e) => setEditedCustomMessage(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded text-gray-900 min-h-[200px]"
                  placeholder="맞춤 메시지를 입력하세요"
                />
              ) : (
                <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-gray-900">
                  {selectedMessage.custom_message || "맞춤 메시지가 생성되지 않았습니다."}
                </div>
              )}
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-gray-900">다음 방문 메시지:</h4>
                <div className="flex gap-2">
                  {isEditingNextVisitMessage ? (
                    <>
                      <button
                        onClick={saveEditedNextVisitMessage}
                        disabled={savingNextVisitMessage}
                        className={`px-3 py-1 rounded text-white text-sm ${
                          savingNextVisitMessage
                            ? "bg-green-300 cursor-wait"
                            : "bg-green-500 hover:bg-green-600"
                        }`}
                      >
                        {savingNextVisitMessage ? "저장 중..." : "저장"}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingNextVisitMessage(false);
                          setEditedNextVisitMessage(selectedMessage.next_visit_message || '');
                        }}
                        className="px-3 py-1 rounded text-white text-sm bg-gray-500 hover:bg-gray-600"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      {/* 다음 방문 메시지 전송 상태가 false일 때만 수정 버튼 표시 */}
                      {!nextVisitMessageIsSent && nextVisitMessageIsSent !== null && (
                        <button
                          onClick={() => {
                            setIsEditingNextVisitMessage(true);
                            setEditedNextVisitMessage(selectedMessage.next_visit_message || '');
                          }}
                          className="px-3 py-1 rounded text-white text-sm bg-yellow-500 hover:bg-yellow-600 mr-2"
                        >
                          수정
                        </button>
                      )}
                      {nextVisitMessageIsSent || nextVisitMessageIsSent === null ? (
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
                    </>
                  )}
                </div>
              </div>
              {isEditingNextVisitMessage ? (
                <textarea
                  value={editedNextVisitMessage}
                  onChange={(e) => setEditedNextVisitMessage(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded text-gray-900 min-h-[200px]"
                  placeholder="다음 방문 메시지를 입력하세요"
                />
              ) : (
                <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-gray-900">
                  {selectedMessage.next_visit_message || "다음 방문 메시지가 생성되지 않았습니다."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 상담 기록 수정 모달 */}
      {isEditModalOpen && editingConsultation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white text-black rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-medium text-gray-900">
                  {isEditModeEnabled ? '상담 기록 수정' : '상담 기록 상세보기'}
                </h3>
                {/* 마지막 수정일 표시 */}
                {editingConsultation.last_modified_at && (
                  <span className="text-sm text-gray-500 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    마지막 수정: {formatDateDisplay(editingConsultation.last_modified_at)}
                  </span>
                )}
              </div>
              {/* 모드 전환 버튼 추가 */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={toggleEditMode}
                  className={`px-3 py-1 rounded text-white ${
                    isEditModeEnabled ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                >
                  {isEditModeEnabled ? '읽기 전용 모드' : '수정 모드'}
                </button>
                <button
                  onClick={closeEditModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  닫기
                </button>
              </div>
              {/* 마지막 수정일 표시 - 이 부분은 제거 */}
            </div>
            
            <form onSubmit={handleEditSubmit} className="space-y-6">
              {/* 환자 정보 표시 */}
              <div className="bg-gray-100 p-4 rounded-lg mb-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">환자 이름</span>
                    <p className="font-medium">{patientInfo?.name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">주민등록번호</span>
                    <p className="font-medium">{patientInfo?.resident_id || '-'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">전화번호</span>
                    <p className="font-medium">{patientInfo?.phone || '-'}</p>
                  </div>
                </div>
              </div>

              {/* 디버깅용 */}
              <details>
                <summary>현재 입력 상태 확인 (디버깅용)</summary>
                <pre>{JSON.stringify(editingConsultation, null, 2)}</pre>
              </details>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">상담 일자</label>
                  <input
                    type="date"
                    name="consultation_date"
                    value={editingConsultation.consultation_date || ''}
                    onChange={handleEditDateChange}
                    className={`w-full p-2 border border-gray-300 rounded ${!isEditModeEnabled && 'bg-gray-100'}`}
                    required
                    disabled={!isEditModeEnabled}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">신환/구환</label>
                  <select
                    name="patient_type"
                    value={editingConsultation.patient_type}
                    onChange={handleEditInputChange}
                    className={`w-full p-2 border border-gray-300 rounded ${!isEditModeEnabled && 'bg-gray-100'}`}
                    required
                    disabled={!isEditModeEnabled}
                  >
                    <option value="신환">신환</option>
                    <option value="구환">구환</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">진단원장</label>
                  <select
                    name="doctor"
                    value={editingConsultation.doctor}
                    onChange={handleEditInputChange}
                    className={`w-full p-2 border border-gray-300 rounded ${!isEditModeEnabled && 'bg-gray-100'}`}
                    required
                    disabled={!isEditModeEnabled}
                  >
                    <option value="">선택하세요</option>
                    <option value="공성배">공성배</option>
                    <option value="남호진">남호진</option>
                    <option value="박대웅">박대웅</option>
                    <option value="전경원">전경원</option>
                    <option value="장성진">장성진</option>
                    <option value="서지희">서지희</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">상담자</label>
                  <select
                    name="consultant"
                    value={editingConsultation.consultant}
                    onChange={handleEditInputChange}
                    className={`w-full p-2 border border-gray-300 rounded ${!isEditModeEnabled && 'bg-gray-100'}`}
                    required
                    disabled={!isEditModeEnabled}
                  >
                    <option value="">선택하세요</option>
                    <option value="김은정">김은정</option>
                    <option value="임예지">임예지</option>
                    <option value="송도원">송도원</option>
                    <option value="김소정">김소정</option>
                    <option value="정두리">정두리</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">상담 결과</label>
                  <select
                    name="consultation_result"
                    value={editingConsultation.consultation_result}
                    onChange={handleEditInputChange}
                    className={`w-full p-2 border border-gray-300 rounded ${!isEditModeEnabled && 'bg-gray-100'}`}
                    required
                    disabled={!isEditModeEnabled}
                  >
                    <option value="전체동의">전체동의</option>
                    <option value="부분동의">부분동의</option>
                    <option value="비동의">비동의</option>
                    <option value="보류">보류</option>
                    <option value="환불">환불</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">진단 금액</label>
                  <input
                    type="text"
                    name="diagnosis_amount"
                    value={formatNumber(editingConsultation.diagnosis_amount)}
                    onChange={handleEditInputChange}
                    className={`w-full p-2 border border-gray-300 rounded ${!isEditModeEnabled && 'bg-gray-100'}`}
                    placeholder="0"
                    disabled={!isEditModeEnabled}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">상담 금액</label>
                  <input
                    type="text"
                    name="consultation_amount"
                    value={formatNumber(editingConsultation.consultation_amount)}
                    onChange={handleEditInputChange}
                    className={`w-full p-2 border border-gray-300 rounded ${!isEditModeEnabled && 'bg-gray-100'}`}
                    placeholder="0"
                    disabled={!isEditModeEnabled}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">수납 금액</label>
                  <input
                    type="text"
                    name="payment_amount"
                    value={formatNumber(editingConsultation.payment_amount)}
                    onChange={handleEditInputChange}
                    className={`w-full p-2 border border-gray-300 rounded ${!isEditModeEnabled && 'bg-gray-100'}`}
                    placeholder="0"
                    disabled={!isEditModeEnabled}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">잔여 금액</label>
                  <input
                    type="text"
                    name="remaining_payment"
                    value={formatNumber(editingConsultation.remaining_payment)}
                    readOnly
                    className="w-full p-2 border border-gray-300 rounded bg-gray-100"
                    placeholder="0"
                    disabled={!isEditModeEnabled}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">치료 계획 및 상세 사항</label>
                  <textarea
                    name="treatment_details"
                    value={editingConsultation.treatment_details}
                    onChange={handleEditInputChange}
                    className="w-full p-2 border border-gray-300 rounded min-h-[100px]"
                    placeholder="치료 계획 및 상세 사항을 입력하세요"
                    disabled={!isEditModeEnabled}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">비동의 사유</label>
                  <textarea
                    name="non_consent_reason"
                    value={editingConsultation.non_consent_reason}
                    onChange={handleEditInputChange}
                    className="w-full p-2 border border-gray-300 rounded min-h-[100px]"
                    placeholder="비동의 사유를 입력하세요"
                    disabled={!isEditModeEnabled}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">당일치료내용</label>
                  <select
                    name="today_treatment"
                    value={editingConsultation.today_treatment}
                    onChange={handleEditInputChange}
                    className={`w-full p-2 border border-gray-300 rounded ${!isEditModeEnabled && 'bg-gray-100'}`}
                    disabled={!isEditModeEnabled}
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
                    value={editingConsultation.next_treatment}
                    onChange={handleEditInputChange}
                    className={`w-full p-2 border border-gray-300 rounded ${!isEditModeEnabled && 'bg-gray-100'}`}
                    disabled={!isEditModeEnabled}
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
                      value={editingConsultation.appointment_date || ''}
                      onChange={handleEditDateChange}
                      className={`w-full p-2 border border-gray-300 rounded ${!isEditModeEnabled && 'bg-gray-100'}`}
                      disabled={!isEditModeEnabled}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">예약시간</label>
                    <input
                      type="time"
                      name="appointment_time"
                      value={editingConsultation.appointment_time}
                      onChange={handleEditInputChange}
                      className={`w-full p-2 border border-gray-300 rounded ${!isEditModeEnabled && 'bg-gray-100'}`}
                      disabled={!isEditModeEnabled}
                    />
                  </div>
                </div>
              </div>

              {/* 연락 기록 요약 정보 */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-medium text-gray-700 mb-2">연락 기록</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 첫 번째 연락 */}
                  <div className="border rounded p-3 bg-white">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">첫 번째 연락</span>
                      {isEditModeEnabled ? (
                        <select
                          name="first_contact_type"
                          value={editingConsultation.first_contact_type}
                          onChange={handleEditInputChange}
                          className="text-xs py-0.5 px-2 border border-gray-300 rounded"
                        >
                          <option value="방문">방문</option>
                          <option value="전화">전화</option>
                        </select>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded ${editingConsultation.first_contact_type === '방문' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {editingConsultation.first_contact_type || '-'}
                        </span>
                      )}
                    </div>
                    {isEditModeEnabled ? (
                      <input
                        type="date"
                        name="first_contact_date"
                        value={editingConsultation.first_contact_date || ''}
                        onChange={handleEditDateChange}
                        className="w-full text-sm p-1 border border-gray-300 rounded"
                      />
                    ) : (
                      <p className="text-sm">{editingConsultation.first_contact_date ? formatDateDisplay(editingConsultation.first_contact_date) : '기록 없음'}</p>
                    )}
                  </div>
                  
                  {/* 두 번째 연락 */}
                  <div className="border rounded p-3 bg-white">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">두 번째 연락</span>
                      {isEditModeEnabled ? (
                        <select
                          name="second_contact_type"
                          value={editingConsultation.second_contact_type}
                          onChange={handleEditInputChange}
                          className="text-xs py-0.5 px-2 border border-gray-300 rounded"
                        >
                          <option value="방문">방문</option>
                          <option value="전화">전화</option>
                        </select>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded ${editingConsultation.second_contact_type === '방문' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {editingConsultation.second_contact_type || '-'}
                        </span>
                      )}
                    </div>
                    {isEditModeEnabled ? (
                      <input
                        type="date"
                        name="second_contact_date"
                        value={editingConsultation.second_contact_date || ''}
                        onChange={handleEditDateChange}
                        className="w-full text-sm p-1 border border-gray-300 rounded"
                      />
                    ) : (
                      <p className="text-sm">{editingConsultation.second_contact_date ? formatDateDisplay(editingConsultation.second_contact_date) : '기록 없음'}</p>
                    )}
                  </div>
                  
                  {/* 세 번째 연락 */}
                  <div className="border rounded p-3 bg-white">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">세 번째 연락</span>
                      {isEditModeEnabled ? (
                        <select
                          name="third_contact_type"
                          value={editingConsultation.third_contact_type}
                          onChange={handleEditInputChange}
                          className="text-xs py-0.5 px-2 border border-gray-300 rounded"
                        >
                          <option value="방문">방문</option>
                          <option value="전화">전화</option>
                        </select>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded ${editingConsultation.third_contact_type === '방문' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {editingConsultation.third_contact_type || '-'}
                        </span>
                      )}
                    </div>
                    {isEditModeEnabled ? (
                      <input
                        type="date"
                        name="third_contact_date"
                        value={editingConsultation.third_contact_date || ''}
                        onChange={handleEditDateChange}
                        className="w-full text-sm p-1 border border-gray-300 rounded"
                      />
                    ) : (
                      <p className="text-sm">{editingConsultation.third_contact_date ? formatDateDisplay(editingConsultation.third_contact_date) : '기록 없음'}</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">상담 메모</label>
                <textarea
                  name="consultation_memo"
                  value={editingConsultation.consultation_memo}
                  onChange={handleEditInputChange}
                  className={`w-full p-2 border border-gray-300 rounded min-h-[120px] ${!isEditModeEnabled && 'bg-gray-100'}`}
                  placeholder="상담 내용에 대한 메모를 입력하세요"
                  disabled={!isEditModeEnabled}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">치료진행 상황</label>
                  <select
                    name="treatment_status"
                    value={editingConsultation.treatment_status || ''}
                    onChange={handleEditInputChange}
                    className={`w-full p-2 border border-gray-300 rounded ${!isEditModeEnabled && 'bg-gray-100'}`}
                    disabled={!isEditModeEnabled || consultations[0]?.id !== editingConsultation.id} // 가장 최근 상담 기록이 아니면 비활성화
                  >
                    <option value="">선택하세요</option>
                    <option value="발치 후 대기">발치 후 대기</option>
                    <option value="진행중">진행중</option>
                    <option value="임플란트 식립 후 대기">임플란트 식립 후 대기</option>
                    <option value="2차 수술 후 대기">2차 수술 후 대기</option>
                    <option value="중단 중">중단 중</option>
                    <option value="근관치료 중">근관치료 중</option>
                    <option value="종결">종결</option>
                  </select>
                  {consultations[0]?.id !== editingConsultation.id && (
                    <p className="text-sm text-orange-500 mt-1">
                      치료 상태는 가장 최근 상담 기록만 수정할 수 있습니다.
                    </p>
                  )}
                </div>
                
                {editingConsultation.treatment_status === '중단 중' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">중단 사유</label>
                    <select
                      name="suspension_reason"
                      value={editingConsultation.suspension_reason || ''}
                      onChange={handleEditInputChange}
                      className={`w-full p-2 border border-gray-300 rounded ${!isEditModeEnabled && 'bg-gray-100'}`}
                      required={editingConsultation.treatment_status === '중단 중'}
                      disabled={!isEditModeEnabled || consultations[0]?.id !== editingConsultation.id} // 가장 최근 상담 기록이 아니면 비활성화
                    >
                      <option value="">선택하세요</option>
                      <option value="개인사정">개인사정</option>
                      <option value="비용부담">비용부담</option>
                      <option value="불만족">불만족</option>
                      <option value="연락 안되심">연락 안되심</option>
                      <option value="환불/취소">환불/취소</option>
                      <option value="예약 취소 후 미내원">예약 취소 후 미내원</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
                >
                  닫기
                </button>
                {isEditModeEnabled && (
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded disabled:bg-blue-300"
                  >
                    {editSubmitting ? '저장 중...' : '수정 완료'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white text-black rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">상담 기록 삭제</h3>
            <p className="mb-6">정말로 이 상담 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={closeDeleteModal}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                취소
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteSubmitting}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:bg-red-300"
              >
                {deleteSubmitting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientConsultation;
