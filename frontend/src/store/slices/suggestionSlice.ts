import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { checkGrammarAndSpelling, analyzeReadability } from '../../services/languageService'
import { checkGrammarWithAI, mergeAISuggestions, AIGrammarCheckOptions } from '../../services/aiGrammarService'
import { StyleProfile } from '../../types/styleProfile'
import { profileGrammarService } from '../../services/profileGrammarService'
import { ignoredWordsService } from '../../services/ignoredWordsService'

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
  isInformational?: boolean
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
  ignoredSuggestionPatterns: Array<{ text: string; type: string; message: string }>
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
  streamingStatus: {
    isStreaming: boolean
    suggestionsReceived: number
    message?: string
  }
  streamingBuffer: Suggestion[] // Buffer for suggestions during streaming
  hasSpellingError: boolean // Flag to track if spelling error was found
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
  ignoredSuggestionPatterns: [],
  apiStatus: null,
  latestRequestId: null,
  aiCheckEnabled: true,
  aiCheckLoading: false,
  aiStats: null,
  streamingStatus: {
    isStreaming: false,
    suggestionsReceived: 0,
    message: undefined
  },
  streamingBuffer: [], // Initialize buffer
  hasSpellingError: false // Initialize flag
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

    // Filter out ignored words
    const filteredSuggestions = ignoredWordsService.filterSuggestions(grammarResults.suggestions, text)
    if (filteredSuggestions.length !== grammarResults.suggestions.length) {
      console.log(`🔍 Filtered out ${grammarResults.suggestions.length - filteredSuggestions.length} ignored words`)
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
      suggestions: filteredSuggestions,
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
    enableAI = true,
    styleProfile,
    changedRanges,
    isDemo = false
  }: { 
    text: string
    language?: string
    documentType?: AIGrammarCheckOptions['documentType']
    checkType?: AIGrammarCheckOptions['checkType']
    enableAI?: boolean
    styleProfile?: StyleProfile | null
    changedRanges?: Array<{ start: number; end: number }>
    isDemo?: boolean
  }, { getState }) => {
    let grammarResults: { suggestions: Suggestion[], apiStatus: 'api' | 'client-fallback' | 'mixed' | 'ai-enhanced' } = { 
      suggestions: [], 
      apiStatus: 'client-fallback' as const 
    }
    let readabilityResults = null
    let aiResults = null
    
    // Get current suggestions for incremental checking
    const state = getState() as any
    const currentSuggestions = state.suggestions?.suggestions || []

    // Try traditional grammar checking first - skip for demo mode
    if (!isDemo) {
      try {
        // For incremental checking with traditional API, we still pass the full text
        // but also send changedRanges so the backend can optimize
        grammarResults = await checkGrammarAndSpelling(text, language, 3, changedRanges)
        console.log('✅ Grammar check completed:', grammarResults.suggestions.length, 'suggestions', changedRanges ? '(incremental)' : '(full)')
      } catch (grammarError) {
        console.warn('⚠️ Grammar check failed:', grammarError)
      }
    }

    // Try AI-enhanced checking if enabled and text is substantial
    if (enableAI && text.trim().length > 10) {  // Reduced minimum length for testing
      try {
        console.log('🤖 Starting AI grammar check...', {
          textLength: text.length,
          documentType,
          checkType,
          enableAI,
          isDemo
        })
        aiResults = await checkGrammarWithAI({
          text,
          documentType,
          checkType,
          styleProfile,
          changedRanges,
          isDemo
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
          
          // For incremental checking, merge with existing suggestions
          // Otherwise, merge AI with traditional results
          const baseSuggestions = changedRanges ? currentSuggestions : grammarResults.suggestions
          const mergedSuggestions = mergeAISuggestions(baseSuggestions, aiResults.suggestions, changedRanges)
          
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

    // Apply profile rules to suggestions if a profile is provided
    let finalSuggestions = grammarResults.suggestions
    if (styleProfile) {
      console.log('📋 Applying style profile rules to suggestions')
      finalSuggestions = profileGrammarService.applyProfileRules(
        grammarResults.suggestions,
        styleProfile,
        text
      )
      // Filter out ignored suggestions based on profile rules
      finalSuggestions = finalSuggestions.filter(s => 
        !('profileSeverity' in s) || (s as any).profileSeverity !== 'ignore'
      )
      console.log('📋 Suggestions after profile rules:', finalSuggestions.length)
    }
    
    // Filter out ignored words
    finalSuggestions = ignoredWordsService.filterSuggestions(finalSuggestions, text)
    console.log('🔍 Suggestions after ignored words filter:', finalSuggestions.length)
    
    console.log('📊 Final checkTextWithAI result:', {
      totalSuggestions: finalSuggestions.length,
      bySource: finalSuggestions.reduce((acc, s) => {
        acc[s.source || 'unknown'] = (acc[s.source || 'unknown'] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      apiStatus: grammarResults.apiStatus,
      hasAIStats: !!aiResults?.stats
    })

    return {
      suggestions: finalSuggestions,
      readabilityScore: readabilityResults,
      apiStatus: grammarResults.apiStatus,
      aiStats: aiResults?.stats || null,
    }
  }
)

// Helper function to check if a suggestion matches an ignored pattern
const matchesIgnoredPattern = (
  suggestion: Suggestion, 
  patterns: Array<{ text: string; type: string; message: string }>,
  fullText?: string
): boolean => {
  return patterns.some(pattern => {
    // First check if the type matches
    if (suggestion.type !== pattern.type) {
      return false
    }
    
    // For style suggestions, use fuzzy matching
    if (['style', 'clarity', 'engagement', 'delivery'].includes(suggestion.type)) {
      // Check if the message is similar (could be the same issue)
      const messageSimilarity = calculateStringSimilarity(suggestion.message, pattern.message)
      if (messageSimilarity > 0.8) {
        return true
      }
      
      // If we have the full text, check if the suggestion is for similar text
      if (fullText && pattern.text) {
        const suggestionText = fullText.substring(suggestion.offset, suggestion.offset + suggestion.length)
        const textSimilarity = calculateStringSimilarity(suggestionText.toLowerCase(), pattern.text.toLowerCase())
        
        // If the text is very similar and the message is somewhat similar, it's probably the same issue
        if (textSimilarity > 0.9 && messageSimilarity > 0.5) {
          return true
        }
      }
      
      return false
    }
    
    // For grammar/spelling, require exact message match
    if (suggestion.message === pattern.message) {
      // If we have text, also check that
      if (fullText && pattern.text) {
        const suggestionText = fullText.substring(suggestion.offset, suggestion.offset + suggestion.length)
        return suggestionText === pattern.text
      }
      return true
    }
    
    return false
  })
}

// Helper function to calculate string similarity (simple version)
const calculateStringSimilarity = (str1: string, str2: string): number => {
  if (str1 === str2) return 1
  if (!str1 || !str2) return 0
  
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  const editDistance = getEditDistance(shorter, longer)
  return (longer.length - editDistance) / longer.length
}

// Simple edit distance calculation
const getEditDistance = (s1: string, s2: string): number => {
  const costs: number[] = []
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else if (j > 0) {
        let newValue = costs[j - 1]
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(newValue, lastValue, costs[j]) + 1
        }
        costs[j - 1] = lastValue
        lastValue = newValue
      }
    }
    if (i > 0) costs[s2.length] = lastValue
  }
  return costs[s2.length]
}

const suggestionSlice = createSlice({
  name: 'suggestions',
  initialState,
  reducers: {
    setActiveSuggestion: (state, action: PayloadAction<Suggestion | null>) => {
      state.activeSuggestion = action.payload
    },
    applySuggestion: (state, action: PayloadAction<{ suggestionId: string; replacement: string; offset: number; length: number }>) => {
      const { suggestionId, replacement, offset, length } = action.payload
      
      console.log('Applying suggestion:', {
        suggestionId,
        offset,
        length,
        replacementLength: replacement.length,
        delta: replacement.length - length
      })
      
      // Find the suggestion being applied
      const appliedSuggestion = state.suggestions.find(s => s.id === suggestionId)
      
      // If it's a style suggestion, add it to ignored patterns to prevent re-detection
      if (appliedSuggestion && ['style', 'clarity', 'engagement', 'delivery'].includes(appliedSuggestion.type)) {
        const pattern = {
          text: replacement, // Store the replacement text
          type: appliedSuggestion.type,
          message: appliedSuggestion.message
        }
        state.ignoredSuggestionPatterns.push(pattern)
        
        // Note: We can't reliably get the original text from context since it might be out of sync
        // The component should pass the original text if needed
      }
      
      // Remove the applied suggestion and any that overlap the replaced range
      state.suggestions = state.suggestions.filter(s => {
        // Remove the applied suggestion
        if (s.id === suggestionId) return false
        
        // Check for overlaps with the edited region
        const suggestionEnd = s.offset + s.length
        const editEnd = offset + length
        
        // If suggestion is completely before the edit, it's safe to keep
        if (suggestionEnd <= offset) {
          return true
        }
        
        // If suggestion starts at or after the edit end + replacement length, it needs offset adjustment but is safe
        if (s.offset >= editEnd) {
          return true
        }
        
        // Otherwise it overlaps in some way and should be removed
        console.log(`Removing overlapping suggestion ${s.id} at offset ${s.offset}`)
        return false
      })

      // Calculate the change in text length
      const delta = replacement.length - length

      console.log('Offset adjustment needed:', {
        delta,
        suggestionsBeforeAdjustment: state.suggestions.map(s => ({
          id: s.id,
          offset: s.offset,
          length: s.length,
          type: s.type
        }))
      })

      // Adjust offsets for suggestions that come after the replaced range
      if (delta !== 0) {
        state.suggestions = state.suggestions.map(s => {
          // Only need to adjust suggestions that come after the edit
          // (overlapping ones have already been removed)
          if (s.offset >= offset + length) {
            console.log(`Adjusting suggestion ${s.id} offset from ${s.offset} to ${s.offset + delta}`)
            return {
              ...s,
              offset: s.offset + delta
            }
          }
          return s
        })
      }

      state.activeSuggestion = null
    },
    updateSuggestionOffsets: (state, action: PayloadAction<{ changeOffset: number; delta: number; changeEndOld: number }>) => {
      const { changeOffset, delta, changeEndOld } = action.payload
      
      console.log('Updating suggestion offsets:', { changeOffset, delta, changeEndOld, suggestionCount: state.suggestions.length })
      
      state.suggestions = state.suggestions.map(suggestion => {
        const suggestionEnd = suggestion.offset + suggestion.length

        // Determine if this edit was an insertion (delta > 0 and no characters were removed)
        const isInsertion = delta > 0 && changeEndOld === changeOffset

        // CASE A – Suggestion overlaps with the edited range (including pure insertions that land inside the suggestion)
        const overlapsRemoval = suggestion.offset < changeEndOld && suggestionEnd > changeOffset
        const insertionHitsSuggestion = isInsertion && (
          suggestion.offset <= changeOffset && suggestionEnd >= changeOffset
        )
        if (overlapsRemoval || insertionHitsSuggestion) {
          console.log(`Removing suggestion ${suggestion.id} that overlaps with edit; start ${suggestion.offset}, end ${suggestionEnd}`)
          return null
        }

        // CASE B – Suggestion is completely after the edit. Adjust its offset by delta.
        if (suggestion.offset >= changeEndOld) {
          return {
            ...suggestion,
            offset: suggestion.offset + delta
          }
        }

        // CASE C – Suggestion completely before the edit. No change.
        return suggestion
      }).filter(Boolean) as Suggestion[] // Remove nulls
    },
    ignoreSuggestion: (state, action: PayloadAction<{ suggestionId: string; originalText?: string }>) => {
      const { suggestionId, originalText } = typeof action.payload === 'string' 
        ? { suggestionId: action.payload, originalText: undefined }
        : action.payload
        
      const suggestion = state.suggestions.find(s => s.id === suggestionId)
      
      if (suggestion && originalText) {
        // Store the pattern for this ignored suggestion
        const pattern = {
          text: originalText,
          type: suggestion.type,
          message: suggestion.message
        }
        state.ignoredSuggestionPatterns.push(pattern)
      }
      
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
    removeSuggestionsInRange: (state, action: PayloadAction<{ start: number; end: number }>) => {
      const { start, end } = action.payload
      
      // Remove suggestions that fall within the range
      state.suggestions = state.suggestions.filter(s => {
        const suggestionStart = s.offset
        const suggestionEnd = s.offset + s.length
        
        // Keep suggestions that are completely outside the range
        return suggestionEnd < start || suggestionStart > end
      })
    },
    replaceSuggestionsInRange: (state, action: PayloadAction<{
      start: number
      end: number
      newSuggestions: Suggestion[]
      currentText: string
    }>) => {
      const { start, end, newSuggestions, currentText } = action.payload
      
      console.log('Replacing suggestions in range:', { start, end, newCount: newSuggestions.length })
      
      // Remove existing suggestions in the range
      const suggestionsOutsideRange = state.suggestions.filter(s => {
        const suggestionStart = s.offset
        const suggestionEnd = s.offset + s.length
        
        // Keep suggestions that are completely outside the range
        return suggestionEnd < start || suggestionStart > end
      })
      
      // Filter new suggestions to ensure they're within the text bounds
      const validNewSuggestions = newSuggestions.filter(s => {
        const isValid = s.offset >= 0 && 
                       s.offset + s.length <= currentText.length &&
                       s.offset >= start && 
                       s.offset + s.length <= end
        if (!isValid) {
          console.log('Filtering out invalid suggestion:', {
            offset: s.offset,
            length: s.length,
            rangeStart: start,
            rangeEnd: end,
            textLength: currentText.length
          })
        }
        return isValid
      })
      
      // Merge with existing suggestions
      state.suggestions = [...suggestionsOutsideRange, ...validNewSuggestions]
      
      // Sort by offset for consistent display
      state.suggestions.sort((a, b) => a.offset - b.offset)
      
      console.log('Updated suggestions after range replacement:', {
        total: state.suggestions.length,
        outsideRange: suggestionsOutsideRange.length,
        newAdded: validNewSuggestions.length
      })
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
      state.streamingBuffer = []
      state.hasSpellingError = false
    },
    clearNonSpellingSuggestions: (state) => {
      // Keep only spelling suggestions
      state.suggestions = state.suggestions.filter(s => s.type === 'spelling')
      state.activeSuggestion = null
      state.streamingBuffer = []
      // Don't reset hasSpellingError since we're keeping spelling errors
    },
    clearError: (state) => {
      state.error = null
    },
    setDebounceTimer: (state, action: PayloadAction<number | null>) => {
      state.debounceTimer = action.payload
    },
    clearIgnoredSuggestions: (state) => {
      state.ignoredSuggestions = []
      state.ignoredSuggestionPatterns = []
    },
    toggleAICheck: (state) => {
      state.aiCheckEnabled = !state.aiCheckEnabled
    },
    setAICheckEnabled: (state, action: PayloadAction<boolean>) => {
      state.aiCheckEnabled = action.payload
    },
    validateSuggestions: (state, action: PayloadAction<{ currentText: string }>) => {
      const { currentText } = action.payload
      const beforeCount = state.suggestions.length
      
      // Update suggestions to mark those with negative offsets as informational
      state.suggestions = state.suggestions.map(suggestion => {
        // Check if offset is negative
        if (suggestion.offset < 0) {
          console.log('Marking suggestion as informational (negative offset):', {
            id: suggestion.id,
            offset: suggestion.offset,
            type: suggestion.type,
            source: suggestion.source
          })
          // Add an informational flag instead of filtering out
          return {
            ...suggestion,
            isInformational: true,
            explanation: (suggestion.explanation || suggestion.message) + ' (Informational only - location in text could not be determined)'
          }
        }
        
        // Check bounds for positive offset suggestions
        if (suggestion.offset + suggestion.length > currentText.length) {
          console.log('Removing out-of-bounds suggestion:', {
            id: suggestion.id,
            offset: suggestion.offset,
            length: suggestion.length,
            textLength: currentText.length,
            source: suggestion.source
          })
          return null // Will be filtered out below
        }
        
        return suggestion
      }).filter(Boolean) as Suggestion[] // Remove nulls
      
      const afterCount = state.suggestions.length
      if (beforeCount !== afterCount) {
        console.log(`Validation removed ${beforeCount - afterCount} suggestions (${beforeCount} -> ${afterCount})`)
      }
    },
    // Streaming reducers
    startStreaming: (state, action: PayloadAction<{ message?: string }>) => {
      state.streamingStatus = {
        isStreaming: true,
        suggestionsReceived: 0,
        message: action.payload.message || 'Starting AI analysis...'
      }
      state.loading = true
      state.error = null
      state.streamingBuffer = [] // Clear buffer when starting new stream
      state.hasSpellingError = false // Reset spelling error flag for new stream
      // Note: We're NOT clearing state.suggestions - keeping existing ones
    },
    addStreamingSuggestion: (state, action: PayloadAction<{ suggestion: Suggestion; count: number; currentText?: string }>) => {
      const { suggestion, count, currentText } = action.payload
      
      // Check if this suggestion is in the ignored list
      if (state.ignoredSuggestions.includes(suggestion.id)) {
        console.log('Skipping ignored suggestion by ID:', suggestion.id)
        return
      }
      
      // Check if this suggestion matches an ignored pattern
      if (matchesIgnoredPattern(suggestion, state.ignoredSuggestionPatterns, currentText)) {
        console.log('Skipping ignored suggestion by pattern:', suggestion.type, suggestion.message)
        return
      }
      
      // Check if this is a spelling error
      if (suggestion.type === 'spelling') {
        console.log('🚨 Spelling error detected during streaming:', suggestion)
        state.hasSpellingError = true
        
        // Clear the buffer to prevent any buffered suggestions from being added later
        state.streamingBuffer = []
        
        // Add the spelling error directly to suggestions (keep existing ones)
        state.suggestions.push(suggestion)
        
        // Update streaming status to indicate we found a spelling error
        state.streamingStatus.message = 'Spelling error found'
        state.streamingStatus.suggestionsReceived = count
        return
      }
      
      // If we already have a spelling error, ignore other suggestions
      if (state.hasSpellingError) {
        console.log('Ignoring non-spelling suggestion due to existing spelling error')
        return
      }
      
      // Otherwise, add to buffer instead of directly to suggestions
      const existingIndex = state.streamingBuffer.findIndex(s => 
        s.offset === suggestion.offset && s.length === suggestion.length
      )
      
      if (existingIndex >= 0) {
        // Replace existing suggestion in buffer
        state.streamingBuffer[existingIndex] = suggestion
      } else {
        // Add new suggestion to buffer
        state.streamingBuffer.push(suggestion)
      }
      
      // Update streaming status
      state.streamingStatus.suggestionsReceived = count
      state.streamingStatus.message = `Analyzing... Found ${count} potential issue${count !== 1 ? 's' : ''}...`
    },
    completeStreaming: (state, action: PayloadAction<{ stats: any; metadata: any }>) => {
      // If we have a spelling error, we already added it and cleared the buffer
      if (state.hasSpellingError) {
        console.log('✅ Streaming complete: keeping existing suggestions plus spelling error')
      } else if (state.streamingBuffer.length > 0) {
        // No spelling error, apply all buffered suggestions
        // Sort buffered suggestions by offset
        state.streamingBuffer.sort((a, b) => a.offset - b.offset)
        
        // Merge buffered suggestions with existing ones
        state.suggestions = [...state.suggestions, ...state.streamingBuffer]
        console.log(`✅ Streaming complete: added ${state.streamingBuffer.length} buffered suggestions to ${state.suggestions.length - state.streamingBuffer.length} existing`)
        
        // Re-sort all suggestions by offset
        state.suggestions.sort((a, b) => a.offset - b.offset)
      }
      
      state.streamingStatus = {
        isStreaming: false,
        suggestionsReceived: state.suggestions.length,
        message: state.hasSpellingError ? 'Spelling error found' : 'Analysis complete'
      }
      state.loading = false
      state.aiStats = action.payload.stats
      state.apiStatus = 'ai-enhanced'
      state.lastCheckTime = Date.now()
      
      // Clear buffer
      state.streamingBuffer = []
    },
    streamingError: (state, action: PayloadAction<string>) => {
      state.streamingStatus = {
        isStreaming: false,
        suggestionsReceived: 0,
        message: 'Streaming failed'
      }
      state.loading = false
      state.error = action.payload
      state.streamingBuffer = [] // Clear buffer on error
      state.hasSpellingError = false
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
        console.log('🚀 AI check starting, request ID:', action.meta.requestId)
        state.loading = true
        state.aiCheckLoading = true
        state.error = null
        state.latestRequestId = action.meta.requestId
        // Don't clear suggestions here - let the fulfilled action replace them
      })
      .addCase(checkTextWithAI.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          console.warn('⏭️ Ignoring out-of-date AI grammar check result')
          return
        }
        state.loading = false
        state.aiCheckLoading = false
        
        console.log('📥 AI suggestions received:', {
          count: action.payload.suggestions.length,
          apiStatus: action.payload.apiStatus,
          hasAIStats: !!action.payload.aiStats,
          suggestions: action.payload.suggestions.slice(0, 3).map(s => ({
            id: s.id,
            type: s.type,
            offset: s.offset,
            length: s.length,
            source: s.source
          }))
        })
        
        state.suggestions = action.payload.suggestions.filter(
          (s: Suggestion) => !state.ignoredSuggestions.includes(s.id) && 
                            !matchesIgnoredPattern(s, state.ignoredSuggestionPatterns)
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
export const selectStreamingStatus = (state: { suggestions: SuggestionState }) => state.suggestions.streamingStatus
export const selectHasSpellingError = (state: { suggestions: SuggestionState }) => state.suggestions.hasSpellingError

export const {
  setActiveSuggestion,
  applySuggestion,
  updateSuggestionOffsets,
  ignoreSuggestion,
  ignoreAllSuggestions,
  acceptAllSuggestions,
  ignoreAllCurrentSuggestions,
  ignoreAllSuggestionsByType,
  clearSuggestions,
  clearNonSpellingSuggestions,
  clearError,
  setDebounceTimer,
  clearIgnoredSuggestions,
  toggleAICheck,
  setAICheckEnabled,
  validateSuggestions,
  startStreaming,
  addStreamingSuggestion,
  completeStreaming,
  streamingError,
  removeSuggestionsInRange,
  replaceSuggestionsInRange,
} = suggestionSlice.actions

export default suggestionSlice.reducer 