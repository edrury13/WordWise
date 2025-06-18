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
  // UNIQUE IDENTIFIER: Enhanced OpenAI Version 2.0
  console.log('🚀🤖 ENHANCED OPENAI TONE REWRITE API v2.0 - This is the NEW implementation!')
  
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

    const { text, tone } = body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      })
    }

    if (!tone || typeof tone !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Tone is required and must be a string'
      })
    }

    if (text.length > 50000) {
      return res.status(400).json({
        success: false,
        error: 'Text is too long (maximum 50,000 characters)'
      })
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured'
      })
    }

    console.log('🤖 Processing OpenAI tone rewrite request:', {
      textLength: text.length,
      tone: tone,
      textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      userId: user.id
    })

    // Use OpenAI to rewrite the text
    const rewrittenText = await rewriteWithOpenAI(text, tone)
    
    const hasChanges = rewrittenText !== text && rewrittenText.trim() !== text.trim()
    
    console.log('📊 OpenAI tone rewrite result:', {
      hasChanges,
      originalLength: text.length,
      rewrittenLength: rewrittenText.length,
      tone,
      userId: user.id
    })

    return res.status(200).json({
      success: true,
      originalText: text,
      rewrittenText: rewrittenText,
      tone: tone,
      changes: hasChanges ? [`Text rewritten using AI for ${tone} tone`] : ['No changes needed'],
      hasChanges,
      method: 'openai',
      version: 'Enhanced OpenAI v2.0',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('OpenAI tone rewrite error:', {
      error: error.message,
      type: error.constructor.name,
      stack: error.stack
    })

    // Handle specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return res.status(429).json({
          success: false,
          error: 'OpenAI rate limit exceeded. Please try again in a moment.'
        })
      }
      
      if (error.status === 401) {
        return res.status(500).json({
          success: false,
          error: 'OpenAI API authentication failed'
        })
      }

      if (error.status === 400) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request to OpenAI API'
        })
      }
    }

    // Handle timeout errors
    if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
      return res.status(408).json({
        success: false,
        error: 'Request timeout. Please try with shorter text.'
      })
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to rewrite text. Please try again.'
    })
  }
}

