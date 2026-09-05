import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: {
        chrome: 50,
        safari: 12
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Emit pdf.js worker as .js so hosts without .mjs MIME still serve JS correctly
        assetFileNames(assetInfo) {
          const name = String(assetInfo.names?.[0] || assetInfo.name || '')
          if (name.includes('pdf.worker') || name.endsWith('.mjs')) {
            return 'assets/[name]-[hash].js'
          }
          return 'assets/[name]-[hash][extname]'
        }
      }
    }
  }
})
