import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// In sviluppo il frontend gira su Vite (porta separata) e inoltra le chiamate
// /api e /auth al backend Express in ascolto su localhost:1969.
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:1969',
      '/auth': 'http://localhost:1969',
    },
  },
})
