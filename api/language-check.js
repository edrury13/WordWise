import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  console.log('🚀 Language check API called:', {
    method: req.method,
    url: req.url,
    hasAuth: !!req.headers.authorization,
    timestamp: new Date().toISOString()
  })

  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request handled')
    res.status(200).end()
    return
  }

  try {
    const { method, body, headers } = req
    const authHeader = headers.authorization

    console.log('🔐 Auth check:', {
      hasAuthHeader: !!authHeader,
      authHeaderFormat: authHeader ? 'Bearer token provided' : 'none'
    })

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No valid auth header')
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      })
    }

    const token = authHeader.substring(7)
    
    // Validate user with Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    console.log('👤 User validation:', {
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message
    })

    if (userError || !user) {
      console.error('❌ Authentication failed:', userError?.message)
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      })
    }

    if (method !== 'POST') {
      console.log('❌ Wrong method:', method)
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      })
    }

    const { text, language = 'en-US' } = body

    console.log('📝 Request body:', {
      hasText: !!text,
      textLength: text?.length || 0,
      language
    })

    if (!text || typeof text !== 'string') {
      console.log('❌ Invalid text')
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      })
    }

    if (text.length > 50000) {
      console.log('❌ Text too long')
      return res.status(400).json({
        success: false,
        error: 'Text is too long (maximum 50,000 characters)'
      })
    }

    // Use LanguageTool for grammar checking
    const languageToolUrl = process.env.LANGUAGETOOL_API_URL || 'https://api.languagetool.org/v2'
    
    console.log('🔍 Calling LanguageTool API...')
    
    const params = new URLSearchParams({
      text,
      language,
      enabledOnly: 'false',
      level: 'picky',
      enabledCategories: 'GRAMMAR,SENTENCE_WHITESPACE,MISC,COMPOUNDING,SEMANTICS,PUNCTUATION,CASING,TYPOS',
      disabledCategories: 'STYLE,COLLOQUIALISMS,REDUNDANCY,WORDINESS'
    })

    const ltResponse = await axios.post(`${languageToolUrl}/check`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000,
    })

    console.log('✅ LanguageTool response received:', {
      matches: ltResponse.data.matches.length
    })

    const suggestions = ltResponse.data.matches.map((match, index) => ({
      id: `lt-${match.rule.id}-${match.offset}-${index}`,
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

    console.log('✅ Returning response with', suggestions.length, 'suggestions')

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
    console.error('💥 Language check API error:', error)
    
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded for language check service'
      })
    }
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    })
  }
}

function getSuggestionType(categoryId, issueType) {
  if (categoryId.includes('TYPOS') || issueType === 'misspelling') {
    return 'spelling'
  }
  if (categoryId.includes('GRAMMAR') || issueType === 'grammar') {
    return 'grammar'
  }
  if (categoryId.includes('STYLE') || issueType === 'style') {
    return 'style'
  }
  if (categoryId.includes('CLARITY')) {
    return 'clarity'
  }
  if (categoryId.includes('ENGAGEMENT')) {
    return 'engagement'
  }
  if (categoryId.includes('DELIVERY')) {
    return 'delivery'
  }
  return 'style'
}

function getSeverity(issueType) {
  if (issueType === 'misspelling' || issueType === 'grammar') {
    return 'high'
  }
  if (issueType === 'style') {
    return 'medium'
  }
  return 'low'
} 