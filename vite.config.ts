import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'API_PROXY_')
  const target = env.API_PROXY_TARGET || 'http://localhost:8888'
  if (!['http:', 'https:'].includes(new URL(target).protocol)) {
    throw new Error('API_PROXY_TARGET must be an HTTP(S) URL')
  }
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: 'localhost',
      port: 3001,
      strictPort: true,
      proxy: { '/api/v1': { target, changeOrigin: true } },
    },
  }
})
