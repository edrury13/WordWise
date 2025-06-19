import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    const { method, body, headers, url } = req
    const authHeader = headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      })
    }

    if (method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      })
    }

    const { text, language = 'en-US' } = body

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

    // Determine which endpoint was called
    if (url.includes('/check')) {
      return await handleGrammarCheck(text, language, res)
    } else if (url.includes('/sentence-analysis')) {
      return await handleSentenceAnalysis(text, language, res)
    } else if (url.includes('/readability')) {
      return await handleReadabilityCheck(text, res)
    } else if (url.includes('/rewrite-tone')) {
      return await handleTextRewrite(text, body.tone, res)
    } else if (url.includes('/rewrite-grade-level')) {
      return await handleGradeLevelRewrite(text, body.gradeLevel, res)
    }

    return res.status(404).json({
      success: false,
      error: 'Route not found'
    })

  } catch (error) {
    console.error('Language API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleGrammarCheck(text, language, res) {
  try {
    const languageToolUrl = process.env.LANGUAGETOOL_API_URL || 'https://api.languagetool.org/v2'
    
    const params = new URLSearchParams({
      text,
      language,
      enabledOnly: 'false',
      level: 'picky',
      enabledCategories: 'GRAMMAR,SENTENCE_WHITESPACE,MISC,COMPOUNDING,SEMANTICS,PUNCTUATION,CASING,TYPOS,CONFUSED_WORDS,LOGIC,TYPOGRAPHY,PRONOUN_AGREEMENT,SUBJECT_VERB_AGREEMENT,STYLE,COLLOQUIALISMS,REDUNDANCY,WORDINESS,CREATIVE_WRITING',
      enabledRules: 'FRAGMENT_SENTENCE,MISSING_VERB,INCOMPLETE_SENTENCE,SENTENCE_FRAGMENT,RUN_ON_SENTENCE,COMMA_SPLICE,GRAMMAR_AGREEMENT,SUBJECT_VERB_AGREEMENT,VERB_FORM,VERB_AGREEMENT_VS_NOUN,SINGULAR_PLURAL_VERB,TENSE_AGREEMENT,VERB_TENSE,PAST_TENSE_VERB,PRESENT_TENSE_VERB,PRONOUN_AGREEMENT,PRONOUN_REFERENCE,REFLEXIVE_PRONOUN,PERSONAL_PRONOUN_AGREEMENT,ARTICLE_MISSING,DT_DT,MISSING_DETERMINER,A_VS_AN,THE_SUPERLATIVE,PREPOSITION_VERB,MISSING_PREPOSITION,WRONG_PREPOSITION,CONJUNCTION_COMMA,MISSING_CONJUNCTION,COORDINATING_CONJUNCTION,COMMA_BEFORE_CONJUNCTION,MISSING_COMMA,UNNECESSARY_COMMA,APOSTROPHE_MISSING,SENTENCE_CAPITALIZATION,PROPER_NOUN_CAPITALIZATION'
    })

    const response = await axios.post(`${languageToolUrl}/check`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000,
    })

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

    return res.status(200).json({
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
    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded for language check service'
      })
    }
    throw error
  }
}

async function handleSentenceAnalysis(text, language, res) {
  // Simplified sentence analysis for serverless
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  
  const sentenceAnalysis = sentences.map((sentence, index) => ({
    sentenceIndex: index,
    text: sentence.trim(),
    offset: text.indexOf(sentence.trim()),
    length: sentence.trim().length,
    quality: 'good', // Simplified for serverless
    wordCount: sentence.trim().split(/\s+/).filter(w => w.trim().length > 0).length,
    issues: [],
    issueCount: 0,
    grammarIssueCount: 0,
    spellingIssueCount: 0,
    structureIssueCount: 0
  }))

  return res.status(200).json({
    success: true,
    analysis: {
      totalSentences: sentences.length,
      overallQuality: 'good',
      qualityDistribution: {
        good: sentences.length,
        fair: 0,
        poor: 0,
        incomplete: 0
      },
      totalIssues: 0,
      totalGrammarIssues: 0,
      totalSpellingIssues: 0,
      totalStructureIssues: 0,
      sentences: sentenceAnalysis
    }
  })
}

