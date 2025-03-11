-- 환자 상담 기록 테이블
CREATE TABLE IF NOT EXISTS patient_consultations (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  patient_id TEXT NOT NULL,
  consultation_date DATE NOT NULL,
  patient_type VARCHAR(50) CHECK (patient_type IN ('신환', '구환')),
  doctor VARCHAR(100),
  consultant VARCHAR(100),
  treatment_details TEXT,
  consultation_result VARCHAR(50) CHECK (consultation_result IN ('비동의', '부분동의', '전체동의', '보류', '환불')),
  diagnosis_amount INTEGER DEFAULT 0,
  consultation_amount INTEGER DEFAULT 0,
  payment_amount INTEGER DEFAULT 0,
  remaining_payment INTEGER DEFAULT 0,
  non_consent_reason TEXT,
  ip_count INTEGER DEFAULT 0,
  ipd_count INTEGER DEFAULT 0,
  ipb_count INTEGER DEFAULT 0,
  bg_count INTEGER DEFAULT 0,
  cr_count INTEGER DEFAULT 0,
  in_count INTEGER DEFAULT 0,
  r_count INTEGER DEFAULT 0,
  ca_count INTEGER DEFAULT 0,
  first_contact_date DATE,
  first_contact_type VARCHAR(50) CHECK (first_contact_type IN ('방문', '전화')),
  second_contact_date DATE,
  second_contact_type VARCHAR(50) CHECK (second_contact_type IN ('방문', '전화')),
  third_contact_date DATE,
  third_contact_type VARCHAR(50) CHECK (third_contact_type IN ('방문', '전화')),
  consultation_memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS patient_consultations_patient_id_idx ON patient_consultations (patient_id);
CREATE INDEX IF NOT EXISTS patient_consultations_consultation_date_idx ON patient_consultations (consultation_date);

-- RLS 활성화
ALTER TABLE patient_consultations ENABLE ROW LEVEL SECURITY;

-- 공개 접근 정책
CREATE POLICY patient_consultations_select_policy ON patient_consultations
  FOR SELECT USING (true);

-- 인증된 사용자를 위한 수정 정책
CREATE POLICY patient_consultations_insert_policy ON patient_consultations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY patient_consultations_update_policy ON patient_consultations
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY patient_consultations_delete_policy ON patient_consultations
  FOR DELETE USING (auth.role() = 'authenticated'); 