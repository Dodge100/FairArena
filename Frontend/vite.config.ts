import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression';

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
    // Bundle analyzer (generates stats.html)
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
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 600,

    // Enable minification
    minify: 'esbuild',

    // Rollup options for code splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: (id) => {
          // React core
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router')
          ) {
            return 'vendor-react';
          }

          // Radix UI components
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-ui';
          }

          // Firebase
          if (id.includes('node_modules/firebase')) {
            return 'vendor-firebase';
          }

          // Animation libraries
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion')) {
            return 'vendor-animation';
          }

          // Socket.io
          if (id.includes('node_modules/socket.io-client')) {
            return 'vendor-socket';
          }

          // Video.js
          if (id.includes('node_modules/video.js')) {
            return 'vendor-video';
          }

          // Other large dependencies
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'vendor-query';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
