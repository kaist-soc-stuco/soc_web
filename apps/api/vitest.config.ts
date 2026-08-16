import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    globals: true,
    setupFiles: ['./test/setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['test/security-baseline.spec.ts', 'test/**/*.unit.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'http',
          include: ['test/**/*.http.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/**/*.int.spec.ts'],
        },
      },
    ],
  },
});
