import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/xlsx/')) {
            return 'xlsx';
          }
          if (id.includes('node_modules/dexie/')) {
            return 'dexie';
          }
          if (id.includes('node_modules/html5-qrcode/')) {
            return 'scanner';
          }
        },
      },
    },
  },
})
