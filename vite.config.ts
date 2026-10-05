import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'API_PROXY_')
  const target = process.env.API_PROXY_TARGET || env.API_PROXY_TARGET || 'http://localhost:8888'
  if (!['http:', 'https:'].includes(new URL(target).protocol)) {
    throw new Error('API_PROXY_TARGET must be an HTTP(S) URL')
  }
  return {
    cacheDir: path.resolve(__dirname, 'node_modules/.vite', mode),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: 'localhost',
      port: 3001,
      strictPort: true,
      proxy: mode === 'browser-fixtures' || mode === 'browser-google'
        ? undefined
        : { '/api/v1': { target, changeOrigin: true } },
    },
  }
})
