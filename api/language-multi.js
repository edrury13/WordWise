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
    readabilityLevel: getReadingEaseLevel(fleschReadingEase),
    readingEaseLevel: getReadingEaseLevel(fleschKincaid)
  }
}

function countSyllables(word) {
  // Enhanced syllable counting algorithm with better accuracy
  if (!word || typeof word !== 'string') return 1
  
  word = word.toLowerCase().trim()
  if (word.length === 0) return 1
  if (word.length <= 2) return 1
  
  // Dictionary of common words with known syllable counts for accuracy
  const syllableDict = {
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
  
  // Ensure minimum of 1 syllable
  return Math.max(1, syllableCount)
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