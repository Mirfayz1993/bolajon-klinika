import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '.next/**',
        'prisma/**',
        'src/app/**',        // Next.js page/route fayllar (integration test emas)
        'src/components/**',
        '**/*.config.*',
        '**/*.d.ts',
      ],
      include: [
        'src/lib/**',
        'src/hooks/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
