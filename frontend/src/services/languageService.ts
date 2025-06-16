import axios from 'axios'
import { supabase } from '../config/supabase'
import { Suggestion, ReadabilityScore } from '../store/slices/suggestionSlice'

const LANGUAGETOOL_API_URL = import.meta.env.VITE_LANGUAGETOOL_API_URL || 'https://api.languagetool.org/v2'

interface LanguageToolMatch {
  offset: number
  length: number
  message: string
  shortMessage?: string
  replacements: Array<{ value: string }>
  context: {
    text: string
    offset: number
    length: number
  }
  rule: {
    id: string
    category: {
      id: string
      name: string
    }
    issueType: string
  }
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[]
}

export const checkGrammarAndSpelling = async (
  text: string,
  language: string = 'en-US'
): Promise<Suggestion[]> => {
  try {
    if (!text || text.trim().length === 0) {
      return []
    }

    // Use backend API instead of directly calling LanguageTool
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
    
    // Get auth token from Supabase session (more reliable than localStorage)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const token = session?.access_token

    console.log('🔍 Grammar check:', {
      textLength: text.length,
      hasToken: !!token,
      sessionError: sessionError?.message
    })

    if (!token) {
      console.warn('🚨 No authentication token available for grammar check')
      // Fallback to client-side checking when not authenticated
      return performClientSideGrammarCheck(text)
    }

    console.log('📡 Making grammar API call...', text.substring(0, 50) + '...')

    const response = await axios.post(
      `${API_BASE_URL}/language/check`,
      { text, language },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000
      }
    )

    console.log('✅ Grammar API response:', {
      success: response.data.success,
      suggestionsCount: response.data.suggestions?.length || 0,
      stats: response.data.stats
    })

    const suggestions = response.data.suggestions || []
    
    console.log('📋 Received suggestions:', {
      total: suggestions.length,
      grammar: suggestions.filter((s: Suggestion) => s.type === 'grammar').length,
      spelling: suggestions.filter((s: Suggestion) => s.type === 'spelling').length,
      style: suggestions.filter((s: Suggestion) => s.type === 'style').length,
    })

    // If no grammar suggestions found, add basic client-side checks as fallback
    if (suggestions.filter((s: Suggestion) => s.type === 'grammar').length === 0) {
      console.log('🔄 Adding client-side grammar fallback')
      const clientSideGrammarSuggestions = performClientSideGrammarCheck(text)
      suggestions.push(...clientSideGrammarSuggestions)
    }

    return suggestions
  } catch (error) {
    console.error('❌ Grammar check failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      isAxiosError: axios.isAxiosError(error),
      status: axios.isAxiosError(error) ? error.response?.status : null,
      data: axios.isAxiosError(error) ? error.response?.data : null
    })
    
    // Fallback to client-side checking if backend fails
    if (axios.isAxiosError(error)) {
      console.warn('🔄 Backend API failed, using client-side grammar checking as fallback')
      return performClientSideGrammarCheck(text)
    }
    
    throw new Error('Failed to check grammar and spelling')
  }
}

// Client-side basic grammar checking as fallback
function performClientSideGrammarCheck(text: string): Suggestion[] {
  const suggestions: Suggestion[] = []
  let offset = 0
  
  // Basic grammar rules
  const grammarRules = [
    {
      pattern: /\b(I|you|we|they)\s+was\b/gi,
      message: "Subject-verb disagreement. Use 'were' instead of 'was' with plural subjects.",
      replacement: (match: string) => match.replace(/was/, 'were'),
      type: 'grammar' as const
    },
    {
      pattern: /\b(he|she|it)\s+were\b/gi,
      message: "Subject-verb disagreement. Use 'was' instead of 'were' with singular subjects.",
      replacement: (match: string) => match.replace(/were/, 'was'),
      type: 'grammar' as const
    },
    {
      pattern: /\b(I|you|we|they)\s+don't\s+has\b/gi,
      message: "Incorrect verb form. Use 'have' instead of 'has' with plural subjects.",
      replacement: (match: string) => match.replace(/has/, 'have'),
      type: 'grammar' as const
    },
    {
      pattern: /\b(he|she|it)\s+don't\b/gi,
      message: "Incorrect contraction. Use 'doesn't' instead of 'don't' with singular subjects.",
      replacement: (match: string) => match.replace(/don't/, "doesn't"),
      type: 'grammar' as const
    },
    {
      pattern: /\b(I|you|we|they)\s+goes\b/gi,
      message: "Subject-verb disagreement. Use 'go' instead of 'goes' with plural subjects.",
      replacement: (match: string) => match.replace(/goes/, 'go'),
      type: 'grammar' as const
    },
    {
      pattern: /\b(he|she|it)\s+go\b/gi,
      message: "Subject-verb disagreement. Use 'goes' instead of 'go' with singular subjects.",
      replacement: (match: string) => match.replace(/go/, 'goes'),
      type: 'grammar' as const
    },
    {
      pattern: /\b(I|you|we|they)\s+has\b/gi,
      message: "Subject-verb disagreement. Use 'have' instead of 'has' with plural subjects.",
      replacement: (match: string) => match.replace(/has/, 'have'),
      type: 'grammar' as const
    },
    {
      pattern: /\b(he|she|it)\s+have\b/gi,
      message: "Subject-verb disagreement. Use 'has' instead of 'have' with singular subjects.",
      replacement: (match: string) => match.replace(/have/, 'has'),
      type: 'grammar' as const
    }
  ]

  grammarRules.forEach((rule, ruleIndex) => {
    let match
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags)
    
    while ((match = regex.exec(text)) !== null) {
      const matchText = match[0]
      const matchOffset = match.index
      
      suggestions.push({
        id: `client-grammar-${ruleIndex}-${matchOffset}`,
        type: rule.type,
        message: rule.message,
        replacements: [rule.replacement(matchText)],
        offset: matchOffset,
        length: matchText.length,
        context: text.substring(Math.max(0, matchOffset - 20), matchOffset + matchText.length + 20),
        explanation: rule.message,
        category: 'Grammar (Client-side)',
        severity: 'high'
      })
    }
  })

  console.log('Added client-side grammar suggestions:', suggestions.length)
  return suggestions
}

