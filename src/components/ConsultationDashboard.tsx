import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getNoCacheQuery } from '../supabaseClient';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
  LineController
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import moment from 'moment-timezone';
import * as dateUtils from '../utils/dateUtils';

// Chart.js 컴포넌트 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  LineController,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

// 상담 기록 타입 정의
interface ConsultationRecord {
  id?: number;
  patient_id: string;
  consultation_date: string | null;
  patient_type: '신환' | '구환';
  doctor: string;
  consultant: string;
  consultation_result: '비동의' | '부분동의' | '전체동의' | '보류' | '환불';
  [key: string]: any; // 기타 필드
}

// 상담자별 통계 타입
interface ConsultantStats {
  consultant: string;
  totalConsultations: number;
  newPatients: number;
  existingPatients: number;
  fullConsent: number;
  partialConsent: number;
  noConsent: number;
  pending: number;
  refund: number;
  consentRate: number;
}

// 금액 통계 타입 정의
interface AmountStats {
  diagnosis: number;
  consultation: number;
  payment: number;
  remaining: number;
}

// 날짜별 금액 통계 타입
interface DateAmountStats {
  date: string;
  amounts: AmountStats;
  target: number;
  achievementRate: number;
}

// 상담자별 금액 통계 타입
interface ConsultantAmountStats {
  consultant: string;
  amounts: AmountStats;
}

// 날짜 필터 타입
type DateRange = 'all' | 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom';

const ConsultationDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [consultantStats, setConsultantStats] = useState<ConsultantStats[]>([]);
  const [selectedConsultant, setSelectedConsultant] = useState<string>('');
  // 진단원장 관련 상태 추가
  const [doctorStats, setDoctorStats] = useState<{doctor: string, count: number}[]>([]);
  // 전체 진단원장 목록을 저장할 새로운 상태 추가
  const [allDoctors, setAllDoctors] = useState<{doctor: string, count: number}[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>('thisMonth');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [dateAmountStats, setDateAmountStats] = useState<DateAmountStats[]>([]);
  const [consultantAmountStats, setConsultantAmountStats] = useState<ConsultantAmountStats[]>([]);
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  // 목표 금액 상수 추가
  const DAILY_TARGET = 20000000; // 일별 목표: 2,000만원 (수정됨)
  const WEEKLY_TARGET = 100000000; // 주별 목표: 1억원 (수정됨)
  const MONTHLY_TARGET = 400000000; // 월별 목표: 4억원 (수정됨)
  // 상담자별 목표 금액 추가
  const CONSULTANT_DAILY_TARGET = 5000000; // 일별 목표: 500만원
  const CONSULTANT_WEEKLY_TARGET = 25000000; // 주별 목표: 2,500만원
  const CONSULTANT_MONTHLY_TARGET = 100000000; // 월별 목표: 1억원
  const [filteredDataCount, setFilteredDataCount] = useState<number>(0);
  const [totalDataCount, setTotalDataCount] = useState<number>(0);

  // 상담 기록 가져오기
  useEffect(() => {
    console.log('날짜 범위 변경됨:', dateRange, startDate, endDate);
    if (dateRange !== 'custom' || (startDate && endDate)) {
      // 초기화
      setConsultations([]);
      setFilteredDataCount(0);
      setTotalDataCount(0);
      setLoading(true);
      
      console.log('🔍 실제 사용되는 필터 값 - 시작일:', startDate, '종료일:', endDate);
      
      // 약간의 지연 후 실행 (상태 업데이트 확인을 위해)
      setTimeout(() => {
        fetchConsultations(startDate, endDate, selectedDoctor);
      }, 100);
    }
  }, [dateRange, startDate, endDate, selectedDoctor]);  // selectedDoctor 의존성 추가

  // 상담자별 통계 계산
  useEffect(() => {
    if (consultations.length > 0) {
      calculateConsultantStats();
    }
  }, [consultations, selectedConsultant]);

  // 날짜 범위에 따른 시작일/종료일 설정
  useEffect(() => {
    setDateRangeValues(dateRange);
  }, [dateRange]);

  // 날짜별 금액 통계 계산
  useEffect(() => {
    if (consultations.length > 0) {
      calculateAmountStatsByDate();
    }
  }, [consultations, periodType]);

  // 상담자별 금액 통계 계산
  useEffect(() => {
    if (consultations.length > 0) {
      calculateAmountStatsByConsultant();
    }
  }, [consultations, periodType]);

  // 상담 기록 가져오기
  const fetchConsultations = async (currentStartDate: string, currentEndDate: string, doctor: string = '') => {
    try {
      setLoading(true);
      
      console.log('----------- 데이터 조회 시작 -----------');
      console.log(`조회 기간: ${currentStartDate || '전체'} ~ ${currentEndDate || '전체'}`);
      if (doctor) console.log(`진단원장: ${doctor}`);
      
      // 캐시 무시 쿼리 매개변수
      const nocache = getNoCacheQuery();
      console.log('캐시 방지 키:', nocache);
      
      // 상담 정보 먼저 가져오기
      let query = supabase
        .from('patient_consultations')
        .select('*', { count: 'exact' }) // 전체 카운트 요청
        .order('consultation_date', { ascending: false });
      
      // 날짜 필터 적용 - date 타입에 맞게 단순화
      if (currentStartDate) {
        // date 타입은 YYYY-MM-DD 형식이므로 그대로 사용
        query = query.gte('consultation_date', currentStartDate);
        console.log('date 필터 적용 - 시작일:', currentStartDate);
      }
      
      if (currentEndDate) {
        // date 타입에서 종료일을 포함하려면 다음 날짜보다 작은 조건 사용
        const nextDay = moment(currentEndDate).add(1, 'days').format('YYYY-MM-DD');
        query = query.lt('consultation_date', nextDay);
        console.log('date 필터 적용 - 종료일(다음날):', nextDay);
      }
      
      // 진단원장 필터 적용
      if (doctor) {
        query = query.eq('doctor', doctor);
        console.log('진단원장 필터 적용:', doctor);
      }
      
      // 실제 쿼리 로그
      console.log('실행되는 쿼리 조건:', {
        table: 'patient_consultations',
        startDate: currentStartDate || 'none',
        endDate: currentEndDate ? moment(currentEndDate).add(1, 'days').format('YYYY-MM-DD') : 'none',
        nocache: nocache, // 캐시 방지 쿼리 파라미터 추가
        doctor: doctor // 진단원장 필터 추가
      });
      
      // 콘솔에 전체 SQL 유사 쿼리 표시 (디버깅용)
      console.log(`SQL 유사 쿼리: SELECT * FROM patient_consultations WHERE ${
        currentStartDate ? `consultation_date >= '${currentStartDate}'` : '1=1'
      } AND ${
        currentEndDate ? `consultation_date < '${moment(currentEndDate).add(1, 'days').format('YYYY-MM-DD')}'` : '1=1'
      } ORDER BY consultation_date DESC`);
      
      // 쿼리 실행 - 캐시 옵션 적용
      const { data: consultationsData, error: consultationsError, count: totalCount } = await query;
      
      console.log('쿼리 결과 데이터 수:', consultationsData?.length || 0, '전체 카운트:', totalCount);
      
      if (consultationsError) {
        console.error('조회 오류 발생:', consultationsError);
        throw consultationsError;
      }
      
      if (consultationsData && consultationsData.length > 0) {
        console.log('첫 번째 데이터 날짜 형식 확인:', 
          consultationsData[0].consultation_date, 
          typeof consultationsData[0].consultation_date
        );
        
        // 원본 데이터 수 기록
        setTotalDataCount(totalCount || consultationsData.length);
        
        // 서버 측 필터링이 이미 적용되었으므로 클라이언트 필터링은 생략
        // 하지만 간단한 검증은 수행 (문제 진단용)
        let filteredConsultations = consultationsData;
        setFilteredDataCount(consultationsData.length);
        
        // 날짜 범위 샘플 데이터 확인 (최대 5개)
        if (consultationsData.length > 0) {
          console.log('조회된 날짜 샘플 (최대 5개):');
          consultationsData.slice(0, 5).forEach((consultation, index) => {
            console.log(`${index+1}: ${consultation.consultation_date}`);
          });
        }
        
        // 모든 환자 ID 추출
        const patientIds = [...new Set(filteredConsultations.map(c => c.patient_id))];
        
        // 환자 정보 별도로 가져오기 (캐시 방지 적용)
        console.log('환자 정보 조회 시작');
        const { data: patientsData, error: patientsError } = await supabase
          .from('patient_questionnaire')
          .select('resident_id, name, phone')
          .in('resident_id', patientIds);
          
        if (patientsError) {
          console.error('환자 정보 불러오기 실패:', patientsError);
          // 환자 정보를 가져오지 못해도 상담 정보는 표시
          setConsultations(filteredConsultations);
        } else {
          console.log('가져온 환자 정보:', patientsData?.length, '건');
          
          // 환자 정보와 상담 정보 결합
          const patientsMap = new Map();
          patientsData?.forEach(patient => {
            patientsMap.set(patient.resident_id, patient);
          });
          
          const finalData = filteredConsultations.map(consultation => {
            const patientInfo = patientsMap.get(consultation.patient_id);
            return {
              ...consultation,
              patient_name: patientInfo?.name || '-',
              patient_phone: patientInfo?.phone || '-'
            };
          });
          
          setConsultations(finalData);
        }
      } else {
        setConsultations([]);
        setFilteredDataCount(0);
        setTotalDataCount(0);
      }
      
      // 결과 할당 및 상태 업데이트
      setConsultations(consultationsData || []);
      
      // 진단원장 통계 계산
      if (consultationsData && consultationsData.length > 0) {
        calculateDoctorStats(consultationsData);
      }
      
      // 모든 진단원장 데이터를 가져오는 쿼리 (필터링 없이)
      if (allDoctors.length === 0) {
        const { data: allConsultationsData } = await supabase
          .from('patient_consultations')
          .select('doctor')
          .order('doctor');
          
        if (allConsultationsData && allConsultationsData.length > 0) {
          fetchAllDoctors(allConsultationsData);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('상담 기록 불러오기 실패:', error);
      setError('상담 기록을 불러오는 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  // 상담자별 통계 계산
  const calculateConsultantStats = () => {
    // 모든 상담자 목록 추출
    const consultants = [...new Set(consultations.map(c => c.consultant))].filter(Boolean);
    
    // 상담자별 통계 계산
    const stats: ConsultantStats[] = consultants.map(consultant => {
      // 해당 상담자의 상담 기록만 필터링
      const consultantRecords = consultations.filter(c => c.consultant === consultant);
      
      // 신환/구환 수 계산
      const newPatients = consultantRecords.filter(c => c.patient_type === '신환').length;
      const existingPatients = consultantRecords.filter(c => c.patient_type === '구환').length;
      
      // 동의 결과별 수 계산
      const fullConsent = consultantRecords.filter(c => c.consultation_result === '전체동의').length;
      const partialConsent = consultantRecords.filter(c => c.consultation_result === '부분동의').length;
      const noConsent = consultantRecords.filter(c => c.consultation_result === '비동의').length;
      const pending = consultantRecords.filter(c => c.consultation_result === '보류').length;
      const refund = consultantRecords.filter(c => c.consultation_result === '환불').length;
      
      // 동의율 계산 (전체동의 + 부분동의) / 전체 상담 수
      const totalDecided = fullConsent + partialConsent + noConsent; // 결정된 상담만 계산 (보류, 환불 제외)
      const consentRate = totalDecided > 0 
        ? ((fullConsent + partialConsent) / totalDecided) * 100 
        : 0;
      
      return {
        consultant,
        totalConsultations: consultantRecords.length,
        newPatients,
        existingPatients,
        fullConsent,
        partialConsent,
        noConsent,
        pending,
        refund,
        consentRate
      };
    });
    
    // 상담 건수 기준 내림차순 정렬
    stats.sort((a, b) => b.totalConsultations - a.totalConsultations);
    
    setConsultantStats(stats);
  };

  // 날짜 범위 설정
  const setDateRangeValues = (range: DateRange) => {
    // 한국 시간 기준으로 설정
    const todayStr = dateUtils.getKoreanToday();
    console.log('현재 한국 날짜:', todayStr);
    
    switch (range) {
      case 'all':
        setStartDate('');
        setEndDate('');
        break;
        
      case 'today':
        setStartDate(todayStr);
        setEndDate(todayStr);
        break;
        
      case 'yesterday': {
        const now = moment().tz('Asia/Seoul');
        const yesterday = now.clone().subtract(1, 'days');
        const yesterdayStr = yesterday.format('YYYY-MM-DD');
        setStartDate(yesterdayStr);
        setEndDate(yesterdayStr);
        break;
      }
        
      case 'thisWeek': {
        setStartDate(dateUtils.getFirstDayOfWeek());
        setEndDate(todayStr);
        break;
      }
        
      case 'lastWeek': {
        // 지난 주 월요일과 일요일
        const now = moment().tz('Asia/Seoul');
        const dayOfWeek = now.day() || 7;
        const lastWeekSunday = now.clone().subtract(dayOfWeek, 'days');
        const lastWeekMonday = lastWeekSunday.clone().subtract(6, 'days');
        setStartDate(lastWeekMonday.format('YYYY-MM-DD'));
        setEndDate(lastWeekSunday.format('YYYY-MM-DD'));
        break;
      }
        
      case 'thisMonth': {
        setStartDate(dateUtils.getFirstDayOfMonth());
        setEndDate(todayStr);
        break;
      }
        
      case 'lastMonth': {
        // 지난 달 1일부터 말일까지
        const now = moment().tz('Asia/Seoul');
        const firstDayOfLastMonth = now.clone().subtract(1, 'month').date(1);
        const lastDayOfLastMonth = now.clone().date(1).subtract(1, 'day');
        setStartDate(firstDayOfLastMonth.format('YYYY-MM-DD'));
        setEndDate(lastDayOfLastMonth.format('YYYY-MM-DD'));
        break;
      }
        
      default:
        break;
    }
  };

  // 날짜 포맷 변환
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return dateUtils.formatToKoreanDateText(dateStr);
  };

  // 퍼센트 포맷 변환
  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // 선택된 상담자 변경 핸들러
  const handleConsultantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedConsultant(e.target.value);
  };

  // 날짜 범위 변경 핸들러
  const handleDateRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDateRange(e.target.value as DateRange);
    // 자동 새로고침 코드 제거
  };

  // 커스텀 날짜 변경 핸들러
  const handleCustomDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'startDate') {
      setStartDate(value);
    } else if (name === 'endDate') {
      setEndDate(value);
    }
    // 자동 새로고침 코드 제거
  };

  // 날짜 범위 표시
  const getDateRangeDisplay = () => {
    if (dateRange === 'all') {
      return '전체 기간';
    } else if (dateRange === 'custom') {
      return `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
    } else if (startDate && endDate) {
      return `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
    }
    return '';
  };

  // 클라이언트 측에서의 날짜 필터링 적용 함수 제거
  // 이 함수는 더 이상 사용되지 않으므로 제거합니다
  
  // 필터 초기화 핸들러 - 문제 발생 시 강제 새로고침
  const handleResetFilter = () => {
    // 상태 초기화
    setConsultations([]);
    setFilteredDataCount(0);
    setTotalDataCount(0);
    
    // 캐시 없이 현재 설정된 필터로 데이터 다시 가져오기
    setTimeout(() => {
      fetchConsultations(startDate, endDate, selectedDoctor);
    }, 100);
  };
  
  // 날짜별 금액 통계 계산 함수
  const calculateAmountStatsByDate = () => {
    // 일별/주별/월별에 따른 데이터 준비
    if (periodType === 'daily') {
      // 일별 데이터 (1일~31일)
      const dailyStats: DateAmountStats[] = [];
      
      // 한국 시간 기준 현재 달의 일수 구하기
      const now = moment().tz('Asia/Seoul');
      const currentYear = now.year();
      const currentMonth = now.month();
      const daysInMonth = moment().tz('Asia/Seoul').daysInMonth();
      
      // 1일부터 현재 달의 마지막 일까지 데이터 생성
      for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = moment().tz('Asia/Seoul').year(currentYear).month(currentMonth).date(day);
        const dateStr = dateObj.format('YYYY-MM-DD');
        
        // 해당 날짜의 상담 기록 필터링
        const dayRecords = consultations.filter(c => {
          if (!c.consultation_date) return false;
          return c.consultation_date.startsWith(dateStr);
        });
        
        // 금액 합산
        const consultationAmount = dayRecords.reduce((sum, record) => 
          sum + (typeof record.consultation_amount === 'number' ? record.consultation_amount : 0), 0);
        
        const paymentAmount = dayRecords.reduce((sum, record) => 
          sum + (typeof record.payment_amount === 'number' ? record.payment_amount : 0), 0);
        
        dailyStats.push({
          date: `${day}일`,
          amounts: {
            diagnosis: 0,
            consultation: consultationAmount,
            payment: paymentAmount,
            remaining: consultationAmount - paymentAmount
          },
          target: DAILY_TARGET,
          achievementRate: paymentAmount / DAILY_TARGET * 100
        });
      }
      
      setDateAmountStats(dailyStats);
    } 
    else if (periodType === 'weekly') {
      // 주별 데이터 (1주~4주)
      const weeklyStats: DateAmountStats[] = [];
      
      // 각 주차별 데이터 생성
      for (let week = 1; week <= 4; week++) {
        // 해당 주차에 속하는 상담 기록 필터링 (간단한 구현을 위해 임의로 날짜 범위 지정)
        // 1주: 1-7일, 2주: 8-14일, 3주: 15-21일, 4주: 22-31일
        const startDay = (week - 1) * 7 + 1;
        const endDay = week === 4 ? 31 : week * 7;
        
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        // 해당 주차의 상담 기록 필터링
        const weekRecords = consultations.filter(c => {
          if (!c.consultation_date) return false;
          const day = parseInt(c.consultation_date.split('-')[2], 10);
          return day >= startDay && day <= endDay && 
                 c.consultation_date.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`);
        });
        
        // 금액 합산
        const consultationAmount = weekRecords.reduce((sum, record) => 
          sum + (typeof record.consultation_amount === 'number' ? record.consultation_amount : 0), 0);
        
        const paymentAmount = weekRecords.reduce((sum, record) => 
          sum + (typeof record.payment_amount === 'number' ? record.payment_amount : 0), 0);
        
        weeklyStats.push({
          date: `${week}주차`,
          amounts: {
            diagnosis: 0,
            consultation: consultationAmount,
            payment: paymentAmount,
            remaining: consultationAmount - paymentAmount
          },
          target: WEEKLY_TARGET,
          achievementRate: paymentAmount / WEEKLY_TARGET * 100
        });
      }
      
      setDateAmountStats(weeklyStats);
    } 
    else {
      // 월별 데이터 (최근 12개월)
      const monthlyStats: DateAmountStats[] = [];
      
      // 현재 달로부터 11개월 전까지의 데이터 생성
      const now = new Date();
      
      for (let i = 11; i >= 0; i--) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth();
        
        // 해당 월의 상담 기록 필터링
        const monthRecords = consultations.filter(c => {
          if (!c.consultation_date) return false;
          const [year, month] = c.consultation_date.split('-').map(n => parseInt(n, 10));
          return year === targetYear && month === targetMonth + 1; // DB는 1-12월, JS는 0-11월
        });
        
        // 금액 합산
        const consultationAmount = monthRecords.reduce((sum, record) => 
          sum + (typeof record.consultation_amount === 'number' ? record.consultation_amount : 0), 0);
        
        const paymentAmount = monthRecords.reduce((sum, record) => 
          sum + (typeof record.payment_amount === 'number' ? record.payment_amount : 0), 0);
        
        monthlyStats.push({
          date: `${targetYear}.${targetMonth + 1}`,
          amounts: {
            diagnosis: 0,
            consultation: consultationAmount,
            payment: paymentAmount,
            remaining: consultationAmount - paymentAmount
          },
          target: MONTHLY_TARGET,
          achievementRate: paymentAmount / MONTHLY_TARGET * 100
        });
      }
      
      setDateAmountStats(monthlyStats);
    }
  };

  // 상담자별 금액 통계 계산 함수
  const calculateAmountStatsByConsultant = () => {
    // 기간 유형에 따라 상담 기록 필터링
    let filteredConsultations = [...consultations];

    if (periodType === 'daily') {
      // 일별 데이터 - 한국 시간 기준 현재 날짜의 상담만 필터링
      const today = moment().tz('Asia/Seoul').format('YYYY-MM-DD');
      
      filteredConsultations = consultations.filter(c => {
        if (!c.consultation_date) return false;
        return c.consultation_date.startsWith(today);
      });
    } 
    else if (periodType === 'weekly') {
      // 주별 데이터 - 한국 시간 기준 이번 주의 상담만 필터링
      const now = moment().tz('Asia/Seoul');
      const day = now.day() || 7; // 일요일이면 7로 변환
      const firstDayOfWeek = now.clone().subtract(day - 1, 'days'); // 이번 주 월요일
      
      const startDate = firstDayOfWeek.format('YYYY-MM-DD');
      const todayStr = now.format('YYYY-MM-DD');
      
      filteredConsultations = consultations.filter(c => {
        if (!c.consultation_date) return false;
        return c.consultation_date >= startDate && c.consultation_date <= todayStr;
      });
    }
    else {
      // 월별 데이터 - 한국 시간 기준 이번 달의 상담만 필터링
      const now = moment().tz('Asia/Seoul');
      const currentYear = now.year();
      const currentMonth = now.month() + 1; // moment는 0-11 월 사용
      
      filteredConsultations = consultations.filter(c => {
        if (!c.consultation_date) return false;
        const [year, month] = c.consultation_date.split('-').map(n => parseInt(n, 10));
        return year === currentYear && month === currentMonth;
      });
    }

    // 상담자별로 데이터 그룹화
    const consultantGroups: Record<string, ConsultationRecord[]> = {};
    
    filteredConsultations.forEach(consultation => {
      if (!consultation.consultant) return;
      
      if (!consultantGroups[consultation.consultant]) {
        consultantGroups[consultation.consultant] = [];
      }
      
      consultantGroups[consultation.consultant].push(consultation);
    });

    // 상담자별 금액 통계 계산
    const stats: ConsultantAmountStats[] = Object.keys(consultantGroups)
      .filter(Boolean)
      .map(consultant => {
        const records = consultantGroups[consultant];
        
        const diagnosisAmount = records.reduce((sum, record) => 
          sum + (typeof record.diagnosis_amount === 'number' ? record.diagnosis_amount : 0), 0);
        
        const consultationAmount = records.reduce((sum, record) => 
          sum + (typeof record.consultation_amount === 'number' ? record.consultation_amount : 0), 0);
        
        const paymentAmount = records.reduce((sum, record) => 
          sum + (typeof record.payment_amount === 'number' ? record.payment_amount : 0), 0);
        
        const remainingAmount = consultationAmount - paymentAmount;
        
        return {
          consultant,
          amounts: {
            diagnosis: diagnosisAmount,
            consultation: consultationAmount,
            payment: paymentAmount,
            remaining: remainingAmount
          }
        };
      });

    // 금액 기준 내림차순 정렬
    stats.sort((a, b) => b.amounts.payment - a.amounts.payment);
    
    setConsultantAmountStats(stats);
  };

  // 금액 표시 포맷 (천 단위 콤마)
  const formatAmount = (amount: number) => {
    return `${amount.toLocaleString()}원`;
  };

  // 기간 유형 변경 핸들러
  const handlePeriodTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPeriodType(e.target.value as 'daily' | 'weekly' | 'monthly');
  };

  // 진단원장 통계 계산 함수 추가
  const calculateDoctorStats = (data: ConsultationRecord[]) => {
    // 모든 진단원장 목록 추출
    const doctors = [...new Set(data.map(c => c.doctor))].filter(Boolean);
    
    // 진단원장별 통계 계산
    const stats = doctors.map(doctor => {
      // 해당 진단원장의 상담 기록 수
      const count = data.filter(c => c.doctor === doctor).length;
      
      return {
        doctor,
        count
      };
    });
    
    // 상담 건수 기준 내림차순 정렬
    stats.sort((a, b) => b.count - a.count);
    
    setDoctorStats(stats);
  };

  // 선택된 진단원장 변경 핸들러
  const handleDoctorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDoctor(e.target.value);
  };

  // 모든 진단원장 목록 계산 함수 추가
  const fetchAllDoctors = (data: any[]) => {
    // 모든 진단원장 목록 추출
    const doctors = [...new Set(data.map(c => c.doctor))].filter(Boolean);
    
    // 진단원장별 통계 계산
    const stats = doctors.map(doctor => {
      // 해당 진단원장의 상담 기록 수
      const count = data.filter(c => c.doctor === doctor).length;
      
      return {
        doctor,
        count
      };
    });
    
    // 상담 건수 기준 내림차순 정렬
    stats.sort((a, b) => b.count - a.count);
    
    setAllDoctors(stats);
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
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">상담 통계</h1>
        <button
          onClick={() => navigate('/')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          <span>환자 목록으로 돌아가기</span>
        </button>
      </div>

      {/* 필터 섹션 */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">상담자 선택</label>
            <select
              value={selectedConsultant}
              onChange={handleConsultantChange}
              className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="">전체 상담자</option>
              {consultantStats.map(stat => (
                <option key={stat.consultant} value={stat.consultant}>
                  {stat.consultant} ({stat.totalConsultations}건)
                </option>
              ))}
            </select>
          </div>
          
          {/* 진단원장 선택 필터 추가 */}
          <div>
            <label className="block text-sm font-medium mb-1">진단원장 선택</label>
            <select
              value={selectedDoctor}
              onChange={handleDoctorChange}
              className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="">전체 진단원장</option>
              {allDoctors.length > 0 ? allDoctors.map(stat => (
                <option key={stat.doctor} value={stat.doctor}>
                  {stat.doctor} ({stat.count}건)
                </option>
              )) :
              doctorStats.map(stat => (
                <option key={stat.doctor} value={stat.doctor}>
                  {stat.doctor} ({stat.count}건)
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">기간 선택</label>
            <select
              value={dateRange}
              onChange={handleDateRangeChange}
              className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="all">전체 기간</option>
              <option value="today">오늘</option>
              <option value="yesterday">어제</option>
              <option value="thisWeek">이번 주</option>
              <option value="lastWeek">지난 주</option>
              <option value="thisMonth">이번 달</option>
              <option value="lastMonth">지난 달</option>
              <option value="custom">직접 선택</option>
            </select>
          </div>
          
          {dateRange === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1">시작일</label>
                <input
                  type="date"
                  name="startDate"
                  value={startDate}
                  onChange={handleCustomDateChange}
                  className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">종료일</label>
                <input
                  type="date"
                  name="endDate"
                  value={endDate}
                  onChange={handleCustomDateChange}
                  className="w-full p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
            </div>
          )}
          
          <div className="md:col-span-3">
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {getDateRangeDisplay()} 데이터 기준
                {filteredDataCount > 0 && (
                  <span className="ml-2 text-indigo-600 dark:text-indigo-400">
                    (필터링됨: {filteredDataCount}/{totalDataCount}건)
                  </span>
                )}
              </p>
              <button
                onClick={handleResetFilter}
                className="px-4 py-2 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700 transition-colors ml-2 flex items-center gap-2"
                title="기간 필터 적용"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                <span>기간 필터 적용</span>
              </button>
              {/* 개발용 테스트 버튼 제거 */}
            </div>
          </div>
        </div>
      </div>

      {/* 전체 통계 요약 */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">전체 통계 요약</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">전체 상담</h3>
            <p className="text-2xl font-bold">{consultations.length}건</p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
            <h3 className="text-sm font-medium text-green-800 dark:text-green-300">동의율</h3>
            <p className="text-2xl font-bold">
              {formatPercent(
                consultations.length > 0
                  ? (consultations.filter(c => c.consultation_result === '전체동의' || c.consultation_result === '부분동의').length / 
                     consultations.filter(c => c.consultation_result !== '보류' && c.consultation_result !== '환불').length) * 100
                  : 0
              )}
            </p>
          </div>
          
          <div className="bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg">
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">신환 비율</h3>
            <p className="text-2xl font-bold">
              {formatPercent(
                consultations.length > 0
                  ? (consultations.filter(c => c.patient_type === '신환').length / consultations.length) * 100
                  : 0
              )}
            </p>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/30 p-3 rounded-lg">
            <h3 className="text-sm font-medium text-purple-800 dark:text-purple-300">전체동의 비율</h3>
            <p className="text-2xl font-bold">
              {formatPercent(
                consultations.length > 0
                  ? (consultations.filter(c => c.consultation_result === '전체동의').length / 
                     consultations.filter(c => c.consultation_result !== '보류' && c.consultation_result !== '환불').length) * 100
                  : 0
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 상담자별 통계 */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">상담자별 통계</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 dark:border-gray-700">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="p-2 border border-gray-300 dark:border-gray-700">상담자</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">전체 상담</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">신환</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">구환</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">전체동의</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">부분동의</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">비동의</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">보류</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">환불</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">동의율</th>
              </tr>
            </thead>
            <tbody>
              {consultantStats
                .filter(stat => !selectedConsultant || stat.consultant === selectedConsultant)
                .map((stat) => (
                <tr key={stat.consultant} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="p-2 border border-gray-300 dark:border-gray-700 font-medium">{stat.consultant}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center">{stat.totalConsultations}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center">{stat.newPatients}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center">{stat.existingPatients}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center bg-green-50 dark:bg-green-900/20">{stat.fullConsent}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center bg-lime-50 dark:bg-lime-900/20">{stat.partialConsent}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center bg-red-50 dark:bg-red-900/20">{stat.noConsent}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center bg-gray-50 dark:bg-gray-800">{stat.pending}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center bg-orange-50 dark:bg-orange-900/20">{stat.refund}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-center font-medium">
                    {formatPercent(stat.consentRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 상담 결과별 분석 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">상담 결과 분포</h2>
          <div className="space-y-3">
            {['전체동의', '부분동의', '비동의', '보류', '환불'].map(result => {
              const count = consultations.filter(c => c.consultation_result === result).length;
              const percentage = consultations.length > 0 
                ? (count / consultations.length) * 100 
                : 0;
              
              let bgClass = 'bg-gray-200 dark:bg-gray-700';
              
              switch (result) {
                case '전체동의':
                  bgClass = 'bg-green-500';
                  break;
                case '부분동의':
                  bgClass = 'bg-lime-500';
                  break;
                case '비동의':
                  bgClass = 'bg-red-500';
                  break;
                case '보류':
                  bgClass = 'bg-gray-500';
                  break;
                case '환불':
                  bgClass = 'bg-orange-500';
                  break;
              }
              
              return (
                <div key={result}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">{result}</span>
                    <span className="text-sm">{count}건 ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div 
                      className={`${bgClass} h-2.5 rounded-full`} 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">신환/구환 비율</h2>
          <div className="space-y-3">
            {['신환', '구환'].map(patientType => {
              const count = consultations.filter(c => c.patient_type === patientType).length;
              const percentage = consultations.length > 0 
                ? (count / consultations.length) * 100 
                : 0;
              
              const bgClass = patientType === '신환' ? 'bg-blue-500' : 'bg-purple-500';
              
              return (
                <div key={patientType}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">{patientType}</span>
                    <span className="text-sm">{count}건 ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div 
                      className={`${bgClass} h-2.5 rounded-full`} 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-8">
            <h3 className="text-lg font-medium mb-3">진단원장별 상담 건수</h3>
            <div className="space-y-3">
              {[...new Set(consultations.map(c => c.doctor))]
                .filter(Boolean)
                .map(doctor => {
                  const count = consultations.filter(c => c.doctor === doctor).length;
                  const percentage = consultations.length > 0 
                    ? (count / consultations.length) * 100 
                    : 0;
                  
                  return (
                    <div key={doctor}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">{doctor}</span>
                        <span className="text-sm">{count}건 ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div 
                          className="bg-teal-500 h-2.5 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* 미동의/부분동의 환자 관리 */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">미동의/부분동의 환자 관리</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 dark:border-gray-700">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="p-2 border border-gray-300 dark:border-gray-700">상담일자</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">환자ID</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">환자이름</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">환자연락처</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">진단원장</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">상담자</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">상담결과</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">진단금액</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">상담금액</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">비동의금액</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">비동의 사유</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">상세보기</th>
              </tr>
            </thead>
            <tbody>
              {consultations
                .filter(c => c.consultation_result === '비동의' || c.consultation_result === '부분동의')
                .filter(c => !selectedConsultant || c.consultant === selectedConsultant)
                .slice(0, 10)  // 최근 10건만 표시
                .map((consultation) => (
                <tr key={consultation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="p-2 border border-gray-300 dark:border-gray-700">
                    {consultation.consultation_date
                      ? new Date(consultation.consultation_date).toLocaleDateString()
                      : ''}
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700">
                    {consultation.patient_id}
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700">
                    {consultation.patient_name || '-'}
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700">
                    {consultation.patient_phone || '-'}
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700">
                    {consultation.doctor}
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700">
                    {consultation.consultant}
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 font-medium">
                    <span className={consultation.consultation_result === '비동의' ? 'text-red-500' : 'text-amber-500'}>
                      {consultation.consultation_result}
                    </span>
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700">
                    {typeof consultation.diagnosis_amount === 'number'
                      ? consultation.diagnosis_amount.toLocaleString() + '원'
                      : consultation.diagnosis_amount || '-'}
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700">
                    {typeof consultation.consultation_amount === 'number'
                      ? consultation.consultation_amount.toLocaleString() + '원'
                      : consultation.consultation_amount || '-'}
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 font-medium text-red-500">
                    {(typeof consultation.diagnosis_amount === 'number' && typeof consultation.consultation_amount === 'number')
                      ? (consultation.diagnosis_amount - consultation.consultation_amount).toLocaleString() + '원'
                      : '-'}
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 max-w-xs truncate">
                    {consultation.non_consent_reason || '-'}
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700">
                    <button
                      onClick={() => navigate(`/consultation/${consultation.patient_id}?consultationId=${consultation.id}`)}
                      className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-2 rounded"
                    >
                      상세보기
                    </button>
                  </td>
                </tr>
              ))}
              {consultations.filter(c => c.consultation_result === '비동의' || c.consultation_result === '부분동의').length === 0 && (
                <tr>
                  <td colSpan={12} className="p-4 text-center">미동의/부분동의 환자가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 금액 통계 섹션 - 기간별 */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">기간별 금액 통계</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {periodType === 'daily' ? '일별 목표: 2,000만원' : 
               periodType === 'weekly' ? '주별 목표: 1억원' : 
               '월별 목표: 4억원'}
            </span>
            <select
              value={periodType}
              onChange={handlePeriodTypeChange}
              className="p-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="daily">일별</option>
              <option value="weekly">주별</option>
              <option value="monthly">월별</option>
            </select>
          </div>
        </div>
        
        {dateAmountStats.length > 0 ? (
          <div className="grid grid-cols-10 gap-6">
            <div className="col-span-6 h-80">
              <h3 className="text-lg font-medium mb-3 text-center">
                {periodType === 'daily' ? '일별 수납/상담금액' : 
                 periodType === 'weekly' ? '주별 수납/상담금액' : 
                 '월별 수납/상담금액'}
              </h3>
              <Bar 
                data={{
                  labels: dateAmountStats.map(stat => stat.date),
                  datasets: [
                    {
                      type: 'line' as const,
                      label: '목표 금액',
                      data: dateAmountStats.map(() => 
                        periodType === 'daily' ? DAILY_TARGET : 
                        periodType === 'weekly' ? WEEKLY_TARGET : 
                        MONTHLY_TARGET
                      ),
                      borderColor: 'rgba(255, 0, 0, 1)',
                      backgroundColor: 'transparent',
                      borderWidth: 3,
                      borderDash: [8, 4],
                      fill: false,
                      pointRadius: 0,
                      pointHoverRadius: 0,
                      order: 0,
                      datalabels: {
                        display: false
                      }
                    },
                    {
                      label: '상담금액',
                      data: dateAmountStats.map(stat => stat.amounts.consultation),
                      backgroundColor: 'rgba(255, 205, 86, 0.7)',
                      borderColor: 'rgba(255, 205, 86, 1)',
                      borderWidth: 1,
                      datalabels: {
                        display: false
                      }
                    },
                    {
                      label: '수납금액',
                      data: dateAmountStats.map(stat => stat.amounts.payment),
                      backgroundColor: 'rgba(75, 192, 192, 0.7)',
                      borderColor: 'rgba(75, 192, 192, 1)',
                      borderWidth: 1,
                      datalabels: {
                        display: false
                      }
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: {
                      grid: {
                        display: false
                      }
                    },
                    y: {
                      beginAtZero: true,
                      stacked: false,
                      ticks: {
                        // @ts-ignore
                        callback: function(value) {
                          return value.toLocaleString() + '원';
                        }
                      },
                      // 목표 금액과 상담금액 중 큰 값의 1.2배를 최대값으로 설정
                      max: Math.max(
                        periodType === 'daily' ? DAILY_TARGET : 
                        periodType === 'weekly' ? WEEKLY_TARGET : 
                        MONTHLY_TARGET,
                        ...dateAmountStats.map(stat => stat.amounts.consultation)
                      ) * 1.2
                    }
                  },
                  plugins: {
                    tooltip: {
                      callbacks: {
                        // @ts-ignore
                        label: function(context) {
                          const label = context.dataset.label || '';
                          const value = context.raw as number;
                          const formattedValue = value.toLocaleString() + '원';
                          
                          if (label === '수납금액') {
                            const targetAmount = periodType === 'daily' ? DAILY_TARGET : 
                                               periodType === 'weekly' ? WEEKLY_TARGET : 
                                               MONTHLY_TARGET;
                            const percentage = Math.round((value / targetAmount) * 100);
                            return `${label}: ${formattedValue} (목표의 ${percentage}%)`;
                          } else if (label === '목표 금액') {
                            return `${label}: ${formattedValue}`;
                          } else if (label === '상담금액') {
                            const consultationAmount = dateAmountStats[context.dataIndex].amounts.consultation;
                            const paymentAmount = dateAmountStats[context.dataIndex].amounts.payment;
                            const percentage = consultationAmount > 0 ? Math.round((paymentAmount / consultationAmount) * 100) : 0;
                            return `${label}: ${formattedValue} (수납율: ${percentage}%)`;
                          }
                          return `${label}: ${formattedValue}`;
                        }
                      }
                    },
                    legend: {
                      position: 'bottom',
                      display: true,
                      labels: {
                        font: {
                          size: 10
                        },
                        boxWidth: 12
                      }
                    },
                    datalabels: {
                      display: false
                    },
                    title: {
                      display: true,
                      text: periodType === 'daily' ? '* 일별 목표: 2,000만원' : 
                            periodType === 'weekly' ? '* 주별 목표: 1억원' : 
                            '* 월별 목표: 4억원',
                      position: 'bottom',
                      padding: {
                        top: 10,
                        bottom: 0
                      },
                      font: {
                        size: 12,
                        style: 'italic'
                      }
                    }
                  },
                  barPercentage: 0.7,
                  categoryPercentage: 0.8
                }}
              />
            </div>
            
            <div className="col-span-4 h-80">
              <h3 className="text-lg font-medium mb-3 text-center">
                {periodType === 'daily' ? '일별 상담자별 목표 달성률' : 
                 periodType === 'weekly' ? '주별 상담자별 목표 달성률' : 
                 '월별 상담자별 목표 달성률'}
              </h3>
              <Bar 
                data={{
                  labels: consultantAmountStats.map(stat => stat.consultant),
                  datasets: [
                    {
                      label: '수납금액',
                      data: consultantAmountStats.map(stat => stat.amounts.payment),
                      backgroundColor: 'rgba(75, 192, 192, 0.7)',
                      borderColor: 'rgba(75, 192, 192, 1)',
                      borderWidth: 1,
                      datalabels: {
                        align: 'end',
                        anchor: 'end',
                        color: 'white',
                        font: {
                          weight: 'bold',
                          size: 10
                        },
                        formatter: (value: number) => {
                          const target = periodType === 'daily' ? CONSULTANT_DAILY_TARGET : 
                                      periodType === 'weekly' ? CONSULTANT_WEEKLY_TARGET : 
                                      CONSULTANT_MONTHLY_TARGET;
                          const percentage = Math.round((value / target) * 100);
                          return `${value.toLocaleString()}원\n(${percentage}%)`;
                        }
                      }
                    },
                    {
                      label: '목표 잔여금액',
                      data: consultantAmountStats.map(stat => {
                        const target = periodType === 'daily' ? CONSULTANT_DAILY_TARGET : 
                                      periodType === 'weekly' ? CONSULTANT_WEEKLY_TARGET : 
                                      CONSULTANT_MONTHLY_TARGET;
                        return Math.max(0, target - stat.amounts.payment);
                      }),
                      backgroundColor: 'rgba(220, 220, 220, 0.5)',
                      borderColor: 'rgba(220, 220, 220, 0.8)',
                      borderWidth: 1,
                      datalabels: {
                        display: false
                      }
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: 'y',
                  scales: {
                    x: {
                      stacked: true,
                      ticks: {
                        // @ts-ignore
                        callback: function(value) {
                          return value.toLocaleString() + '원';
                        }
                      },
                      max: periodType === 'daily' ? CONSULTANT_DAILY_TARGET : 
                           periodType === 'weekly' ? CONSULTANT_WEEKLY_TARGET : 
                           CONSULTANT_MONTHLY_TARGET // 목표금액 설정
                    },
                    y: {
                      stacked: true,
                      ticks: {
                        font: {
                          weight: 'bold'
                        }
                      }
                    }
                  },
                  plugins: {
                    tooltip: {
                      callbacks: {
                        // @ts-ignore
                        label: function(context) {
                          const label = context.dataset.label || '';
                          const value = context.raw as number;
                          const formattedValue = value.toLocaleString() + '원';
                          
                          if (label === '수납금액') {
                            const target = periodType === 'daily' ? CONSULTANT_DAILY_TARGET : 
                                         periodType === 'weekly' ? CONSULTANT_WEEKLY_TARGET : 
                                         CONSULTANT_MONTHLY_TARGET;
                            const percentage = Math.round((value / target) * 100);
                            return `${label}: ${formattedValue} (목표의 ${percentage}%)`;
                          }
                          
                          return `${label}: ${formattedValue}`;
                        },
                        // @ts-ignore
                        afterLabel: function(context) {
                          const label = context.dataset.label || '';
                          if (label === '수납금액') {
                            const target = periodType === 'daily' ? CONSULTANT_DAILY_TARGET : 
                                         periodType === 'weekly' ? CONSULTANT_WEEKLY_TARGET : 
                                         CONSULTANT_MONTHLY_TARGET;
                            return `목표금액: ${target.toLocaleString()}원`;
                          }
                          return '';
                        }
                      }
                    },
                    legend: {
                      position: 'bottom',
                      display: true,
                      labels: {
                        font: {
                          size: 10
                        },
                        boxWidth: 12
                      }
                    },
                    title: {
                      display: true,
                      text: periodType === 'daily' ? '일별 목표금액: 500만원' : 
                            periodType === 'weekly' ? '주별 목표금액: 2,500만원' : 
                            '월별 목표금액: 1억원',
                      position: 'bottom',
                      padding: {
                        top: 10,
                        bottom: 0
                      },
                      font: {
                        size: 12,
                        style: 'italic'
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            데이터가 없습니다.
          </div>
        )}
      </div>

      {/* 금액 통계 섹션 - 상담자별 */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">상담자별 금액 통계</h2>
        
        {consultantAmountStats.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-80">
              <Bar 
                data={{
                  labels: consultantAmountStats.map(stat => stat.consultant),
                  datasets: [
                    {
                      label: '상담금액',
                      data: consultantAmountStats.map(stat => stat.amounts.consultation),
                      backgroundColor: 'rgba(255, 159, 64, 0.5)',
                      datalabels: {
                        align: 'end',
                        anchor: 'end',
                        color: 'white',
                        font: {
                          weight: 'bold',
                          size: 10
                        },
                        formatter: (value: number) => value > 0 ? value.toLocaleString() : ''
                      }
                    },
                    {
                      label: '수납금액',
                      data: consultantAmountStats.map(stat => stat.amounts.payment),
                      backgroundColor: 'rgba(75, 192, 192, 0.5)',
                      datalabels: {
                        align: 'end',
                        anchor: 'end',
                        color: 'white',
                        font: {
                          weight: 'bold',
                          size: 10
                        },
                        formatter: (value: number) => value > 0 ? value.toLocaleString() : ''
                      }
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        // @ts-ignore
                        callback: function(value) {
                          return value.toLocaleString() + '원';
                        }
                      }
                    }
                  },
                  plugins: {
                    tooltip: {
                      callbacks: {
                        // @ts-ignore
                        label: function(context) {
                          return `${context.dataset.label}: ${parseInt(context.raw as string).toLocaleString()}원`;
                        }
                      }
                    },
                    legend: {
                      position: 'bottom',
                      display: true,
                      labels: {
                        font: {
                          size: 10
                        },
                        boxWidth: 12
                      }
                    }
                  }
                }}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-80 relative">
                <h5 className="text-center font-bold text-lg absolute w-full py-1 bottom-10 left-0 right-0 text-gray-800 dark:text-white z-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">상담금액 비율</h5>
                <Pie
                  data={{
                    labels: consultantAmountStats.map(stat => stat.consultant),
                    datasets: [
                      {
                        data: consultantAmountStats.map(stat => stat.amounts.consultation),
                        backgroundColor: [
                          'rgba(255, 99, 132, 0.6)',
                          'rgba(54, 162, 235, 0.6)',
                          'rgba(255, 206, 86, 0.6)',
                          'rgba(75, 192, 192, 0.6)',
                          'rgba(153, 102, 255, 0.6)',
                          'rgba(255, 159, 64, 0.6)',
                          'rgba(199, 199, 199, 0.6)'
                        ],
                        borderColor: [
                          'rgba(255, 99, 132, 1)',
                          'rgba(54, 162, 235, 1)',
                          'rgba(255, 206, 86, 1)',
                          'rgba(75, 192, 192, 1)',
                          'rgba(153, 102, 255, 1)',
                          'rgba(255, 159, 64, 1)',
                          'rgba(199, 199, 199, 1)'
                        ],
                        borderWidth: 1,
                        datalabels: {
                          color: 'white',
                          font: {
                            weight: 'bold',
                            size: 10
                          },
                          formatter: (value: number, context: any) => {
                            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${value.toLocaleString()}원\n(${percentage}%)`;
                          }
                        }
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        display: true,
                        labels: {
                          font: {
                            size: 10
                          },
                          boxWidth: 12
                        }
                      },
                      tooltip: {
                        callbacks: {
                          // @ts-ignore
                          label: function(context) {
                            const value = context.raw as number;
                            const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${context.label}: ${value.toLocaleString()}원 (${percentage}%)`;
                          }
                        },
                        title: {
                          display: true,
                          text: '상담금액 비율',
                          font: {
                            size: 16,
                            weight: 'bold'
                          },
                          color: '#333',
                          padding: {
                            top: 10,
                            bottom: 10
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
              
              <div className="h-80 relative">
                <h5 className="text-center font-bold text-lg absolute w-full py-1 bottom-10 left-0 right-0 text-gray-800 dark:text-white z-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">수납금액 비율</h5>
                <Pie
                  data={{
                    labels: consultantAmountStats.map(stat => stat.consultant),
                    datasets: [
                      {
                        data: consultantAmountStats.map(stat => stat.amounts.payment),
                        backgroundColor: [
                          'rgba(255, 99, 132, 0.6)',
                          'rgba(54, 162, 235, 0.6)',
                          'rgba(255, 206, 86, 0.6)',
                          'rgba(75, 192, 192, 0.6)',
                          'rgba(153, 102, 255, 0.6)',
                          'rgba(255, 159, 64, 0.6)',
                          'rgba(199, 199, 199, 0.6)'
                        ],
                        borderColor: [
                          'rgba(255, 99, 132, 1)',
                          'rgba(54, 162, 235, 1)',
                          'rgba(255, 206, 86, 1)',
                          'rgba(75, 192, 192, 1)',
                          'rgba(153, 102, 255, 1)',
                          'rgba(255, 159, 64, 1)',
                          'rgba(199, 199, 199, 1)'
                        ],
                        borderWidth: 1,
                        datalabels: {
                          color: 'white',
                          font: {
                            weight: 'bold',
                            size: 10
                          },
                          formatter: (value: number, context: any) => {
                            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${value.toLocaleString()}원\n(${percentage}%)`;
                          }
                        }
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        display: true,
                        labels: {
                          font: {
                            size: 10
                          },
                          boxWidth: 12
                        }
                      },
                      tooltip: {
                        callbacks: {
                          // @ts-ignore
                          label: function(context) {
                            const value = context.raw as number;
                            const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${context.label}: ${value.toLocaleString()}원 (${percentage}%)`;
                          }
                        },
                        title: {
                          display: true,
                          text: '수납금액 비율',
                          font: {
                            size: 16,
                            weight: 'bold'
                          },
                          color: '#333',
                          padding: {
                            top: 10,
                            bottom: 10
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            데이터가 없습니다.
          </div>
        )}
        
        {/* 상담자별 금액 통계 표 */}
        <div className="mt-8 overflow-x-auto">
          <table className="min-w-full border border-gray-300 dark:border-gray-700">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="p-2 border border-gray-300 dark:border-gray-700">상담자</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">진단금액</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">상담금액</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">수납금액</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">남은금액</th>
              </tr>
            </thead>
            <tbody>
              {consultantAmountStats.map((stat) => (
                <tr key={stat.consultant} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="p-2 border border-gray-300 dark:border-gray-700 font-medium">{stat.consultant}</td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-right">
                    {formatAmount(stat.amounts.diagnosis)}
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-right bg-orange-50 dark:bg-orange-900/20">
                    {formatAmount(stat.amounts.consultation)}
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-right bg-emerald-50 dark:bg-emerald-900/20">
                    {formatAmount(stat.amounts.payment)}
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 text-right bg-red-50 dark:bg-red-900/20">
                    {formatAmount(stat.amounts.remaining)}
                  </td>
                </tr>
              ))}
              
              {/* 총계 행 */}
              <tr className="bg-gray-200 dark:bg-gray-700 font-bold">
                <td className="p-2 border border-gray-300 dark:border-gray-700">총계</td>
                <td className="p-2 border border-gray-300 dark:border-gray-700 text-right">
                  {formatAmount(consultantAmountStats.reduce((sum, stat) => sum + stat.amounts.diagnosis, 0))}
                </td>
                <td className="p-2 border border-gray-300 dark:border-gray-700 text-right">
                  {formatAmount(consultantAmountStats.reduce((sum, stat) => sum + stat.amounts.consultation, 0))}
                </td>
                <td className="p-2 border border-gray-300 dark:border-gray-700 text-right">
                  {formatAmount(consultantAmountStats.reduce((sum, stat) => sum + stat.amounts.payment, 0))}
                </td>
                <td className="p-2 border border-gray-300 dark:border-gray-700 text-right">
                  {formatAmount(consultantAmountStats.reduce((sum, stat) => sum + stat.amounts.remaining, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ConsultationDashboard; 