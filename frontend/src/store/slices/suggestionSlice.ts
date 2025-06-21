import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { checkGrammarAndSpelling, analyzeReadability } from '../../services/languageService'
import { checkGrammarWithAI, mergeAISuggestions, AIGrammarCheckOptions } from '../../services/aiGrammarService'

export interface Suggestion {
  id: string
  type: 'grammar' | 'spelling' | 'style' | 'clarity' | 'engagement' | 'delivery' | 'conciseness' | 'tone'
  message: string
  replacements?: string[]
  offset: number
  length: number
  context: string
  explanation?: string
  category: string
  severity: 'low' | 'medium' | 'high'
  source?: 'rule-based' | 'languagetool' | 'ai'
  confidence?: number
}

export interface ReadabilityScore {
  fleschKincaid: number
  fleschReadingEase: number
  readabilityLevel: string
  averageWordsPerSentence: number
  averageSyllablesPerWord: number
  totalSentences: number
  passiveVoicePercentage: number
  longSentences: number
}

interface SuggestionState {
  suggestions: Suggestion[]
  readabilityScore: ReadabilityScore | null
  activeSuggestion: Suggestion | null
  loading: boolean
  error: string | null
  debounceTimer: number | null
  lastCheckTime: number | null
  ignoredSuggestions: string[]
  apiStatus: 'api' | 'client-fallback' | 'mixed' | 'ai-enhanced' | null
  latestRequestId: string | null
  aiCheckEnabled: boolean
  aiCheckLoading: boolean
  aiStats: {
    totalIssues: number
    grammarIssues: number
    spellingIssues: number
    styleIssues: number
    averageConfidence: number
  } | null
}

const initialState: SuggestionState = {
  suggestions: [],
  readabilityScore: null,
  activeSuggestion: null,
  loading: false,
  error: null,
  debounceTimer: null,
  lastCheckTime: null,
  ignoredSuggestions: [],
  apiStatus: null,
  latestRequestId: null,
  aiCheckEnabled: true,
  aiCheckLoading: false,
  aiStats: null,
}

// Async thunks
export const checkText = createAsyncThunk(
  'suggestions/checkText',
  async ({ text, language = 'en-US' }: { text: string; language?: string }) => {
    let grammarResults: { suggestions: Suggestion[], apiStatus: 'api' | 'client-fallback' | 'mixed' } = { 
      suggestions: [], 
      apiStatus: 'client-fallback' as const 
    }
    let readabilityResults = null

    // Try grammar checking
    try {
      grammarResults = await checkGrammarAndSpelling(text, language)
      console.log('✅ Grammar check completed:', grammarResults.suggestions.length, 'suggestions')
    } catch (grammarError) {
      console.warn('⚠️ Grammar check failed:', grammarError)
      // Keep default empty results
    }

    // Try readability analysis separately - this should almost never fail
    try {
      readabilityResults = await analyzeReadability(text)
      console.log('✅ Readability analysis completed:', readabilityResults)
    } catch (readabilityError) {
      console.error('❌ Readability analysis failed:', readabilityError)
      // Provide a basic fallback readability score to ensure UI always shows something
      console.log('🔄 Providing fallback readability score')
      readabilityResults = {
        fleschKincaid: 10.0,
        fleschReadingEase: 60.0,
        readabilityLevel: 'High School',
        averageWordsPerSentence: Math.max(text.split(/\s+/).length / Math.max(text.split(/[.!?]+/).length, 1), 1),
        averageSyllablesPerWord: 1.5,
        totalSentences: Math.max(text.split(/[.!?]+/).filter(s => s.trim().length > 0).length, 1),
        passiveVoicePercentage: 0.0,
        longSentences: 0,
      }
    }

    // Handle rate limiting specifically
    if (grammarResults.apiStatus === 'client-fallback' && 
        grammarResults.suggestions.length === 0 && 
        text.trim().length > 0) {
      // This might indicate a rate limit or API failure
      console.warn('🚨 Possible rate limiting or API failure detected')
    }

    return {
      suggestions: grammarResults.suggestions,
      readabilityScore: readabilityResults,
      apiStatus: grammarResults.apiStatus,
    }
  }
)

export const recheckText = createAsyncThunk(
  'suggestions/recheckText',
  async ({ text, language = 'en-US' }: { text: string; language?: string }, { dispatch }) => {
    // Clear existing suggestions
    dispatch(clearSuggestions())
    
    // Wait a moment to avoid too frequent API calls
    await new Promise(resolve => setTimeout(resolve, 300))
    
    return dispatch(checkText({ text, language }))
  }
)

