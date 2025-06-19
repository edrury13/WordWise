import axios from 'axios'
import { supabase } from '../config/supabase'
import { Suggestion, ReadabilityScore } from '../store/slices/suggestionSlice'
import { grammarEngine, GrammarSuggestion } from '../grammar'

// const LANGUAGETOOL_API_URL = import.meta.env.VITE_LANGUAGETOOL_API_URL || 'https://api.languagetool.org/v2'

// Simple rate limiter to prevent too many simultaneous API calls
// class RateLimiter {
//   private lastCallTime: number = 0
//   private minInterval: number = 1000 // Minimum 1 second between calls

//   async throttle(): Promise<void> {
//     const now = Date.now()
//     const timeSinceLastCall = now - this.lastCallTime
    
//     if (timeSinceLastCall < this.minInterval) {
//       const waitTime = this.minInterval - timeSinceLastCall
//       console.log(`⏳ Rate limiting: waiting ${waitTime}ms before API call`)
//       await new Promise(resolve => setTimeout(resolve, waitTime))
//     }
    
//     this.lastCallTime = Date.now()
//   }
// }

// const grammarRateLimiter = new RateLimiter()
// const sentenceRateLimiter = new RateLimiter()

// interface LanguageToolMatch {
//   offset: number
//   length: number
//   message: string
//   shortMessage?: string
//   replacements: Array<{ value: string }>
//   context: {
//     text: string
//     offset: number
//     length: number
//   }
//   rule: {
//     id: string
//     category: {
//       id: string
//       name: string
//     }
//     issueType: string
//   }
// }

// interface LanguageToolResponse {
//   matches: LanguageToolMatch[]
// }

