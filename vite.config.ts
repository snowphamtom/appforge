import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GH Pages (snowphamtom.github.io/appforge) needs a subpath; local/dev stays at /
  base: process.env.GITHUB_PAGES === '1' ? '/appforge/' : '/',
})