// Test function to check if LanguageTool API is working
export const testLanguageAPI = async (): Promise<any> => {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    if (!token) {
      throw new Error('No authentication token available')
    }

    const response = await axios.post(
      `${API_BASE_URL}/language/test`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000
      }
    )

    return response.data
  } catch (error) {
    console.error('Language API test failed:', error)
    throw error
  }
}

export const analyzeReadability = async (text: string): Promise<ReadabilityScore> => {
  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for readability analysis')
  }

  try {
    // Use backend API for readability analysis
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    if (!token) {
      // Fallback to client-side readability analysis
      return performClientSideReadabilityAnalysis(text)
    }

    const response = await axios.post(
      `${API_BASE_URL}/language/readability`,
      { text },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 15000
      }
    )

    return response.data.readability
  } catch (error) {
    console.error('Readability analysis failed, using client-side fallback:', error)
    // Fallback to client-side analysis
    return performClientSideReadabilityAnalysis(text)
  }
}

const getSuggestionType = (categoryId: string, issueType: string): Suggestion['type'] => {
  if (categoryId.includes('TYPOS') || issueType === 'misspelling') {
    return 'spelling'
  }
  if (categoryId.includes('GRAMMAR') || issueType === 'grammar') {
    return 'grammar'
  }
  if (categoryId.includes('STYLE') || issueType === 'style') {
    return 'style'
  }
  if (categoryId.includes('CLARITY')) {
    return 'clarity'
  }
  if (categoryId.includes('ENGAGEMENT')) {
    return 'engagement'
  }
  if (categoryId.includes('DELIVERY')) {
    return 'delivery'
  }
  return 'style'
}

const getSeverity = (issueType: string): Suggestion['severity'] => {
  if (issueType === 'misspelling' || issueType === 'grammar') {
    return 'high'
  }
  if (issueType === 'style') {
    return 'medium'
  }
  return 'low'
}

const countSyllables = (word: string): number => {
  word = word.toLowerCase()
  if (word.length <= 3) return 1
  
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
  word = word.replace(/^y/, '')
  
  const matches = word.match(/[aeiouy]{1,2}/g)
  return Math.max(1, matches ? matches.length : 1)
}

const getReadabilityLevel = (score: number): string => {
  if (score >= 16) return 'Graduate'
  if (score >= 13) return 'College'
  if (score >= 10) return 'High School'
  if (score >= 8) return 'Middle School'
  if (score >= 6) return 'Elementary'
  return 'Very Easy'
}

// Client-side readability analysis as fallback
function performClientSideReadabilityAnalysis(text: string): ReadabilityScore {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = text.split(/\s+/).filter(w => w.trim().length > 0)
  const totalSentences = sentences.length
  const totalWords = words.length
  const averageWordsPerSentence = totalWords / Math.max(totalSentences, 1)

  // Estimate syllables
  const syllables = words.reduce((total, word) => {
    return total + countSyllables(word)
  }, 0)
  const averageSyllablesPerWord = syllables / Math.max(totalWords, 1)

  // Flesch-Kincaid Grade Level
  const fleschKincaid = 0.39 * averageWordsPerSentence + 11.8 * averageSyllablesPerWord - 15.59

  // Long sentences (>20 words)
  const longSentences = sentences.filter(sentence => {
    const sentenceWords = sentence.split(/\s+/).filter(w => w.trim().length > 0)
    return sentenceWords.length > 20
  }).length

  // Simple passive voice detection
  const passiveIndicators = /(was|were|been|being)\s+\w+ed\b/gi
  const passiveMatches = text.match(passiveIndicators) || []
  const passiveVoicePercentage = (passiveMatches.length / Math.max(totalSentences, 1)) * 100

  return {
    fleschKincaid: Math.round(fleschKincaid * 10) / 10,
    readabilityLevel: getReadabilityLevel(fleschKincaid),
    averageWordsPerSentence: Math.round(averageWordsPerSentence * 10) / 10,
    averageSyllablesPerWord: Math.round(averageSyllablesPerWord * 10) / 10,
    totalSentences,
    passiveVoicePercentage: Math.round(passiveVoicePercentage * 10) / 10,
    longSentences,
  }
} 