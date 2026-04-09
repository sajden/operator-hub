import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '..')
const hubTarget = process.env.OPERATOR_HUB_URL ?? 'http://127.0.0.1:8787'
const rawAppBase = process.env.OPERATOR_HUB_APP_BASE ?? '/operatorhub-app/'
const appBase = rawAppBase === '/' ? '/' : rawAppBase.endsWith('/') ? rawAppBase : `${rawAppBase}/`

export default defineConfig({
  base: appBase,
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    fs: {
      allow: [repoRoot]
    },
    proxy: {
      '/api': {
        target: hubTarget,
        changeOrigin: true
      }
    }
  }
})
