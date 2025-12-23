import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    include: ['src/**/*.test.ts(x)'],
    env: {
      MAVENAGI_APP_ID: 'readme',
      MAVENAGI_APP_NAME: 'ReadMe',
      DEFAULT_CHUNK_SIZE: '20',
      MAVEN_API_RATELIMIT: '200'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        'public/**',
        'scripts/**',
        '**/[.]**',
        'packages/*/test?(s)/**',
        '**/*.d.ts',
        '**/virtual:*',
        '**/__mocks__/*',
        '**/node_modules/**',
        'test/**',
        'tests/e2e/**',
        '**/*.config.*',
        'src/lib/types/*.ts',
      ],
      thresholds: {
        statements: 3,
      },
    },
  },
});
