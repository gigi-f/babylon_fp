import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { resolve } from 'path';
/// <reference types="vitest" />

export default defineConfig({
  plugins: [checker({ typescript: true })],
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
  resolve: {
    alias: {
      '@src': resolve(__dirname, 'src'),
    },
  },
  server: { open: true },
  build: { 
    sourcemap: true,
    target: 'esnext',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
});