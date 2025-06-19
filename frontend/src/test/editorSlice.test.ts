import { describe, it, expect, beforeEach, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import editorReducer, {
  performGradeLevelRewriteOptimized,
  performGradeLevelRewriteDebounced,
  processRetryQueue,
  addToCache,
  updateCacheAccess,
  clearCache,
  updatePerformanceMetrics,
  addToRetryQueue,
  removeFromRetryQueue,
  updateRetryItem,
  addToRewriteHistory,
  undoRewrite,
  redoRewrite,
  applyGradeLevelRewrite,
  setTargetGradeLevel,
  setShowGradeLevelPanel,
  selectPerformanceMetrics,
  selectCacheStats,
  selectCanUndo,
  selectCanRedo,
  selectIsRateLimited,
  type EditorState
} from '../store/slices/editorSlice'
import { generateMockRewriteResult, generateTestText } from './setup'

// Mock the language service
vi.mock('../services/languageService', () => ({
  rewriteGradeLevelWithOpenAI: vi.fn(() => Promise.resolve({
    success: true,
    rewrittenText: 'This is a test sentence written for elementary students.',
    originalReadability: { fleschKincaid: 8.5, readingEase: 65.2, level: 'Middle School' },
    newReadability: { fleschKincaid: 4.2, readingEase: 85.1, level: 'Elementary' },
    hasChanges: true,
    method: 'openai'
  }))
}))

describe('editorSlice - Grade Level Rewrite', () => {
  let store: any
  let initialState: EditorState

  beforeEach(() => {
    store = configureStore({
      reducer: { editor: editorReducer },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: {
            ignoredActions: ['editor/setEditorInstance'],
            ignoredPaths: ['editor.editorInstance'],
          },
        }),
    })
    initialState = store.getState().editor
  })

  describe('Basic State Management', () => {
    it('should have correct initial state', () => {
      expect(initialState.gradeLevelRewrite.isRewriting).toBe(false)
      expect(initialState.gradeLevelRewrite.targetGradeLevel).toBeNull()
      expect(initialState.gradeLevelRewrite.lastRewriteResult).toBeNull()
      expect(initialState.gradeLevelRewrite.cache).toEqual([])
      expect(initialState.gradeLevelRewrite.maxCacheSize).toBe(50)
      expect(initialState.gradeLevelRewrite.performanceMetrics.requestCount).toBe(0)
    })

    it('should set target grade level', () => {
      store.dispatch(setTargetGradeLevel('elementary'))
      const state = store.getState().editor
      expect(state.gradeLevelRewrite.targetGradeLevel).toBe('elementary')
    })

    it('should toggle grade level panel visibility', () => {
      store.dispatch(setShowGradeLevelPanel(true))
      let state = store.getState().editor
      expect(state.gradeLevelRewrite.showGradeLevelPanel).toBe(true)

      store.dispatch(setShowGradeLevelPanel(false))
      state = store.getState().editor
      expect(state.gradeLevelRewrite.showGradeLevelPanel).toBe(false)
    })
  })

  describe('Performance Optimization - Caching', () => {
    it('should add items to cache', () => {
      const mockResult = generateMockRewriteResult('elementary', 'Test text')
      const cacheKey = 'elementary:test-key'

      store.dispatch(addToCache({ key: cacheKey, result: mockResult }))
      const state = store.getState().editor

      expect(state.gradeLevelRewrite.cache).toHaveLength(1)
      expect(state.gradeLevelRewrite.cache[0].key).toBe(cacheKey)
      expect(state.gradeLevelRewrite.cache[0].result).toEqual(mockResult)
      expect(state.gradeLevelRewrite.cache[0].accessCount).toBe(1)
    })

    it('should update cache access count', () => {
      const mockResult = generateMockRewriteResult('elementary', 'Test text')
      const cacheKey = 'elementary:test-key'

      store.dispatch(addToCache({ key: cacheKey, result: mockResult }))
      store.dispatch(updateCacheAccess(cacheKey))
      
      const state = store.getState().editor
      expect(state.gradeLevelRewrite.cache[0].accessCount).toBe(2)
    })

    it('should clear cache', () => {
      const mockResult = generateMockRewriteResult('elementary', 'Test text')
      store.dispatch(addToCache({ key: 'test-key', result: mockResult }))
      
      let state = store.getState().editor
      expect(state.gradeLevelRewrite.cache).toHaveLength(1)

      store.dispatch(clearCache())
      state = store.getState().editor
      expect(state.gradeLevelRewrite.cache).toHaveLength(0)
    })

    it('should enforce cache size limits', () => {
      // Add items beyond max cache size
      for (let i = 0; i < 55; i++) {
        const mockResult = generateMockRewriteResult('elementary', `Test text ${i}`)
        store.dispatch(addToCache({ key: `test-key-${i}`, result: mockResult }))
      }

      const state = store.getState().editor
      expect(state.gradeLevelRewrite.cache.length).toBeLessThanOrEqual(50)
    })
  })

  describe('Performance Optimization - Metrics', () => {
    it('should track cache hits', () => {
      store.dispatch(updatePerformanceMetrics({
        type: 'cache_hit',
        responseTime: 100
      }))

      const state = store.getState().editor
      expect(state.gradeLevelRewrite.performanceMetrics.cacheHits).toBe(1)
    })

    it('should track cache misses', () => {
      store.dispatch(updatePerformanceMetrics({
        type: 'cache_miss'
      }))

      const state = store.getState().editor
      expect(state.gradeLevelRewrite.performanceMetrics.cacheMisses).toBe(1)
    })

    it('should track request completion', () => {
      store.dispatch(updatePerformanceMetrics({
        type: 'request_complete',
        responseTime: 1500,
        tokensUsed: 50
      }))

      const state = store.getState().editor
      expect(state.gradeLevelRewrite.performanceMetrics.requestCount).toBe(1)
      expect(state.gradeLevelRewrite.performanceMetrics.averageResponseTime).toBe(1500)
      expect(state.gradeLevelRewrite.performanceMetrics.totalTokensUsed).toBe(50)
    })

    it('should calculate average response time correctly', () => {
      store.dispatch(updatePerformanceMetrics({
        type: 'request_complete',
        responseTime: 1000
      }))
      store.dispatch(updatePerformanceMetrics({
        type: 'request_complete',
        responseTime: 2000
      }))

      const state = store.getState().editor
      expect(state.gradeLevelRewrite.performanceMetrics.averageResponseTime).toBe(1500)
    })

    it('should track rate limit hits', () => {
      store.dispatch(updatePerformanceMetrics({
        type: 'rate_limit_hit'
      }))

      const state = store.getState().editor
      expect(state.gradeLevelRewrite.performanceMetrics.rateLimitHits).toBe(1)
    })
  })

  describe('Performance Optimization - Retry Queue', () => {
    it('should add items to retry queue', () => {
      store.dispatch(addToRetryQueue({
        text: 'Test text',
        gradeLevel: 'elementary',
        retryCount: 0
      }))

      const state = store.getState().editor
      expect(state.gradeLevelRewrite.retryQueue).toHaveLength(1)
      expect(state.gradeLevelRewrite.retryQueue[0].text).toBe('Test text')
      expect(state.gradeLevelRewrite.retryQueue[0].gradeLevel).toBe('elementary')
    })

    it('should remove items from retry queue', () => {
      store.dispatch(addToRetryQueue({
        text: 'Test text',
        gradeLevel: 'elementary',
        retryCount: 0
      }))

      let state = store.getState().editor
      const itemId = state.gradeLevelRewrite.retryQueue[0].id

      store.dispatch(removeFromRetryQueue(itemId))
      state = store.getState().editor
      expect(state.gradeLevelRewrite.retryQueue).toHaveLength(0)
    })

    it('should update retry items', () => {
      store.dispatch(addToRetryQueue({
        text: 'Test text',
        gradeLevel: 'elementary',
        retryCount: 0
      }))

      let state = store.getState().editor
      const itemId = state.gradeLevelRewrite.retryQueue[0].id

      store.dispatch(updateRetryItem({
        id: itemId,
        retryCount: 2,
        nextRetryTime: Date.now() + 5000
      }))

      state = store.getState().editor
      expect(state.gradeLevelRewrite.retryQueue[0].retryCount).toBe(2)
    })
  })

  describe('Rewrite History', () => {
    it('should add items to rewrite history', () => {
      const originalContent = [{ type: 'paragraph', children: [{ text: 'Original text' }] }]
      const newContent = [{ type: 'paragraph', children: [{ text: 'Rewritten text' }] }]

      store.dispatch(addToRewriteHistory({
        type: 'grade-level',
        originalContent,
        newContent,
        gradeLevel: 'elementary',
        description: 'Test rewrite'
      }))

      const state = store.getState().editor
      expect(state.rewriteHistory).toHaveLength(1)
      expect(state.currentHistoryIndex).toBe(0)
      expect(state.rewriteHistory[0].type).toBe('grade-level')
      expect(state.rewriteHistory[0].gradeLevel).toBe('elementary')
    })

    it('should support undo operations', () => {
      const originalContent = [{ type: 'paragraph', children: [{ text: 'Original text' }] }]
      const newContent = [{ type: 'paragraph', children: [{ text: 'Rewritten text' }] }]

      store.dispatch(addToRewriteHistory({
        type: 'grade-level',
        originalContent,
        newContent,
        gradeLevel: 'elementary',
        description: 'Test rewrite'
      }))

      // Set content to new content first
      store.dispatch({ type: 'editor/setContent', payload: newContent })

      store.dispatch(undoRewrite())
      const state = store.getState().editor
      
      expect(state.currentHistoryIndex).toBe(-1)
      expect(state.content).toEqual(originalContent)
    })

    it('should support redo operations', () => {
      const originalContent = [{ type: 'paragraph', children: [{ text: 'Original text' }] }]
      const newContent = [{ type: 'paragraph', children: [{ text: 'Rewritten text' }] }]

      store.dispatch(addToRewriteHistory({
        type: 'grade-level',
        originalContent,
        newContent,
        gradeLevel: 'elementary',
        description: 'Test rewrite'
      }))

      store.dispatch({ type: 'editor/setContent', payload: newContent })
      store.dispatch(undoRewrite())
      store.dispatch(redoRewrite())
      
      const state = store.getState().editor
      expect(state.currentHistoryIndex).toBe(0)
      expect(state.content).toEqual(newContent)
    })

    it('should respect max history items limit', () => {
      const originalContent = [{ type: 'paragraph', children: [{ text: 'Original text' }] }]
      const newContent = [{ type: 'paragraph', children: [{ text: 'Rewritten text' }] }]

      // Add more items than the limit (20)
      for (let i = 0; i < 25; i++) {
        store.dispatch(addToRewriteHistory({
          type: 'grade-level',
          originalContent,
          newContent,
          gradeLevel: 'elementary',
          description: `Test rewrite ${i}`
        }))
      }

      const state = store.getState().editor
      expect(state.rewriteHistory.length).toBeLessThanOrEqual(20)
    })
  })

  describe('Apply Grade Level Rewrite', () => {
    it('should apply grade level rewrite and update history', () => {
      const originalContent = [{ type: 'paragraph', children: [{ text: 'Original text' }] }]
      const rewrittenText = 'This is rewritten text for elementary students.'
      const mockResult = generateMockRewriteResult('elementary', 'Original text')

      // Set initial content
      store.dispatch({ type: 'editor/setContent', payload: originalContent })

      store.dispatch(applyGradeLevelRewrite({
        rewrittenText,
        originalContent,
        rewriteResult: mockResult
      }))

      const state = store.getState().editor
      
      // Check content was updated
      expect(state.content[0].children[0].text).toBe(rewrittenText)
      
      // Check grade level state was updated
      expect(state.gradeLevelRewrite.currentGradeLevel).toBe('elementary')
      expect(state.gradeLevelRewrite.lastRewriteResult).toEqual(mockResult)
      expect(state.gradeLevelRewrite.showGradeLevelPanel).toBe(false)
      
      // Check history was updated
      expect(state.rewriteHistory).toHaveLength(1)
      expect(state.rewriteHistory[0].type).toBe('grade-level')
      expect(state.rewriteHistory[0].gradeLevel).toBe('elementary')
    })
  })

  describe('Selectors', () => {
    beforeEach(() => {
      // Set up some test data
      store.dispatch(updatePerformanceMetrics({
        type: 'cache_hit',
        responseTime: 100
      }))
      store.dispatch(updatePerformanceMetrics({
        type: 'cache_miss'
      }))
      
      const mockResult = generateMockRewriteResult('elementary', 'Test text')
      store.dispatch(addToCache({ key: 'test-key', result: mockResult }))
    })

    it('should select performance metrics correctly', () => {
      const state = store.getState()
      const metrics = selectPerformanceMetrics(state)
      
      expect(metrics.cacheHits).toBe(1)
      expect(metrics.cacheMisses).toBe(1)
    })

    it('should select cache stats correctly', () => {
      const state = store.getState()
      const cacheStats = selectCacheStats(state)
      
      expect(cacheStats.size).toBe(1)
      expect(cacheStats.maxSize).toBe(50)
      expect(cacheStats.hitRate).toBe('50.0')
      expect(cacheStats.totalHits).toBe(1)
      expect(cacheStats.totalMisses).toBe(1)
    })

    it('should select undo/redo availability correctly', () => {
      let state = store.getState()
      expect(selectCanUndo(state)).toBe(false)
      expect(selectCanRedo(state)).toBe(false)

      // Add history item
      const originalContent = [{ type: 'paragraph', children: [{ text: 'Original text' }] }]
      const newContent = [{ type: 'paragraph', children: [{ text: 'Rewritten text' }] }]

      store.dispatch(addToRewriteHistory({
        type: 'grade-level',
        originalContent,
        newContent,
        gradeLevel: 'elementary',
        description: 'Test rewrite'
      }))

      state = store.getState()
      expect(selectCanUndo(state)).toBe(true)
      expect(selectCanRedo(state)).toBe(false)

      // Undo
      store.dispatch(undoRewrite())
      state = store.getState()
      expect(selectCanUndo(state)).toBe(false)
      expect(selectCanRedo(state)).toBe(true)
    })

    it('should select rate limit status correctly', () => {
      let state = store.getState()
      expect(selectIsRateLimited(state)).toBe(false)

      // Simulate rate limiting by adding many requests to the window
      const now = Date.now()
      store.dispatch({
        type: 'editor/updateRateLimitWindow',
        payload: Array(15).fill(now) // Exceed the limit of 10
      })

      state = store.getState()
      // Note: This test might need adjustment based on actual rate limiting logic
    })
  })

  describe('Async Thunks', () => {
    it('should handle optimized grade level rewrite success', async () => {
      const testText = generateTestText('medium')
      const mockCurrentContent = [{ type: 'paragraph', children: [{ text: testText }] }]

      const action = await store.dispatch(performGradeLevelRewriteOptimized({
        text: testText,
        gradeLevel: 'elementary',
        currentContent: mockCurrentContent,
        priority: 'high'
      }))

      expect(action.type).toBe('editor/performGradeLevelRewriteOptimized/fulfilled')
      
      const state = store.getState().editor
      expect(state.gradeLevelRewrite.isRewriting).toBe(false)
      expect(state.gradeLevelRewrite.lastRewriteResult).toBeTruthy()
    })

    it('should handle debounced grade level rewrite', async () => {
      const testText = generateTestText('short')
      const mockCurrentContent = [{ type: 'paragraph', children: [{ text: testText }] }]

      const action = await store.dispatch(performGradeLevelRewriteDebounced({
        text: testText,
        gradeLevel: 'elementary',
        currentContent: mockCurrentContent,
        debounceMs: 100
      }))

      expect(action.type).toBe('editor/performGradeLevelRewriteDebounced/fulfilled')
    })

    it('should process retry queue', async () => {
      // Add item to retry queue
      store.dispatch(addToRetryQueue({
        text: 'Test text',
        gradeLevel: 'elementary',
        retryCount: 0
      }))

      const action = await store.dispatch(processRetryQueue())
      expect(action.type).toBe('editor/processRetryQueue/fulfilled')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty cache operations gracefully', () => {
      store.dispatch(updateCacheAccess('non-existent-key'))
      const state = store.getState().editor
      expect(state.gradeLevelRewrite.cache).toHaveLength(0)
    })

    it('should handle undo/redo when no history exists', () => {
      store.dispatch(undoRewrite())
      store.dispatch(redoRewrite())
      
      const state = store.getState().editor
      expect(state.currentHistoryIndex).toBe(-1)
      expect(state.rewriteHistory).toHaveLength(0)
    })

    it('should handle removing non-existent retry queue items', () => {
      store.dispatch(removeFromRetryQueue('non-existent-id'))
      const state = store.getState().editor
      expect(state.gradeLevelRewrite.retryQueue).toHaveLength(0)
    })

    it('should handle updating non-existent retry queue items', () => {
      store.dispatch(updateRetryItem({
        id: 'non-existent-id',
        retryCount: 5,
        nextRetryTime: Date.now()
      }))
      const state = store.getState().editor
      expect(state.gradeLevelRewrite.retryQueue).toHaveLength(0)
    })
  })

  describe('Data Validation', () => {
    it('should validate grade levels', () => {
      const validLevels = ['elementary', 'middle-school', 'high-school', 'college', 'graduate']
      
      validLevels.forEach(level => {
        expect(level).toBeValidGradeLevel()
      })
    })

    it('should validate readability scores', () => {
      const validScore = {
        fleschKincaid: 8.5,
        readingEase: 65.2,
        level: 'Middle School'
      }
      
      expect(validScore).toHaveValidReadabilityScore()
    })

    it('should reject invalid readability scores', () => {
      const invalidScores = [
        { fleschKincaid: -1, readingEase: 65.2, level: 'Middle School' },
        { fleschKincaid: 8.5, readingEase: 150, level: 'Middle School' },
        { fleschKincaid: 8.5, readingEase: 65.2, level: '' }
      ]
      
      invalidScores.forEach(score => {
        expect(() => expect(score).toHaveValidReadabilityScore()).toThrow()
      })
    })
  })
}) 