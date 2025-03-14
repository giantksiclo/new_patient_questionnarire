-- 메시지 생성 요청 처리 함수
CREATE OR REPLACE FUNCTION process_message_request(message_id bigint)
RETURNS json AS $$
DECLARE
  message_data record;
  result json;
BEGIN
  -- 메시지 데이터 조회
  SELECT * INTO message_data 
  FROM message_generation_view
  WHERE id = message_id;
  
  -- 데이터가 없으면 오류 반환
  IF message_data IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Message not found',
      'message_id', message_id
    );
  END IF;
  
  -- 이미 처리된 메시지인지 확인
  IF message_data.message_generated_at IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Message already processed',
      'message_id', message_id
    );
  END IF;
  
  -- 로그 기록 (디버깅용)
  INSERT INTO message_generation_logs (
    message_id,
    log_message,
    log_data
  ) VALUES (
    message_id,
    'Processing message request',
    row_to_json(message_data)
  );
  
  -- 여기서 필요한 경우 HTTP 요청을 통해 외부 API 호출
  -- Supabase에서는 pg_net 확장을 사용해야 합니다
  /* 
  SELECT http_post(
    'https://your-cloud-api-url',
    json_build_object(
      'message_id', message_data.id,
      'patient_name', message_data.patient_name,
      'patient_phone', message_data.phone,
      'consultation_result', message_data.consultation_result
    )::text,
    'application/json'
  ) INTO result;
  */
  
  -- 실제 API 호출이 아닌 경우, 성공 메시지 반환
  RETURN json_build_object(
    'success', true,
    'message', 'Message request processed successfully',
    'message_id', message_id
  );
  
  -- 예외 처리
  EXCEPTION WHEN OTHERS THEN
    -- 오류 기록
    INSERT INTO message_generation_logs (
      message_id,
      log_message,
      log_data
    ) VALUES (
      message_id,
      'Error processing message request',
      json_build_object(
        'error', SQLERRM,
        'error_detail', SQLSTATE
      )
    );
    
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE,
      'message_id', message_id
    );
END;
$$ LANGUAGE plpgsql;

-- 로그 테이블 생성 (아직 없는 경우)
CREATE TABLE IF NOT EXISTS message_generation_logs (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT REFERENCES message_generation(id),
  log_message TEXT,
  log_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 메시지 상태 업데이트 함수 (외부 시스템에서 호출할 수 있음)
CREATE OR REPLACE FUNCTION update_message_status(
  p_message_id bigint,
  p_custom_message text,
  p_next_visit_message text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  updated_record record;
BEGIN
  -- 메시지 상태 업데이트
  UPDATE message_generation
  SET 
    custom_message = p_custom_message,
    next_visit_message = p_next_visit_message,
    message_generated_at = NOW()
  WHERE id = p_message_id
  RETURNING * INTO updated_record;
  
  -- 업데이트 성공 여부 확인
  IF updated_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Message not found or not updated',
      'message_id', p_message_id
    );
  END IF;
  
  -- 로그 기록
  INSERT INTO message_generation_logs (
    message_id,
    log_message,
    log_data
  ) VALUES (
    p_message_id,
    'Message status updated',
    row_to_json(updated_record)
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Message status updated successfully',
    'message_id', p_message_id,
    'updated_at', updated_record.message_generated_at
  );
  
  -- 예외 처리
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE,
      'message_id', p_message_id
    );
END;
$$ LANGUAGE plpgsql;

-- HTTP 확장 활성화 (필요한 경우)
-- CREATE EXTENSION IF NOT EXISTS pg_net; 