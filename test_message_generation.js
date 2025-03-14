// 메시지 생성 기능 테스트 스크립트
// Supabase 클라이언트 초기화 (브라우저 환경에서 실행)

const testMessageGeneration = async () => {
  try {
    // 1. 테스트할 환자 ID와 상담 ID 설정
    const patientId = "주민등록번호"; // 실제 테스트할 환자 주민등록번호로 변경
    const consultationId = 1; // 실제 테스트할 상담 ID로 변경
    
    console.log(`메시지 생성 테스트 시작: 환자ID=${patientId}, 상담ID=${consultationId}`);
    
    // 2. 환자 데이터 확인
    const { data: patientData, error: patientError } = await supabase
      .from('patient_questionnaire')
      .select('*')
      .eq('resident_id', patientId)
      .single();
      
    if (patientError) {
      console.error('환자 데이터 조회 오류:', patientError);
      return;
    }
    
    console.log('환자 데이터:', patientData);
    
    // 3. 상담 데이터 확인
    const { data: consultationData, error: consultationError } = await supabase
      .from('patient_consultations')
      .select('*')
      .eq('id', consultationId)
      .single();
      
    if (consultationError) {
      console.error('상담 데이터 조회 오류:', consultationError);
      return;
    }
    
    console.log('상담 데이터:', consultationData);
    
    // 4. 메시지 생성 요청 생성
    const { data: messageData, error: messageError } = await supabase
      .from('message_generation')
      .insert([
        {
          patient_id: patientId,
          consultation_id: consultationId,
          patient_name: patientData.name,
          patient_phone: patientData.phone,
          patient_gender: patientData.gender,
          patient_birth: patientData.birthdate,
          consultation_date: consultationData.consultation_date,
          doctor: consultationData.doctor,
          consultant: consultationData.consultant,
          consultation_result: consultationData.consultation_result,
          next_visit_date: consultationData.next_treatment_date,
          next_visit_time: consultationData.next_treatment_time,
          treatments: consultationData.treatment_details,
          medical_conditions: patientData.medical_history,
          medications: patientData.medications,
          message_requested: true,
          message_requested_at: new Date().toISOString()
        }
      ])
      .select()
      .single();
      
    if (messageError) {
      console.error('메시지 생성 요청 오류:', messageError);
      return;
    }
    
    console.log('메시지 생성 요청 성공:', messageData);
    
    // 5. 메시지 생성 결과 확인 (폴링)
    console.log('메시지 생성 결과를 확인합니다. 10초마다 상태를 체크합니다...');
    
    const checkMessageStatus = async () => {
      const { data: statusData, error: statusError } = await supabase
        .from('message_generation')
        .select('*')
        .eq('id', messageData.id)
        .single();
        
      if (statusError) {
        console.error('메시지 상태 조회 오류:', statusError);
        return false;
      }
      
      console.log('현재 메시지 상태:', {
        id: statusData.id,
        requested_at: statusData.message_requested_at,
        generated_at: statusData.message_generated_at,
        custom_message: statusData.custom_message ? '메시지 생성됨' : '생성되지 않음'
      });
      
      // 메시지가 생성되었는지 확인
      if (statusData.message_generated_at && statusData.custom_message) {
        console.log('메시지 생성 완료!');
        console.log('생성된 메시지:', statusData.custom_message);
        return true;
      }
      
      return false;
    };
    
    // 최대 5번 체크 (50초)
    let checkCount = 0;
    const maxChecks = 5;
    
    const intervalId = setInterval(async () => {
      checkCount++;
      console.log(`상태 확인 시도 ${checkCount}/${maxChecks}...`);
      
      const isComplete = await checkMessageStatus();
      
      if (isComplete || checkCount >= maxChecks) {
        clearInterval(intervalId);
        if (!isComplete) {
          console.log('최대 시도 횟수에 도달했습니다. 메시지 생성이 완료되지 않았을 수 있습니다.');
        }
      }
    }, 10000); // 10초마다 체크
    
  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
  }
};

// 콘솔에서 실행하려면 아래 줄의 주석을 제거하세요
// testMessageGeneration(); 