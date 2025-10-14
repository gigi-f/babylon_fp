import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { resolve } from 'path';

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
  build: { sourcemap: true,
     target: 'esnext',
   },
});