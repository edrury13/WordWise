import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Vercel edge function configuration
export const config = {
  maxDuration: 30, // 30 seconds timeout for OpenAI operations
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    console.log('🎓📝 GRADE LEVEL REWRITE API v1.0 - Vercel Edge Function!')

    // Verify authentication
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      })
    }

    const token = authHeader.substring(7)

    // Verify the token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('Authentication error:', authError)
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      })
    }

    const { text, gradeLevel } = req.body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      })
    }

    if (!gradeLevel || typeof gradeLevel !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Grade level is required and must be a string'
      })
    }

    // Validate grade level options
    const validGradeLevels = ['elementary', 'middle-school', 'high-school', 'college', 'graduate']
    if (!validGradeLevels.includes(gradeLevel.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid grade level. Must be one of: ${validGradeLevels.join(', ')}`
      })
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured'
      })
    }

    // Calculate original readability
    const originalReadability = calculateReadability(text)

    const rewrittenText = await rewriteGradeLevelWithOpenAI(text, gradeLevel.toLowerCase())

    // Calculate new readability
    const newReadability = calculateReadability(rewrittenText)

    const hasChanges = rewrittenText !== text && rewrittenText.trim() !== text.trim()

    return res.status(200).json({
      success: true,
      originalText: text,
      rewrittenText,
      gradeLevel: gradeLevel.toLowerCase(),
      originalReadability: {
        fleschKincaid: originalReadability.fleschKincaid,
        readingEase: originalReadability.fleschReadingEase,
        level: originalReadability.readabilityLevel
      },
      newReadability: {
        fleschKincaid: newReadability.fleschKincaid,
        readingEase: newReadability.fleschReadingEase,
        level: newReadability.readabilityLevel
      },
      changes: hasChanges ? [`Text rewritten for ${gradeLevel} grade level`] : ['No changes needed'],
      hasChanges,
      method: 'openai',
      version: 'Grade Level Rewrite Edge Function v1.0',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Grade level rewriting error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to rewrite text for grade level'
    })
  }
}

async function rewriteGradeLevelWithOpenAI(text, gradeLevel) {
  const gradeLevelInstructions = {
    'elementary': {
      instruction: 'Rewrite this text for elementary school students (grades 1-5). Use very simple words, short sentences, and basic concepts that young children can understand.',
      examples: {
        before: "The implementation of this methodology requires significant consideration of various factors.",
        after: "This way of doing things needs us to think about many things first."
      },
      changes: [
        'Use only simple, common words that elementary students know',
        'Keep sentences under 10-12 words',
        'Replace complex concepts with basic explanations',
        'Use active voice and simple sentence structures',
        'Avoid technical terms and big words'
      ],
      temperature: 0.3,
      targetFK: '3-5'
    },
    'middle-school': {
      instruction: 'Rewrite this text for middle school students (grades 6-8). Use clear language and moderate complexity that pre-teens can understand.',
      examples: {
        before: "The implementation of this methodology requires significant consideration of various factors.",
        after: "Using this method means we need to think carefully about several important things."
      },
      changes: [
        'Use clear, straightforward vocabulary',
        'Keep sentences moderate length (12-16 words)',
        'Explain concepts clearly without being too simple',
        'Use familiar examples and comparisons',
        'Balance simplicity with some complexity'
      ],
      temperature: 0.4,
      targetFK: '6-8'
    },
    'high-school': {
      instruction: 'Rewrite this text for high school students (grades 9-12). Use standard academic language that teenagers can understand.',
      examples: {
        before: "The implementation of this methodology requires significant consideration of various factors.",
        after: "Implementing this approach requires careful consideration of several important factors."
      },
      changes: [
        'Use standard academic vocabulary',
        'Keep sentences reasonably complex but clear',
        'Include some advanced concepts with explanation',
        'Use proper academic structure',
        'Balance complexity with clarity'
      ],
      temperature: 0.4,
      targetFK: '9-12'
    },
    'college': {
      instruction: 'Rewrite this text for college students and adults. Use sophisticated language and complex concepts appropriate for higher education.',
      examples: {
        before: "This way of doing things needs us to think about many things first.",
        after: "The implementation of this methodology requires comprehensive analysis of multiple contributing factors."
      },
      changes: [
        'Use advanced vocabulary and terminology',
        'Employ complex sentence structures',
        'Include sophisticated concepts and analysis',
        'Use academic writing conventions',
        'Demonstrate higher-level thinking'
      ],
      temperature: 0.5,
      targetFK: '13-16'
    },
    'graduate': {
      instruction: 'Rewrite this text for graduate-level readers and professionals. Use highly sophisticated language, technical terminology, and complex analytical concepts.',
      examples: {
        before: "This way of doing things needs us to think about many things first.",
        after: "The operationalization of this theoretical framework necessitates a multifaceted evaluation of interdependent variables and their potential ramifications across diverse contextual parameters."
      },
      changes: [
        'Use highly technical and specialized vocabulary',
        'Employ complex, nuanced sentence structures',
        'Include advanced theoretical concepts',
        'Use professional/academic jargon appropriately',
        'Demonstrate expert-level analysis and synthesis'
      ],
      temperature: 0.6,
      targetFK: '17+'
    }
  }

  const selectedLevel = gradeLevelInstructions[gradeLevel] || gradeLevelInstructions['high-school']
  
  // Estimate tokens to stay within limits
  const estimatedTokens = Math.ceil(text.length / 3)
  const maxTokens = Math.min(4000, Math.max(800, estimatedTokens * 2))

  console.log('🎓 Grade Level OpenAI request details:', {
    gradeLevel,
    targetFK: selectedLevel.targetFK,
    textLength: text.length,
    estimatedInputTokens: estimatedTokens,
    maxOutputTokens: maxTokens,
    temperature: selectedLevel.temperature
  })

  try {
    const systemPrompt = `You are an expert educational content specialist who rewrites text for specific grade levels. Your job is to COMPLETELY REWRITE the given text to match the target reading level.

CRITICAL REQUIREMENTS:
- You MUST rewrite for ${gradeLevel.toUpperCase()} level (Flesch-Kincaid Grade Level: ${selectedLevel.targetFK})
- The rewritten version should be significantly different from the original
- You MUST preserve all the original meaning and information
- Never lose important details or concepts
- Always aim for the target reading level while maintaining accuracy

GRADE LEVEL: ${gradeLevel.toUpperCase()}
TARGET FLESCH-KINCAID: ${selectedLevel.targetFK}
INSTRUCTION: ${selectedLevel.instruction}

REQUIRED CHANGES:
${selectedLevel.changes.map(change => `• ${change}`).join('\n')}

EXAMPLE TRANSFORMATION:
Original: "${selectedLevel.examples.before}"
Target Level: "${selectedLevel.examples.after}"

Your rewrite should demonstrate this level of transformation. Make substantial changes while preserving the core meaning and targeting the specified grade level.`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Rewrite this text for ${gradeLevel} grade level (target FK: ${selectedLevel.targetFK}):\n\n"${text}"`
        }
      ],
      max_tokens: maxTokens,
      temperature: selectedLevel.temperature,
      top_p: 0.95,
      frequency_penalty: 0.2,
      presence_penalty: 0.2
    })

    let rewrittenText = completion.choices[0]?.message?.content?.trim()

    if (!rewrittenText) {
      console.error('OpenAI returned empty response for grade level rewrite')
      throw new Error('OpenAI returned empty response')
    }

    // Remove quotes if OpenAI wrapped the response in quotes
    if (rewrittenText.startsWith('"') && rewrittenText.endsWith('"')) {
      rewrittenText = rewrittenText.slice(1, -1)
    }

    console.log('✅ Grade Level OpenAI completion successful:', {
      inputTokens: completion.usage?.prompt_tokens || 'unknown',
      outputTokens: completion.usage?.completion_tokens || 'unknown',
      totalTokens: completion.usage?.total_tokens || 'unknown',
      model: completion.model,
      targetGradeLevel: gradeLevel,
      targetFK: selectedLevel.targetFK
    })

    return rewrittenText

  } catch (error) {
    console.error('Grade Level OpenAI API call failed:', {
      error: error.message,
      type: error.constructor.name,
      status: error.status,
      code: error.code,
      gradeLevel
    })
    
    throw error
  }
}

