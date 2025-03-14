import React from 'react';
import { PatientQuestionnaire } from '../types';

/**
 * 주소 정보 렌더링 함수
 */
export const renderAddress = (
  value: string | null | undefined, 
  index: number, 
  isModal: boolean = false,
  expandedAddresses: Record<string, boolean> = {},
  setExpandedAddresses?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
) => {
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
          if (setExpandedAddresses) {
            setExpandedAddresses(prev => ({
              ...prev,
              [`address-${index}`]: false
            }));
          }
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
          if (setExpandedAddresses) {
            setExpandedAddresses(prev => ({
              ...prev,
              [`address-${index}`]: true
            }));
          }
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

/**
 * 불편부위 정보 렌더링 함수
 */
export const renderTreatmentArea = (
  value: string | null | undefined, 
  index: number, 
  isModal: boolean = false,
  expandedTreatmentAreas: Record<string, boolean> = {},
  setExpandedTreatmentAreas?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
) => {
  if (!value) return '-';
  
  // 쉼표로 구분하여 배열로 변환하고 각 항목의 앞뒤 공백 제거
  const areas = value.split(',').map(item => item.trim()).filter(Boolean);
  
  // 항목이 없거나 빈 문자열만 있는 경우
  if (areas.length === 0) return '-';
  
  // 모달에서는 항상 전체 내용 표시
  if (isModal) {
    return (
      <div className="flex flex-col">
        {areas.map((area, i) => (
          <span key={i}>{area}{i < areas.length - 1 ? ',' : ''}</span>
        ))}
      </div>
    );
  }
  
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
          if (setExpandedTreatmentAreas) {
            setExpandedTreatmentAreas(prev => ({
              ...prev,
              [`treatment-${index}`]: false
            }));
          }
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
          if (setExpandedTreatmentAreas) {
            setExpandedTreatmentAreas(prev => ({
              ...prev,
              [`treatment-${index}`]: true
            }));
          }
        }}
        title="펼쳐서 모든 불편부위 보기"
      >
        <div className="flex flex-col">
          <span>{areas.slice(0, 2).join(', ')} {areas.length > 2 && `+${areas.length - 2}개`}</span>
          <span className="text-sm text-gray-500">더보기 <span className="text-blue-500 text-sm">▼</span></span>
        </div>
      </div>
    );
  }
};

/**
 * 부가정보 렌더링 함수
 */
export const renderAdditionalInfo = (
  value: string | null | undefined, 
  index: number, 
  isModal: boolean = false,
  expandedAdditionalInfos: Record<string, boolean> = {},
  setExpandedAdditionalInfos?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
) => {
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
          if (setExpandedAdditionalInfos) {
            setExpandedAdditionalInfos(prev => ({
              ...prev,
              [`info-${index}`]: false
            }));
          }
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
    // 접힌 상태: 줄임 표시
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
          if (setExpandedAdditionalInfos) {
            setExpandedAdditionalInfos(prev => ({
              ...prev,
              [`info-${index}`]: true
            }));
          }
        }}
        title="펼쳐서 모든 내용 보기"
      >
        <div className="flex flex-col">
          <span>{firstLine}</span>
          {secondLine && <span>{secondLine} <span className="text-blue-500 text-sm">▼</span></span>}
        </div>
      </div>
    );
  }
}; 