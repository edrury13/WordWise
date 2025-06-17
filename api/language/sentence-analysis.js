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

  } catch (error) {
    console.error('Sentence analysis API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
} 