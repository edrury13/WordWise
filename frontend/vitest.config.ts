/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment
    environment: 'jsdom',
    
    // Setup files
    setupFiles: ['./src/test/setup.ts'],
    
    // Global test configuration
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'dist/',
        'build/',
        '.next/',
        '.nuxt/',
        '.vercel/',
        '.netlify/'
      ],
      include: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.test.{ts,tsx}',
        '!src/**/*.spec.{ts,tsx}'
      ],
      // Coverage thresholds for Grade Level Rewrite features
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        // Higher thresholds for critical components
        'src/components/GradeLevelRewritePanel.tsx': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        'src/store/slices/editorSlice.ts': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        },
        'src/services/languageService.ts': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    },
    
    // Test patterns
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/test/**/*.test.{ts,tsx}'
    ],
    exclude: [
      'node_modules/',
      'dist/',
      'build/',
      '.next/',
      '.nuxt/',
      '.vercel/',
      '.netlify/'
    ],
    
    // Test timeout configuration
    testTimeout: 10000, // 10 seconds for integration tests
    hookTimeout: 10000,
    
    // Retry configuration for flaky tests
    retry: 2,
    
    // Reporter configuration
    reporter: [
      'verbose',
      'json',
      'html'
    ],
    outputFile: {
      json: './test-results/results.json',
      html: './test-results/index.html'
    },
    
    // Watch configuration
    watch: {
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        'coverage/**',
        'test-results/**'
      ]
    },
    
    // Environment variables for testing
    env: {
      NODE_ENV: 'test',
      VITE_API_BASE_URL: 'http://localhost:5000/api',
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key'
    },
    
    // Alias configuration
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@services': resolve(__dirname, './src/services'),
      '@store': resolve(__dirname, './src/store'),
      '@test': resolve(__dirname, './src/test')
    },
    
    // Pool configuration for parallel testing
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4
      }
    },
    
    // Benchmark configuration for performance tests
    benchmark: {
      include: ['src/**/*.{bench,benchmark}.{ts,tsx}'],
      exclude: ['node_modules/**'],
      reporters: ['verbose']
    },
    
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // Snapshot configuration
    resolveSnapshotPath: (testPath, snapExtension) => {
      return testPath.replace(/\.test\.([tj]sx?)/, `.test.${snapExtension}`)
    },
    
    // Console configuration
    silent: false,
    
    // Sequence configuration for test execution order
    sequence: {
      concurrent: true,
      shuffle: false,
      hooks: 'parallel'
    },
    
    // Workspace configuration for multi-project testing
    workspace: [
      {
        // Unit tests
        test: {
          name: 'unit',
          include: [
            'src/**/*.test.{ts,tsx}',
            '!src/test/integration/**',
            '!src/test/e2e/**'
          ],
          environment: 'jsdom'
        }
      },
      {
        // Integration tests
        test: {
          name: 'integration',
          include: ['src/test/integration/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          testTimeout: 15000
        }
      },
      {
        // Performance tests
        test: {
          name: 'performance',
          include: ['src/test/performance/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          testTimeout: 30000
        }
      }
    ]
  },
  
  // Build configuration for test builds
  build: {
    sourcemap: true,
    minify: false
  },
  
  // Define configuration for test environment
  define: {
    __TEST__: true,
    __DEV__: true
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@services': resolve(__dirname, './src/services'),
      '@store': resolve(__dirname, './src/store'),
      '@test': resolve(__dirname, './src/test')
    }
  },
  
  // Server configuration for test server
  server: {
    port: 3001,
    host: 'localhost'
  }
}) 