export const checkGrammarAndSpelling = async (
  text: string,
  language: string = 'en-US'
): Promise<{ suggestions: Suggestion[], apiStatus: 'api' | 'client-fallback' | 'mixed' }> => {
  try {
    if (!text || text.trim().length === 0) {
      return { suggestions: [], apiStatus: 'client-fallback' }
    }

    // Add a small delay to prevent rapid API calls
    await new Promise(resolve => setTimeout(resolve, 100))

    console.log('🔍 Grammar check:', {
      textLength: text.length,
      isProd: import.meta.env.PROD
    })

    // ALWAYS try LanguageTool API first (no authentication required)
    try {
      console.log('📡 Calling LanguageTool API directly...')
      
      const languageToolUrl = 'https://api.languagetool.org/v2'
      const params = new URLSearchParams({
        text,
        language,
        enabledOnly: 'false',
        level: 'picky',
        // Enable all grammar-related categories including incomplete sentences
        enabledCategories: 'GRAMMAR,SENTENCE_WHITESPACE,MISC,COMPOUNDING,SEMANTICS,PUNCTUATION,CASING,TYPOS,CONFUSED_WORDS,LOGIC,TYPOGRAPHY,PRONOUN_AGREEMENT,SUBJECT_VERB_AGREEMENT,STYLE,COLLOQUIALISMS,REDUNDANCY,WORDINESS,CREATIVE_WRITING'
      })

      console.log('📡 LanguageTool API request:', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        language,
        textLength: text.length
      })

      const ltResponse = await axios.post(`${languageToolUrl}/check`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      })

      console.log('✅ LanguageTool API response:', {
        matches: ltResponse.data.matches?.length || 0,
        textSnippet: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        rawMatches: ltResponse.data.matches?.map((match: any) => ({
          rule: match.rule.id,
          category: match.rule.category.id,
          message: match.message,
          text: text.substring(match.offset, match.offset + match.length),
          offset: match.offset,
          length: match.length
        })) || []
      })

      const suggestions = ltResponse.data.matches.map((match: any, index: number) => ({
        id: `lt-${match.rule.id}-${match.offset}-${index}`,
        type: getSuggestionType(match.rule.category.id, match.rule.issueType),
        message: match.message,
        replacements: match.replacements.map((r: any) => r.value),
        offset: match.offset,
        length: match.length,
        context: match.context.text,
        explanation: match.shortMessage || match.message,
        category: match.rule.category.name,
        severity: getSeverity(match.rule.issueType),
      })) || []
      
      console.log('📋 LanguageTool suggestions:', {
        total: suggestions.length,
        grammar: suggestions.filter((s: Suggestion) => s.type === 'grammar').length,
        spelling: suggestions.filter((s: Suggestion) => s.type === 'spelling').length,
        style: suggestions.filter((s: Suggestion) => s.type === 'style').length,
      })

      // Add centralized grammar engine suggestions
      const grammarEngineResult = await grammarEngine.checkText(text, {
        language: language,
        minConfidence: 70,
        maxSuggestions: 25
      })
      
      const clientSideSuggestions = grammarEngineResult.suggestions.map((gs: GrammarSuggestion): Suggestion => ({
        id: gs.id,
        type: gs.type,
        message: gs.message,
        replacements: gs.replacements,
        offset: gs.offset,
        length: gs.length,
        context: gs.context,
        explanation: gs.explanation,
        category: gs.category,
        severity: gs.severity
      }))
      
      // Merge with LanguageTool suggestions, avoiding duplicates
      const mergedSuggestions = [...suggestions]
      
      clientSideSuggestions.forEach((clientSuggestion: Suggestion) => {
        // Check if there's already a suggestion covering this text range
        const hasOverlappingSuggestion = suggestions.some((apiSuggestion: Suggestion) => {
          const clientStart = clientSuggestion.offset
          const clientEnd = clientSuggestion.offset + clientSuggestion.length
          const apiStart = apiSuggestion.offset
          const apiEnd = apiSuggestion.offset + apiSuggestion.length
          
          // Check for overlap: ranges overlap if one starts before the other ends
          return (clientStart < apiEnd && clientEnd > apiStart)
        })
        
        // Only add client-side suggestion if there's no overlapping API suggestion
        if (!hasOverlappingSuggestion) {
          mergedSuggestions.push(clientSuggestion)
        }
      })

      console.log('📋 Final suggestions after centralized grammar check:', {
        fromLanguageTool: suggestions.length,
        fromGrammarEngine: clientSideSuggestions.length,
        total: mergedSuggestions.length
      })

      // Status should be 'api' if LanguageTool API succeeded, regardless of suggestion count
      return { suggestions: mergedSuggestions, apiStatus: 'api' }

    } catch (languageToolError) {
      console.warn('🔄 LanguageTool API failed:', 
        axios.isAxiosError(languageToolError) ? languageToolError.response?.status : languageToolError)
      
      // Handle rate limiting specifically
      if (axios.isAxiosError(languageToolError) && languageToolError.response?.status === 429) {
        console.warn('🚨 LanguageTool rate limit exceeded - using centralized grammar engine as fallback')
        const fallbackResult = await grammarEngine.checkText(text, {
          language: language,
          minConfidence: 60,
          maxSuggestions: 50
        })
        
        const fallbackSuggestions = fallbackResult.suggestions.map((gs: GrammarSuggestion): Suggestion => ({
          id: gs.id,
          type: gs.type,
          message: gs.message,
          replacements: gs.replacements,
          offset: gs.offset,
          length: gs.length,
          context: gs.context,
          explanation: gs.explanation,
          category: gs.category,
          severity: gs.severity
        }))
        
        return { suggestions: fallbackSuggestions, apiStatus: 'client-fallback' }
      }
    }

    // Fallback to centralized grammar engine if LanguageTool API fails
    console.log('🔄 Using centralized grammar engine as fallback')
    const fallbackResult = await grammarEngine.checkText(text, {
      language: language,
      minConfidence: 60,
      maxSuggestions: 50
    })
    
    const fallbackSuggestions = fallbackResult.suggestions.map((gs: GrammarSuggestion): Suggestion => ({
      id: gs.id,
      type: gs.type,
      message: gs.message,
      replacements: gs.replacements,
      offset: gs.offset,
      length: gs.length,
      context: gs.context,
      explanation: gs.explanation,
      category: gs.category,
      severity: gs.severity
    }))
    
    return { suggestions: fallbackSuggestions, apiStatus: 'client-fallback' }
  } catch (error) {
    console.error('❌ Grammar check failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      isAxiosError: axios.isAxiosError(error),
      status: axios.isAxiosError(error) ? error.response?.status : null,
      data: axios.isAxiosError(error) ? error.response?.data : null
    })
    
    // Handle rate limiting specifically
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      console.warn('🚨 Rate limit exceeded - using centralized grammar engine as fallback')
      const fallbackResult = await grammarEngine.checkText(text, {
        language: language,
        minConfidence: 60,
        maxSuggestions: 50
      })
      
      const fallbackSuggestions = fallbackResult.suggestions.map((gs: GrammarSuggestion): Suggestion => ({
        id: gs.id,
        type: gs.type,
        message: gs.message,
        replacements: gs.replacements,
        offset: gs.offset,
        length: gs.length,
        context: gs.context,
        explanation: gs.explanation,
        category: gs.category,
        severity: gs.severity
      }))
      
      return { suggestions: fallbackSuggestions, apiStatus: 'client-fallback' }
    }
    
    // Fallback to centralized grammar engine if backend fails
    if (axios.isAxiosError(error)) {
      console.warn('🔄 Backend API failed, using centralized grammar engine as fallback')
      const fallbackResult = await grammarEngine.checkText(text, {
        language: language,
        minConfidence: 60,
        maxSuggestions: 50
      })
      
      const fallbackSuggestions = fallbackResult.suggestions.map((gs: GrammarSuggestion): Suggestion => ({
        id: gs.id,
        type: gs.type,
        message: gs.message,
        replacements: gs.replacements,
        offset: gs.offset,
        length: gs.length,
        context: gs.context,
        explanation: gs.explanation,
        category: gs.category,
        severity: gs.severity
      }))
      
      return { suggestions: fallbackSuggestions, apiStatus: 'client-fallback' }
    }
    
    throw new Error('Failed to check grammar and spelling')
  }
}

