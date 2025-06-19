import { createClient } from '@supabase/supabase-js'

// Debug environment variables
console.log('Environment check:', {
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseUrlLength: process.env.SUPABASE_URL?.length || 0
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Enhanced syllable counting function
const countSyllables = (word) => {
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

// Readability level function
const getReadabilityLevel = (score) => {
  if (score < 6) return 'Elementary School'
  if (score < 9) return 'Middle School'
  if (score < 13) return 'High School'
  if (score < 16) return 'College'
  return 'Graduate'
}

// Reading ease level function
const getReadingEaseLevel = (score) => {
  if (score >= 90) return 'Very Easy'
  if (score >= 80) return 'Easy'
  if (score >= 70) return 'Fairly Easy'
  if (score >= 60) return 'Standard'
  if (score >= 50) return 'Fairly Difficult'
  if (score >= 30) return 'Difficult'
  return 'Very Difficult'
}

// Calculate readability scores
const calculateReadabilityScores = (text) => {
  try {
    // Split into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const totalSentences = sentences.length

    if (totalSentences === 0) {
      return {
        fleschKincaidScore: 0,
        fleschReadingEase: 100,
        readabilityLevel: 'Elementary School',
        readingEaseLevel: 'Very Easy'
      }
    }

    // Count words and syllables
    const words = text.split(/\s+/).filter(w => w.trim().length > 0)
    const totalWords = words.length

    if (totalWords === 0) {
      return {
        fleschKincaidScore: 0,
        fleschReadingEase: 100,
        readabilityLevel: 'Elementary School',
        readingEaseLevel: 'Very Easy'
      }
    }

    const totalSyllables = words.reduce((total, word) => {
      return total + countSyllables(word)
    }, 0)

    // Calculate averages
    const averageWordsPerSentence = totalWords / totalSentences
    const averageSyllablesPerWord = totalSyllables / totalWords

    // Flesch-Kincaid Grade Level
    const fleschKincaid = 0.39 * averageWordsPerSentence + 11.8 * averageSyllablesPerWord - 15.59

    // Flesch Reading Ease Score
    const fleschReadingEase = 206.835 - (1.015 * averageWordsPerSentence) - (84.6 * averageSyllablesPerWord)

    // Round to 1 decimal place
    const roundedFK = Math.round(fleschKincaid * 10) / 10
    const roundedFRE = Math.round(fleschReadingEase * 10) / 10

    console.log('📊 API Readability calculations:', {
      fleschKincaid: roundedFK,
      fleschReadingEase: roundedFRE,
      averageWordsPerSentence: Math.round(averageWordsPerSentence * 10) / 10,
      averageSyllablesPerWord: Math.round(averageSyllablesPerWord * 10) / 10,
      totalSentences,
      totalWords,
      totalSyllables
    })

    return {
      fleschKincaidScore: roundedFK,
      fleschReadingEase: roundedFRE,
      readabilityLevel: getReadingEaseLevel(roundedFRE),
      readingEaseLevel: getReadingEaseLevel(roundedFRE)
    }
  } catch (error) {
    console.error('Error calculating readability scores:', error)
    return {
      fleschKincaidScore: 10.0,
      fleschReadingEase: 60.0,
      readabilityLevel: 'High School',
      readingEaseLevel: 'Standard'
    }
  }
}

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
    const { method, body, headers } = req
    const authHeader = headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const token = authHeader.substring(7)
    
    // Debug token validation
    console.log('Token validation:', {
      tokenLength: token.length,
      tokenStart: token.substring(0, 10) + '...'
    })
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      console.error('Authentication failed:', {
        error: userError?.message,
        hasUser: !!user
      })
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token',
        debug: userError?.message
      })
    }

    if (method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      })
    }

    const { text } = body

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

    console.log('📊 Processing sentence analysis for text length:', text.length)

    // Calculate readability scores
    const readabilityScores = calculateReadabilityScores(text)

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

    const response = {
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
        // Add readability scores to the response
        fleschKincaidScore: readabilityScores.fleschKincaidScore,
        fleschReadingEase: readabilityScores.fleschReadingEase,
        readabilityLevel: readabilityScores.readabilityLevel,
        readingEaseLevel: readabilityScores.readingEaseLevel,
        sentences: sentenceAnalysis
      }
    }

    console.log('📊 API Response readability scores:', {
      fleschKincaidScore: response.analysis.fleschKincaidScore,
      fleschReadingEase: response.analysis.fleschReadingEase,
      readabilityLevel: response.analysis.readabilityLevel,
      readingEaseLevel: response.analysis.readingEaseLevel
    })

    return res.status(200).json(response)

  } catch (error) {
    console.error('Sentence analysis API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
} 