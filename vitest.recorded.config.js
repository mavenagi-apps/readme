import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts(x)'],
    env: {
      MAVENAGI_APP_ID: 'readme',
      MAVENAGI_APP_NAME: 'ReadMe',
      DEFAULT_CHUNK_SIZE: '20',
      MAVEN_API_RATELIMIT: '200'
    },
  },
});
