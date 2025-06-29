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

    // Check if it's a demo request - allow without authentication
    const isDemo = body?.isDemo || false
    
    if (!isDemo && (!authHeader || !authHeader.startsWith('Bearer '))) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      })
    }

    // For demo requests, we skip the Supabase authentication
    let user = null
    if (!isDemo) {
      const token = authHeader.substring(7)
      
      // Validate user with Supabase
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(token)

      if (userError || !authUser) {
        return res.status(401).json({
          success: false,
          error: 'Invalid authentication token'
        })
      }
      
      user = authUser
    } else {
      // For demo mode, create a dummy user object
      user = { id: 'demo-user' }
      console.log('🎯 Running in demo mode - authentication bypassed')
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
      checkType = 'comprehensive', // comprehensive, grammar-only, style-only
      styleProfile
    } = body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      })
    }

    // Apply stricter limits for demo mode
    const maxTextLength = isDemo ? 1000 : 10000
    
    if (text.length > maxTextLength) {
      return res.status(400).json({
        success: false,
        error: `Text is too long (maximum ${maxTextLength} characters${isDemo ? ' for demo mode' : ' for AI analysis'})`
      })
    }

    // Generate cache key
    const cacheKey = `${user.id}-${text.substring(0, 100)}-${checkType}-${documentType}-${styleProfile?.name || 'none'}`
    
    // Check cache first
    const cached = responseCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('📦 Returning cached AI response')
      return res.status(200).json(cached.data)
    }

    console.log('🤖 Calling OpenAI API...')
    
    // Prepare the system prompt based on check type
    let systemPrompt = `You are an expert writing assistant specializing in grammar, spelling, and style checking. 
    Analyze the provided text and return a JSON object with a "suggestions" array.
    
    Each suggestion should have:
    - type: "grammar", "spelling", "style", "clarity", "conciseness", or "tone"
    - severity: "high" (errors), "medium" (likely issues), or "low" (style suggestions)
    - message: Brief description of the issue
    - explanation: Detailed explanation of why this is an issue
    - originalText: The EXACT text that has the issue (including any surrounding punctuation)
    - context: A unique phrase of 10-20 words that includes the error (to help locate it precisely)
    - suggestions: Array of 1-3 suggested replacements
    - confidence: 0-100 score indicating confidence in the suggestion
    
    Important guidelines:
    - For originalText, include the exact error and immediate context (e.g., "dog are" not just "are")
    - For context, include enough surrounding text to make the location unambiguous
    - Only flag actual errors or improvements, not stylistic preferences unless they impact clarity
    - Consider the document type: ${documentType}
    - Preserve the author's voice while improving clarity and correctness
    - For grammar/spelling errors, confidence should be 90-100
    - For style suggestions, confidence should be 60-85
    - Be especially careful with technical terms, proper nouns, and domain-specific language
    - If the text seems intentionally informal or creative, adjust expectations accordingly
    - Return a JSON object (not array) with a "suggestions" array property`

    // Add style profile specific instructions
    if (styleProfile) {
      systemPrompt += `\n\n${styleProfile.prompt}`
      console.log('📝 Using style profile:', styleProfile.name, '- Type:', styleProfile.type)
    }

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
      // Better offset calculation that handles context
      let offset = -1
      let length = 0
      
      if (suggestion.originalText) {
        length = suggestion.originalText.length
        
        // Use the best occurrence finder with context
        offset = findBestOccurrence(text, suggestion.originalText, suggestion.context)
      }
      
      // Log for debugging
      const occurrenceCount = suggestion.originalText ? findAllOccurrences(text, suggestion.originalText).length : 0
      console.log(`AI suggestion #${index}:`, {
        originalText: suggestion.originalText,
        foundAt: offset,
        hasContext: !!suggestion.context,
        occurrences: occurrenceCount,
        type: suggestion.type
      })
      
      return {
        id: `ai-${Date.now()}-${index}`,
        type: suggestion.type || 'grammar',
        message: suggestion.message,
        explanation: suggestion.explanation || suggestion.message,
        replacements: suggestion.suggestions || [],
        offset: offset,
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
  // Handle negative offset gracefully
  if (offset < 0) {
    return ''
  }
  
  const contextRadius = 40
  const start = Math.max(0, offset - contextRadius)
  const end = Math.min(text.length, offset + length + contextRadius)
  
  let snippet = text.substring(start, end)
  
  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet = snippet + '...'
  
  return snippet
}

// Find all occurrences of a substring in text
function findAllOccurrences(text, searchStr) {
  const occurrences = []
  let index = text.indexOf(searchStr)
  
  while (index !== -1) {
    occurrences.push(index)
    index = text.indexOf(searchStr, index + 1)
  }
  
  return occurrences
}

// Find the best matching occurrence based on context
function findBestOccurrence(text, searchStr, context) {
  if (!context) {
    return text.indexOf(searchStr)
  }
  
  // Find all occurrences
  const occurrences = findAllOccurrences(text, searchStr)
  
  if (occurrences.length === 0) return -1
  if (occurrences.length === 1) return occurrences[0]
  
  // Score each occurrence based on context match
  let bestScore = -1
  let bestIndex = occurrences[0]
  
  for (const occurrence of occurrences) {
    // Get surrounding context for this occurrence
    const contextStart = Math.max(0, occurrence - 50)
    const contextEnd = Math.min(text.length, occurrence + searchStr.length + 50)
    const occurrenceContext = text.substring(contextStart, contextEnd)
    
    // Calculate similarity score (simple word overlap)
    const contextWords = context.toLowerCase().split(/\s+/)
    const occurrenceWords = occurrenceContext.toLowerCase().split(/\s+/)
    
    let score = 0
    for (const word of contextWords) {
      if (occurrenceWords.includes(word)) {
        score++
      }
    }
    
    if (score > bestScore) {
      bestScore = score
      bestIndex = occurrence
    }
  }
  
  return bestIndex
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