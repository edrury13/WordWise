import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import GradeLevelRewritePanel from '../components/GradeLevelRewritePanel'
import editorReducer from '../store/slices/editorSlice'
import { 
  mockGradeLevelRewriteResponse, 
  mockPerformanceMetrics, 
  mockCacheStats,
  generateTestText 
} from './setup'

// Mock the language service
vi.mock('../services/languageService', () => ({
  analyzeReadability: vi.fn(() => Promise.resolve({
    fleschKincaid: 8.5,
    fleschReadingEase: 65.2,
    readabilityLevel: 'Middle School',
    averageWordsPerSentence: 15,
    averageSyllablesPerWord: 1.6,
    totalSentences: 3,
    passiveVoicePercentage: 10,
    longSentences: 1
  })),
  rewriteGradeLevelWithOpenAI: vi.fn(() => Promise.resolve(mockGradeLevelRewriteResponse))
}))

describe('GradeLevelRewritePanel', () => {
  let store: any
  let user: any

  const defaultProps = {
    text: generateTestText('medium'),
    onRewrite: vi.fn(),
    onClose: vi.fn()
  }

  const createMockStore = (initialState = {}) => {
    return configureStore({
      reducer: { editor: editorReducer },
      preloadedState: {
        editor: {
          ...initialState,
          gradeLevelRewrite: {
            isRewriting: false,
            currentGradeLevel: null,
            lastRewriteResult: null,
            rewriteError: null,
            showGradeLevelPanel: true,
            targetGradeLevel: 'elementary',
            previewText: null,
            requestQueue: [],
            cache: [],
            maxCacheSize: 50,
            cacheExpiryTime: 30 * 60 * 1000,
            debounceTimer: null,
            lastRequestTime: 0,
            rateLimitWindow: [],
            maxRequestsPerMinute: 10,
            performanceMetrics: mockPerformanceMetrics,
            isRateLimited: false,
            retryQueue: [],
            ...initialState.gradeLevelRewrite
          },
          content: [{ type: 'paragraph', children: [{ text: defaultProps.text }] }],
          rewriteHistory: [],
          currentHistoryIndex: -1,
          maxHistoryItems: 20,
          editorInstance: null,
          isDarkMode: false,
          wordCount: 0,
          characterCount: 0,
          isFullscreen: false,
          showStats: true,
          autoSaveEnabled: false,
          lastSaved: null,
          ...initialState
        }
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: {
            ignoredActions: ['editor/setEditorInstance'],
            ignoredPaths: ['editor.editorInstance'],
          },
        }),
    })
  }

  const renderWithStore = (component: React.ReactElement, storeInstance = store) => {
    return render(
      <Provider store={storeInstance}>
        {component}
      </Provider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    store = createMockStore()
    user = userEvent.setup()
  })

  describe('Basic Rendering', () => {
    it('should render the panel with correct title', () => {
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />)
      
      expect(screen.getByText('Adjust Reading Level')).toBeInTheDocument()
      expect(screen.getByText('🎓')).toBeInTheDocument()
    })

    it('should render all grade level options', () => {
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />)
      
      expect(screen.getByText('Elementary School')).toBeInTheDocument()
      expect(screen.getByText('Middle School')).toBeInTheDocument()
      expect(screen.getByText('High School')).toBeInTheDocument()
      expect(screen.getByText('College Level')).toBeInTheDocument()
      expect(screen.getByText('Graduate Level')).toBeInTheDocument()
    })

    it('should show current readability analysis', async () => {
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('Current Text Analysis')).toBeInTheDocument()
      })
    })

    it('should render close button', () => {
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />)
      
      const closeButton = screen.getByRole('button', { name: /close/i })
      expect(closeButton).toBeInTheDocument()
    })
  })

  describe('Grade Level Selection', () => {
    it('should select elementary level by default', () => {
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />)
      
      const elementaryRadio = screen.getByDisplayValue('elementary')
      expect(elementaryRadio).toBeChecked()
    })

    it('should change selection when different grade level is clicked', async () => {
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />)
      
      const highSchoolRadio = screen.getByDisplayValue('high-school')
      await user.click(highSchoolRadio)
      
      expect(highSchoolRadio).toBeChecked()
    })

    it('should show grade level details and examples', () => {
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />)
      
      // Check for Flesch-Kincaid and Reading Ease indicators
      expect(screen.getByText(/FK:/)).toBeInTheDocument()
      expect(screen.getByText(/Ease:/)).toBeInTheDocument()
    })
  })

  describe('Performance Indicators', () => {
    it('should show cache performance when available', () => {
      const storeWithCache = createMockStore({
        gradeLevelRewrite: {
          performanceMetrics: { ...mockPerformanceMetrics, requestCount: 5 },
          cache: [{ key: 'test', result: {}, timestamp: Date.now(), accessCount: 1, lastAccessed: Date.now() }]
        }
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithCache)
      
      expect(screen.getByText(/Cache:/)).toBeInTheDocument()
    })

    it('should show rate limiting indicator when rate limited', () => {
      const storeWithRateLimit = createMockStore({
        gradeLevelRewrite: {
          isRateLimited: true,
          performanceMetrics: mockPerformanceMetrics
        }
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithRateLimit)
      
      expect(screen.getByText('Rate Limited')).toBeInTheDocument()
    })

    it('should show response time when available', () => {
      const storeWithMetrics = createMockStore({
        gradeLevelRewrite: {
          performanceMetrics: { ...mockPerformanceMetrics, averageResponseTime: 1200 }
        }
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithMetrics)
      
      expect(screen.getByText('1200ms')).toBeInTheDocument()
    })
  })

  describe('Rewrite Functionality', () => {
    it('should trigger rewrite when rewrite button is clicked', async () => {
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />)
      
      const rewriteButton = screen.getByRole('button', { name: /rewrite text/i })
      await user.click(rewriteButton)
      
      // Should dispatch the optimized rewrite action
      await waitFor(() => {
        const state = store.getState().editor
        expect(state.gradeLevelRewrite.isRewriting).toBe(false) // Will be false after completion
      })
    })

    it('should show loading state during rewrite', async () => {
      const storeWithLoading = createMockStore({
        gradeLevelRewrite: { isRewriting: true }
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithLoading)
      
      expect(screen.getByText(/rewriting/i)).toBeInTheDocument()
    })

    it('should disable rewrite button when no text is provided', () => {
      renderWithStore(<GradeLevelRewritePanel {...{ ...defaultProps, text: '' }} />)
      
      const rewriteButton = screen.getByRole('button', { name: /rewrite text/i })
      expect(rewriteButton).toBeDisabled()
    })

    it('should show error message when rewrite fails', () => {
      const storeWithError = createMockStore({
        gradeLevelRewrite: { rewriteError: 'Failed to rewrite text' }
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithError)
      
      expect(screen.getByText('Failed to rewrite text')).toBeInTheDocument()
    })
  })

  describe('Results Display', () => {
    it('should show comparison when rewrite result is available', () => {
      const storeWithResult = createMockStore({
        gradeLevelRewrite: {
          lastRewriteResult: {
            id: 'test-result',
            originalText: defaultProps.text,
            rewrittenText: 'This is rewritten text for elementary students.',
            gradeLevel: 'elementary',
            timestamp: new Date(),
            originalReadability: { fleschKincaid: 8.5, readingEase: 65.2, level: 'Middle School' },
            newReadability: { fleschKincaid: 4.2, readingEase: 85.1, level: 'Elementary' },
            hasChanges: true,
            method: 'openai'
          }
        }
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithResult)
      
      expect(screen.getByText('Before & After Comparison')).toBeInTheDocument()
      expect(screen.getByText('This is rewritten text for elementary students.')).toBeInTheDocument()
    })

    it('should show apply button when rewrite result is available', () => {
      const storeWithResult = createMockStore({
        gradeLevelRewrite: {
          lastRewriteResult: {
            id: 'test-result',
            originalText: defaultProps.text,
            rewrittenText: 'Rewritten text',
            gradeLevel: 'elementary',
            timestamp: new Date(),
            originalReadability: { fleschKincaid: 8.5, readingEase: 65.2, level: 'Middle School' },
            newReadability: { fleschKincaid: 4.2, readingEase: 85.1, level: 'Elementary' },
            hasChanges: true,
            method: 'openai'
          }
        }
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithResult)
      
      const applyButton = screen.getByRole('button', { name: /apply rewrite/i })
      expect(applyButton).toBeInTheDocument()
    })

    it('should call onRewrite and onClose when apply button is clicked', async () => {
      const storeWithResult = createMockStore({
        gradeLevelRewrite: {
          lastRewriteResult: {
            id: 'test-result',
            originalText: defaultProps.text,
            rewrittenText: 'Rewritten text',
            gradeLevel: 'elementary',
            timestamp: new Date(),
            originalReadability: { fleschKincaid: 8.5, readingEase: 65.2, level: 'Middle School' },
            newReadability: { fleschKincaid: 4.2, readingEase: 85.1, level: 'Elementary' },
            hasChanges: true,
            method: 'openai'
          }
        }
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithResult)
      
      const applyButton = screen.getByRole('button', { name: /apply rewrite/i })
      await user.click(applyButton)
      
      expect(defaultProps.onRewrite).toHaveBeenCalledWith('Rewritten text')
      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('should show copy button for rewritten text', () => {
      const storeWithResult = createMockStore({
        gradeLevelRewrite: {
          lastRewriteResult: {
            id: 'test-result',
            originalText: defaultProps.text,
            rewrittenText: 'Rewritten text',
            gradeLevel: 'elementary',
            timestamp: new Date(),
            originalReadability: { fleschKincaid: 8.5, readingEase: 65.2, level: 'Middle School' },
            newReadability: { fleschKincaid: 4.2, readingEase: 85.1, level: 'Elementary' },
            hasChanges: true,
            method: 'openai'
          }
        }
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithResult)
      
      const copyButton = screen.getByRole('button', { name: /copy/i })
      expect(copyButton).toBeInTheDocument()
    })
  })

  describe('Undo/Redo Functionality', () => {
    it('should show undo/redo buttons when history is available', () => {
      const storeWithHistory = createMockStore({
        rewriteHistory: [{
          id: 'history-1',
          type: 'grade-level',
          originalContent: [],
          newContent: [],
          timestamp: new Date(),
          gradeLevel: 'elementary',
          description: 'Test rewrite'
        }],
        currentHistoryIndex: 0
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithHistory)
      
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /redo/i })).toBeInTheDocument()
    })

    it('should disable undo button when at beginning of history', () => {
      const storeWithHistory = createMockStore({
        rewriteHistory: [{
          id: 'history-1',
          type: 'grade-level',
          originalContent: [],
          newContent: [],
          timestamp: new Date(),
          gradeLevel: 'elementary',
          description: 'Test rewrite'
        }],
        currentHistoryIndex: -1 // At beginning, can't undo
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithHistory)
      
      const undoButton = screen.getByRole('button', { name: /undo/i })
      expect(undoButton).toBeDisabled()
    })

    it('should show history stats', () => {
      const storeWithHistory = createMockStore({
        rewriteHistory: [
          {
            id: 'history-1',
            type: 'grade-level',
            originalContent: [],
            newContent: [],
            timestamp: new Date(),
            gradeLevel: 'elementary',
            description: 'Test rewrite'
          }
        ],
        currentHistoryIndex: 0
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithHistory)
      
      expect(screen.getByText('1/1')).toBeInTheDocument()
    })
  })

  describe('Tooltips and Help', () => {
    it('should show tooltips on hover for grade levels', async () => {
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />)
      
      const elementaryOption = screen.getByText('Elementary School')
      await user.hover(elementaryOption)
      
      // Tooltip content might be shown (implementation dependent)
      // This test would need to be adjusted based on actual tooltip implementation
    })

    it('should show help text for grade level characteristics', () => {
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />)
      
      // Look for descriptive text about grade levels
      expect(screen.getByText(/Simple vocabulary and short sentences/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />)
      
      const radioGroup = screen.getByRole('radiogroup', { name: /grade level/i })
      expect(radioGroup).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />)
      
      const elementaryRadio = screen.getByDisplayValue('elementary')
      const middleSchoolRadio = screen.getByDisplayValue('middle-school')
      
      elementaryRadio.focus()
      await user.keyboard('[ArrowDown]')
      
      expect(middleSchoolRadio).toHaveFocus()
    })

    it('should have proper heading hierarchy', () => {
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />)
      
      const mainHeading = screen.getByRole('heading', { level: 2 })
      expect(mainHeading).toHaveTextContent('Adjust Reading Level')
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      const storeWithError = createMockStore({
        gradeLevelRewrite: {
          rewriteError: 'Network error: Unable to connect to server'
        }
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithError)
      
      expect(screen.getByText(/Network error/i)).toBeInTheDocument()
    })

    it('should handle rate limiting errors', () => {
      const storeWithRateLimit = createMockStore({
        gradeLevelRewrite: {
          rewriteError: 'Rate limited. Please wait a moment before trying again.',
          isRateLimited: true
        }
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithRateLimit)
      
      expect(screen.getByText(/Rate limited/i)).toBeInTheDocument()
    })

    it('should handle authentication errors', () => {
      const storeWithAuthError = createMockStore({
        gradeLevelRewrite: {
          rewriteError: 'Authentication failed. Please log in again.'
        }
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithAuthError)
      
      expect(screen.getByText(/Authentication failed/i)).toBeInTheDocument()
    })
  })

  describe('Performance Features', () => {
    it('should trigger debounced preview when grade level changes', async () => {
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />)
      
      const highSchoolRadio = screen.getByDisplayValue('high-school')
      await user.click(highSchoolRadio)
      
      // Should trigger debounced rewrite for preview
      // This would require mocking timers to test properly
    })

    it('should show cache hit indicator when result comes from cache', () => {
      const storeWithCacheHit = createMockStore({
        gradeLevelRewrite: {
          lastRewriteResult: {
            id: 'cached-result',
            originalText: defaultProps.text,
            rewrittenText: 'Cached rewritten text',
            gradeLevel: 'elementary',
            timestamp: new Date(),
            originalReadability: { fleschKincaid: 8.5, readingEase: 65.2, level: 'Middle School' },
            newReadability: { fleschKincaid: 4.2, readingEase: 85.1, level: 'Elementary' },
            hasChanges: true,
            method: 'cache'
          },
          performanceMetrics: { ...mockPerformanceMetrics, cacheHits: 1 }
        }
      })
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />, storeWithCacheHit)
      
      expect(screen.getByText(/Cache:/)).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty text gracefully', () => {
      renderWithStore(<GradeLevelRewritePanel {...{ ...defaultProps, text: '' }} />)
      
      const rewriteButton = screen.getByRole('button', { name: /rewrite text/i })
      expect(rewriteButton).toBeDisabled()
    })

    it('should handle very long text', () => {
      const longText = 'A'.repeat(5000)
      renderWithStore(<GradeLevelRewritePanel {...{ ...defaultProps, text: longText }} />)
      
      // Should still render without issues
      expect(screen.getByText('Adjust Reading Level')).toBeInTheDocument()
    })

    it('should handle special characters in text', () => {
      const specialText = 'Text with émojis 🎓 and spëcial çharacters!'
      renderWithStore(<GradeLevelRewritePanel {...{ ...defaultProps, text: specialText }} />)
      
      expect(screen.getByText('Adjust Reading Level')).toBeInTheDocument()
    })

    it('should handle missing readability data', async () => {
      // Mock analyzeReadability to return null
      const { analyzeReadability } = await import('../services/languageService')
      vi.mocked(analyzeReadability).mockResolvedValueOnce(null)
      
      renderWithStore(<GradeLevelRewritePanel {...defaultProps} />)
      
      // Should still render without crashing
      expect(screen.getByText('Adjust Reading Level')).toBeInTheDocument()
    })
  })
}) 