import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5173 },
  // Three.js alone is ~700 kB minified; split it out once we add menus and lazy-loaded assets.
  build: { chunkSizeWarningLimit: 900 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