// Helper functions for LanguageTool API response processing
function getSuggestionType(categoryId: string, issueType: string): Suggestion['type'] {
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

function getSeverity(issueType: string): Suggestion['severity'] {
  if (issueType === 'misspelling' || issueType === 'grammar') {
    return 'high'
  }
  if (issueType === 'style') {
    return 'medium'
  }
  return 'low'
}

// These functions have been replaced by the centralized grammar engine
// performClientSideGrammarCheck and performSupplementalGrammarCheck are no longer used

// Test function to check if LanguageTool API is working

export const testLanguageAPI = async (): Promise<any> => {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api')
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

  console.log('📊 Starting readability analysis for text:', text.substring(0, 50) + '...')
  
  try {
    // Use client-side readability analysis directly - it's fast, reliable, and doesn't require API calls
    const result = performClientSideReadabilityAnalysis(text)
    console.log('📊 Readability analysis result:', result)
    return result
  } catch (error) {
    console.error('❌ Readability analysis failed:', error)
    throw error
  }
}

// const getSuggestionType = (categoryId: string, issueType: string): Suggestion['type'] => {
//   if (categoryId.includes('TYPOS') || issueType === 'misspelling') {
//     return 'spelling'
//   }
//   if (categoryId.includes('GRAMMAR') || issueType === 'grammar') {
//     return 'grammar'
//   }
//   if (categoryId.includes('STYLE') || issueType === 'style') {
//     return 'style'
//   }
//   if (categoryId.includes('CLARITY')) {
//     return 'clarity'
//   }
//   if (categoryId.includes('ENGAGEMENT')) {
//     return 'engagement'
//   }
//   if (categoryId.includes('DELIVERY')) {
//     return 'delivery'
//   }
//   return 'style'
// }

// const getSeverity = (issueType: string): Suggestion['severity'] => {
//   if (issueType === 'misspelling' || issueType === 'grammar') {
//     return 'high'
//   }
//   if (issueType === 'style') {
//     return 'medium'
//   }
//   return 'low'
// }

const countSyllables = (word: string): number => {
  // Enhanced syllable counting algorithm with better accuracy
  if (!word || typeof word !== 'string') return 1
  
  word = word.toLowerCase().trim()
  if (word.length === 0) return 1
  if (word.length <= 2) return 1
  
  // Dictionary of common words with known syllable counts for accuracy
  const syllableDict: { [key: string]: number } = {
    'the': 1, 'be': 1, 'to': 1, 'of': 1, 'and': 1, 'a': 1, 'in': 1, 'that': 1,
    'have': 1, 'i': 1, 'it': 1, 'for': 1, 'not': 1, 'on': 1, 'with': 1, 'he': 1,
    'as': 1, 'you': 1, 'do': 1, 'at': 1, 'this': 1, 'but': 1, 'his': 1, 'by': 1,
    'from': 1, 'they': 1, 'we': 1, 'say': 1, 'her': 1, 'she': 1, 'or': 1, 'an': 1,
    'will': 1, 'my': 1, 'one': 1, 'all': 1, 'would': 1, 'there': 1, 'their': 1,
    'what': 1, 'so': 1, 'up': 1, 'out': 1, 'if': 1, 'about': 2, 'who': 1, 'get': 1,
    'which': 1, 'go': 1, 'me': 1, 'when': 1, 'make': 1, 'can': 1, 'like': 1,
    'time': 1, 'no': 1, 'just': 1, 'him': 1, 'know': 1, 'take': 1, 'people': 2,
    'into': 2, 'year': 1, 'your': 1, 'good': 1, 'some': 1, 'could': 1, 'them': 1,
    'see': 1, 'other': 2, 'than': 1, 'then': 1, 'now': 1, 'look': 1, 'only': 2,
    'come': 1, 'its': 1, 'over': 2, 'think': 1, 'also': 2, 'work': 1,
    'life': 1, 'new': 1, 'years': 1, 'way': 1, 'may': 1, 'says': 1,
    'each': 1, 'how': 1, 'these': 1, 'two': 1, 'more': 1, 'very': 2,
    'first': 1, 'where': 1, 'much': 1, 'well': 1, 'were': 1, 'been': 1,
    'had': 1, 'has': 1, 'said': 1,
    // Common problematic words
    'every': 2, 'really': 3, 'being': 2, 'through': 1, 'should': 1, 'before': 2,
    'because': 2, 'different': 3, 'another': 3, 'important': 3, 'business': 2,
    'interest': 3, 'probably': 3, 'beautiful': 3, 'family': 3, 'general': 3,
    'several': 3, 'special': 2, 'available': 4, 'possible': 3, 'necessary': 4,
    'development': 4, 'experience': 4, 'information': 4, 'education': 4,
    'government': 3, 'organization': 5, 'technology': 4, 'university': 5,
    'community': 4, 'especially': 4, 'everything': 3, 'individual': 5,
    'environment': 4, 'management': 3, 'performance': 3, 'relationship': 4,
    'opportunity': 5, 'responsibility': 6, 'understanding': 4, 'communication': 5
  }
  
  // Remove punctuation and normalize
  word = word.replace(/[^a-z]/g, '')
  if (word.length === 0) return 1
  
  // Check dictionary first for accuracy
  if (syllableDict.hasOwnProperty(word)) {
    return syllableDict[word]
  }
  
  // Handle contractions
  if (word.includes("'")) {
    const parts = word.split("'")
    return Math.max(1, parts.reduce((sum, part) => sum + countSyllables(part), 0))
  }
  
  // Count vowel groups as syllables
  let syllableCount = 0
  let previousWasVowel = false
  
  for (let i = 0; i < word.length; i++) {
    const char = word[i]
    const isVowel = /[aeiouy]/.test(char)
    
    if (isVowel && !previousWasVowel) {
      syllableCount++
    }
    previousWasVowel = isVowel
  }
  
  // Handle special cases and adjustments
  
  // Silent e at the end (but not if it's the only vowel sound)
  if (word.endsWith('e') && syllableCount > 1) {
    const beforeE = word[word.length - 2]
    // Don't remove the e if it follows certain patterns
    if (!/[aeiou]/.test(beforeE) && !word.endsWith('le') && !word.endsWith('re') && !word.endsWith('se')) {
      syllableCount--
    }
  }
  
  // Handle -ed endings
  if (word.endsWith('ed')) {
    const beforeEd = word.substring(word.length - 3, word.length - 2)
    // Only count -ed as syllable if it follows t or d
    if (!/[td]/.test(beforeEd)) {
      syllableCount--
    }
  }
  
  // Handle -es endings
  if (word.endsWith('es') && word.length > 3) {
    const beforeEs = word[word.length - 3]
    // Count -es as syllable after s, x, z, ch, sh sounds
    if (!/[sxz]/.test(beforeEs) && !word.endsWith('ches') && !word.endsWith('shes')) {
      syllableCount--
    }
  }
  
  // Handle common prefixes that add syllables
  const prefixes = ['anti', 'auto', 'co', 'de', 'dis', 'em', 'fore', 'in', 'im', 'inter', 'mid', 'mis', 'non', 'over', 'pre', 'pro', 're', 'semi', 'sub', 'super', 'trans', 'un', 'under']
  for (const prefix of prefixes) {
    if (word.startsWith(prefix) && word.length > prefix.length + 2) {
      // Most prefixes add one syllable, but check for vowel patterns
      if (prefix === 'anti' || prefix === 'auto' || prefix === 'inter' || prefix === 'super') {
        // These typically add 2 syllables
        syllableCount += 1
      }
      break
    }
  }
  
  // Handle common suffixes
  if (word.endsWith('tion') || word.endsWith('sion')) {
    syllableCount += 1  // These endings typically add a syllable
  } else if (word.endsWith('ly') && word.length > 4) {
    // -ly usually doesn't add syllables unless the word is very short
    const withoutLy = word.substring(0, word.length - 2)
    if (withoutLy.endsWith('al') || withoutLy.endsWith('ic')) {
      syllableCount += 1
    }
  }
  
  // Handle compound words and words with multiple vowel clusters
  if (word.length > 8) {
    // For longer words, add slight adjustment for potential missed syllables
    const vowelClusters = word.match(/[aeiouy]+/g) || []
    if (vowelClusters.length > syllableCount) {
      syllableCount = Math.min(syllableCount + 1, vowelClusters.length)
    }
  }
  
  // Ensure minimum of 1 syllable
  return Math.max(1, syllableCount)
}

const getReadingEaseLevel = (score: number): string => {
  if (score >= 90) return 'Very Easy'
  if (score >= 80) return 'Easy'
  if (score >= 70) return 'Fairly Easy'
  if (score >= 60) return 'Standard'
  if (score >= 50) return 'Fairly Difficult'
  if (score >= 30) return 'Difficult'
  return 'Very Difficult'
}

// Client-side readability analysis as fallback
function performClientSideReadabilityAnalysis(text: string): ReadabilityScore {
  try {
    console.log('📊 Processing text for readability:', { textLength: text.length })
    
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = text.split(/\s+/).filter(w => w.trim().length > 0)
    const totalSentences = Math.max(sentences.length, 1) // Ensure at least 1 to avoid division by zero
    const totalWords = Math.max(words.length, 1) // Ensure at least 1 to avoid division by zero
    const averageWordsPerSentence = totalWords / totalSentences

    console.log('📊 Basic text stats:', { totalSentences, totalWords, averageWordsPerSentence })

  // Estimate syllables
  const syllables = words.reduce((total, word) => {
    return total + countSyllables(word)
  }, 0)
  const averageSyllablesPerWord = syllables / Math.max(totalWords, 1)

  // Flesch-Kincaid Grade Level
  const fleschKincaid = 0.39 * averageWordsPerSentence + 11.8 * averageSyllablesPerWord - 15.59

  // Flesch Reading Ease Score
  const fleschReadingEase = 206.835 - (1.015 * averageWordsPerSentence) - (84.6 * averageSyllablesPerWord)

  // Long sentences (>20 words)
  const longSentences = sentences.filter(sentence => {
    const sentenceWords = sentence.split(/\s+/).filter(w => w.trim().length > 0)
    return sentenceWords.length > 20
  }).length

  // Simple passive voice detection
  const passiveIndicators = /(was|were|been|being)\s+\w+ed\b/gi
  const passiveMatches = text.match(passiveIndicators) || []
  const passiveVoicePercentage = (passiveMatches.length / Math.max(totalSentences, 1)) * 100

  const calculatedFK = Math.round(fleschKincaid * 10) / 10
  const calculatedFRE = Math.round(fleschReadingEase * 10) / 10
  
  console.log('📊 Readability calculations:', {
    fleschKincaid: calculatedFK,
    fleschReadingEase: calculatedFRE,
    averageWordsPerSentence: Math.round(averageWordsPerSentence * 10) / 10,
    averageSyllablesPerWord: Math.round(averageSyllablesPerWord * 10) / 10,
    totalSentences,
    longSentences,
    passiveVoicePercentage: Math.round(passiveVoicePercentage * 10) / 10,
    rawFK: fleschKincaid,
    rawFRE: fleschReadingEase,
    isNaN_FK: isNaN(calculatedFK),
    isNaN_FRE: isNaN(calculatedFRE)
  })

  const readabilityScore: ReadabilityScore = {
    fleschKincaid: Math.round(fleschKincaid * 10) / 10,
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    readabilityLevel: getReadingEaseLevel(fleschReadingEase),
    averageWordsPerSentence: Math.round(averageWordsPerSentence * 10) / 10,
    averageSyllablesPerWord: Math.round(averageSyllablesPerWord * 10) / 10,
    totalSentences,
    passiveVoicePercentage: Math.round(passiveVoicePercentage * 10) / 10,
    longSentences,
  }

  return readabilityScore
  } catch (error) {
    console.error('❌ Error in performClientSideReadabilityAnalysis:', error)
    // Return a basic fallback readability score
    return {
      fleschKincaid: 10.0,
      fleschReadingEase: 60.0,
      readabilityLevel: 'High School',
      averageWordsPerSentence: 15.0,
      averageSyllablesPerWord: 1.5,
      totalSentences: 1,
      passiveVoicePercentage: 0.0,
      longSentences: 0,
    }
  }
}

export const analyzeSentences = async (text: string) => {
  try {
    // Add a small delay to prevent rapid API calls
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Use backend API with Supabase authentication
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api')
    
    // Get auth token from Supabase session (consistent with other functions)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const token = session?.access_token

    console.log('📊 Sentence analysis request:', {
      textLength: text.length,
      hasToken: !!token,
      sessionError: sessionError?.message
    })

    if (!token) {
      console.warn('🚨 No authentication token available for sentence analysis')
      return {
        success: false,
        error: 'Authentication required. Please log in to analyze sentences.'
      }
    }

    const response = await axios.post(
      `${API_BASE_URL}/language/sentence-analysis`,
      { text },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000
      }
    )

    if (response.status === 429) {
      // Rate limited - return graceful fallback
      return {
        success: false,
        error: 'Rate limited. Please wait a moment before trying again.'
      }
    }

    return response.data
  } catch (error) {
    console.error('Sentence analysis error:', error)
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        return {
          success: false,
          error: 'Rate limited. Please wait a moment before trying again.'
        }
      } else if (error.response?.status === 401) {
        return {
          success: false,
          error: 'Authentication failed. Please log in again.'
        }
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze sentences'
    }
  }
}

