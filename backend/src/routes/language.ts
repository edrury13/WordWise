import express from 'express'
import axios from 'axios'
import { AuthenticatedRequest } from '../middleware/auth'

const router = express.Router()

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

// Check grammar and spelling
router.post('/check', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { text, language = 'en-US' } = req.body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      })
    }

    if (text.length > 50000) {
      return res.status(400).json({
        success: false,
        error: 'Text is too long (maximum 50,000 characters)'
      })
    }

    // Use LanguageTool API with enhanced grammar checking
    const languageToolUrl = process.env.LANGUAGETOOL_API_URL || 'https://api.languagetool.org/v2'
    
    // Enhanced parameters for better grammar detection
    const params = new URLSearchParams({
      text,
      language,
      enabledOnly: 'false',
      // Level of checking (1 = default, 2 = picky)
      level: 'picky',
      // Enable specific grammar categories that catch sentence fragments
      enabledCategories: 'GRAMMAR,SENTENCE_WHITESPACE,MISC,COMPOUNDING,SEMANTICS',
      // Enable specific rules for incomplete sentences and missing verbs
      enabledRules: 'FRAGMENT_SENTENCE,MISSING_VERB,INCOMPLETE_SENTENCE,SENTENCE_FRAGMENT,GRAMMAR_AGREEMENT,VERB_FORM',
      // Disable some overly aggressive style suggestions to focus on grammar
      disabledCategories: 'STYLE,COLLOQUIALISMS,REDUNDANCY'
    })

    console.log('Checking text with LanguageTool:', text.substring(0, 100) + '...')
    
    const response = await axios.post<LanguageToolResponse>(
      `${languageToolUrl}/check`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000, // 30 second timeout
      }
    )

    console.log('LanguageTool response:', {
      matchCount: response.data.matches.length,
      matches: response.data.matches.map(m => ({
        rule: m.rule.id,
        category: m.rule.category.id,
        issueType: m.rule.issueType,
        message: m.message.substring(0, 50)
      }))
    })

    // Transform LanguageTool response to our format
    const suggestions = response.data.matches.map((match, index) => ({
      id: `${match.rule.id}-${match.offset}-${index}`,
      type: getSuggestionType(match.rule.category.id, match.rule.issueType),
      message: match.message,
      replacements: match.replacements.map(r => r.value),
      offset: match.offset,
      length: match.length,
      context: match.context.text,
      explanation: match.shortMessage || match.message,
      category: match.rule.category.name,
      severity: getSeverity(match.rule.issueType),
    }))

    res.status(200).json({
      success: true,
      suggestions,
      stats: {
        totalIssues: suggestions.length,
        grammarIssues: suggestions.filter(s => s.type === 'grammar').length,
        spellingIssues: suggestions.filter(s => s.type === 'spelling').length,
        styleIssues: suggestions.filter(s => s.type === 'style').length,
      }
    })
  } catch (error) {
    console.error('Language check error:', error)
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        return res.status(408).json({
          success: false,
          error: 'Language check service timeout'
        })
      }
      
      if (error.response?.status === 429) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded for language check service'
        })
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to check text'
    })
  }
})

// Analyze text readability
router.post('/readability', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { text } = req.body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      })
    }

    const readabilityScore = calculateReadability(text)

    res.status(200).json({
      success: true,
      readability: readabilityScore
    })
  } catch (error) {
    console.error('Readability analysis error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to analyze text readability'
    })
  }
})

