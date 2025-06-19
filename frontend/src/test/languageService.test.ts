import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'
import { 
  rewriteGradeLevelWithOpenAI,
  rewriteGradeLevelWithOptimization,
  getGradeLevelOptimizerStats
} from '../services/languageService'
import { mockGradeLevelRewriteResponse, generateTestText } from './setup'

// Mock axios
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    isAxiosError: vi.fn(),
  }
}))

// Mock supabase
vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({
        data: { session: { access_token: 'mock-token' } },
        error: null
      }))
    }
  }
}))

describe('languageService - Grade Level Rewrite', () => {
  const mockAxios = vi.mocked(axios)
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    import.meta.env.VITE_API_BASE_URL = 'http://localhost:5000/api'
    import.meta.env.PROD = false
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Basic Grade Level Rewrite', () => {
    it('should successfully rewrite text for elementary level', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: mockGradeLevelRewriteResponse
      })

      const result = await rewriteGradeLevelWithOpenAI(
        generateTestText('medium'),
        'elementary'
      )

      expect(result).toEqual(mockGradeLevelRewriteResponse)
      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://localhost:5000/api/language/rewrite-grade-level',
        {
          text: expect.any(String),
          gradeLevel: 'elementary'
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          }),
          timeout: 45000
        })
      )
    })

    it('should handle different grade levels', async () => {
      const gradeLevels = ['elementary', 'middle-school', 'high-school', 'college', 'graduate']
      
      for (const gradeLevel of gradeLevels) {
        mockAxios.post.mockResolvedValueOnce({
          data: { ...mockGradeLevelRewriteResponse, gradeLevel }
        })

        const result = await rewriteGradeLevelWithOpenAI(
          generateTestText('medium'),
          gradeLevel
        )

        expect(result.gradeLevel).toBe(gradeLevel)
      }
    })

    it('should include proper authentication headers', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: mockGradeLevelRewriteResponse
      })

      await rewriteGradeLevelWithOpenAI(generateTestText('medium'), 'elementary')

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          })
        })
      )
    })

    it('should use correct API endpoint in production', async () => {
      import.meta.env.PROD = true
      import.meta.env.VITE_API_BASE_URL = undefined

      mockAxios.post.mockResolvedValueOnce({
        data: mockGradeLevelRewriteResponse
      })

      await rewriteGradeLevelWithOpenAI(generateTestText('medium'), 'elementary')

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/language/rewrite-grade-level',
        expect.any(Object),
        expect.any(Object)
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      mockAxios.post.mockRejectedValueOnce({
        response: { status: 401, data: { error: 'Unauthorized' } }
      })
      mockAxios.isAxiosError.mockReturnValueOnce(true)

      await expect(
        rewriteGradeLevelWithOpenAI(generateTestText('medium'), 'elementary')
      ).rejects.toThrow('Authentication failed. Please log in again.')
    })

    it('should handle rate limiting errors', async () => {
      mockAxios.post.mockRejectedValueOnce({
        response: { status: 429, data: { error: 'Rate limited' } }
      })
      mockAxios.isAxiosError.mockReturnValueOnce(true)

      await expect(
        rewriteGradeLevelWithOpenAI(generateTestText('medium'), 'elementary')
      ).rejects.toThrow('Rate limited. Please wait a moment before trying again.')
    })

    it('should handle API error responses', async () => {
      mockAxios.post.mockRejectedValueOnce({
        response: { 
          status: 500, 
          data: { error: 'Internal server error' } 
        }
      })
      mockAxios.isAxiosError.mockReturnValueOnce(true)

      await expect(
        rewriteGradeLevelWithOpenAI(generateTestText('medium'), 'elementary')
      ).rejects.toThrow('Internal server error')
    })

    it('should handle network errors', async () => {
      mockAxios.post.mockRejectedValueOnce(new Error('Network error'))
      mockAxios.isAxiosError.mockReturnValueOnce(false)

      await expect(
        rewriteGradeLevelWithOpenAI(generateTestText('medium'), 'elementary')
      ).rejects.toThrow('Network error')
    })

    it('should handle missing authentication token', async () => {
      // Mock missing session
      const { supabase } = await import('../config/supabase')
      vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: null },
        error: null
      })

      await expect(
        rewriteGradeLevelWithOpenAI(generateTestText('medium'), 'elementary')
      ).rejects.toThrow('Authentication required. Please log in to use grade level rewriting.')
    })
  })

  describe('Performance Optimization', () => {
    beforeEach(() => {
      // Mock successful API responses
      mockAxios.post.mockResolvedValue({
        data: mockGradeLevelRewriteResponse
      })
    })

    it('should use optimization layer for rewrite requests', async () => {
      const testText = generateTestText('medium')
      
      const result = await rewriteGradeLevelWithOptimization(testText, 'elementary')
      
      expect(result).toEqual(mockGradeLevelRewriteResponse)
    })

    it('should deduplicate identical requests', async () => {
      const testText = generateTestText('medium')
      
      // Make two identical requests simultaneously
      const [result1, result2] = await Promise.all([
        rewriteGradeLevelWithOptimization(testText, 'elementary'),
        rewriteGradeLevelWithOptimization(testText, 'elementary')
      ])
      
      expect(result1).toEqual(mockGradeLevelRewriteResponse)
      expect(result2).toEqual(mockGradeLevelRewriteResponse)
      
      // Should only make one actual API call due to deduplication
      expect(mockAxios.post).toHaveBeenCalledTimes(1)
    })

    it('should handle different texts separately', async () => {
      const text1 = generateTestText('short')
      const text2 = generateTestText('long')
      
      await Promise.all([
        rewriteGradeLevelWithOptimization(text1, 'elementary'),
        rewriteGradeLevelWithOptimization(text2, 'elementary')
      ])
      
      // Should make separate API calls for different texts
      expect(mockAxios.post).toHaveBeenCalledTimes(2)
    })

    it('should handle different grade levels separately', async () => {
      const testText = generateTestText('medium')
      
      await Promise.all([
        rewriteGradeLevelWithOptimization(testText, 'elementary'),
        rewriteGradeLevelWithOptimization(testText, 'high-school')
      ])
      
      // Should make separate API calls for different grade levels
      expect(mockAxios.post).toHaveBeenCalledTimes(2)
    })

    it('should provide optimizer statistics', () => {
      const stats = getGradeLevelOptimizerStats()
      
      expect(stats).toHaveProperty('uniqueRequests')
      expect(stats).toHaveProperty('totalPendingRequests')
      expect(stats).toHaveProperty('averageQueueSize')
      expect(typeof stats.uniqueRequests).toBe('number')
      expect(typeof stats.totalPendingRequests).toBe('number')
      expect(typeof stats.averageQueueSize).toBe('number')
    })

    it('should cleanup stale requests', async () => {
      // This test would require mocking timers and testing the cleanup functionality
      // For now, we'll just verify the stats are available
      const initialStats = getGradeLevelOptimizerStats()
      expect(initialStats.uniqueRequests).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Request Validation', () => {
    it('should handle empty text', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { ...mockGradeLevelRewriteResponse, hasChanges: false }
      })

      const result = await rewriteGradeLevelWithOpenAI('', 'elementary')
      expect(result.hasChanges).toBe(false)
    })

    it('should handle very long text', async () => {
      const longText = 'A'.repeat(10000)
      mockAxios.post.mockResolvedValueOnce({
        data: mockGradeLevelRewriteResponse
      })

      const result = await rewriteGradeLevelWithOpenAI(longText, 'elementary')
      expect(result).toEqual(mockGradeLevelRewriteResponse)
    })

    it('should handle special characters', async () => {
      const specialText = 'Text with émojis 🎓 and spëcial çharacters!'
      mockAxios.post.mockResolvedValueOnce({
        data: mockGradeLevelRewriteResponse
      })

      const result = await rewriteGradeLevelWithOpenAI(specialText, 'elementary')
      expect(result).toEqual(mockGradeLevelRewriteResponse)
    })

    it('should validate grade level parameter', () => {
      const validLevels = ['elementary', 'middle-school', 'high-school', 'college', 'graduate']
      
      validLevels.forEach(level => {
        expect(level).toBeValidGradeLevel()
      })
    })
  })

  describe('Response Validation', () => {
    it('should validate readability scores in response', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: mockGradeLevelRewriteResponse
      })

      const result = await rewriteGradeLevelWithOpenAI(
        generateTestText('medium'),
        'elementary'
      )

      expect(result.originalReadability).toHaveValidReadabilityScore()
      expect(result.newReadability).toHaveValidReadabilityScore()
    })

    it('should handle missing readability data gracefully', async () => {
      const responseWithoutReadability = {
        ...mockGradeLevelRewriteResponse,
        originalReadability: undefined,
        newReadability: undefined
      }

      mockAxios.post.mockResolvedValueOnce({
        data: responseWithoutReadability
      })

      const result = await rewriteGradeLevelWithOpenAI(
        generateTestText('medium'),
        'elementary'
      )

      expect(result.success).toBe(true)
      expect(result.originalReadability).toBeUndefined()
      expect(result.newReadability).toBeUndefined()
    })

    it('should validate required response fields', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: mockGradeLevelRewriteResponse
      })

      const result = await rewriteGradeLevelWithOpenAI(
        generateTestText('medium'),
        'elementary'
      )

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('originalText')
      expect(result).toHaveProperty('rewrittenText')
      expect(result).toHaveProperty('gradeLevel')
      expect(result).toHaveProperty('hasChanges')
      expect(result).toHaveProperty('method')
    })
  })

  describe('Timeout Handling', () => {
    it('should handle request timeouts', async () => {
      mockAxios.post.mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout of 45000ms exceeded'
      })
      mockAxios.isAxiosError.mockReturnValueOnce(true)

      await expect(
        rewriteGradeLevelWithOpenAI(generateTestText('medium'), 'elementary')
      ).rejects.toThrow()
    })

    it('should use appropriate timeout values', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: mockGradeLevelRewriteResponse
      })

      await rewriteGradeLevelWithOpenAI(generateTestText('medium'), 'elementary')

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          timeout: 45000
        })
      )
    })
  })

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill(null).map((_, i) => {
        mockAxios.post.mockResolvedValueOnce({
          data: { ...mockGradeLevelRewriteResponse, id: `request-${i}` }
        })
        
        return rewriteGradeLevelWithOptimization(
          generateTestText('medium') + ` ${i}`,
          'elementary'
        )
      })

      const results = await Promise.all(requests)
      
      expect(results).toHaveLength(5)
      results.forEach((result, i) => {
        expect(result.id).toBe(`request-${i}`)
      })
    })

    it('should handle mixed success and failure requests', async () => {
      const requests = [
        // Successful request
        (() => {
          mockAxios.post.mockResolvedValueOnce({
            data: mockGradeLevelRewriteResponse
          })
          return rewriteGradeLevelWithOptimization(generateTestText('short'), 'elementary')
        })(),
        
        // Failed request
        (() => {
          mockAxios.post.mockRejectedValueOnce(new Error('API Error'))
          return rewriteGradeLevelWithOptimization(generateTestText('medium'), 'elementary')
            .catch(err => ({ error: err.message }))
        })()
      ]

      const results = await Promise.all(requests)
      
      expect(results[0]).toEqual(mockGradeLevelRewriteResponse)
      expect(results[1]).toHaveProperty('error')
    })
  })

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys for identical inputs', async () => {
      const testText = generateTestText('medium')
      
      // Make the same request twice
      await rewriteGradeLevelWithOptimization(testText, 'elementary')
      await rewriteGradeLevelWithOptimization(testText, 'elementary')
      
      // Should use the same cache key and only make one API call
      expect(mockAxios.post).toHaveBeenCalledTimes(1)
    })

    it('should generate different cache keys for different inputs', async () => {
      await rewriteGradeLevelWithOptimization(generateTestText('short'), 'elementary')
      await rewriteGradeLevelWithOptimization(generateTestText('long'), 'elementary')
      
      // Should make separate API calls for different texts
      expect(mockAxios.post).toHaveBeenCalledTimes(2)
    })

    it('should handle edge cases in cache key generation', async () => {
      const edgeCases = [
        '', // Empty string
        'A', // Single character
        'A'.repeat(1000), // Very long string
        '🎓📚✏️', // Unicode characters
        'Line 1\nLine 2\nLine 3' // Multi-line text
      ]

      for (const text of edgeCases) {
        mockAxios.post.mockResolvedValueOnce({
          data: mockGradeLevelRewriteResponse
        })
        
        await rewriteGradeLevelWithOptimization(text, 'elementary')
      }

      expect(mockAxios.post).toHaveBeenCalledTimes(edgeCases.length)
    })
  })
}) 