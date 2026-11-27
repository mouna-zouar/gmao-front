import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/, priority: 30 },
            { name: 'redux', test: /node_modules[\\/](@reduxjs|redux|react-redux|immer|reselect|redux-thunk)[\\/]/, priority: 20 },
            { name: 'reseau', test: /node_modules[\\/]axios[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:9090', // <-- le port réel de votre Spring Boot
        changeOrigin: true,
      },
    },
  },
});