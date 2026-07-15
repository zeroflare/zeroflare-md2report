import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages project site: https://zeroflare.github.io/zeroflare-md2report/
  base: '/zeroflare-md2report/',
})
