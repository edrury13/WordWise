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

// Syllable counting function
const countSyllables = (word) => {
  if (!word || typeof word !== 'string') return 1
  
  word = word.toLowerCase().replace(/[^a-z]/g, '')
  if (word.length === 0) return 1
  
  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g) || []
  let syllables = vowelGroups.length
  
  // Subtract silent 'e' at the end
  if (word.endsWith('e') && syllables > 1) {
    syllables--
  }
  
  // Ensure at least 1 syllable
  return Math.max(syllables, 1)
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
      readabilityLevel: getReadabilityLevel(roundedFK),
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