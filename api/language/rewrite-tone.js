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

    // Simplified tone rewriting for serverless deployment
    // In a full implementation, this would use an AI service like OpenAI
    const rewrittenText = applyToneRewriting(text, tone)

    return res.status(200).json({
      success: true,
      originalText: text,
      rewrittenText: rewrittenText,
      tone: tone,
      changes: []
    })

  } catch (error) {
    console.error('Tone rewrite API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

function applyToneRewriting(text, tone) {
  // Simplified tone rewriting logic
  // In production, this would integrate with an AI service
  
  const toneModifications = {
    'professional': {
      replacements: [
        { from: /\bkinda\b/gi, to: 'somewhat' },
        { from: /\bgonna\b/gi, to: 'going to' },
        { from: /\bwanna\b/gi, to: 'want to' },
        { from: /\byeah\b/gi, to: 'yes' },
        { from: /\bokay\b/gi, to: 'acceptable' }
      ]
    },
    'casual': {
      replacements: [
        { from: /\bsomewhat\b/gi, to: 'kinda' },
        { from: /\bgoing to\b/gi, to: 'gonna' },
        { from: /\bwant to\b/gi, to: 'wanna' },
        { from: /\byes\b/gi, to: 'yeah' }
      ]
    },
    'friendly': {
      replacements: [
        { from: /\bHello\b/gi, to: 'Hi there' },
        { from: /\bThank you\b/gi, to: 'Thanks so much' },
        { from: /\bRegards\b/gi, to: 'Best wishes' }
      ]
    },
    'formal': {
      replacements: [
        { from: /\bHi\b/gi, to: 'Dear' },
        { from: /\bThanks\b/gi, to: 'Thank you' },
        { from: /\bBest\b/gi, to: 'Sincerely' }
      ]
    }
  }

  let rewrittenText = text
  const modifications = toneModifications[tone.toLowerCase()] || { replacements: [] }

  modifications.replacements.forEach(({ from, to }) => {
    rewrittenText = rewrittenText.replace(from, to)
  })

  return rewrittenText
} 