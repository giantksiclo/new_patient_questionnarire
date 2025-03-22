import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import moment from 'moment-timezone';
import Header from './Header';

type ConsultationRecord = {
  id: number;
  created_at: string;
  last_modified_at?: string;
  consultation_date: string;
  patient_id: string;
  patient_name: string;
  patient_phone?: string;
  doctor?: string;
  consultant: string;
  consultation_content: string;
  treatment_status: string;
  consultation_result?: string;
  diagnosis_amount?: number;
  consultation_amount?: number;
  non_consent_reason?: string;
};

const RecentConsultations = () => {
  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});
  const [consultantList, setConsultantList] = useState<string[]>([]);
  const [selectedConsultant, setSelectedConsultant] = useState<string>('');
  
  // 표 드래그 관련 상태와 ref 추가
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    fetchRecentConsultations();
  }, []);
  
  // 마우스 드래그 관련 핸들러
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tableContainerRef.current) return;
    
    setIsDragging(true);
    setStartX(e.pageX - tableContainerRef.current.offsetLeft);
    setStartY(e.pageY - tableContainerRef.current.offsetTop);
    setScrollLeft(tableContainerRef.current.scrollLeft);
    setScrollTop(tableContainerRef.current.scrollTop);
    
    tableContainerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !tableContainerRef.current) return;
    
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const y = e.pageY - tableContainerRef.current.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    
    tableContainerRef.current.scrollLeft = scrollLeft - walkX;
    tableContainerRef.current.scrollTop = scrollTop - walkY;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (tableContainerRef.current) {
      tableContainerRef.current.style.cursor = 'grab';
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      if (tableContainerRef.current) {
        tableContainerRef.current.style.cursor = 'grab';
      }
    }
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const fetchRecentConsultations = async () => {
    try {
      setLoading(true);
      setError(null);

      // 최근 60일 내의 상담 기록 가져오기 (더 많은 데이터를 위해 기간 확장)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const formattedDate = sixtyDaysAgo.toISOString().split('T')[0];

      // 상담 기록 가져오기 (최근 60일, 모든 데이터)
      const { data, error } = await supabase
        .from('patient_consultations')
        .select('*')
        .gte('consultation_date', formattedDate);

      if (error) {
        throw error;
      }

      console.log(`가져온, 상담 기록 수: ${data.length}개`);

      // 환자 ID 목록 추출
      const patientIds = data.map(item => item.patient_id).filter(Boolean);
      const uniquePatientIds = [...new Set(patientIds)];

      // 상담자 목록 추출
      const consultants = [...new Set(data.map(item => item.consultant).filter(Boolean))];
      setConsultantList(consultants);

      // 환자 이름 가져오기
      if (uniquePatientIds.length > 0) {
        const { data: patientData, error: patientError } = await supabase
          .from('patient_questionnaire')
          .select('resident_id, name, phone')
          .in('resident_id', uniquePatientIds);

        if (patientError) {
          console.error('환자 정보 조회 오류:', patientError);
        } else if (patientData) {
          // 환자 ID를 키로, 이름을 값으로 하는 객체 생성
          const names: Record<string, string> = {};
          const phones: Record<string, string> = {};
          patientData.forEach(patient => {
            names[patient.resident_id] = patient.name;
            phones[patient.resident_id] = patient.phone;
          });
          setPatientNames(names);
          
          // 상담 기록에 환자 이름과 전화번호 추가
          const enhancedData = data.map(item => ({
            ...item,
            patient_name: names[item.patient_id] || '',
            patient_phone: phones[item.patient_id] || ''
          }));
          
          // last_modified_at이 있으면 그 값을, 없으면 created_at을 기준으로 내림차순 정렬
          const sortedData = enhancedData.sort((a, b) => {
            // 수정일을 기준으로 정렬 (없으면 생성일 기준)
            const aDate = a.last_modified_at || a.created_at;
            const bDate = b.last_modified_at || b.created_at;
            
            if (!aDate && !bDate) return 0;
            if (!aDate) return 1; // a의 날짜가 없으면 b가 앞으로
            if (!bDate) return -1; // b의 날짜가 없으면 a가 앞으로
            
            return new Date(bDate).getTime() - new Date(aDate).getTime(); // 내림차순 정렬
          });

          setConsultations(sortedData);
        }
      } else {
        setConsultations([]);
      }
    } catch (error) {
      console.error('최근 상담 목록 가져오기 오류:', error);
      setError('상담 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 필터링된 상담 목록
  const filteredConsultations = useMemo(() => {
    // 정렬된 데이터를 필터링
    const filtered = consultations.filter(item => {
      const searchableValues = [
        item.patient_name || patientNames[item.patient_id] || '',
        item.patient_id || '',
        item.consultant || '',
        item.consultation_content || '',
        item.treatment_status || ''
      ].filter(Boolean);
      
      const searchableText = searchableValues.join(' ').toLowerCase();
      const textMatch = searchableText.includes(filterText.toLowerCase());
      
      // 상담자 필터링
      const consultantMatch = !selectedConsultant || item.consultant === selectedConsultant;
      
      return textMatch && consultantMatch;
    });

    // 추가로 정렬 확인
    const sorted = [...filtered].sort((a, b) => {
      const aDate = a.last_modified_at || a.created_at;
      const bDate = b.last_modified_at || b.created_at;
      
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      
      // 내림차순 정렬 (최신이 먼저 오도록)
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
    
    // 최대 10개로 제한
    return sorted.slice(0, 30);
  }, [consultations, filterText, patientNames, selectedConsultant]);

  // 날짜 형식화 함수
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return moment(dateString).format('YYYY-MM-DD');
  };

  // 날짜 및 시간 형식화 함수 추가 (한국 시간으로 표시)
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return moment(dateString).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');
  };

  // last_modified_at과 created_at 중 사용된 값을 반환하는 함수
  const getUsedDate = (consultation: ConsultationRecord) => {
    return consultation.last_modified_at || consultation.created_at;
  };

  // 상담 목록 테이블 컴포넌트
  const ConsultationTable = ({ consultations, title, maxCount }: { consultations: ConsultationRecord[], title: string, maxCount?: number }) => (
    <div className="mb-10">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="text-sm text-gray-600 mb-2">
        총 {consultations.length}개 표시 {maxCount ? `(최대 ${maxCount}개)` : ''}
      </div>
      {consultations.length > 0 ? (
        <div className="overflow-x-auto border border-gray-300 dark:border-gray-700 rounded-lg">
          <div className="max-h-[420px] overflow-y-auto">
            <table className="min-w-full bg-white dark:bg-gray-800">
              <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700 z-10 shadow-sm">
                <tr className="text-gray-700 dark:text-gray-300">
                  <th className="py-2 px-4 border-b">최종 업데이트</th>
                  <th className="py-2 px-4 border-b">상담 날짜</th>
                  <th className="py-2 px-4 border-b">환자 ID</th>
                  <th className="py-2 px-4 border-b">환자명</th>
                  <th className="py-2 px-4 border-b">상담자</th>
                  <th className="py-2 px-4 border-b">상담결과</th>
                  <th className="py-2 px-4 border-b">진단금액</th>
                  <th className="py-2 px-4 border-b">상담금액</th>
                  <th className="py-2 px-4 border-b">치료진행상황</th>
                  <th className="py-2 px-4 border-b">상세보기</th>
                </tr>
              </thead>
              <tbody>
                {consultations.map((consultation) => (
                  <tr key={consultation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="py-2 px-4 border-b border-gray-300 dark:border-gray-700">
                      {formatDateTime(getUsedDate(consultation))}
                      <div className="text-xs text-gray-500">
                        {consultation.last_modified_at ? '수정됨' : '생성됨'}
                      </div>
                    </td>
                    <td className="py-2 px-4 border-b border-gray-300 dark:border-gray-700">
                      {formatDate(consultation.consultation_date)}
                    </td>
                    <td className="py-2 px-4 border-b border-gray-300 dark:border-gray-700">
                      {consultation.patient_id || '-'}
                    </td>
                    <td className="py-2 px-4 border-b border-gray-300 dark:border-gray-700">
                      {patientNames[consultation.patient_id] || '-'}
                    </td>
                    <td className="py-2 px-4 border-b border-gray-300 dark:border-gray-700">
                      {consultation.consultant || '-'}
                    </td>
                    <td className="py-2 px-4 border-b border-gray-300 dark:border-gray-700 font-medium">
                      <span className={
                        consultation.consultation_result === '비동의' 
                          ? 'text-red-500' 
                          : consultation.consultation_result === '부분동의'
                            ? 'text-amber-500'
                            : consultation.consultation_result === '보류'
                              ? 'text-blue-500'
                              : consultation.consultation_result === '전체동의'
                                ? 'text-green-500'
                                : ''
                      }>
                        {consultation.consultation_result || '-'}
                      </span>
                    </td>
                    <td className="py-2 px-4 border-b border-gray-300 dark:border-gray-700 text-right">
                      {typeof consultation.diagnosis_amount === 'number'
                        ? consultation.diagnosis_amount.toLocaleString() + '원'
                        : consultation.diagnosis_amount || '-'}
                    </td>
                    <td className="py-2 px-4 border-b border-gray-300 dark:border-gray-700 text-right">
                      {typeof consultation.consultation_amount === 'number'
                        ? consultation.consultation_amount.toLocaleString() + '원'
                        : consultation.consultation_amount || '-'}
                    </td>
                    <td className="py-2 px-4 border-b border-gray-300 dark:border-gray-700">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        ['보류', '비동의', '부분동의'].includes(consultation.consultation_result || '')
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : consultation.treatment_status === '중단 중' 
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                            : consultation.treatment_status === '종결' 
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {['보류', '비동의', '부분동의'].includes(consultation.consultation_result || '')
                          ? consultation.non_consent_reason || consultation.consultation_result 
                          : consultation.treatment_status || '치료중'}
                      </span>
                    </td>
                    <td className="py-2 px-4 border-b border-gray-300 dark:border-gray-700">
                      <Link 
                        to={`/consultation/${consultation.patient_id}?consultationId=${consultation.id}`}
                        state={{ fromRecentConsultations: true }}
                        className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        상세보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-center rounded-md border border-gray-200 dark:border-gray-700">
          데이터가 없습니다.
        </div>
      )}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <Header showTestDataButton={false} pageTitle="최근상담목록" />

      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[250px]">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">검색어</label>
          <input
            type="text"
            placeholder="환자명, 상담자, 내용 등으로 검색"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
        </div>

        <div className="w-full md:w-48">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">상담자 필터</label>
          <select
            value={selectedConsultant}
            onChange={(e) => setSelectedConsultant(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            <option value="">모든 상담자</option>
            {consultantList.map(consultant => (
              <option key={consultant} value={consultant}>{consultant}</option>
            ))}
          </select>
        </div>

        <div>
          <button
            onClick={fetchRecentConsultations}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-md"
            disabled={loading}
          >
            {loading ? '로딩 중...' : '새로고침'}
          </button>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        전체 {consultations.length}개 중 필터링됨 {filteredConsultations.length > 30 ? '30' : filteredConsultations.length}개
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <>
          {/* 최근 상담 목록 */}
          <ConsultationTable consultations={filteredConsultations} title="최근 상담 목록 - 30개" maxCount={30} />
          
          {/* 비동의/부분동의/보류 환자 관리 */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md mb-6">
            <div className="flex items-center mb-4">
              <h2 className="text-xl font-semibold">비동의/부분동의/보류 환자 관리</h2>
            </div>
            <div 
              ref={tableContainerRef}
              className="overflow-x-auto select-none" 
              style={{ 
                maxHeight: '600px', 
                overflowY: 'auto',
                cursor: 'grab',
                userSelect: 'none'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={isDragging ? handleMouseMove : undefined}
              onMouseLeave={handleMouseLeave}
            >
              <table className="min-w-full border border-gray-300 dark:border-gray-700">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="p-2 border border-gray-300 dark:border-gray-700">상세</th>
                    <th className="p-2 border border-gray-300 dark:border-gray-700">최종 업데이트</th>
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
                  </tr>
                </thead>
                <tbody>
                  {consultations
                    .filter(c => c.consultation_result === '비동의' || c.consultation_result === '부분동의' || c.consultation_result === '보류')
                    .filter(c => !selectedConsultant || c.consultant === selectedConsultant)
                    .map((consultation) => (
                    <tr key={consultation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="p-2 border border-gray-300 dark:border-gray-700">
                        <Link 
                          to={`/consultation/${consultation.patient_id}?consultationId=${consultation.id}`}
                          className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-2 rounded inline-block"
                        >
                          상세
                        </Link>
                      </td>
                      <td className="p-2 border border-gray-300 dark:border-gray-700">
                        {formatDateTime(getUsedDate(consultation))}
                        <div className="text-xs text-gray-500">
                          {consultation.last_modified_at ? '수정됨' : '생성됨'}
                        </div>
                      </td>
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
                        {consultation.doctor || '-'}
                      </td>
                      <td className="p-2 border border-gray-300 dark:border-gray-700">
                        {consultation.consultant}
                      </td>
                      <td className="p-2 border border-gray-300 dark:border-gray-700 font-medium">
                        <span className={
                          consultation.consultation_result === '비동의' 
                            ? 'text-red-500' 
                            : consultation.consultation_result === '부분동의'
                              ? 'text-amber-500'
                              : 'text-blue-500'
                        }>
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
                    </tr>
                  ))}
                  {consultations.filter(c => c.consultation_result === '비동의' || c.consultation_result === '부분동의' || c.consultation_result === '보류').length === 0 && (
                    <tr>
                      <td colSpan={13} className="p-4 text-center">비동의/부분동의/보류 환자가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RecentConsultations; 