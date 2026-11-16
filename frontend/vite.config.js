import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/runs': 'http://localhost:8000',
      '/templates': 'http://localhost:8000',
      '/preferences': 'http://localhost:8000',
      '/bookmarks': 'http://localhost:8000',
      '/annotations': 'http://localhost:8000',
      '/exports': 'http://localhost:8000',
      '/versions': 'http://localhost:8000',
      '/graph': 'http://localhost:8000',
      '/pipeline': 'http://localhost:8000',
      '/query': 'http://localhost:8000',
      '/demo': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/metrics': 'http://localhost:8000',
    },
    // data/demo/*.json is imported by src/demoData.js from outside the
    // frontend root. Bundling resolves it either way; this only tells
    // the dev server it is allowed to read it.
    fs: { allow: ['..'] },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'force-graph': ['react-force-graph-2d'],
          zustand: ['zustand'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    env: {
      VITE_USE_MOCK_API: 'true',
    },
  },
});
