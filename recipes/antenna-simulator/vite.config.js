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
      // Forward SSE log-tail to proxy.js (runs on 9046)
      '/log/stream': {
        target: 'http://localhost:9046',
        changeOrigin: true,
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
