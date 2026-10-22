import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // En dev, /api est redirigé vers l'API Express locale (npm run dev:api)
    proxy: {
      '/api': 'http://localhost:3001',
    },
  }
})