export const rewriteToneWithOpenAI = async (text: string, tone: string) => {
  try {
    // Use backend API with OpenAI integration
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api')
    
    console.log('🔧 API Configuration Debug:', {
      API_BASE_URL,
      NODE_ENV: import.meta.env.NODE_ENV,
      PROD: import.meta.env.PROD,
      targetURL: `${API_BASE_URL}/language/rewrite-tone`
    })
    
    // Get auth token from Supabase session (consistent with other functions)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const token = session?.access_token

    console.log('🤖 OpenAI Tone rewrite request:', {
      textLength: text.length,
      tone,
      hasToken: !!token,
      sessionError: sessionError?.message,
      usingVercelAPI: true
    })

    if (!token) {
      console.warn('🚨 No authentication token available for tone rewriting')
      throw new Error('Authentication required. Please log in to use tone rewriting.')
    }

    console.log('📡 Making OpenAI tone rewrite API call...')

    const response = await axios.post(
      `${API_BASE_URL}/language/rewrite-tone`,
      { text, tone },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 45000 // Increased timeout for OpenAI calls
      }
    )

    console.log('✅ OpenAI Tone rewrite API response:', {
      success: response.data.success,
      originalLength: response.data.originalText?.length || 0,
      rewrittenLength: response.data.rewrittenText?.length || 0,
      tone: response.data.tone,
      method: response.data.method,
      hasChanges: response.data.hasChanges
    })

    return response.data
  } catch (error) {
    console.error('❌ Tone rewriting failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      isAxiosError: axios.isAxiosError(error),
      status: axios.isAxiosError(error) ? error.response?.status : null,
      data: axios.isAxiosError(error) ? error.response?.data : null
    })
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        throw new Error('Rate limited. Please wait a moment before trying again.')
      } else if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please log in again.')
      } else if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
    }
    
    throw error
  }
}

