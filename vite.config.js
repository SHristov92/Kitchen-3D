import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative paths so the build works from any folder or static host
  build: { chunkSizeWarningLimit: 1000 },
});
