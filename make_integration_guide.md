# Make.com 통합 가이드

## 개요

이 가이드는 Supabase의 메시지 생성 시스템과 Make.com을 통합하여 자동화된 메시지 생성 워크플로우를 설정하는 방법을 설명합니다.

## 필요한 것

1. Supabase 계정 및 프로젝트
2. Make.com 계정
3. Supabase에서 설정된 `message_generation` 테이블

## Make.com 시나리오 설정 단계

### 1. 웹훅 트리거 설정하기

1. Make.com에서 새 시나리오 생성
2. 첫 번째 모듈로 "Webhooks" > "Custom webhook" 선택
3. "Add webhook" 버튼 클릭, 웹훅에 의미있는 이름 부여
4. 생성된 웹훅 URL 복사 (예: `https://hook.make.com/yourwebhookurl`)
5. Supabase SQL 에디터에서 해당 URL을 `webhook_setup.sql` 파일의 `'https://hook.make.com/yourwebhookurl'` 부분에 붙여넣기 하여 업데이트

### 2. Supabase API 연결 설정

1. Make.com에서 "Connections" > "Add connection" > "Supabase" 선택
2. 다음 정보 입력:
   - Connection name: 접속 이름 (예: "Dental Clinic Supabase")
   - Project URL: Supabase 프로젝트 URL (예: `https://yourproject.supabase.co`)
   - API Key: Supabase 서비스 롤 API 키 (Settings > API > Project API keys에서 찾을 수 있음)
3. "Save" 클릭

### 3. AI 메시지 생성 시나리오 구성

다음과 같은 시나리오를 구성합니다:

1. **웹훅 트리거** - Supabase에서 전송된 데이터 수신
   - 웹훅이 트리거되면 전달받은 JSON 데이터에서 `message_id`, `patient_id`, `consultation_id` 정보 추출

2. **Supabase 모듈 추가** - 환자 및 상담 정보 가져오기
   - 작업: "Run query"
   - Query: 
   ```sql
   SELECT * FROM message_generation_view 
   WHERE id = {{1.json.message_id}}
   ```

3. **HTTP 모듈 추가** - AI 모델에 메시지 생성 요청
   - 작업: "Make a request"
   - URL: AI 제공자의 API 엔드포인트 (예: OpenAI API 엔드포인트)
   - 메서드: POST
   - 헤더: 
     - Content-Type: application/json
     - Authorization: Bearer YOUR_API_KEY
   - 바디: JSON 형식으로 환자 정보, 상담 정보 포함
   ```json
   {
     "model": "gpt-4",
     "messages": [
       {
         "role": "system",
         "content": "당신은 치과 클리닉의 환자에게 보내는 메시지를 작성하는 전문가입니다. 아래 정보를 바탕으로 환자에게 맞춤화된 메시지를 작성해주세요."
       },
       {
         "role": "user",
         "content": "환자 이름: {{2.patient_name}}\n상담 일자: {{2.consultation_date}}\n상담 결과: {{2.consultation_result}}\n의사: {{2.doctor}}\n다음 방문 정보: {{2.next_treatment_date}} {{2.next_treatment_time}}\n치료 내용: {{2.treatments}}\n\n이 환자에게 적절한 사후 관리 메시지와 다음 방문 안내 메시지를 작성해주세요. 상담 결과가 '{{2.consultation_result}}'인 점을 고려하여 메시지를 작성해주세요."
       }
     ],
     "temperature": 0.7
   }
   ```

4. **JSON 파싱 모듈** - AI 응답에서 메시지 추출
   - 작업: "Parse JSON"
   - JSON 문자열: 3단계의 응답
   - 경로: choices[0].message.content

5. **Supabase 모듈 추가** - 생성된 메시지 업데이트
   - 작업: "Run query"
   - Query: 
   ```sql
   UPDATE message_generation
   SET 
     custom_message = '{{4.파싱된메시지}}',
     message_generated_at = NOW()
   WHERE id = {{1.json.message_id}}
   ```

### 4. 테스트 및 배포

1. "Run once" 버튼을 클릭하여 시나리오 테스트
2. 테스트가 성공적으로 완료되면 시나리오 활성화
3. 필요한 경우 스케줄링 설정 (예: 15분마다 실행)

## 문제 해결

- 웹훅이 트리거되지 않는 경우:
  - Supabase 트리거가 올바르게 설정되었는지 확인
  - Supabase의 pg_net 확장이 활성화되었는지 확인

- 메시지가 생성되지 않는 경우:
  - AI 제공자의 API 키와 권한 확인
  - 요청 형식과 응답 처리 확인

## 참고

- 이 가이드는 기본적인 통합 과정만 설명하며, 실제 구현에서는 추가적인 오류 처리 및 보안 조치가 필요할 수 있습니다.
- AI 모델 제공자에 따라 요청 형식과 응답 처리 방법이 달라질 수 있습니다. 