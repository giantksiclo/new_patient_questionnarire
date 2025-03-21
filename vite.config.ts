import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/new_patient_questionnarire/',
  plugins: [react()],
  // 기타 설정...
})
