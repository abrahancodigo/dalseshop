import { defineConfig } from 'vite'
import './scripts/build-policy.mjs'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    strictPort: true
  },
  build: {
    manifest: true,
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@firebase/') || id.includes('node_modules/firebase/')) return 'firebase';
          if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router') || id.includes('node_modules/react/') || id.includes('node_modules/scheduler/')) return 'react-vendor';
        }
      }
    }
  }
})