// Helper functions
function getSuggestionType(categoryId: string, issueType: string): string {
  console.log('Categorizing suggestion:', { categoryId, issueType })
  
  // Spelling/typos
  if (categoryId.includes('TYPOS') || 
      categoryId.includes('MISSPELLING') || 
      issueType === 'misspelling' ||
      categoryId.includes('SPELL')) {
    return 'spelling'
  }
  
  // Grammar errors - comprehensive detection
  if (categoryId.includes('GRAMMAR') || 
      categoryId.includes('VERB') ||
      categoryId.includes('AGREEMENT') ||
      categoryId.includes('TENSE') ||
      categoryId.includes('PRONOUN') ||
      categoryId.includes('ARTICLE') ||
      categoryId.includes('PREPOSITION') ||
      categoryId.includes('SENTENCE') ||
      categoryId.includes('SUBJECT') ||
      categoryId.includes('AUXILIARY') ||
      categoryId.includes('MODAL') ||
      categoryId.includes('PUNCTUATION') ||
      categoryId.includes('CAPITALIZATION') ||
      categoryId.includes('CONJUNCTION') ||
      categoryId.includes('DETERMINER') ||
      categoryId.includes('SYNTAX') ||
      issueType === 'grammar' ||
      issueType === 'typographical') {
    return 'grammar'
  }
  
  // Style suggestions
  if (categoryId.includes('STYLE') || 
      categoryId.includes('REDUNDANCY') ||
      categoryId.includes('WORDINESS') ||
      categoryId.includes('COLLOQUIALISM') ||
      issueType === 'style') {
    return 'style'
  }
  
  // Clarity issues
  if (categoryId.includes('CLARITY') ||
      categoryId.includes('CONFUSION') ||
      categoryId.includes('AMBIGUITY')) {
    return 'clarity'
  }
  
  // Engagement
  if (categoryId.includes('ENGAGEMENT') ||
      categoryId.includes('TONE')) {
    return 'engagement'
  }
  
  // Delivery
  if (categoryId.includes('DELIVERY') ||
      categoryId.includes('FORMATTING')) {
    return 'delivery'
  }
  
  // Default to grammar for unclassified issues that aren't clearly style
  if (issueType === 'other' || issueType === 'uncategorized') {
    return 'grammar'
  }
  
  return 'style'
}

function getSeverity(issueType: string): string {
  if (issueType === 'misspelling' || issueType === 'grammar') {
    return 'high'
  }
  if (issueType === 'style') {
    return 'medium'
  }
  return 'low'
}

function calculateReadability(text: string) {
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

function countSyllables(word: string): number {
  word = word.toLowerCase()
  if (word.length <= 3) return 1
  
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
  word = word.replace(/^y/, '')
  
  const matches = word.match(/[aeiouy]{1,2}/g)
  return Math.max(1, matches ? matches.length : 1)
}

function getReadabilityLevel(score: number): string {
  if (score >= 16) return 'Graduate'
  if (score >= 13) return 'College'
  if (score >= 10) return 'High School'
  if (score >= 8) return 'Middle School'
  if (score >= 6) return 'Elementary'
  return 'Very Easy'
}

// Test endpoint to verify LanguageTool API
router.post('/test', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    // Test text with known grammar and spelling errors
    const testText = "I has many errors in this sentence. Teh cat are running to the tree. She dont like it when they goes there. The cat running. The dog jumping."
    const languageToolUrl = process.env.LANGUAGETOOL_API_URL || 'https://api.languagetool.org/v2'
    
    const params = new URLSearchParams({
      text: testText,
      language: 'en-US',
      enabledOnly: 'false',
      level: 'picky',
      enabledCategories: 'GRAMMAR,SENTENCE_WHITESPACE,MISC,COMPOUNDING,SEMANTICS',
      enabledRules: 'FRAGMENT_SENTENCE,MISSING_VERB,INCOMPLETE_SENTENCE,SENTENCE_FRAGMENT,GRAMMAR_AGREEMENT,VERB_FORM',
      disabledCategories: 'STYLE,COLLOQUIALISMS,REDUNDANCY'
    })

    const response = await axios.post<LanguageToolResponse>(
      `${languageToolUrl}/check`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      }
    )

    const suggestions = response.data.matches.map((match, index) => ({
      id: `${match.rule.id}-${match.offset}-${index}`,
      type: getSuggestionType(match.rule.category.id, match.rule.issueType),
      message: match.message,
      replacements: match.replacements.map(r => r.value),
      offset: match.offset,
      length: match.length,
      context: match.context.text,
      explanation: match.shortMessage || match.message,
      category: match.rule.category.name,
      categoryId: match.rule.category.id,
      issueType: match.rule.issueType,
      ruleId: match.rule.id,
      severity: getSeverity(match.rule.issueType),
    }))

    res.status(200).json({
      success: true,
      testText,
      suggestions,
      stats: {
        totalIssues: suggestions.length,
        grammarIssues: suggestions.filter(s => s.type === 'grammar').length,
        spellingIssues: suggestions.filter(s => s.type === 'spelling').length,
        styleIssues: suggestions.filter(s => s.type === 'style').length,
      },
      raw: response.data.matches
    })
  } catch (error) {
    console.error('Language test error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to test language API',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router 