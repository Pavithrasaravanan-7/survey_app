import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://survey-app-7h98.onrender.com',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
