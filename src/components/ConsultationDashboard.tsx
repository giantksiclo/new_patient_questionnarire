import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
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
  ArcElement
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

// Chart.js 컴포넌트 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
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
  const [dateRange, setDateRange] = useState<DateRange>('thisMonth');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [dateAmountStats, setDateAmountStats] = useState<DateAmountStats[]>([]);
  const [consultantAmountStats, setConsultantAmountStats] = useState<ConsultantAmountStats[]>([]);
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  // 상담 기록 가져오기
  useEffect(() => {
    fetchConsultations();
  }, [dateRange, startDate, endDate]);

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
  }, [consultations]);

  // 상담 기록 가져오기
  const fetchConsultations = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('patient_consultations')
        .select('*')
        .order('consultation_date', { ascending: false });
      
      // 날짜 필터 적용
      if (startDate) {
        query = query.gte('consultation_date', startDate);
      }
      
      if (endDate) {
        query = query.lte('consultation_date', endDate);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      if (data) {
        setConsultations(data);
      }
    } catch (error) {
      console.error('상담 기록 불러오기 실패:', error);
      setError('상담 기록을 불러오는 중 오류가 발생했습니다.');
    } finally {
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
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
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
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        setStartDate(yesterdayStr);
        setEndDate(yesterdayStr);
        break;
      }
        
      case 'thisWeek': {
        const firstDayOfWeek = new Date(today);
        const day = today.getDay() || 7; // 일요일이면 7로 변환
        firstDayOfWeek.setDate(today.getDate() - (day - 1)); // 이번 주 월요일
        setStartDate(firstDayOfWeek.toISOString().split('T')[0]);
        setEndDate(todayStr);
        break;
      }
        
      case 'lastWeek': {
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(today.getDate() - today.getDay() - 1); // 지난 주 일요일
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6); // 지난 주 월요일
        setStartDate(lastWeekStart.toISOString().split('T')[0]);
        setEndDate(lastWeekEnd.toISOString().split('T')[0]);
        break;
      }
        
      case 'thisMonth': {
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(firstDayOfMonth.toISOString().split('T')[0]);
        setEndDate(todayStr);
        break;
      }
        
      case 'lastMonth': {
        const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        setStartDate(firstDayOfLastMonth.toISOString().split('T')[0]);
        setEndDate(lastDayOfLastMonth.toISOString().split('T')[0]);
        break;
      }
        
      default:
        break;
    }
  };

  // 날짜 포맷 변환
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
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
  };

  // 커스텀 날짜 변경 핸들러
  const handleCustomDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'startDate') {
      setStartDate(value);
    } else if (name === 'endDate') {
      setEndDate(value);
    }
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

  // 날짜별 금액 통계 계산 함수
  const calculateAmountStatsByDate = () => {
    // 날짜 그룹화 기준 설정
    const getGroupKey = (date: Date) => {
      if (periodType === 'daily') {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (periodType === 'weekly') {
        // 주의 시작일(월요일)을 키로 사용
        const dayOfWeek = date.getDay() || 7; // 일요일(0)을 7로 변환
        const monday = new Date(date);
        monday.setDate(date.getDate() - (dayOfWeek - 1));
        return monday.toISOString().split('T')[0];
      } else {
        // 월 단위 그룹화
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
    };

    // 날짜 표시 포맷 설정
    const formatGroupKey = (key: string) => {
      if (periodType === 'daily') {
        const date = new Date(key);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      } else if (periodType === 'weekly') {
        const date = new Date(key);
        return `${date.getMonth() + 1}/${date.getDate()} 주`;
      } else {
        const [year, month] = key.split('-');
        return `${year}년 ${month}월`;
      }
    };

    // 날짜별로 데이터 그룹화
    const dateGroups: Record<string, ConsultationRecord[]> = {};
    
    consultations.forEach(consultation => {
      if (!consultation.consultation_date) return;
      
      const date = new Date(consultation.consultation_date);
      const groupKey = getGroupKey(date);
      
      if (!dateGroups[groupKey]) {
        dateGroups[groupKey] = [];
      }
      
      dateGroups[groupKey].push(consultation);
    });

    // 날짜별 금액 통계 계산
    const stats: DateAmountStats[] = Object.keys(dateGroups)
      .sort()
      .map(key => {
        const records = dateGroups[key];
        const displayDate = formatGroupKey(key);
        
        const diagnosisAmount = records.reduce((sum, record) => 
          sum + (typeof record.diagnosis_amount === 'number' ? record.diagnosis_amount : 0), 0);
        
        const consultationAmount = records.reduce((sum, record) => 
          sum + (typeof record.consultation_amount === 'number' ? record.consultation_amount : 0), 0);
        
        const paymentAmount = records.reduce((sum, record) => 
          sum + (typeof record.payment_amount === 'number' ? record.payment_amount : 0), 0);
        
        const remainingAmount = consultationAmount - paymentAmount;
        
        return {
          date: displayDate,
          amounts: {
            diagnosis: diagnosisAmount,
            consultation: consultationAmount,
            payment: paymentAmount,
            remaining: remainingAmount
          }
        };
      });

    // 최근 6개 기간만 표시 (역순으로 정렬된 배열에서 앞의 6개 추출하고 다시 역순으로)
    const recentStats = [...stats].reverse().slice(0, 6).reverse();
    setDateAmountStats(recentStats);
  };

  // 상담자별 금액 통계 계산 함수
  const calculateAmountStatsByConsultant = () => {
    // 상담자별로 데이터 그룹화
    const consultantGroups: Record<string, ConsultationRecord[]> = {};
    
    consultations.forEach(consultation => {
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
    stats.sort((a, b) => b.amounts.consultation - a.amounts.consultation);
    
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
        <h1 className="text-2xl font-bold">상담 통계 대시보드</h1>
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {getDateRangeDisplay()} 데이터 기준
            </p>
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
                <th className="p-2 border border-gray-300 dark:border-gray-700">진단원장</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">상담자</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">상담결과</th>
                <th className="p-2 border border-gray-300 dark:border-gray-700">진단금액</th>
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
                      : consultation.diagnosis_amount}
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700 max-w-xs truncate">
                    {consultation.non_consent_reason || '-'}
                  </td>
                  <td className="p-2 border border-gray-300 dark:border-gray-700">
                    <button
                      onClick={() => navigate(`/consultation/${consultation.patient_id}`)}
                      className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-2 rounded"
                    >
                      상세보기
                    </button>
                  </td>
                </tr>
              ))}
              {consultations.filter(c => c.consultation_result === '비동의' || c.consultation_result === '부분동의').length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center">미동의/부분동의 환자가 없습니다.</td>
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
        
        {dateAmountStats.length > 0 ? (
          <div className="h-80">
            <Bar 
              data={{
                labels: dateAmountStats.map(stat => stat.date),
                datasets: [
                  {
                    label: '진단금액',
                    data: dateAmountStats.map(stat => stat.amounts.diagnosis),
                    backgroundColor: 'rgba(53, 162, 235, 0.5)',
                    borderColor: 'rgba(53, 162, 235, 0.8)',
                    borderWidth: 1
                  },
                  {
                    label: '상담금액',
                    data: dateAmountStats.map(stat => stat.amounts.consultation),
                    backgroundColor: 'rgba(255, 159, 64, 0.5)',
                    borderColor: 'rgba(255, 159, 64, 0.8)',
                    borderWidth: 1
                  },
                  {
                    label: '수납금액',
                    data: dateAmountStats.map(stat => stat.amounts.payment),
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 0.8)',
                    borderWidth: 1
                  },
                  {
                    label: '남은금액',
                    data: dateAmountStats.map(stat => stat.amounts.remaining),
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    borderColor: 'rgba(255, 99, 132, 0.8)',
                    borderWidth: 1
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
                      callback: function(value) {
                        return value.toLocaleString() + '원';
                      }
                    }
                  }
                },
                plugins: {
                  tooltip: {
                    callbacks: {
                      label: function(context) {
                        return `${context.dataset.label}: ${parseInt(context.raw as string).toLocaleString()}원`;
                      }
                    }
                  },
                  legend: {
                    position: 'bottom'
                  }
                }
              }}
            />
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
                    },
                    {
                      label: '수납금액',
                      data: consultantAmountStats.map(stat => stat.amounts.payment),
                      backgroundColor: 'rgba(75, 192, 192, 0.5)',
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
                        callback: function(value) {
                          return value.toLocaleString() + '원';
                        }
                      }
                    }
                  },
                  plugins: {
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          return `${context.dataset.label}: ${parseInt(context.raw as string).toLocaleString()}원`;
                        }
                      }
                    },
                    legend: {
                      position: 'bottom'
                    }
                  }
                }}
              />
            </div>
            
            <div className="h-80">
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
                      borderWidth: 1
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const value = context.raw as number;
                          const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                          const percentage = Math.round((value / total) * 100);
                          return `${context.label}: ${value.toLocaleString()}원 (${percentage}%)`;
                        }
                      }
                    },
                    title: {
                      display: true,
                      text: '상담금액 비율'
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