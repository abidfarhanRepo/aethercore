import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Target modern browsers
    target: 'esnext',

    // Chunk size warnings
    chunkSizeWarningLimit: 500, // 500KB
    reportCompressedSize: true,

    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console in production
        passes: 2, // Multiple passes for better compression
      },
      mangle: true,
    },

    // Rollup options for better chunking
    rollupOptions: {
      output: {
        // Define chunk splitting strategy
        manualChunks: {
          // Vendor bundles - split to leverage browser caching
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-tabs',
          ],
          'vendor-table': ['@tanstack/react-table'],
          'vendor-charts': ['recharts'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers'],
          'vendor-routing': ['react-router-dom'],
          'vendor-payments': ['@stripe/react-stripe-js', '@stripe/js'],
          'vendor-store': ['zustand'],
          'vendor-utils': [
            'axios',
            'zod',
            'date-fns',
            'dayjs',
            'clsx',
            'tailwind-merge',
          ],
          'vendor-other': [
            'lucide-react',
            'tailwindcss-animate',
            'class-variance-authority',
            'validator',
          ],
        },

        // Optimize entrypoints
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|gif|svg|webp/i.test(ext)) {
            return `images/[name]-[hash][extname]`;
          } else if (/woff|woff2|eot|ttf|otf/.test(ext)) {
            return `fonts/[name]-[hash][extname]`;
          } else if (ext === 'css') {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },

    // Source maps - only for errors in production
    sourcemap: 'hidden',

    // CSS code splitting
    cssCodeSplit: true,

    // Lib mode (if needed)
    // lib: {
    //   entry: path.resolve(__dirname, 'src/main.tsx'),
    //   name: 'AetherPOS',
    //   fileName: (format) => `aether-pos.${format}.js`
    // }
  },

  // Optimization settings
  optimizeDeps: {
    // Pre-bundle these dependencies for faster development
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      '@tanstack/react-table',
      'recharts',
      'axios',
      'zod',
      'date-fns',
      'dayjs',
    ],
    exclude: [],
  },

  // Server settings
  server: {
    // Enable CORS for development
    cors: true,
    // Proxy API calls in development
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },

  // Preview settings
  preview: {
    port: 5173,
  },
});
