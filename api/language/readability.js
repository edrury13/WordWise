import { createClient } from '@supabase/supabase-js'

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
    const { method, body, headers } = req
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

    const readabilityData = calculateReadability(text)
    
    return res.status(200).json({
      success: true,
      readability: readabilityData
    })

  } catch (error) {
    console.error('Readability API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

function calculateReadability(text) {
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
    readabilityLevel: getReadingEaseLevel(fleschReadingEase),
    averageWordsPerSentence: Math.round(averageWordsPerSentence * 10) / 10,
    averageSyllablesPerWord: Math.round(averageSyllablesPerWord * 10) / 10,
    totalSentences,
    passiveVoicePercentage: Math.round(passiveVoicePercentage * 10) / 10,
    longSentences,
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
    'come': 1, 'its': 1, 'over': 2, 'think': 1, 'also': 2, 'your': 1, 'work': 1,
    'life': 1, 'only': 2, 'new': 1, 'years': 1, 'way': 1, 'may': 1, 'says': 1,
    'each': 1, 'which': 1, 'she': 1, 'do': 1, 'how': 1, 'their': 1, 'if': 1,
    'will': 1, 'up': 1, 'other': 2, 'about': 2, 'out': 1, 'many': 2, 'then': 1,
    'them': 1, 'these': 1, 'so': 1, 'some': 1, 'her': 1, 'would': 1, 'make': 1,
    'like': 1, 'into': 2, 'him': 1, 'has': 1, 'two': 1, 'more': 1, 'very': 2,
    'what': 1, 'know': 1, 'just': 1, 'first': 1, 'get': 1, 'over': 2, 'think': 1,
    'where': 1, 'much': 1, 'go': 1, 'well': 1, 'were': 1, 'been': 1, 'have': 1,
    'had': 1, 'has': 1, 'said': 1, 'each': 1, 'which': 1, 'their': 1, 'time': 1,
    'will': 1, 'about': 2, 'if': 1, 'up': 1, 'out': 1, 'many': 2, 'then': 1,
    'them': 1, 'can': 1, 'said': 1, 'there': 1, 'each': 1, 'which': 1, 'do': 1,
    'how': 1, 'their': 1, 'if': 1, 'will': 1, 'way': 1, 'about': 2, 'out': 1,
    'up': 1, 'time': 1, 'them': 1,
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

function getReadabilityLevel(score) {
  if (score >= 16) return 'Graduate'
  if (score >= 13) return 'College'
  if (score >= 10) return 'High School'
  if (score >= 8) return 'Middle School'
  if (score >= 6) return 'Elementary'
  return 'Very Easy'
} 