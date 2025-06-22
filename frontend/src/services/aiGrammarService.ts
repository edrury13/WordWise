import { supabase } from '../config/supabase'
import { StyleProfile } from '../types/styleProfile'
import { profileGrammarService } from './profileGrammarService'

export interface AIGrammarCheckOptions {
  text: string
  context?: string
  documentType?: 'general' | 'academic' | 'business' | 'creative' | 'technical' | 'email'
  checkType?: 'comprehensive' | 'grammar-only' | 'style-only'
  styleProfile?: StyleProfile | null
  changedRanges?: Array<{ start: number; end: number }>
  isDemo?: boolean
}

export interface AIGrammarSuggestion {
  id: string
  type: 'grammar' | 'spelling' | 'style' | 'clarity' | 'conciseness' | 'tone'
  message: string
  explanation: string
  replacements: string[]
  offset: number
  length: number
  context: string
  category: string
  severity: 'high' | 'medium' | 'low'
  confidence: number
  source: 'ai'
}

export interface AIGrammarCheckResult {
  success: boolean
  suggestions: AIGrammarSuggestion[]
  stats: {
    totalIssues: number
    grammarIssues: number
    spellingIssues: number
    styleIssues: number
    highSeverity: number
    mediumSeverity: number
    lowSeverity: number
    averageConfidence: number
  }
  metadata?: {
    model: string
    checkType: string
    documentType: string
    textLength: number
  }
  error?: string
}

// Cache for AI results
const aiCache = new Map<string, { timestamp: number; result: AIGrammarCheckResult }>()
const AI_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Rate limiting
let lastAICallTime = 0
const MIN_AI_CALL_INTERVAL = 500 // 0.5 seconds between AI calls (reduced for intelligent triggers)

