import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dotenv from 'dotenv'

dotenv.config()

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: `/${process.env.URL_PREFIX_PATH || ''}`,
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
