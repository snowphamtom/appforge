import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { appforgeGenerateApi } from './server/viteGeneratePlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), appforgeGenerateApi()],
  // GH Pages (snowphamtom.github.io/appforge) needs a subpath; local/dev stays at /
  base: process.env.GITHUB_PAGES === '1' ? '/appforge/' : '/',
})