// AI-enhanced grammar check
export const checkTextWithAI = createAsyncThunk(
  'suggestions/checkTextWithAI',
  async ({ 
    text, 
    language = 'en-US',
    documentType = 'general',
    checkType = 'comprehensive',
    enableAI = true
  }: { 
    text: string
    language?: string
    documentType?: AIGrammarCheckOptions['documentType']
    checkType?: AIGrammarCheckOptions['checkType']
    enableAI?: boolean
  }) => {
    let grammarResults: { suggestions: Suggestion[], apiStatus: 'api' | 'client-fallback' | 'mixed' | 'ai-enhanced' } = { 
      suggestions: [], 
      apiStatus: 'client-fallback' as const 
    }
    let readabilityResults = null
    let aiResults = null

    // Try traditional grammar checking first
    try {
      grammarResults = await checkGrammarAndSpelling(text, language)
      console.log('✅ Grammar check completed:', grammarResults.suggestions.length, 'suggestions')
    } catch (grammarError) {
      console.warn('⚠️ Grammar check failed:', grammarError)
    }

    // Try AI-enhanced checking if enabled and text is substantial
    if (enableAI && text.trim().length > 50) {
      try {
        console.log('🤖 Starting AI grammar check...')
        aiResults = await checkGrammarWithAI({
          text,
          documentType,
          checkType
        })
        
        console.log('🤖 AI Results received:', {
          success: aiResults.success,
          error: aiResults.error,
          suggestionsCount: aiResults.suggestions?.length || 0,
          stats: aiResults.stats
        })
        
        if (aiResults.success && aiResults.suggestions.length > 0) {
          console.log('✅ AI grammar check completed:', aiResults.suggestions.length, 'AI suggestions')
          console.log('📝 Traditional suggestions before merge:', grammarResults.suggestions.length)
          
          // Merge AI suggestions with traditional ones
          const mergedSuggestions = mergeAISuggestions(grammarResults.suggestions, aiResults.suggestions)
          
          console.log('🔀 Merged suggestions:', mergedSuggestions.length)
          console.log('🔀 Merge details:', {
            traditional: grammarResults.suggestions.length,
            ai: aiResults.suggestions.length,
            merged: mergedSuggestions.length
          })
          
          grammarResults = {
            suggestions: mergedSuggestions,
            apiStatus: 'ai-enhanced'
          }
        } else if (!aiResults.success) {
          console.warn('⚠️ AI check was not successful:', aiResults.error)
        } else {
          console.log('ℹ️ AI check successful but no suggestions found')
        }
      } catch (aiError) {
        console.warn('⚠️ AI grammar check failed:', aiError)
        // Continue with traditional results
      }
    } else {
      console.log('⏭️ Skipping AI check:', {
        enableAI,
        textLength: text.trim().length,
        reason: !enableAI ? 'AI disabled' : 'Text too short'
      })
    }

    // Try readability analysis
    try {
      readabilityResults = await analyzeReadability(text)
      console.log('✅ Readability analysis completed:', readabilityResults)
    } catch (readabilityError) {
      console.error('❌ Readability analysis failed:', readabilityError)
      // Provide fallback readability score
      readabilityResults = {
        fleschKincaid: 10.0,
        fleschReadingEase: 60.0,
        readabilityLevel: 'High School',
        averageWordsPerSentence: Math.max(text.split(/\s+/).length / Math.max(text.split(/[.!?]+/).length, 1), 1),
        averageSyllablesPerWord: 1.5,
        totalSentences: Math.max(text.split(/[.!?]+/).filter(s => s.trim().length > 0).length, 1),
        passiveVoicePercentage: 0.0,
        longSentences: 0,
      }
    }

    return {
      suggestions: grammarResults.suggestions,
      readabilityScore: readabilityResults,
      apiStatus: grammarResults.apiStatus,
      aiStats: aiResults?.stats || null,
    }
  }
)

