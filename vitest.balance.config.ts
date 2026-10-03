import { defineConfig } from 'vitest/config';

/** Lange Balancing-Läufe, getrennt von den normalen Tests. */
export default defineConfig({
  test: {
    include: ['src/**/*.balance.ts'],
    environment: 'node',
  },
});
