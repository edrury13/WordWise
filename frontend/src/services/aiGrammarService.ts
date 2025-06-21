import { supabase } from '../config/supabase'
import { StyleProfile } from '../types/styleProfile'
import { profileGrammarService } from './profileGrammarService'

export interface AIGrammarCheckOptions {
  text: string
  context?: string
  documentType?: 'general' | 'academic' | 'business' | 'creative' | 'technical' | 'email'
  checkType?: 'comprehensive' | 'grammar-only' | 'style-only'
  styleProfile?: StyleProfile | null
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
const MIN_AI_CALL_INTERVAL = 2000 // 2 seconds between AI calls

export async function checkGrammarWithAI(options: AIGrammarCheckOptions): Promise<AIGrammarCheckResult> {
  try {
    console.log('🤖 AI Grammar Check Started:', {
      textLength: options.text.length,
      textPreview: options.text.substring(0, 100) + '...',
      checkType: options.checkType,
      documentType: options.documentType
    })

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
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

    console.log('🔐 AI Auth successful, user:', session.user.email)

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

    // Check cache
    const cacheKey = `${options.text.substring(0, 100)}-${options.checkType}-${options.documentType}`
    const cached = aiCache.get(cacheKey)
    if (cached && now - cached.timestamp < AI_CACHE_TTL) {
      console.log('📦 Returning cached AI grammar result')
      return cached.result
    }

    // Make API call
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? 'https://wordwise-ten.vercel.app/api/language/ai-grammar-check'
      : 'http://localhost:3001/api/language/ai-grammar-check'

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
        'Authorization': `Bearer ${session.access_token}`
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
        } : undefined
      })
    })

    console.log('📡 AI API Response Status:', response.status)
    console.log('📡 AI API Response OK:', response.ok)

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ AI Grammar check API error:', {
        status: response.status,
        error: error,
        message: error.error || 'Unknown error'
      })
      
      // Provide more specific error messages
      if (response.status === 500 && error.error?.includes('AI service configuration')) {
        console.error('🔑 OpenAI API key may not be configured on the server')
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
        error: error.error || 'AI grammar check failed'
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
  aiSuggestions: AIGrammarSuggestion[]
): any[] {
  // Create a map to track overlapping suggestions
  const suggestionMap = new Map<string, any>()
  
  // Add existing suggestions
  existingSuggestions.forEach(suggestion => {
    const key = `${suggestion.offset}-${suggestion.length}`
    suggestionMap.set(key, suggestion)
  })
  
  // Add AI suggestions, preferring them when there's overlap due to higher quality
  aiSuggestions.forEach(aiSuggestion => {
    const key = `${aiSuggestion.offset}-${aiSuggestion.length}`
    const existing = suggestionMap.get(key)
    
    // If there's an overlap, prefer AI suggestion if it has higher confidence
    if (!existing || (existing.confidence || 0) < aiSuggestion.confidence) {
      suggestionMap.set(key, {
        ...aiSuggestion,
        source: 'ai' // Mark as AI-powered
      })
    }
  })
  
  // Convert back to array and sort by offset
  return Array.from(suggestionMap.values()).sort((a, b) => a.offset - b.offset)
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