import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Mirror the production nginx setup: the browser calls /api and /otlp,
    // which are forwarded with the prefix removed.
    proxy: {
      '/otlp': {
        target: process.env.OTLP_PROXY_TARGET ?? 'http://localhost:4318',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/otlp/, ''),
      },
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