const suggestionSlice = createSlice({
  name: 'suggestions',
  initialState,
  reducers: {
    setActiveSuggestion: (state, action: PayloadAction<Suggestion | null>) => {
      state.activeSuggestion = action.payload
    },
    applySuggestion: (state, action: PayloadAction<{ suggestionId: string; replacement: string; offset: number; length: number }>) => {
      const { suggestionId, replacement, offset, length } = action.payload
      // Remove the applied suggestion and any that overlap the replaced range
      state.suggestions = state.suggestions.filter(s => {
        const overlap = !(s.offset + s.length <= offset || s.offset >= offset + length)
        return s.id !== suggestionId && !overlap
      })

      // Calculate the change in text length so we can shift remaining offsets
      const delta = replacement.length - length

      // Adjust offsets for suggestions that come after the replaced range
      if (delta !== 0) {
        state.suggestions.forEach(s => {
          if (s.offset > offset) {
            s.offset += delta
          }
        })
      }

      state.activeSuggestion = null
    },
    ignoreSuggestion: (state, action: PayloadAction<string>) => {
      const suggestionId = action.payload
      state.suggestions = state.suggestions.filter(s => s.id !== suggestionId)
      state.ignoredSuggestions.push(suggestionId)
      state.activeSuggestion = null
    },
    ignoreAllSuggestions: (state, action: PayloadAction<string>) => {
      const suggestionType = action.payload
      const toIgnore = state.suggestions.filter(s => s.type === suggestionType)
      toIgnore.forEach(suggestion => {
        state.ignoredSuggestions.push(suggestion.id)
      })
      state.suggestions = state.suggestions.filter(s => s.type !== suggestionType)
      state.activeSuggestion = null
    },
    acceptAllSuggestions: (state, action: PayloadAction<{ 
      acceptedSuggestions: Array<{ id: string, replacement: string }> 
    }>) => {
      // Remove all accepted suggestions from the list
      const acceptedIds = action.payload.acceptedSuggestions.map(s => s.id)
      state.suggestions = state.suggestions.filter(s => !acceptedIds.includes(s.id))
      state.activeSuggestion = null
    },
    ignoreAllCurrentSuggestions: (state) => {
      // Ignore all current suggestions regardless of type
      state.suggestions.forEach(suggestion => {
        state.ignoredSuggestions.push(suggestion.id)
      })
      state.suggestions = []
      state.activeSuggestion = null
    },
    ignoreAllSuggestionsByType: (state, action: PayloadAction<string>) => {
      const suggestionType = action.payload
      const toIgnore = state.suggestions.filter(s => s.type === suggestionType)
      toIgnore.forEach(suggestion => {
        state.ignoredSuggestions.push(suggestion.id)
      })
      state.suggestions = state.suggestions.filter(s => s.type !== suggestionType)
      state.activeSuggestion = null
    },
    clearSuggestions: (state) => {
      state.suggestions = []
      state.activeSuggestion = null
    },
    clearError: (state) => {
      state.error = null
    },
    setDebounceTimer: (state, action: PayloadAction<number | null>) => {
      state.debounceTimer = action.payload
    },
    clearIgnoredSuggestions: (state) => {
      state.ignoredSuggestions = []
    },
    toggleAICheck: (state) => {
      state.aiCheckEnabled = !state.aiCheckEnabled
    },
    setAICheckEnabled: (state, action: PayloadAction<boolean>) => {
      state.aiCheckEnabled = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      // Check text
      .addCase(checkText.pending, (state, action) => {
        state.loading = true
        state.error = null
        state.latestRequestId = action.meta.requestId
      })
      .addCase(checkText.fulfilled, (state, action) => {
        // Ignore results from outdated requests
        if (action.meta.requestId !== state.latestRequestId) {
          console.warn('⏭️ Ignoring out-of-date grammar check result')
          return
        }
        state.loading = false
        state.suggestions = action.payload.suggestions.filter(
          (s: Suggestion) => !state.ignoredSuggestions.includes(s.id)
        )
        
        // Debug logging for readability score
        console.log('📊 Redux: Setting readability score:', {
          hasScore: !!action.payload.readabilityScore,
          score: action.payload.readabilityScore,
          isProd: typeof window !== 'undefined' ? window.location.hostname.includes('vercel') : false
        })
        
        state.readabilityScore = action.payload.readabilityScore
        state.apiStatus = action.payload.apiStatus
        state.lastCheckTime = Date.now()
      })
      .addCase(checkText.rejected, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          return
        }
        state.loading = false
        // Handle rate limiting more gracefully
        if (action.payload === 'Rate limited. Please wait a moment before trying again.') {
          state.error = action.payload as string
        } else {
          state.error = action.error.message || 'Failed to check text'
        }
      })
      // Recheck text
      .addCase(recheckText.pending, (state) => {
        state.loading = true
      })
      .addCase(recheckText.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(recheckText.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to recheck text'
      })
      // AI-enhanced text checking
      .addCase(checkTextWithAI.pending, (state, action) => {
        state.loading = true
        state.aiCheckLoading = true
        state.error = null
        state.latestRequestId = action.meta.requestId
      })
      .addCase(checkTextWithAI.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          console.warn('⏭️ Ignoring out-of-date AI grammar check result')
          return
        }
        state.loading = false
        state.aiCheckLoading = false
        state.suggestions = action.payload.suggestions.filter(
          (s: Suggestion) => !state.ignoredSuggestions.includes(s.id)
        )
        state.readabilityScore = action.payload.readabilityScore
        state.apiStatus = action.payload.apiStatus
        state.aiStats = action.payload.aiStats
        state.lastCheckTime = Date.now()
      })
      .addCase(checkTextWithAI.rejected, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          return
        }
        state.loading = false
        state.aiCheckLoading = false
        state.error = action.error.message || 'Failed to check text with AI'
      })
  },
})

// Selectors
export const selectApiStatus = (state: { suggestions: SuggestionState }) => state.suggestions.apiStatus
export const selectAICheckEnabled = (state: { suggestions: SuggestionState }) => state.suggestions.aiCheckEnabled
export const selectAIStats = (state: { suggestions: SuggestionState }) => state.suggestions.aiStats

export const {
  setActiveSuggestion,
  applySuggestion,
  ignoreSuggestion,
  ignoreAllSuggestions,
  acceptAllSuggestions,
  ignoreAllCurrentSuggestions,
  ignoreAllSuggestionsByType,
  clearSuggestions,
  clearError,
  setDebounceTimer,
  clearIgnoredSuggestions,
  toggleAICheck,
  setAICheckEnabled,
} = suggestionSlice.actions

export default suggestionSlice.reducer 