async function handleReadabilityCheck(text, res) {
  const readabilityData = calculateReadability(text)
  return res.status(200).json({
    success: true,
    readability: readabilityData
  })
}

async function handleTextRewrite(text, tone, res) {
  // Simplified rewrite for serverless
  return res.status(200).json({
    success: true,
    rewrittenText: text // Return original text for now
  })
}

async function handleGradeLevelRewrite(text, gradeLevel, res) {
  // Validate grade level
  const validGradeLevels = ['elementary', 'middle-school', 'high-school', 'college', 'graduate']
  if (!gradeLevel || !validGradeLevels.includes(gradeLevel.toLowerCase())) {
    return res.status(400).json({
      success: false,
      error: `Invalid grade level. Must be one of: ${validGradeLevels.join(', ')}`
    })
  }

  // Calculate readability scores
  const originalReadability = calculateReadability(text)
  
  // For now, return original text with readability info
  // In production, this would call OpenAI for actual rewriting
  return res.status(200).json({
    success: true,
    originalText: text,
    rewrittenText: text, // Placeholder - would be OpenAI rewritten text
    gradeLevel: gradeLevel.toLowerCase(),
    originalReadability: {
      fleschKincaid: originalReadability.fleschKincaid,
      readingEase: originalReadability.fleschReadingEase,
      level: originalReadability.readabilityLevel
    },
    newReadability: {
      fleschKincaid: originalReadability.fleschKincaid,
      readingEase: originalReadability.fleschReadingEase,
      level: originalReadability.readabilityLevel
    },
    changes: ['Grade level rewrite not implemented in serverless fallback'],
    hasChanges: false,
    method: 'fallback',
    version: 'Grade Level Rewrite Fallback v1.0',
    timestamp: new Date().toISOString()
  })
}

function getSuggestionType(categoryId, issueType) {
  if (categoryId.includes('TYPOS') || categoryId.includes('MISSPELLING') || issueType === 'misspelling') {
    return 'spelling'
  }
  if (categoryId.includes('GRAMMAR') || categoryId.includes('VERB') || categoryId.includes('AGREEMENT')) {
    return 'grammar'
  }
  return 'style'
}

function getSeverity(issueType) {
  if (issueType === 'misspelling') return 'error'
  if (issueType === 'grammar') return 'error'
  return 'warning'
}

function calculateReadability(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = text.split(/\s+/).filter(w => w.trim().length > 0)
  const syllables = words.reduce((total, word) => total + countSyllables(word), 0)
  
  const avgWordsPerSentence = words.length / sentences.length
  const avgSyllablesPerWord = syllables / words.length
  
  const fleschKincaid = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord)
  
  return {
    fleschKincaid: Math.round(fleschKincaid * 100) / 100,
    fleschReadingEase: Math.round(fleschKincaid * 100) / 100,
    readabilityLevel: getReadabilityLevel(fleschKincaid),
    readingEaseLevel: getReadingEaseLevel(fleschKincaid)
  }
}

function countSyllables(word) {
  word = word.toLowerCase()
  if (word.length <= 3) return 1
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
  word = word.replace(/^y/, '')
  const matches = word.match(/[aeiouy]{1,2}/g)
  return matches ? matches.length : 1
}

function getReadabilityLevel(score) {
  if (score >= 90) return 'Very Easy'
  if (score >= 80) return 'Easy'
  if (score >= 70) return 'Fairly Easy'
  if (score >= 60) return 'Standard'
  if (score >= 50) return 'Fairly Difficult'
  if (score >= 30) return 'Difficult'
  return 'Very Difficult'
}

function getReadingEaseLevel(score) {
  return getReadabilityLevel(score)
} 