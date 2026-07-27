import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
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
          include: ['test/app.http.spec.ts', 'test/app-module.http.spec.ts', 'test/auth.http.spec.ts', 'test/origin.http.spec.ts', 'test/permissions.http.spec.ts', 'test/users.http.spec.ts'],
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
