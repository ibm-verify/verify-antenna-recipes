import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 9045,
    proxy: {
      // Forward transmitter API calls — bypasses self-signed cert
      '/sources': {
        target: 'https://localhost:9044',
        changeOrigin: true,
        secure: false,
      },
    }
  },

  test: {
    globals:     true,
    environment: 'jsdom',
    setupFiles:  './src/test-setup.js',
    css:         true,
  }
})
