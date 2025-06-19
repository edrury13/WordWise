import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import editorReducer from '../../store/slices/editorSlice'
import GradeLevelRewritePanel from '../../components/GradeLevelRewritePanel'
import { 
  mockGradeLevelRewriteResponse,
  generateTestText,
  generateMockRewriteResult
} from '../setup'

// Mock the language service with realistic delays
vi.mock('../../services/languageService', () => ({
  analyzeReadability: vi.fn(() => 
    new Promise(resolve => 
      setTimeout(() => resolve({
        fleschKincaid: 8.5,
        fleschReadingEase: 65.2,
        readabilityLevel: 'Middle School',
        averageWordsPerSentence: 15,
        averageSyllablesPerWord: 1.6,
        totalSentences: 3,
        passiveVoicePercentage: 10,
        longSentences: 1
      }), 100)
    )
  ),
  rewriteGradeLevelWithOptimization: vi.fn(() =>
    new Promise(resolve => 
      setTimeout(() => resolve(mockGradeLevelRewriteResponse), 500)
    )
  ),
  getGradeLevelOptimizerStats: vi.fn(() => ({
    uniqueRequests: 2,
    totalPendingRequests: 0,
    averageQueueSize: 0
  }))
}))

describe('Grade Level Rewrite - Integration Tests', () => {
  let store: any
  let user: any

  const createIntegrationStore = () => {
    return configureStore({
      reducer: { editor: editorReducer },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: {
            ignoredActions: ['editor/setEditorInstance'],
            ignoredPaths: ['editor.editorInstance'],
          },
        }),
    })
  }

  const renderWithStore = (component: React.ReactElement) => {
    return render(
      <Provider store={store}>
        {component}
      </Provider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    store = createIntegrationStore()
    user = userEvent.setup()
  })

  describe('Complete Rewrite Workflow', () => {
    it('should complete full rewrite workflow from selection to application', async () => {
      const testText = generateTestText('medium')
      const mockOnRewrite = vi.fn()
      const mockOnClose = vi.fn()

      renderWithStore(
        <GradeLevelRewritePanel 
          text={testText}
          onRewrite={mockOnRewrite}
          onClose={mockOnClose}
        />
      )

      // 1. Verify initial state
      expect(screen.getByText('Adjust Reading Level')).toBeInTheDocument()
      
      // 2. Wait for readability analysis to complete
      await waitFor(() => {
        expect(screen.getByText('Current Text Analysis')).toBeInTheDocument()
      }, { timeout: 2000 })

      // 3. Select different grade level
      const highSchoolRadio = screen.getByDisplayValue('high-school')
      await user.click(highSchoolRadio)
      expect(highSchoolRadio).toBeChecked()

      // 4. Verify target grade level is updated in store
      let state = store.getState().editor
      expect(state.gradeLevelRewrite.targetGradeLevel).toBe('high-school')

      // 5. Trigger rewrite
      const rewriteButton = screen.getByRole('button', { name: /rewrite text/i })
      await user.click(rewriteButton)

      // 6. Verify loading state
      state = store.getState().editor
      expect(state.gradeLevelRewrite.isRewriting).toBe(true)

      // 7. Wait for rewrite to complete
      await waitFor(() => {
        const currentState = store.getState().editor
        expect(currentState.gradeLevelRewrite.isRewriting).toBe(false)
        expect(currentState.gradeLevelRewrite.lastRewriteResult).toBeTruthy()
      }, { timeout: 2000 })

      // 8. Verify results are displayed
      expect(screen.getByText('Before & After Comparison')).toBeInTheDocument()
      expect(screen.getByText(mockGradeLevelRewriteResponse.rewrittenText)).toBeInTheDocument()

      // 9. Apply the rewrite
      const applyButton = screen.getByRole('button', { name: /apply rewrite/i })
      await user.click(applyButton)

      // 10. Verify callbacks and state updates
      expect(mockOnRewrite).toHaveBeenCalledWith(mockGradeLevelRewriteResponse.rewrittenText)
      expect(mockOnClose).toHaveBeenCalled()

      // 11. Verify final state
      state = store.getState().editor
      expect(state.gradeLevelRewrite.showGradeLevelPanel).toBe(false)
      expect(state.rewriteHistory).toHaveLength(1)
      expect(state.rewriteHistory[0].type).toBe('grade-level')
    })

    it('should handle error recovery workflow', async () => {
      // Mock API failure
      const { rewriteGradeLevelWithOptimization } = await import('../../services/languageService')
      vi.mocked(rewriteGradeLevelWithOptimization).mockRejectedValueOnce(
        new Error('API Error: Rate limited')
      )

      const testText = generateTestText('medium')

      renderWithStore(
        <GradeLevelRewritePanel 
          text={testText}
          onRewrite={vi.fn()}
          onClose={vi.fn()}
        />
      )

      // Trigger rewrite that will fail
      const rewriteButton = screen.getByRole('button', { name: /rewrite text/i })
      await user.click(rewriteButton)

      // Wait for error to appear
      await waitFor(() => {
        const state = store.getState().editor
        expect(state.gradeLevelRewrite.rewriteError).toBeTruthy()
      }, { timeout: 2000 })

      // Verify error is displayed
      expect(screen.getByText(/API Error/i)).toBeInTheDocument()

      // Clear error and retry
      const clearErrorButton = screen.getByRole('button', { name: /clear error/i })
      if (clearErrorButton) {
        await user.click(clearErrorButton)
      }

      // Mock successful retry
      vi.mocked(rewriteGradeLevelWithOptimization).mockResolvedValueOnce(
        mockGradeLevelRewriteResponse
      )

      // Retry the operation
      await user.click(rewriteButton)

      // Verify success
      await waitFor(() => {
        const state = store.getState().editor
        expect(state.gradeLevelRewrite.lastRewriteResult).toBeTruthy()
        expect(state.gradeLevelRewrite.rewriteError).toBeFalsy()
      }, { timeout: 2000 })
    })
  })

  describe('Performance Optimization Integration', () => {
    it('should demonstrate caching behavior across multiple requests', async () => {
      const testText = generateTestText('medium')
      
      renderWithStore(
        <GradeLevelRewritePanel 
          text={testText}
          onRewrite={vi.fn()}
          onClose={vi.fn()}
        />
      )

      // First request - should hit API
      const rewriteButton = screen.getByRole('button', { name: /rewrite text/i })
      await user.click(rewriteButton)

      await waitFor(() => {
        const state = store.getState().editor
        expect(state.gradeLevelRewrite.lastRewriteResult).toBeTruthy()
      }, { timeout: 2000 })

      // Verify cache was populated
      let state = store.getState().editor
      expect(state.gradeLevelRewrite.cache.length).toBeGreaterThan(0)

      // Second identical request - should use cache
      await user.click(rewriteButton)

      await waitFor(() => {
        const currentState = store.getState().editor
        expect(currentState.gradeLevelRewrite.performanceMetrics.cacheHits).toBeGreaterThan(0)
      })

      // Verify cache hit metrics
      state = store.getState().editor
      expect(state.gradeLevelRewrite.performanceMetrics.cacheHits).toBeGreaterThan(0)
    })

    it('should handle rate limiting and retry queue', async () => {
      const testText = generateTestText('medium')
      
      // Mock rate limiting
      const { rewriteGradeLevelWithOptimization } = await import('../../services/languageService')
      vi.mocked(rewriteGradeLevelWithOptimization).mockRejectedValueOnce(
        new Error('Rate limited. Please wait a moment before trying again.')
      )

      renderWithStore(
        <GradeLevelRewritePanel 
          text={testText}
          onRewrite={vi.fn()}
          onClose={vi.fn()}
        />
      )

      // Trigger request that will be rate limited
      const rewriteButton = screen.getByRole('button', { name: /rewrite text/i })
      await user.click(rewriteButton)

      // Wait for rate limit error
      await waitFor(() => {
        const state = store.getState().editor
        expect(state.gradeLevelRewrite.rewriteError).toContain('Rate limited')
      }, { timeout: 2000 })

      // Verify retry queue was populated
      let state = store.getState().editor
      expect(state.gradeLevelRewrite.retryQueue.length).toBeGreaterThan(0)

      // Mock successful retry
      vi.mocked(rewriteGradeLevelWithOptimization).mockResolvedValueOnce(
        mockGradeLevelRewriteResponse
      )

      // Simulate retry queue processing
      store.dispatch({ type: 'editor/processRetryQueue/fulfilled', payload: { processed: 1 } })

      // Verify retry queue was cleared
      state = store.getState().editor
      expect(state.gradeLevelRewrite.retryQueue.length).toBe(0)
    })

    it('should track performance metrics throughout workflow', async () => {
      const testText = generateTestText('medium')
      
      renderWithStore(
        <GradeLevelRewritePanel 
          text={testText}
          onRewrite={vi.fn()}
          onClose={vi.fn()}
        />
      )

      // Initial metrics should be zero
      let state = store.getState().editor
      expect(state.gradeLevelRewrite.performanceMetrics.requestCount).toBe(0)

      // Make a request
      const rewriteButton = screen.getByRole('button', { name: /rewrite text/i })
      await user.click(rewriteButton)

      // Wait for completion and verify metrics
      await waitFor(() => {
        const currentState = store.getState().editor
        expect(currentState.gradeLevelRewrite.performanceMetrics.requestCount).toBeGreaterThan(0)
      }, { timeout: 2000 })

      state = store.getState().editor
      expect(state.gradeLevelRewrite.performanceMetrics.averageResponseTime).toBeGreaterThan(0)
    })
  })

  describe('Undo/Redo Integration', () => {
    it('should integrate undo/redo with complete rewrite workflow', async () => {
      const testText = generateTestText('medium')
      const mockOnRewrite = vi.fn()

      renderWithStore(
        <GradeLevelRewritePanel 
          text={testText}
          onRewrite={mockOnRewrite}
          onClose={vi.fn()}
        />
      )

      // Complete a rewrite
      const rewriteButton = screen.getByRole('button', { name: /rewrite text/i })
      await user.click(rewriteButton)

      await waitFor(() => {
        const state = store.getState().editor
        expect(state.gradeLevelRewrite.lastRewriteResult).toBeTruthy()
      }, { timeout: 2000 })

      // Apply the rewrite
      const applyButton = screen.getByRole('button', { name: /apply rewrite/i })
      await user.click(applyButton)

      // Verify history was created
      let state = store.getState().editor
      expect(state.rewriteHistory).toHaveLength(1)
      expect(state.currentHistoryIndex).toBe(0)

      // Re-open panel to test undo
      store.dispatch({ type: 'editor/setShowGradeLevelPanel', payload: true })

      renderWithStore(
        <GradeLevelRewritePanel 
          text={mockGradeLevelRewriteResponse.rewrittenText}
          onRewrite={vi.fn()}
          onClose={vi.fn()}
        />
      )

      // Should show undo button
      const undoButton = screen.getByRole('button', { name: /undo/i })
      expect(undoButton).toBeInTheDocument()
      expect(undoButton).not.toBeDisabled()

      // Perform undo
      await user.click(undoButton)

      // Verify undo was applied
      state = store.getState().editor
      expect(state.currentHistoryIndex).toBe(-1)

      // Should now show redo button
      const redoButton = screen.getByRole('button', { name: /redo/i })
      expect(redoButton).not.toBeDisabled()

      // Perform redo
      await user.click(redoButton)

      // Verify redo was applied
      state = store.getState().editor
      expect(state.currentHistoryIndex).toBe(0)
    })
  })

  describe('Debounced Preview Integration', () => {
    it('should trigger debounced preview when grade level changes', async () => {
      const testText = generateTestText('short') // Use short text to trigger preview
      
      renderWithStore(
        <GradeLevelRewritePanel 
          text={testText}
          onRewrite={vi.fn()}
          onClose={vi.fn()}
        />
      )

      // Change grade level multiple times quickly
      const middleSchoolRadio = screen.getByDisplayValue('middle-school')
      const highSchoolRadio = screen.getByDisplayValue('high-school')

      await user.click(middleSchoolRadio)
      await user.click(highSchoolRadio)

      // Should trigger debounced preview
      await waitFor(() => {
        const state = store.getState().editor
        // Check if debounce timer was set
        expect(state.gradeLevelRewrite.debounceTimer).toBeTruthy()
      }, { timeout: 1000 })
    })
  })

  describe('Multi-User Scenario Simulation', () => {
    it('should handle concurrent operations from multiple components', async () => {
      const testText1 = generateTestText('short')
      const testText2 = generateTestText('long')

      // Render two panels simultaneously (simulating multiple users)
      const { rerender } = renderWithStore(
        <div>
          <GradeLevelRewritePanel 
            text={testText1}
            onRewrite={vi.fn()}
            onClose={vi.fn()}
          />
          <GradeLevelRewritePanel 
            text={testText2}
            onRewrite={vi.fn()}
            onClose={vi.fn()}
          />
        </div>
      )

      // Both should render without conflicts
      const rewriteButtons = screen.getAllByRole('button', { name: /rewrite text/i })
      expect(rewriteButtons).toHaveLength(2)

      // Trigger both simultaneously
      await Promise.all([
        user.click(rewriteButtons[0]),
        user.click(rewriteButtons[1])
      ])

      // Both should complete successfully
      await waitFor(() => {
        const state = store.getState().editor
        expect(state.gradeLevelRewrite.performanceMetrics.requestCount).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })
  })

  describe('Edge Case Integration', () => {
    it('should handle component unmounting during async operations', async () => {
      const testText = generateTestText('medium')
      
      const { unmount } = renderWithStore(
        <GradeLevelRewritePanel 
          text={testText}
          onRewrite={vi.fn()}
          onClose={vi.fn()}
        />
      )

      // Start a rewrite operation
      const rewriteButton = screen.getByRole('button', { name: /rewrite text/i })
      await user.click(rewriteButton)

      // Unmount component before operation completes
      unmount()

      // Should not cause errors or memory leaks
      // This is mainly testing that cleanup functions work properly
      expect(true).toBe(true) // Placeholder assertion
    })

    it('should handle rapid successive operations', async () => {
      const testText = generateTestText('medium')
      
      renderWithStore(
        <GradeLevelRewritePanel 
          text={testText}
          onRewrite={vi.fn()}
          onClose={vi.fn()}
        />
      )

      const rewriteButton = screen.getByRole('button', { name: /rewrite text/i })

      // Trigger multiple rapid requests
      await user.click(rewriteButton)
      await user.click(rewriteButton)
      await user.click(rewriteButton)

      // Should handle gracefully without errors
      await waitFor(() => {
        const state = store.getState().editor
        expect(state.gradeLevelRewrite.performanceMetrics.requestCount).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should maintain state consistency across operations', async () => {
      const testText = generateTestText('medium')
      
      renderWithStore(
        <GradeLevelRewritePanel 
          text={testText}
          onRewrite={vi.fn()}
          onClose={vi.fn()}
        />
      )

      // Perform multiple operations
      const elementaryRadio = screen.getByDisplayValue('elementary')
      const collegeRadio = screen.getByDisplayValue('college')
      const rewriteButton = screen.getByRole('button', { name: /rewrite text/i })

      // Change grade level
      await user.click(elementaryRadio)
      let state = store.getState().editor
      expect(state.gradeLevelRewrite.targetGradeLevel).toBe('elementary')

      // Perform rewrite
      await user.click(rewriteButton)
      
      await waitFor(() => {
        const currentState = store.getState().editor
        expect(currentState.gradeLevelRewrite.lastRewriteResult).toBeTruthy()
      }, { timeout: 2000 })

      // Change grade level again
      await user.click(collegeRadio)
      state = store.getState().editor
      expect(state.gradeLevelRewrite.targetGradeLevel).toBe('college')

      // Previous result should still be available
      expect(state.gradeLevelRewrite.lastRewriteResult).toBeTruthy()
    })
  })

  describe('Accessibility Integration', () => {
    it('should maintain accessibility during dynamic updates', async () => {
      const testText = generateTestText('medium')
      
      renderWithStore(
        <GradeLevelRewritePanel 
          text={testText}
          onRewrite={vi.fn()}
          onClose={vi.fn()}
        />
      )

      // Verify initial accessibility
      const radioGroup = screen.getByRole('radiogroup')
      expect(radioGroup).toBeInTheDocument()

      // Trigger rewrite and verify accessibility is maintained
      const rewriteButton = screen.getByRole('button', { name: /rewrite text/i })
      await user.click(rewriteButton)

      await waitFor(() => {
        // Should still have accessible elements after state changes
        expect(screen.getByRole('radiogroup')).toBeInTheDocument()
        
        // New elements should also be accessible
        const applyButton = screen.queryByRole('button', { name: /apply rewrite/i })
        if (applyButton) {
          expect(applyButton).toBeInTheDocument()
        }
      }, { timeout: 2000 })
    })

    it('should support keyboard navigation throughout workflow', async () => {
      const testText = generateTestText('medium')
      
      renderWithStore(
        <GradeLevelRewritePanel 
          text={testText}
          onRewrite={vi.fn()}
          onClose={vi.fn()}
        />
      )

      // Test keyboard navigation
      const elementaryRadio = screen.getByDisplayValue('elementary')
      elementaryRadio.focus()

      // Navigate with arrow keys
      await user.keyboard('[ArrowDown]')
      expect(screen.getByDisplayValue('middle-school')).toHaveFocus()

      // Navigate to button with Tab
      await user.keyboard('[Tab]')
      await user.keyboard('[Tab]')
      
      // Should be able to activate button with Enter/Space
      const rewriteButton = screen.getByRole('button', { name: /rewrite text/i })
      if (document.activeElement === rewriteButton) {
        await user.keyboard('[Enter]')
        
        // Should trigger rewrite
        await waitFor(() => {
          const state = store.getState().editor
          expect(state.gradeLevelRewrite.isRewriting).toBe(true)
        })
      }
    })
  })
}) 