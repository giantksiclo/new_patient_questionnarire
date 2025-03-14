import moment from 'moment-timezone';

/**
 * 한국 시간으로 현재 날짜를 YYYY-MM-DD 형식으로 반환합니다.
 * PostgreSQL date 타입과 호환되는 형식입니다.
 */
export const getKoreanToday = (): string => {
  return moment().tz('Asia/Seoul').format('YYYY-MM-DD');
};

/**
 * Date 객체나 날짜 문자열을 YYYY-MM-DD 형식으로 반환합니다.
 * PostgreSQL date 타입과 호환되는 형식입니다.
 */
export const formatToKoreanDate = (date: Date | string): string => {
  return moment(date).tz('Asia/Seoul').format('YYYY-MM-DD');
};

/**
 * 날짜를 YYYY년 MM월 DD일 형식으로 반환합니다.
 * 화면 표시용 형식입니다.
 */
export const formatToKoreanDateText = (date: Date | string): string => {
  if (!date) return '';
  return moment(date).format('YYYY년 MM월 DD일');
};

/**
 * 한국 시간 기준으로 현재 시간과 UTC 시간의 차이를 시간 단위로 반환합니다.
 * 이 값은 DB에 저장된 UTC 기준 날짜에 더하여 한국 시간으로 변환할 때 사용할 수 있습니다.
 */
export const getKoreanTimezoneOffset = (): number => {
  return 9; // 한국은 UTC+9
};

/**
 * UTC 기준 날짜를 한국 시간 기준으로 변환합니다.
 * 예: 2023-03-14T15:00:00Z (UTC 시간) -> 2023-03-15 (한국 날짜)
 */
export const convertUtcToKoreanDate = (utcDate: string): string => {
  return moment.utc(utcDate).tz('Asia/Seoul').format('YYYY-MM-DD');
};

/**
 * 현재 한국 시간 기준 월의 첫날을 YYYY-MM-DD 형식으로 반환합니다.
 */
export const getFirstDayOfMonth = (): string => {
  return moment().tz('Asia/Seoul').date(1).format('YYYY-MM-DD');
};

/**
 * 현재 한국 시간 기준 주의 첫날(월요일)을 YYYY-MM-DD 형식으로 반환합니다.
 */
export const getFirstDayOfWeek = (): string => {
  const now = moment().tz('Asia/Seoul');
  const dayOfWeek = now.day() || 7; // 일요일이면 7로 변환
  return now.clone().subtract(dayOfWeek - 1, 'days').format('YYYY-MM-DD');
}; 