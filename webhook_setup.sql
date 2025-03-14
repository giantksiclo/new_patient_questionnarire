-- 메시지 생성 시 웹훅 트리거 설정
CREATE OR REPLACE FUNCTION message_generation_webhook_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.message_requested = true AND OLD.message_requested IS DISTINCT FROM NEW.message_requested) THEN
    -- 여기에 웹훅 호출 로직이 들어갑니다. Supabase에서는 Edge Function을 사용하는 것이 좋습니다.
    -- 이 예제에서는 edge function을 직접 호출할 수 없으므로 생략합니다.
    -- 실제 구현에서는 pg_net 확장 등을 사용해 웹훅 호출 코드를 추가할 수 있습니다.
    
    -- 예를 들어, make.com 웹훅을 호출하는 코드는 다음과 같습니다:
    -- PERFORM http_post(
    --   'https://hook.make.com/yourwebhookurl',
    --   json_build_object('message_id', NEW.id, 'patient_id', NEW.patient_id, 'consultation_id', NEW.consultation_id),
    --   'application/json'
    -- );
    
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 설정
CREATE TRIGGER message_generation_after_insert_update_trigger
AFTER INSERT OR UPDATE ON message_generation
FOR EACH ROW
EXECUTE FUNCTION message_generation_webhook_trigger();

-- 쉬운 테스트를 위한 뷰 생성
CREATE OR REPLACE VIEW message_generation_view AS
SELECT 
  m.id,
  m.created_at,
  m.patient_id,
  m.consultation_id,
  p.name as patient_name,
  p.phone,
  c.consultation_date,
  c.doctor,
  c.consultant,
  m.consultation_result,
  m.message_requested,
  m.message_requested_at,
  m.message_generated_at,
  m.custom_message,
  m.next_visit_message
FROM 
  message_generation m
LEFT JOIN 
  patient_questionnaire p ON m.patient_id = p.resident_id
LEFT JOIN 
  patient_consultations c ON m.consultation_id = c.id
ORDER BY 
  m.created_at DESC; 