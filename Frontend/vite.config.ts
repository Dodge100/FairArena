import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import viteCompression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    // Gzip compression
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
    }),

    // Brotli compression
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
    }),

    // Bundle analyzer
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html',
    }),
  ],

  esbuild: {
    drop: ['console', 'debugger'],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    minify: 'esbuild',
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {},
    },
  },

  server: {
    port: 5173,
  },
});
