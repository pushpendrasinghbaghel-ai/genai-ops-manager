import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./ui/app/tests/setup.tsx'],
    include: ['ui/app/tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['ui/app/**/*.{ts,tsx}'],
      exclude: ['ui/app/tests/**/*'],
    },
  },
});
