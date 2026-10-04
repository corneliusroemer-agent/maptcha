import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset URLs, so the built site works from a GitHub Pages project
  // path (/maptcha/), a custom domain, or a plain file server without a rebuild.
  base: './',
  plugins: [react()],
})
