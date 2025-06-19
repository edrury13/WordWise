import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup()
})

// Mock environment variables
vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({
        data: { session: { access_token: 'mock-token' } },
        error: null
      })),
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
        error: null
      })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      }))
    }
  }
}))

// Mock axios for API calls
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(() => false),
    create: vi.fn(() => ({
      post: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    }))
  }
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null
}))

// Mock window.matchMedia for dark mode
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock btoa for base64 encoding (used in cache keys)
Object.defineProperty(window, 'btoa', {
  value: vi.fn((str: string) => Buffer.from(str, 'binary').toString('base64'))
})

// Mock setTimeout and clearTimeout for debouncing tests
Object.defineProperty(window, 'setTimeout', {
  value: vi.fn((fn: Function, delay: number) => {
    return setTimeout(fn, delay)
  })
})

Object.defineProperty(window, 'clearTimeout', {
  value: vi.fn((id: number) => {
    clearTimeout(id)
  })
})

// Global test utilities
export const mockGradeLevelRewriteResponse = {
  success: true,
  originalText: 'This is a test sentence.',
  rewrittenText: 'This is a test sentence written for elementary students.',
  gradeLevel: 'elementary',
  originalReadability: {
    fleschKincaid: 8.5,
    readingEase: 65.2,
    level: 'Middle School'
  },
  newReadability: {
    fleschKincaid: 4.2,
    readingEase: 85.1,
    level: 'Elementary'
  },
  hasChanges: true,
  method: 'openai',
  timestamp: new Date().toISOString()
}

export const mockPerformanceMetrics = {
  requestCount: 5,
  cacheHits: 2,
  cacheMisses: 3,
  averageResponseTime: 1200,
  lastRequestTime: Date.now(),
  rateLimitHits: 0,
  totalTokensUsed: 150
}

export const mockCacheStats = {
  size: 3,
  maxSize: 50,
  hitRate: '40.0',
  totalHits: 2,
  totalMisses: 3
}

// Test data generators
export const generateTestText = (length: 'short' | 'medium' | 'long' = 'medium') => {
  const texts = {
    short: 'This is a short test.',
    medium: 'This is a medium length test sentence that contains enough words to trigger the grade level rewrite functionality properly.',
    long: 'This is a much longer test paragraph that contains multiple sentences and complex vocabulary. It should be sufficient to test the comprehensive functionality of the grade level rewrite feature. The text includes various sentence structures and should provide a good foundation for testing different grade level transformations and performance optimization features.'
  }
  return texts[length]
}

export const generateMockRewriteResult = (gradeLevel: string, originalText: string) => ({
  id: `test-rewrite-${Date.now()}`,
  originalText,
  rewrittenText: `${originalText} (rewritten for ${gradeLevel} level)`,
  gradeLevel,
  timestamp: new Date(),
  originalReadability: {
    fleschKincaid: 10.0,
    readingEase: 60.0,
    level: 'High School'
  },
  newReadability: {
    fleschKincaid: gradeLevel === 'elementary' ? 4.0 : gradeLevel === 'middle-school' ? 7.0 : 11.0,
    readingEase: gradeLevel === 'elementary' ? 85.0 : gradeLevel === 'middle-school' ? 75.0 : 65.0,
    level: gradeLevel === 'elementary' ? 'Elementary' : gradeLevel === 'middle-school' ? 'Middle School' : 'High School'
  },
  hasChanges: true,
  method: 'openai'
})

// Custom matchers for testing
expect.extend({
  toBeValidGradeLevel(received: string) {
    const validLevels = ['elementary', 'middle-school', 'high-school', 'college', 'graduate']
    const pass = validLevels.includes(received)
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid grade level`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be a valid grade level (one of: ${validLevels.join(', ')})`,
        pass: false,
      }
    }
  },
  
  toHaveValidReadabilityScore(received: any) {
    const hasFK = typeof received.fleschKincaid === 'number' && received.fleschKincaid >= 0
    const hasEase = typeof received.readingEase === 'number' && received.readingEase >= 0 && received.readingEase <= 100
    const hasLevel = typeof received.level === 'string' && received.level.length > 0
    
    const pass = hasFK && hasEase && hasLevel
    
    if (pass) {
      return {
        message: () => `expected readability score not to be valid`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected readability score to have valid fleschKincaid (number >= 0), readingEase (number 0-100), and level (non-empty string)`,
        pass: false,
      }
    }
  }
})

// Declare custom matchers for TypeScript
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeValidGradeLevel(): T
    toHaveValidReadabilityScore(): T
  }
} 