// Calculate readability scores
function calculateReadability(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = text.split(/\s+/).filter(w => w.trim().length > 0)
  
  if (sentences.length === 0 || words.length === 0) {
    return {
      fleschKincaid: 0,
      fleschReadingEase: 0,
      readabilityLevel: 'Unknown',
      readingEaseLevel: 'Unknown',
      averageWordsPerSentence: 0,
      averageSyllablesPerWord: 0,
      totalSentences: 0,
      passiveVoicePercentage: 0,
      longSentences: 0
    }
  }

  const syllables = words.reduce((total, word) => total + countSyllables(word), 0)
  
  const avgWordsPerSentence = words.length / sentences.length
  const avgSyllablesPerWord = syllables / words.length
  
  // Flesch-Kincaid Grade Level formula
  const fleschKincaid = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59
  
  // Flesch Reading Ease formula
  const fleschReadingEase = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord)
  
  // Count long sentences (>20 words) and passive voice (simplified)
  const longSentences = sentences.filter(s => s.split(/\s+/).length > 20).length
  const passiveVoiceCount = sentences.filter(s => 
    /\b(was|were|is|are|been|being)\s+\w+ed\b/i.test(s) ||
    /\b(was|were|is|are|been|being)\s+\w+en\b/i.test(s)
  ).length
  const passiveVoicePercentage = Math.round((passiveVoiceCount / sentences.length) * 100)
  
  return {
    fleschKincaid: Math.round(fleschKincaid * 100) / 100,
    fleschReadingEase: Math.round(fleschReadingEase * 100) / 100,
    readabilityLevel: getReadabilityLevel(fleschKincaid),
    readingEaseLevel: getReadingEaseLevel(fleschReadingEase),
    averageWordsPerSentence: Math.round(avgWordsPerSentence * 100) / 100,
    averageSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    totalSentences: sentences.length,
    passiveVoicePercentage,
    longSentences
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
  if (score <= 5) return 'Elementary School'
  if (score <= 8) return 'Middle School'
  if (score <= 12) return 'High School'
  if (score <= 16) return 'College Level'
  return 'Graduate Level'
}

function getReadingEaseLevel(score) {
  if (score >= 90) return 'Very Easy'
  if (score >= 80) return 'Easy'
  if (score >= 70) return 'Fairly Easy'
  if (score >= 60) return 'Standard'
  if (score >= 50) return 'Fairly Difficult'
  if (score >= 30) return 'Difficult'
  return 'Very Difficult'
} 