export async function checkGrammarWithAI(options: AIGrammarCheckOptions): Promise<AIGrammarCheckResult> {
  try {
    // Validate input
    if (!options.text || options.text.trim().length < 5) {
      console.log('Text too short for AI grammar check')
      return {
        success: true,
        suggestions: [],
        stats: {
          totalIssues: 0,
          grammarIssues: 0,
          spellingIssues: 0,
          styleIssues: 0,
          highSeverity: 0,
          mediumSeverity: 0,
          lowSeverity: 0,
          averageConfidence: 0
        }
      }
    }
    
    // Apply demo mode text length limit
    if (options.isDemo && options.text.length > 1000) {
      console.log('Text too long for demo mode (max 1000 characters)')
      return {
        success: false,
        suggestions: [],
        stats: {
          totalIssues: 0,
          grammarIssues: 0,
          spellingIssues: 0,
          styleIssues: 0,
          highSeverity: 0,
          mediumSeverity: 0,
          lowSeverity: 0,
          averageConfidence: 0
        },
        error: 'Demo mode is limited to 1000 characters. Please sign up for full access.'
      }
    }
    
    console.log('🤖 AI Grammar Check Started:', {
      textLength: options.text.length,
      textPreview: options.text.substring(0, 100) + '...',
      checkType: options.checkType,
      documentType: options.documentType,
      isDemo: options.isDemo
    })

    // For demo mode, skip authentication check
    let session: any = null
    
    if (!options.isDemo) {
      // Get current session
      const { data: { session: authSession }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !authSession) {
        console.error('AI Grammar check auth error:', sessionError)
        return {
          success: false,
          suggestions: [],
          stats: {
            totalIssues: 0,
            grammarIssues: 0,
            spellingIssues: 0,
            styleIssues: 0,
            highSeverity: 0,
            mediumSeverity: 0,
            lowSeverity: 0,
            averageConfidence: 0
          },
          error: 'Authentication required for AI grammar checking'
        }
      }

      session = authSession
      console.log('🔐 AI Auth successful, user:', session.user.email)
    } else {
      console.log('🎯 Running in demo mode - skipping authentication')
    }

    // Rate limiting
    const now = Date.now()
    if (now - lastAICallTime < MIN_AI_CALL_INTERVAL) {
      console.log('AI Grammar check rate limited')
      return {
        success: false,
        suggestions: [],
        stats: {
          totalIssues: 0,
          grammarIssues: 0,
          spellingIssues: 0,
          styleIssues: 0,
          highSeverity: 0,
          mediumSeverity: 0,
          lowSeverity: 0,
          averageConfidence: 0
        },
        error: 'Please wait a moment before checking again'
      }
    }
    lastAICallTime = now

    // Check cache - for incremental checking, create a different cache key
    let cacheKey: string
    if (options.changedRanges && options.changedRanges.length > 0) {
      // For incremental, use changed ranges as part of key
      const rangeKey = options.changedRanges.map(r => `${r.start}-${r.end}`).join(',')
      cacheKey = `inc-${rangeKey}-${options.checkType}-${options.documentType}`
    } else {
      cacheKey = `${options.text.substring(0, 100)}-${options.checkType}-${options.documentType}`
    }
    
    const cached = aiCache.get(cacheKey)
    if (cached && now - cached.timestamp < AI_CACHE_TTL) {
      console.log('📦 Returning cached AI grammar result')
      return cached.result
    }

    // Make API call
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? '/api/language/ai-grammar-check'
      : 'http://localhost:5000/api/language/ai-grammar-check'

    console.log('🌐 AI API URL:', apiUrl)
    console.log('🚀 Making AI API request...')

    // Generate profile prompt if profile is provided
    let profilePrompt: string | undefined
    if (options.styleProfile) {
      profilePrompt = profileGrammarService.generateProfilePrompt(options.styleProfile)
      console.log('📝 Using style profile:', options.styleProfile.name)
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session && { 'Authorization': `Bearer ${session.access_token}` })
      },
      body: JSON.stringify({
        text: options.text,
        context: options.context,
        documentType: options.documentType || 'general',
        checkType: options.checkType || 'comprehensive',
        styleProfile: options.styleProfile ? {
          name: options.styleProfile.name,
          type: options.styleProfile.profileType,
          prompt: profilePrompt
        } : undefined,
        changedRanges: options.changedRanges,
        isDemo: options.isDemo || false
      })
    })

    console.log('📡 AI API Response Status:', response.status)
    console.log('📡 AI API Response OK:', response.ok)

    if (!response.ok) {
      let errorMessage = 'AI grammar check failed'
      let errorDetails: any = {}
      
      try {
        errorDetails = await response.json()
        errorMessage = errorDetails.error || errorDetails.message || errorMessage
      } catch (e) {
        // Response might not be JSON
        if (response.status === 406) {
          errorMessage = 'Server rejected the request. Please try refreshing the page.'
        } else if (response.status === 401) {
          errorMessage = 'Authentication expired. Please log in again.'
        } else if (response.status === 413) {
          errorMessage = 'Text is too long. Please try a shorter selection.'
        }
      }
      
      console.error('❌ AI Grammar check API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorDetails,
        message: errorMessage
      })
      
      // Provide more specific error messages
      if (response.status === 500 && errorMessage?.includes('AI service configuration')) {
        console.error('🔑 OpenAI API key may not be configured on the server')
      }
      
      // Handle 406 Not Acceptable specifically
      if (response.status === 406) {
        console.error('406 Error - Server rejected request format')
        // Try to refresh the session
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          console.error('Failed to refresh session:', refreshError)
          // Clear auth state and force re-login
          await supabase.auth.signOut()
          window.location.href = '/login'
          return {
            success: false,
            suggestions: [],
            stats: {
              totalIssues: 0,
              grammarIssues: 0,
              spellingIssues: 0,
              styleIssues: 0,
              highSeverity: 0,
              mediumSeverity: 0,
              lowSeverity: 0,
              averageConfidence: 0
            },
            error: 'Session expired. Please log in again.'
          }
        }
        if (newSession) {
          console.log('Session refreshed, retrying request...')
          // Retry the request with new session
          const retryResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${newSession.access_token}`
            },
            body: JSON.stringify({
              text: options.text,
              context: options.context,
              documentType: options.documentType || 'general',
              checkType: options.checkType || 'comprehensive',
              styleProfile: options.styleProfile ? {
                name: options.styleProfile.name,
                type: options.styleProfile.profileType,
                prompt: profilePrompt
              } : undefined,
              changedRanges: options.changedRanges
            })
          })
          
          if (retryResponse.ok) {
            const result = await retryResponse.json()
            console.log('✅ Retry successful')
            return result
          }
        }
      }
      
      return {
        success: false,
        suggestions: [],
        stats: {
          totalIssues: 0,
          grammarIssues: 0,
          spellingIssues: 0,
          styleIssues: 0,
          highSeverity: 0,
          mediumSeverity: 0,
          lowSeverity: 0,
          averageConfidence: 0
        },
        error: errorMessage
      }
    }

    const result = await response.json()
    
    console.log('✅ AI Grammar check result:', {
      success: result.success,
      suggestionsCount: result.suggestions?.length || 0,
      stats: result.stats,
      metadata: result.metadata
    })

    // Log first few suggestions for debugging
    if (result.suggestions && result.suggestions.length > 0) {
      console.log('🤖 Sample AI suggestions:', result.suggestions.slice(0, 3))
      console.log('🤖 All AI suggestion sources:', result.suggestions.map((s: any) => ({
        id: s.id,
        source: s.source,
        type: s.type,
        hasSource: 'source' in s
      })))
    }
    
    // Cache successful result
    if (result.success) {
      aiCache.set(cacheKey, { timestamp: now, result })
      
      // Clean old cache entries
      if (aiCache.size > 50) {
        const entries = Array.from(aiCache.entries())
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
        entries.slice(0, 25).forEach(([key]) => aiCache.delete(key))
      }
    }

    return result

  } catch (error) {
    console.error('💥 AI Grammar check error:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    
    return {
      success: false,
      suggestions: [],
      stats: {
        totalIssues: 0,
        grammarIssues: 0,
        spellingIssues: 0,
        styleIssues: 0,
        highSeverity: 0,
        mediumSeverity: 0,
        lowSeverity: 0,
        averageConfidence: 0
      },
      error: 'Network error while checking grammar'
    }
  }
}

// Helper function to merge AI suggestions with existing suggestions
export function mergeAISuggestions(
  existingSuggestions: any[],
  aiSuggestions: AIGrammarSuggestion[],
  changedRanges?: Array<{ start: number; end: number }>
): any[] {
  console.log('🔀 Merging suggestions:', {
    existingCount: existingSuggestions.length,
    aiCount: aiSuggestions.length,
    aiSources: aiSuggestions.map(s => s.source),
    incremental: !!changedRanges
  })
  
  // Create a map to track overlapping suggestions
  const suggestionMap = new Map<string, any>()
  
  // For incremental checking, keep suggestions outside changed ranges
  if (changedRanges && changedRanges.length > 0) {
    existingSuggestions.forEach(suggestion => {
      // Check if suggestion is within any changed range
      const isInChangedRange = changedRanges.some(range => 
        suggestion.offset >= range.start && 
        suggestion.offset + suggestion.length <= range.end
      )
      
      // Keep suggestions outside changed ranges
      if (!isInChangedRange) {
        const key = `${suggestion.offset}-${suggestion.length}`
        suggestionMap.set(key, suggestion)
      }
    })
    
    console.log('🔀 Kept', suggestionMap.size, 'suggestions outside changed ranges')
  } else {
    // Full check - add all existing suggestions
    existingSuggestions.forEach(suggestion => {
      const key = `${suggestion.offset}-${suggestion.length}`
      suggestionMap.set(key, suggestion)
    })
  }
  
  // Add AI suggestions, preferring them when there's overlap due to higher quality
  aiSuggestions.forEach(aiSuggestion => {
    const key = `${aiSuggestion.offset}-${aiSuggestion.length}`
    const existing = suggestionMap.get(key)
    
    // If there's an overlap, prefer AI suggestion if it has higher confidence
    if (!existing || (existing.confidence || 0) < aiSuggestion.confidence) {
      // Ensure AI suggestions are properly marked
      const mergedSuggestion = {
        ...aiSuggestion,
        source: 'ai', // Mark as AI-powered
        // Store the original text for validation - 'context' field contains the text at the error location
        context: aiSuggestion.context || ''
      }
      suggestionMap.set(key, mergedSuggestion)
      console.log('🤖 Added AI suggestion:', {
        id: mergedSuggestion.id,
        source: mergedSuggestion.source,
        type: mergedSuggestion.type
      })
    }
  })
  
  // Convert back to array and sort by offset
  const merged = Array.from(suggestionMap.values()).sort((a, b) => a.offset - b.offset)
  
  console.log('🔀 Merge result:', {
    totalCount: merged.length,
    sourceBreakdown: merged.reduce((acc, s) => {
      acc[s.source || 'unknown'] = (acc[s.source || 'unknown'] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  })
  
  return merged
}

// Export AI-specific features
export const AIGrammarFeatures = {
  // Check if a suggestion is from AI
  isAISuggestion: (suggestion: any) => suggestion.source === 'ai',
  
  // Get confidence level description
  getConfidenceDescription: (confidence: number): string => {
    if (confidence >= 90) return 'Very confident'
    if (confidence >= 75) return 'Confident'
    if (confidence >= 60) return 'Moderately confident'
    return 'Suggestion'
  },
  
  // Get severity icon
  getSeverityIcon: (severity: string): string => {
    switch (severity) {
      case 'high': return '🔴'
      case 'medium': return '🟡'
      case 'low': return '🔵'
      default: return '⚪'
    }
  },
  
  // Format AI explanation with examples
  formatAIExplanation: (suggestion: AIGrammarSuggestion): string => {
    let formatted = suggestion.explanation
    
    if (suggestion.replacements.length > 0) {
      formatted += '\n\nSuggested corrections:'
      suggestion.replacements.forEach((replacement, index) => {
        formatted += `\n${index + 1}. "${replacement}"`
      })
    }
    
    if (suggestion.confidence) {
      formatted += `\n\nConfidence: ${suggestion.confidence}% (${AIGrammarFeatures.getConfidenceDescription(suggestion.confidence)})`
    }
    
    return formatted
  }
}

// Clear AI cache
export function clearAICache(): void {
  aiCache.clear()
  console.log('AI grammar cache cleared')
}

// Streaming AI grammar check
export interface StreamingCallbacks {
  onStart?: () => void
  onSuggestion?: (suggestion: AIGrammarSuggestion, count: number) => void
  onComplete?: (stats: any, metadata: any) => void
  onError?: (error: string) => void
}

export async function checkGrammarWithAIStream(
  options: AIGrammarCheckOptions,
  callbacks: StreamingCallbacks
): Promise<() => void> {
  // Validate input
  if (!options.text || options.text.trim().length < 5) {
    console.log('Text too short for AI streaming check')
    callbacks.onComplete?.({
      totalIssues: 0,
      grammarIssues: 0,
      spellingIssues: 0,
      styleIssues: 0,
      highSeverity: 0,
      mediumSeverity: 0,
      lowSeverity: 0,
      averageConfidence: 0
    }, {})
    return () => {} // Return empty abort function
  }
  
  console.log('🤖 Starting AI Grammar streaming check:', {
    textLength: options.text.length,
    checkType: options.checkType,
    documentType: options.documentType,
    incremental: !!options.changedRanges
  })

  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      console.error('AI Grammar streaming auth error:', sessionError)
      callbacks.onError?.('Authentication required for AI grammar checking')
      return () => {} // Return empty abort function
    }

    // Make API call
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? '/api/language/ai-grammar-check-stream'
      : 'http://localhost:5000/api/language/ai-grammar-check-stream'

    console.log('🌐 AI Streaming API URL:', apiUrl)
    
    // Generate profile prompt if profile is provided
    let profilePrompt: string | undefined
    if (options.styleProfile) {
      profilePrompt = profileGrammarService.generateProfilePrompt(options.styleProfile)
      console.log('📝 Using style profile:', options.styleProfile.name)
    }

    // Use fetch for streaming
    let response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session && { 'Authorization': `Bearer ${session.access_token}` })
      },
      body: JSON.stringify({
        text: options.text,
        context: options.context,
        documentType: options.documentType || 'general',
        checkType: options.checkType || 'comprehensive',
        styleProfile: options.styleProfile ? {
          name: options.styleProfile.name,
          type: options.styleProfile.profileType,
          prompt: profilePrompt
        } : undefined,
        changedRanges: options.changedRanges
      })
    })

    if (!response.ok) {
      let errorMessage = 'AI grammar check failed'
      
      try {
        const error = await response.json()
        errorMessage = error.error || error.message || errorMessage
      } catch (e) {
        // Response might not be JSON
        if (response.status === 406) {
          errorMessage = 'Server rejected the request. Please try refreshing the page.'
          // Try to refresh the session
          const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError) {
            console.error('Failed to refresh session:', refreshError)
            // Clear auth state and force re-login
            await supabase.auth.signOut()
            window.location.href = '/login'
            callbacks.onError?.('Session expired. Please log in again.')
            return () => {}
          }
          if (newSession) {
            console.log('Session refreshed after 406 error, retrying...')
            // Retry the request with new session
            const retryResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(newSession && { 'Authorization': `Bearer ${newSession.access_token}` })
              },
              body: JSON.stringify({
                text: options.text,
                context: options.context,
                documentType: options.documentType || 'general',
                checkType: options.checkType || 'comprehensive',
                styleProfile: options.styleProfile ? {
                  name: options.styleProfile.name,
                  type: options.styleProfile.profileType,
                  prompt: profilePrompt
                } : undefined,
                changedRanges: options.changedRanges
              })
            })
            
            if (retryResponse.ok) {
              response = retryResponse
              console.log('✅ Streaming retry successful')
            } else {
              callbacks.onError?.('Failed to retry after session refresh')
              return () => {}
            }
          }
        } else if (response.status === 401) {
          errorMessage = 'Authentication expired. Please log in again.'
        }
      }
      
      console.error('❌ AI Grammar streaming API error:', {
        status: response.status,
        statusText: response.statusText,
        message: errorMessage
      })
      
      callbacks.onError?.(errorMessage)
      return () => {}
    }

    // Set up streaming reader
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let aborted = false

    if (!reader) {
      callbacks.onError?.('Streaming not supported')
      return () => {}
    }

    // Process stream
    const processStream = async () => {
      try {
        while (!aborted) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data) {
                try {
                  const event = JSON.parse(data)
                  
                  switch (event.type) {
                    case 'start':
                      console.log('🚀 Stream started:', event.message)
                      callbacks.onStart?.()
                      break
                      
                    case 'suggestion':
                      console.log('📝 Received suggestion:', event.count, event.suggestion)
                      callbacks.onSuggestion?.(event.suggestion, event.count)
                      break
                      
                    case 'complete':
                      console.log('✅ Stream complete:', event.stats)
                      callbacks.onComplete?.(event.stats, event.metadata)
                      break
                      
                    case 'error':
                      console.error('❌ Stream error:', event.error)
                      callbacks.onError?.(event.error)
                      break
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e, data)
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('💥 Stream processing error:', error)
        callbacks.onError?.('Stream processing failed')
      } finally {
        reader.releaseLock()
      }
    }

    // Start processing
    processStream()

    // Return abort function
    return () => {
      aborted = true
      try {
        reader.cancel()
      } catch (e) {
        // Ignore errors on cancel
      }
    }

  } catch (error) {
    console.error('💥 AI Grammar streaming error:', error)
    callbacks.onError?.('Failed to start streaming')
    return () => {}
  }
} 