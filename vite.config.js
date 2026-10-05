import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:9090', // <-- le port réel de votre Spring Boot
        changeOrigin: true,
      },
    },
  },
});