// Performance optimization utilities
interface PendingRequest {
  text: string
  gradeLevel: string
  timestamp: number
  resolve: (result: any) => void
  reject: (error: any) => void
}

class GradeLevelRewriteOptimizer {
  private pendingRequests: Map<string, PendingRequest[]> = new Map()
  // private requestDedupeWindow = 1000 // 1 second window for deduplication
  
  private generateRequestKey(text: string, gradeLevel: string): string {
    // Create a shorter hash for deduplication
    const textSample = text.slice(0, 200) + text.slice(-100)
    return `${gradeLevel}:${btoa(textSample).slice(0, 15)}`
  }
  
  async optimizedRewrite(text: string, gradeLevel: string): Promise<any> {
    const requestKey = this.generateRequestKey(text, gradeLevel)
    
    return new Promise((resolve, reject) => {
      // Check if there's already a pending request for the same text/grade level
      const existingRequests = this.pendingRequests.get(requestKey) || []
      
      if (existingRequests.length > 0) {
        // Add to existing request queue - will be resolved when the first request completes
        console.log('🎯 Deduplicating grade level rewrite request:', { requestKey, queueLength: existingRequests.length + 1 })
        existingRequests.push({
          text,
          gradeLevel,
          timestamp: Date.now(),
          resolve,
          reject
        })
        this.pendingRequests.set(requestKey, existingRequests)
        return
      }
      
      // This is the first request for this text/grade level combination
      const newRequest: PendingRequest = {
        text,
        gradeLevel,
        timestamp: Date.now(),
        resolve,
        reject
      }
      
      this.pendingRequests.set(requestKey, [newRequest])
      
      // Execute the actual API call
      this.executeRewrite(text, gradeLevel)
        .then(result => {
          // Resolve all pending requests with the same result
          const allRequests = this.pendingRequests.get(requestKey) || []
          console.log(`✅ Resolving ${allRequests.length} deduplicated requests for:`, requestKey)
          
          allRequests.forEach(req => req.resolve(result))
          this.pendingRequests.delete(requestKey)
        })
        .catch(error => {
          // Reject all pending requests with the same error
          const allRequests = this.pendingRequests.get(requestKey) || []
          console.log(`❌ Rejecting ${allRequests.length} deduplicated requests for:`, requestKey)
          
          allRequests.forEach(req => req.reject(error))
          this.pendingRequests.delete(requestKey)
        })
    })
  }
  
