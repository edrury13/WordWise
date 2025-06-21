import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Cache for AI responses to reduce API calls
const responseCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export default async function handler(req, res) {
  console.log('🤖 AI Grammar check API called:', {
    method: req.method,
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
    res.status(200).end()
    return
  }

  try {
    const { method, body, headers } = req
    const authHeader = headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      })
    }

    const token = authHeader.substring(7)
    
    // Validate user with Supabase
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

    const { 
      text, 
      context = '', 
      documentType = 'general',
      checkType = 'comprehensive' // comprehensive, grammar-only, style-only
    } = body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      })
    }

    if (text.length > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Text is too long (maximum 10,000 characters for AI analysis)'
      })
    }

    // Generate cache key
    const cacheKey = `${user.id}-${text.substring(0, 100)}-${checkType}-${documentType}`
    
    // Check cache first
    const cached = responseCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('📦 Returning cached AI response')
      return res.status(200).json(cached.data)
    }

    console.log('🤖 Calling OpenAI API...')
    
    // Prepare the system prompt based on check type
    let systemPrompt = `You are an expert writing assistant specializing in grammar, spelling, and style checking. 
    Analyze the provided text and return a JSON array of suggestions.
    
    Each suggestion should have:
    - type: "grammar", "spelling", "style", "clarity", "conciseness", or "tone"
    - severity: "high" (errors), "medium" (likely issues), or "low" (style suggestions)
    - message: Brief description of the issue
    - explanation: Detailed explanation of why this is an issue
    - originalText: The exact text that has the issue
    - suggestions: Array of 1-3 suggested replacements
    - confidence: 0-100 score indicating confidence in the suggestion
    
    Important guidelines:
    - Only flag actual errors or improvements, not stylistic preferences unless they impact clarity
    - Consider the document type: ${documentType}
    - Preserve the author's voice while improving clarity and correctness
    - For grammar/spelling errors, confidence should be 90-100
    - For style suggestions, confidence should be 60-85
    - Be especially careful with technical terms, proper nouns, and domain-specific language
    - If the text seems intentionally informal or creative, adjust expectations accordingly`

    if (checkType === 'grammar-only') {
      systemPrompt += '\n\nFocus ONLY on grammar and spelling errors. Ignore style and tone.'
    } else if (checkType === 'style-only') {
      systemPrompt += '\n\nFocus ONLY on style, clarity, and tone. Ignore minor grammar issues.'
    }

    const userPrompt = context 
      ? `Context about this document: ${context}\n\nText to analyze:\n${text}`
      : `Text to analyze:\n${text}`

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Low temperature for consistent grammar checking
      max_tokens: 2000
    })

    const aiResponse = JSON.parse(completion.choices[0].message.content)
    
    // Process and format suggestions
    const suggestions = (aiResponse.suggestions || []).map((suggestion, index) => {
      // Find the position of the original text in the content
      const offset = text.indexOf(suggestion.originalText)
      const length = suggestion.originalText ? suggestion.originalText.length : 0
      
      return {
        id: `ai-${Date.now()}-${index}`,
        type: suggestion.type || 'grammar',
        message: suggestion.message,
        explanation: suggestion.explanation || suggestion.message,
        replacements: suggestion.suggestions || [],
        offset: offset >= 0 ? offset : 0,
        length: length,
        context: getContextSnippet(text, offset, length),
        category: mapTypeToCategory(suggestion.type),
        severity: suggestion.severity || 'medium',
        confidence: suggestion.confidence || 80,
        source: 'ai'
      }
    }).filter(s => s.offset >= 0) // Only include suggestions we could locate

    // Calculate statistics
    const stats = {
      totalIssues: suggestions.length,
      grammarIssues: suggestions.filter(s => s.type === 'grammar').length,
      spellingIssues: suggestions.filter(s => s.type === 'spelling').length,
      styleIssues: suggestions.filter(s => ['style', 'clarity', 'conciseness', 'tone'].includes(s.type)).length,
      highSeverity: suggestions.filter(s => s.severity === 'high').length,
      mediumSeverity: suggestions.filter(s => s.severity === 'medium').length,
      lowSeverity: suggestions.filter(s => s.severity === 'low').length,
      averageConfidence: suggestions.length > 0 
        ? Math.round(suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length)
        : 0
    }

    const response = {
      success: true,
      suggestions,
      stats,
      metadata: {
        model: 'gpt-4-turbo',
        checkType,
        documentType,
        textLength: text.length
      }
    }

    // Cache the response
    responseCache.set(cacheKey, {
      timestamp: Date.now(),
      data: response
    })

    // Clean old cache entries
    if (responseCache.size > 100) {
      const entries = Array.from(responseCache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      entries.slice(0, 50).forEach(([key]) => responseCache.delete(key))
    }

    console.log('✅ AI Grammar check completed:', stats)
    return res.status(200).json(response)

  } catch (error) {
    console.error('💥 AI Grammar check error:', error)
    
    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'AI service rate limit exceeded. Please try again later.'
      })
    }
    
    if (error.status === 401) {
      return res.status(500).json({
        success: false,
        error: 'AI service configuration error'
      })
    }
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    })
  }
}

function getContextSnippet(text, offset, length) {
  const contextRadius = 40
  const start = Math.max(0, offset - contextRadius)
  const end = Math.min(text.length, offset + length + contextRadius)
  
  let snippet = text.substring(start, end)
  
  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet = snippet + '...'
  
  return snippet
}

function mapTypeToCategory(type) {
  const categoryMap = {
    'grammar': 'Grammar',
    'spelling': 'Spelling',
    'style': 'Style',
    'clarity': 'Clarity',
    'conciseness': 'Conciseness',
    'tone': 'Tone & Voice'
  }
  return categoryMap[type] || 'Other'
} 