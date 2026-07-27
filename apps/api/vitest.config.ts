import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['test/security-baseline.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'http',
          include: ['test/app.http.spec.ts', 'test/app-module.http.spec.ts'],
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