  private async executeRewrite(text: string, gradeLevel: string): Promise<any> {
    // Implement the actual API call here
    try {
      // Use backend API with OpenAI integration
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api')
      
      console.log('🎓 Grade Level API Configuration Debug:', {
        API_BASE_URL,
        NODE_ENV: import.meta.env.NODE_ENV,
        PROD: import.meta.env.PROD,
        targetURL: `${API_BASE_URL}/language/rewrite-grade-level`
      })
      
      // Get auth token from Supabase session (consistent with other functions)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      const token = session?.access_token

      console.log('🎓 OpenAI Grade Level rewrite request with iterative refinement:', {
        textLength: text.length,
        gradeLevel,
        hasToken: !!token,
        sessionError: sessionError?.message,
        usingVercelAPI: true,
        iterativeRefinement: true
      })

      if (!token) {
        console.warn('🚨 No authentication token available for grade level rewriting')
        throw new Error('Authentication required. Please log in to use grade level rewriting.')
      }

      console.log('📡 Making OpenAI grade level rewrite API call...')

      const response = await axios.post(
        `${API_BASE_URL}/language/rewrite-grade-level`,
        { text, gradeLevel },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 45000 // Increased timeout for OpenAI calls
        }
      )

      console.log('✅ OpenAI Grade Level rewrite API response with iterative refinement:', {
        success: response.data.success,
        originalLength: response.data.originalText?.length || 0,
        rewrittenLength: response.data.rewrittenText?.length || 0,
        gradeLevel: response.data.gradeLevel,
        method: response.data.method,
        hasChanges: response.data.hasChanges,
        originalFK: response.data.originalReadability?.fleschKincaid,
        newFK: response.data.newReadability?.fleschKincaid,
        originalLevel: response.data.originalReadability?.level,
        newLevel: response.data.newReadability?.level,
        iterativeRefinement: true,
        accuracyImprovement: 'Enhanced with iterative validation'
      })

      return response.data
    } catch (error) {
      console.error('❌ Grade level rewriting failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        isAxiosError: axios.isAxiosError(error),
        status: axios.isAxiosError(error) ? error.response?.status : null,
        data: axios.isAxiosError(error) ? error.response?.data : null
      })
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('Rate limited. Please wait a moment before trying again.')
        } else if (error.response?.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        } else if (error.response?.data?.error) {
          throw new Error(error.response.data.error)
        }
      }
      
      throw error
    }
  }
  
  // Cleanup old pending requests (in case of timeouts)
  cleanup(): void {
    const now = Date.now()
    const timeout = 30000 // 30 seconds timeout
    
    for (const [key, requests] of this.pendingRequests.entries()) {
      const validRequests = requests.filter(req => (now - req.timestamp) < timeout)
      
      if (validRequests.length === 0) {
        this.pendingRequests.delete(key)
      } else if (validRequests.length < requests.length) {
        this.pendingRequests.set(key, validRequests)
      }
    }
  }
  
  // Get current optimization stats
  getStats() {
    const totalPendingRequests = Array.from(this.pendingRequests.values())
      .reduce((sum, requests) => sum + requests.length, 0)
    
    return {
      uniqueRequests: this.pendingRequests.size,
      totalPendingRequests,
      averageQueueSize: this.pendingRequests.size > 0 
        ? totalPendingRequests / this.pendingRequests.size 
        : 0
    }
  }
}

// Create singleton instance
const gradeLevelOptimizer = new GradeLevelRewriteOptimizer()

// Cleanup pending requests periodically
setInterval(() => {
  gradeLevelOptimizer.cleanup()
}, 60000) // Every minute

// Original function for backward compatibility
export const rewriteGradeLevelWithOpenAI = async (text: string, gradeLevel: string) => {
  return gradeLevelOptimizer.optimizedRewrite(text, gradeLevel)
}

// Enhanced rewrite function with optimization (same as above, different name for clarity)
export const rewriteGradeLevelWithOptimization = async (text: string, gradeLevel: string) => {
  return gradeLevelOptimizer.optimizedRewrite(text, gradeLevel)
}

// Export optimizer stats for monitoring
export const getGradeLevelOptimizerStats = () => {
  return gradeLevelOptimizer.getStats()
} 