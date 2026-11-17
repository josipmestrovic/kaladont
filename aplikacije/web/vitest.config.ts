import { defineConfig } from 'vitest/config';

// Jedinični testovi pokrivaju čistu TypeScript logiku u src/lib, pa im ne treba
// SvelteKit plugin iz vite.config.ts.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