async function rewriteWithOpenAI(text, tone) {
  const toneInstructions = {
    'professional': {
      instruction: 'Transform this text into a highly professional, business-appropriate tone. You MUST make significant changes to achieve a formal, polished style.',
      examples: {
        before: "Hey, this is awesome and I can't wait to see how it works out!",
        after: "I am pleased to express my enthusiasm for this development and look forward to observing its implementation and outcomes."
      },
      changes: [
        'Replace all contractions with full forms',
        'Use sophisticated business vocabulary',
        'Structure sentences formally',
        'Add professional courtesy language',
        'Eliminate casual expressions entirely'
      ],
      temperature: 0.4
    },
    'casual': {
      instruction: 'Convert this text to a relaxed, conversational style that sounds like friendly chat. You MUST make it sound completely informal and approachable.',
      examples: {
        before: "I am writing to inform you that the project has been completed successfully.",
        after: "Hey! Just wanted to let you know the project's all done and it turned out great!"
      },
      changes: [
        'Use lots of contractions',
        'Add casual filler words and phrases',
        'Make sentences shorter and punchier',
        'Include friendly exclamations',
        'Use informal vocabulary throughout'
      ],
      temperature: 0.6
    },
    'formal': {
      instruction: 'Elevate this text to an extremely formal, academic register with sophisticated language structures. You MUST use complex vocabulary and formal constructions.',
      examples: {
        before: "This is a good idea that will help our company.",
        after: "This proposal represents a commendable initiative that shall facilitate the advancement of our organizational objectives."
      },
      changes: [
        'Use complex sentence structures',
        'Employ sophisticated academic vocabulary',
        'Add formal transitional phrases',
        'Use passive voice where appropriate',
        'Eliminate all informal elements'
      ],
      temperature: 0.3
    },
    'friendly': {
      instruction: 'Make this text warm, welcoming, and genuinely personable. You MUST infuse it with positive energy and approachable warmth.',
      examples: {
        before: "The meeting is scheduled for tomorrow.",
        after: "I'm so excited to let you know our meeting is all set for tomorrow - looking forward to seeing you there!"
      },
      changes: [
        'Add enthusiastic and welcoming language',
        'Include positive emotional words',
        'Use inclusive and warm phrasing',
        'Add personal touches and encouragement',
        'Make it sound genuinely caring'
      ],
      temperature: 0.5
    },
    'academic': {
      instruction: 'Transform this into scholarly academic prose with precise terminology and rigorous intellectual structure. You MUST use academic conventions and scholarly language.',
      examples: {
        before: "Our research shows that this method works well.",
        after: "The empirical evidence demonstrates that this methodological approach yields consistently favorable outcomes across multiple parameters."
      },
      changes: [
        'Use precise academic terminology',
        'Employ objective, third-person perspective',
        'Add scholarly qualifiers and hedging',
        'Structure arguments with academic rigor',
        'Include formal academic phrases'
      ],
      temperature: 0.3
    },
    'creative': {
      instruction: 'Completely reimagine this text with vivid, imaginative language that captivates and engages. You MUST use creative literary techniques and colorful expressions.',
      examples: {
        before: "The product launch was successful.",
        after: "Our product burst onto the scene like a shooting star, dazzling the market and leaving competitors scrambling in its luminous wake."
      },
      changes: [
        'Use vivid metaphors and imagery',
        'Add creative adjectives and descriptors',
        'Employ literary devices and figurative language',
        'Create engaging, story-like elements',
        'Transform mundane statements into compelling prose'
      ],
      temperature: 0.8
    },
    'persuasive': {
      instruction: 'Rewrite this to be powerfully convincing and compelling. You MUST use strong persuasive techniques to make the content irresistibly appealing.',
      examples: {
        before: "You should consider this option.",
        after: "Imagine the incredible transformation you'll experience when you choose this game-changing solution that smart leaders are already embracing!"
      },
      changes: [
        'Use strong action verbs and power words',
        'Add compelling emotional appeals',
        'Include social proof and urgency',
        'Frame benefits as transformative',
        'Use persuasive psychological triggers'
      ],
      temperature: 0.6
    },
    'concise': {
      instruction: 'Strip this text down to its absolute essentials while making it punchy and direct. You MUST eliminate every unnecessary word and make it incredibly tight.',
      examples: {
        before: "I would like to take this opportunity to inform you that we have successfully completed the project.",
        after: "Project completed successfully."
      },
      changes: [
        'Remove all redundant words and phrases',
        'Use active voice exclusively',
        'Eliminate unnecessary qualifiers',
        'Make every word count',
        'Create maximum impact with minimum words'
      ],
      temperature: 0.4
    }
  }

  const selectedTone = toneInstructions[tone] || toneInstructions['professional']
  
  // Estimate tokens to stay within limits
  const estimatedTokens = Math.ceil(text.length / 3)
  const maxTokens = Math.min(4000, Math.max(800, estimatedTokens * 2)) // Increased token allowance

  console.log('🔧 Enhanced OpenAI request details:', {
    tone,
    textLength: text.length,
    estimatedInputTokens: estimatedTokens,
    maxOutputTokens: maxTokens,
    temperature: selectedTone.temperature,
    hasExamples: !!selectedTone.examples
  })

  try {
    const systemPrompt = `You are an expert text transformation specialist. Your job is to COMPLETELY REWRITE the given text to match the requested tone. 

CRITICAL REQUIREMENTS:
- You MUST make substantial changes to the text
- The rewritten version should sound significantly different from the original
- You MUST apply the tone transformation throughout the entire text
- Never return text that is too similar to the original
- Always aim for dramatic improvement in the requested style

TONE: ${tone.toUpperCase()}
INSTRUCTION: ${selectedTone.instruction}

REQUIRED CHANGES:
${selectedTone.changes.map(change => `• ${change}`).join('\n')}

EXAMPLE TRANSFORMATION:
Original: "${selectedTone.examples.before}"
Target Style: "${selectedTone.examples.after}"

Your rewrite should demonstrate this level of transformation. Be bold and make significant changes while preserving the core meaning.`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Transform this text to ${tone} tone (make substantial changes):\n\n"${text}"`
        }
      ],
      max_tokens: maxTokens,
      temperature: selectedTone.temperature,
      top_p: 0.95,
      frequency_penalty: 0.2,
      presence_penalty: 0.2
    })

    let rewrittenText = completion.choices[0]?.message?.content?.trim()

    if (!rewrittenText) {
      console.error('OpenAI returned empty response')
      throw new Error('OpenAI returned empty response')
    }

    // Remove quotes if OpenAI wrapped the response in quotes
    if (rewrittenText.startsWith('"') && rewrittenText.endsWith('"')) {
      rewrittenText = rewrittenText.slice(1, -1)
    }

    // Fallback logic if changes are too minimal
    const similarity = calculateSimilarity(text.toLowerCase(), rewrittenText.toLowerCase())
    console.log('📊 Similarity analysis:', {
      similarity: `${(similarity * 100).toFixed(1)}%`,
      originalLength: text.length,
      rewrittenLength: rewrittenText.length,
      lengthChange: `${(((rewrittenText.length - text.length) / text.length) * 100).toFixed(1)}%`
    })

    // If the text is too similar (>85% similarity), try again with more aggressive prompt
    if (similarity > 0.85 && text.length > 10) {
      console.log('🔄 Text too similar, attempting more aggressive rewrite...')
      
      const aggressiveCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a text transformation expert. The previous attempt was too conservative. 

CRITICAL: You MUST create a dramatically different version that clearly demonstrates the ${tone} tone.
- Change sentence structures completely
- Use entirely different vocabulary where possible
- Rearrange ideas and presentation
- Make it sound like a completely different person wrote it
- Be much more aggressive in applying the ${tone} style

${selectedTone.instruction}

The result should be obviously and dramatically different from the original.`
          },
          {
            role: "user",
            content: `AGGRESSIVELY rewrite this in ${tone} tone (must be very different):\n\n"${text}"`
          }
        ],
        max_tokens: maxTokens,
        temperature: Math.min(0.9, selectedTone.temperature + 0.3), // Increase temperature
        top_p: 0.95,
        frequency_penalty: 0.3,
        presence_penalty: 0.3
      })

      const aggressiveRewrite = aggressiveCompletion.choices[0]?.message?.content?.trim()
      if (aggressiveRewrite && aggressiveRewrite.length > 0) {
        rewrittenText = aggressiveRewrite.startsWith('"') && aggressiveRewrite.endsWith('"') 
          ? aggressiveRewrite.slice(1, -1) 
          : aggressiveRewrite
      }
    }

    console.log('✅ Enhanced OpenAI completion successful:', {
      inputTokens: completion.usage?.prompt_tokens || 'unknown',
      outputTokens: completion.usage?.completion_tokens || 'unknown',
      totalTokens: completion.usage?.total_tokens || 'unknown',
      model: completion.model,
      finalSimilarity: `${(calculateSimilarity(text.toLowerCase(), rewrittenText.toLowerCase()) * 100).toFixed(1)}%`
    })

    return rewrittenText

  } catch (error) {
    console.error('Enhanced OpenAI API call failed:', {
      error: error.message,
      type: error.constructor.name,
      status: error.status,
      code: error.code
    })
    
    throw error
  }
}

// Helper function to calculate text similarity
function calculateSimilarity(text1, text2) {
  const words1 = new Set(text1.split(/\s+/))
  const words2 = new Set(text2.split(/\s+/))
  
  const intersection = new Set([...words1].filter(word => words2.has(word)))
  const union = new Set([...words1, ...words2])
  
  return intersection.size / union.size
}

// Helper function to split long texts into chunks if needed
function splitIntoChunks(text, maxLength = 3000) {
  if (text.length <= maxLength) {
    return [text]
  }

  const chunks = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let currentChunk = ''

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks.length > 0 ? chunks : [text]
} 