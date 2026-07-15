import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Local `vite` stays at `/`; production build uses the GitHub Pages project path.
  base: command === 'serve' ? '/' : '/zeroflare-md2report/',
}))
