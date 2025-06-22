import express from 'express'
import axios from 'axios'
import OpenAI from 'openai'
import { AuthenticatedRequest } from '../middleware/auth'
// TODO: Import centralized grammar engine when backend integration is complete
// import { grammarEngine, GrammarSuggestion } from '../../../shared/grammar'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const router = express.Router()

// Standardized API response format
interface StandardAPIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  code?: string
  timestamp: number
  performance?: {
    duration: number
    source: 'api' | 'cache' | 'fallback'
  }
}

// Enhanced error handling
class APIError extends Error {
  public code: string
  public status: number
  public source: string

  constructor(message: string, code: string = 'UNKNOWN', status: number = 500, source: string = 'api') {
    super(message)
    this.name = 'APIError'
    this.code = code
    this.status = status
    this.source = source
  }
}

// Standardized response helpers
const createSuccessResponse = <T>(data: T, duration?: number, source: 'api' | 'cache' | 'fallback' = 'api'): StandardAPIResponse<T> => {
  return {
    success: true,
    data,
    timestamp: Date.now(),
    ...(duration && { performance: { duration, source } })
  }
}

const createErrorResponse = (error: APIError | Error | string, code?: string): StandardAPIResponse<never> => {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorCode = error instanceof APIError ? error.code : (code || 'UNKNOWN')
  
  return {
    success: false,
    error: errorMessage,
    code: errorCode,
    timestamp: Date.now()
  }
}

// Enhanced request validation
const validateTextInput = (text: any, maxLength: number = 50000): void => {
  if (!text || typeof text !== 'string') {
    throw new APIError('Text is required and must be a string', 'INVALID_INPUT', 400, 'validation')
  }
  
  if (text.trim().length === 0) {
    throw new APIError('Text cannot be empty', 'INVALID_INPUT', 400, 'validation')
  }
  
  if (text.length > maxLength) {
    throw new APIError(`Text is too long (maximum ${maxLength} characters)`, 'TEXT_TOO_LONG', 400, 'validation')
  }
}

// Enhanced LanguageTool API wrapper with retry logic
const callLanguageToolAPI = async (text: string, language: string = 'en-US', retries: number = 2): Promise<any> => {
  const languageToolUrl = process.env.LANGUAGETOOL_API_URL || 'https://api.languagetool.org/v2'
  
  const params = new URLSearchParams({
    text,
    language,
    enabledOnly: 'false',
    level: 'picky',
    enabledCategories: 'GRAMMAR,SENTENCE_WHITESPACE,MISC,COMPOUNDING,SEMANTICS,PUNCTUATION,CASING,TYPOS,CONFUSED_WORDS,LOGIC,TYPOGRAPHY,PRONOUN_AGREEMENT,SUBJECT_VERB_AGREEMENT,STYLE,COLLOQUIALISMS,REDUNDANCY,WORDINESS,CREATIVE_WRITING',
    enabledRules: 'FRAGMENT_SENTENCE,MISSING_VERB,INCOMPLETE_SENTENCE,SENTENCE_FRAGMENT,RUN_ON_SENTENCE,COMMA_SPLICE,GRAMMAR_AGREEMENT,SUBJECT_VERB_AGREEMENT,VERB_FORM,VERB_AGREEMENT_VS_NOUN,SINGULAR_PLURAL_VERB,TENSE_AGREEMENT,VERB_TENSE,PAST_TENSE_VERB,PRESENT_TENSE_VERB,PRONOUN_AGREEMENT,PRONOUN_REFERENCE,REFLEXIVE_PRONOUN,PERSONAL_PRONOUN_AGREEMENT,ARTICLE_MISSING,DT_DT,MISSING_DETERMINER,A_VS_AN,THE_SUPERLATIVE,PREPOSITION_VERB,MISSING_PREPOSITION,WRONG_PREPOSITION,CONJUNCTION_COMMA,MISSING_CONJUNCTION,COORDINATING_CONJUNCTION,COMMA_BEFORE_CONJUNCTION,MISSING_COMMA,UNNECESSARY_COMMA,APOSTROPHE_MISSING,SENTENCE_CAPITALIZATION,PROPER_NOUN_CAPITALIZATION'
  })

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(`${languageToolUrl}/check`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      })
      
      return response.data
    } catch (error) {
      if (attempt === retries) {
        // Last attempt failed, throw the error
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 429) {
            throw new APIError('Rate limit exceeded for language check service', 'RATE_LIMIT', 429, 'languagetool')
          }
          if (error.code === 'ECONNABORTED') {
            throw new APIError('Language check service timeout', 'TIMEOUT', 408, 'languagetool')
          }
          if (error.response?.status === 503) {
            throw new APIError('Language check service unavailable', 'SERVICE_UNAVAILABLE', 503, 'languagetool')
          }
        }
        throw new APIError('Language check service error', 'SERVICE_ERROR', 500, 'languagetool')
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }
}

interface LanguageToolMatch {
  offset: number
  length: number
  message: string
  shortMessage?: string
  replacements: Array<{ value: string }>
  context: {
    text: string
    offset: number
    length: number
  }
  rule: {
    id: string
    category: {
      id: string
      name: string
    }
    issueType: string
  }
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[]
}

// Check grammar and spelling
router.post('/check', async (req: AuthenticatedRequest, res) => {
  const startTime = Date.now()
  
  try {
    if (!req.user) {
      const errorResponse = createErrorResponse('User not authenticated', 'AUTH_REQUIRED')
      return res.status(401).json(errorResponse)
    }

    const { text, language = 'en-US' } = req.body

    // Enhanced validation
    validateTextInput(text)

    console.log('🔍 Grammar check request:', {
      textLength: text.length,
      language,
      userId: req.user.id
    })

    // Call LanguageTool API with retry logic
    const ltResponse = await callLanguageToolAPI(text, language)

    // Transform LanguageTool response to our format
    const suggestions = ltResponse.matches.map((match: LanguageToolMatch, index: number) => ({
      id: `${match.rule.id}-${match.offset}-${index}`,
      type: getSuggestionType(match.rule.category.id, match.rule.issueType),
      message: match.message,
      replacements: improveReplacements(match.replacements.map(r => r.value), match.rule.id, match.context.text, match.offset, match.length),
      offset: match.offset,
      length: match.length,
      context: match.context.text,
      explanation: match.shortMessage || match.message,
      category: match.rule.category.name,
      severity: getSeverity(match.rule.issueType),
    }))

    const responseData = {
      suggestions,
      stats: {
        totalIssues: suggestions.length,
        grammarIssues: suggestions.filter((s: any) => s.type === 'grammar').length,
        spellingIssues: suggestions.filter((s: any) => s.type === 'spelling').length,
        styleIssues: suggestions.filter((s: any) => s.type === 'style').length,
      }
    }

    const duration = Date.now() - startTime
    const successResponse = createSuccessResponse(responseData, duration, 'api')

    console.log('✅ Grammar check complete:', {
      suggestions: suggestions.length,
      duration,
      userId: req.user.id
    })

    res.status(200).json(successResponse)

  } catch (error) {
    const duration = Date.now() - startTime
    console.error('❌ Grammar check error:', error)
    
    if (error instanceof APIError) {
      const errorResponse = createErrorResponse(error)
      return res.status(error.status).json(errorResponse)
    }

    const errorResponse = createErrorResponse('Failed to check text', 'INTERNAL_ERROR')
    res.status(500).json(errorResponse)
  }
})

// Sentence-level grammar analysis endpoint
router.post('/sentence-analysis', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { text, language = 'en-US' } = req.body

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

    const languageToolUrl = process.env.LANGUAGETOOL_API_URL || 'https://api.languagetool.org/v2'
    
    // Simple and reliable sentence detection
    const sentences = []
    const sentenceOffsets = []
    
    console.log(`📄 Analyzing text of length ${text.length}`)
    
    // Use a simple approach: split by sentence endings and find each in the original text
    const rawSentences = text.split(/[.!?]+/).filter(s => s.trim().length >= 3)
    
    console.log(`📝 Found ${rawSentences.length} raw sentences`)
    
    let searchStartIndex = 0
    
    for (let i = 0; i < rawSentences.length; i++) {
      const sentenceText = rawSentences[i].trim()
      
      // Find this sentence in the original text starting from where we left off
      const sentenceIndex = text.indexOf(sentenceText, searchStartIndex)
      
      if (sentenceIndex !== -1) {
        sentences.push(sentenceText)
        sentenceOffsets.push(sentenceIndex)
        
        // Update search start for next sentence
        searchStartIndex = sentenceIndex + sentenceText.length
        
        console.log(`📍 Sentence ${i + 1}: "${sentenceText.substring(0, 30)}..." at offset ${sentenceIndex}, length ${sentenceText.length}`)
      } else {
        console.log(`⚠️ Could not find sentence in text: "${sentenceText.substring(0, 30)}..."`)
      }
    }

    const sentenceAnalysis = []
    console.log(`Analyzing ${sentences.length} sentences for sentence-level grammar...`)

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]
      const sentenceOffset = sentenceOffsets[i]

      // Add proper punctuation for analysis
      const sentenceWithPunctuation = sentence + '.'

      // Focused sentence-level parameters
      const sentenceParams = new URLSearchParams({
        text: sentenceWithPunctuation,
        language,
        enabledOnly: 'false',
        level: 'picky',
        enabledCategories: 'GRAMMAR,SENTENCE_WHITESPACE,MISC,COMPOUNDING,SEMANTICS,PUNCTUATION,CASING,TYPOS,CONFUSED_WORDS,LOGIC,TYPOGRAPHY,PRONOUN_AGREEMENT,SUBJECT_VERB_AGREEMENT,STYLE,COLLOQUIALISMS,REDUNDANCY,WORDINESS,CREATIVE_WRITING',
        enabledRules: 'FRAGMENT_SENTENCE,MISSING_VERB,INCOMPLETE_SENTENCE,SENTENCE_FRAGMENT,RUN_ON_SENTENCE,COMMA_SPLICE,SUBJECT_VERB_AGREEMENT,GRAMMAR_AGREEMENT,VERB_FORM,SINGULAR_PLURAL_VERB,ARTICLE_MISSING,MISSING_DETERMINER,MISSING_PREPOSITION,MISSING_CONJUNCTION,COMMA_BEFORE_CONJUNCTION,MISSING_COMMA,SENTENCE_CAPITALIZATION'
      })

      try {
        const sentenceResponse = await axios.post<LanguageToolResponse>(
          `${languageToolUrl}/check`,
          sentenceParams,
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000
          }
        )

        // Analyze sentence structure
        const issues = sentenceResponse.data.matches.map(match => ({
          type: getSuggestionType(match.rule.category.id, match.rule.issueType),
          message: match.message,
          ruleId: match.rule.id,
          category: match.rule.category.name,
          severity: getSeverity(match.rule.issueType),
          offset: sentenceOffset + match.offset,
          length: match.length,
          replacements: match.replacements.map(r => r.value)
        }))

        // Add custom sentence structure validation
        const customIssues = validateSentenceStructure(sentence, sentenceOffset)
        issues.push(...customIssues)

        // Determine sentence quality
        const grammarIssues = issues.filter(issue => issue.type === 'grammar').length
        const spellingIssues = issues.filter(issue => issue.type === 'spelling').length
        const structureIssues = issues.filter(issue => 
          issue.ruleId.includes('FRAGMENT') || 
          issue.ruleId.includes('MISSING_VERB') ||
          issue.ruleId.includes('INCOMPLETE') ||
          issue.ruleId.includes('CUSTOM_INCOMPLETE')
        ).length

        let sentenceQuality = 'good'
        if (structureIssues > 0) {
          sentenceQuality = 'incomplete'
        } else if (grammarIssues > 2) {
          sentenceQuality = 'poor'
        } else if (grammarIssues > 0) {
          // Any sentence with grammar issues should be at least 'poor'
          sentenceQuality = 'poor'
        } else if (spellingIssues > 0) {
          // Any sentence with spelling errors should be marked 'fair' at best
          sentenceQuality = 'fair'
        }

        // Additional check: if sentence has spelling errors, it cannot be better than 'fair'
        if (spellingIssues > 0 && (sentenceQuality === 'good' || sentenceQuality === 'poor')) {
          sentenceQuality = sentenceQuality === 'poor' ? 'poor' : 'fair'
        }

        sentenceAnalysis.push({
          sentenceIndex: i,
          text: sentence,
          offset: sentenceOffset,
          length: sentence.length,
          quality: sentenceQuality,
          wordCount: sentence.split(/\s+/).filter(w => w.trim().length > 0).length,
          issues,
          issueCount: issues.length,
          grammarIssueCount: grammarIssues,
          spellingIssueCount: spellingIssues,
          structureIssueCount: structureIssues
        })

        console.log(`Sentence ${i + 1}: "${sentence.substring(0, 50)}..." - Quality: ${sentenceQuality}, Issues: ${issues.length} (Grammar: ${grammarIssues}, Spelling: ${spellingIssues}, Structure: ${structureIssues})`)

      } catch (error) {
        console.error(`Error analyzing sentence ${i + 1}:`, error)
        // Continue with other sentences
        sentenceAnalysis.push({
          sentenceIndex: i,
          text: sentence,
          offset: sentenceOffset,
          length: sentence.length,
          quality: 'unknown',
          wordCount: sentence.split(/\s+/).filter(w => w.trim().length > 0).length,
          issues: [],
          issueCount: 0,
          grammarIssueCount: 0,
          spellingIssueCount: 0,
          structureIssueCount: 0,
          error: 'Analysis failed'
        })
      }
    }

    // Overall text analysis
    const totalIssues = sentenceAnalysis.reduce((sum, s) => sum + s.issueCount, 0)
    const totalGrammarIssues = sentenceAnalysis.reduce((sum, s) => sum + s.grammarIssueCount, 0)
    const totalSpellingIssues = sentenceAnalysis.reduce((sum, s) => sum + s.spellingIssueCount, 0)
    const totalStructureIssues = sentenceAnalysis.reduce((sum, s) => sum + s.structureIssueCount, 0)
    
    const qualityDistribution = {
      good: sentenceAnalysis.filter(s => s.quality === 'good').length,
      fair: sentenceAnalysis.filter(s => s.quality === 'fair').length,
      poor: sentenceAnalysis.filter(s => s.quality === 'poor').length,
      incomplete: sentenceAnalysis.filter(s => s.quality === 'incomplete').length
    }

    // Calculate overall text quality
    let overallQuality = 'good'
    const incompletePercentage = (qualityDistribution.incomplete / sentences.length) * 100
    const poorPercentage = (qualityDistribution.poor / sentences.length) * 100

    if (incompletePercentage > 20) {
      overallQuality = 'needs_major_revision'
    } else if (poorPercentage > 30 || incompletePercentage > 10) {
      overallQuality = 'needs_revision'
    } else if (poorPercentage > 10 || qualityDistribution.fair > qualityDistribution.good) {
      overallQuality = 'fair'
    }

    // Calculate Flesch-Kincaid readability score for the entire text
    const readabilityData = calculateReadability(text)

    res.status(200).json({
      success: true,
      analysis: {
        totalSentences: sentences.length,
        overallQuality,
        qualityDistribution,
        totalIssues,
        totalGrammarIssues,
        totalSpellingIssues,
        totalStructureIssues,
        fleschKincaidScore: readabilityData.fleschKincaid,
        fleschReadingEase: readabilityData.fleschReadingEase,
        readabilityLevel: readabilityData.readabilityLevel,
        readingEaseLevel: readabilityData.readingEaseLevel,
        sentences: sentenceAnalysis
      }
    })

  } catch (error) {
    console.error('Sentence analysis error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to analyze sentences'
    })
  }
})

// Analyze text readability
router.post('/readability', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { text } = req.body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      })
    }

    const readabilityScore = calculateReadability(text)

    res.status(200).json({
      success: true,
      readability: readabilityScore
    })
  } catch (error) {
    console.error('Readability analysis error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to analyze text readability'
    })
  }
})

// AI-powered grammar check (streaming)
router.post('/ai-grammar-check-stream', async (req: AuthenticatedRequest, res) => {
  const startTime = Date.now()
  
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { 
      text, 
      context = '', 
      documentType = 'general',
      checkType = 'comprehensive',
      styleProfile,
      changedRanges
    } = req.body

    // Validate input
    validateTextInput(text, 10000) // 10k limit for AI

    console.log('🤖 AI Grammar check (streaming) request:', {
      textLength: text.length,
      documentType,
      checkType,
      userId: req.user.id,
      incremental: !!changedRanges,
      changedRanges: changedRanges?.length || 0
    })

    if (!process.env.OPENAI_API_KEY) {
      console.error('🔑 OpenAI API key not configured')
      return res.status(500).json({
        success: false,
        error: 'AI service configuration error'
      })
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    // Prepare the system prompt based on check type
    let systemPrompt = `You are an expert writing assistant specializing in grammar, spelling, and style checking. 
    Analyze the provided text and identify issues ONE BY ONE.
    
    For EACH issue you find, immediately output a JSON object on a single line with:
    - type: "grammar", "spelling", "style", "clarity", "conciseness", or "tone"
    - severity: "high" (errors), "medium" (likely issues), or "low" (style suggestions)
    - message: Brief description of the issue
    - explanation: Detailed explanation of why this is an issue
    - originalText: The EXACT text that has the issue (including any surrounding punctuation)
    - context: A unique phrase of 10-20 words that includes the error (to help locate it precisely)
    - suggestions: Array of 1-3 suggested replacements
    - confidence: 0-100 score indicating confidence in the suggestion
    
    Output each suggestion as a separate JSON object on its own line.
    DO NOT output an array or wrap suggestions in any container.
    
    Important guidelines:
    - Output each suggestion immediately as you find it
    - Each line should be a complete, valid JSON object
    - For originalText, include the exact error and immediate context
    - For context, include enough surrounding text to make the location unambiguous
    - Only flag actual errors or improvements
    - Consider the document type: ${documentType}
    - Preserve the author's voice while improving clarity
    - Be especially careful with technical terms and proper nouns`
    
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

    let userPrompt = context 
      ? `Context about this document: ${context}\n\n`
      : ''
    
    // Handle incremental checking
    if (changedRanges && changedRanges.length > 0) {
      const changedTexts: string[] = []
      
      changedRanges.forEach((range: { start: number; end: number }, index: number) => {
        const changedText = text.substring(range.start, range.end + 1)
        changedTexts.push(`[Paragraph ${index + 1} - Position ${range.start}-${range.end}]:\n${changedText}`)
      })
      
      userPrompt += `INCREMENTAL CHECK - Only analyze the following changed paragraphs:\n\n${changedTexts.join('\n\n')}\n\nNote: The positions are relative to the full document for proper offset calculation.`
      systemPrompt += '\n\nIMPORTANT: This is an incremental check. Only analyze the specific paragraphs provided.'
    } else {
      userPrompt += `Text to analyze:\n${text}`
    }

    console.log('🚀 Starting OpenAI streaming...')

    // Send initial event
    res.write('data: {"type":"start","message":"Starting AI grammar check..."}\n\n')
    
    const stream = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 2000
    })

    let buffer = ''
    let suggestionCount = 0
    const suggestions: any[] = []
    
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || ''
      buffer += delta
      
      // Check if we have complete lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer
      
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed) {
          try {
            const suggestion = JSON.parse(trimmed)
            
            // Calculate offset
            let offset = -1
            let length = 0
            
            if (suggestion.originalText) {
              length = suggestion.originalText.length
              offset = findBestOccurrence(text, suggestion.originalText, suggestion.context)
            }
            
            if (offset >= 0) {
              const formattedSuggestion = {
                id: `ai-${Date.now()}-${suggestionCount}`,
                type: suggestion.type || 'grammar',
                message: suggestion.message,
                explanation: suggestion.explanation || suggestion.message,
                replacements: suggestion.suggestions || [],
                offset: offset,
                length: length,
                context: suggestion.originalText || '',
                category: mapTypeToCategory(suggestion.type),
                severity: suggestion.severity || 'medium',
                confidence: suggestion.confidence || 80,
                source: 'ai'
              }
              
              suggestions.push(formattedSuggestion)
              suggestionCount++
              
              // Send suggestion event
              res.write(`data: ${JSON.stringify({
                type: 'suggestion',
                suggestion: formattedSuggestion,
                count: suggestionCount
              })}\n\n`)
              
              console.log(`📝 Streamed suggestion #${suggestionCount}:`, {
                type: suggestion.type,
                offset: offset,
                message: suggestion.message.substring(0, 50) + '...'
              })
            }
          } catch (e) {
            // Not valid JSON yet or couldn't parse
            console.log('Parse error:', e, 'Line:', trimmed)
          }
        }
      }
    }
    
    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const suggestion = JSON.parse(buffer.trim())
        // Process final suggestion...
      } catch (e) {
        // Ignore incomplete data
      }
    }

    // Calculate statistics
    const stats = {
      totalIssues: suggestions.length,
      grammarIssues: suggestions.filter((s: any) => s.type === 'grammar').length,
      spellingIssues: suggestions.filter((s: any) => s.type === 'spelling').length,
      styleIssues: suggestions.filter((s: any) => ['style', 'clarity', 'conciseness', 'tone'].includes(s.type)).length,
      highSeverity: suggestions.filter((s: any) => s.severity === 'high').length,
      mediumSeverity: suggestions.filter((s: any) => s.severity === 'medium').length,
      lowSeverity: suggestions.filter((s: any) => s.severity === 'low').length,
      averageConfidence: suggestions.length > 0 
        ? Math.round(suggestions.reduce((sum: number, s: any) => sum + s.confidence, 0) / suggestions.length)
        : 0
    }

    const duration = Date.now() - startTime
    
    // Send completion event
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      stats,
      metadata: {
        model: 'gpt-4-turbo',
        checkType,
        documentType,
        textLength: text.length,
        duration,
        totalSuggestions: suggestions.length
      }
    })}\n\n`)
    
    console.log('✅ AI Grammar streaming complete:', {
      suggestions: suggestions.length,
      duration,
      userId: req.user.id,
      stats
    })
    
    res.end()

  } catch (error: any) {
    console.error('💥 AI Grammar streaming error:', error)
    
    // Try to send error if connection is still open
    try {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message || 'Streaming failed'
      })}\n\n`)
      res.end()
    } catch (e) {
      // Connection already closed
    }
  }
})

// AI-powered grammar check
router.post('/ai-grammar-check', async (req: AuthenticatedRequest, res) => {
  const startTime = Date.now()
  
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { 
      text, 
      context = '', 
      documentType = 'general',
      checkType = 'comprehensive',
      styleProfile,
      changedRanges
    } = req.body

    // Validate input
    validateTextInput(text, 10000) // 10k limit for AI

    console.log('🤖 AI Grammar check request:', {
      textLength: text.length,
      documentType,
      checkType,
      userId: req.user.id,
      incremental: !!changedRanges,
      changedRanges: changedRanges?.length || 0
    })

    if (!process.env.OPENAI_API_KEY) {
      console.error('🔑 OpenAI API key not configured')
      return res.status(500).json({
        success: false,
        error: 'AI service configuration error'
      })
    }

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
    - If the text seems intentionally informal or creative, adjust expectations accordingly`
    
    // Add style profile specific instructions
    if (styleProfile) {
      systemPrompt += `\n\n${styleProfile.prompt}`
      
      // Log that we're using a style profile
      console.log('📝 Using style profile:', styleProfile.name, '- Type:', styleProfile.type)
    }
    
    systemPrompt += '\n\nReturn ONLY valid JSON with a "suggestions" array, nothing else.'

    if (checkType === 'grammar-only') {
      systemPrompt += '\n\nFocus ONLY on grammar and spelling errors. Ignore style and tone.'
    } else if (checkType === 'style-only') {
      systemPrompt += '\n\nFocus ONLY on style, clarity, and tone. Ignore minor grammar issues.'
    }

    let userPrompt = context 
      ? `Context about this document: ${context}\n\n`
      : ''
    
    // Handle incremental checking
    if (changedRanges && changedRanges.length > 0) {
      // Extract only the changed paragraphs for checking
      const changedTexts: string[] = []
      
      changedRanges.forEach((range: { start: number; end: number }, index: number) => {
        const changedText = text.substring(range.start, range.end + 1)
        changedTexts.push(`[Paragraph ${index + 1} - Position ${range.start}-${range.end}]:\n${changedText}`)
      })
      
      userPrompt += `INCREMENTAL CHECK - Only analyze the following changed paragraphs:\n\n${changedTexts.join('\n\n')}\n\nNote: The positions are relative to the full document for proper offset calculation.`
      
      // Add to system prompt for incremental mode
      systemPrompt += '\n\nIMPORTANT: This is an incremental check. Only analyze the specific paragraphs provided, not the entire document. Ensure offsets are calculated relative to the full document position provided.'
    } else {
      userPrompt += `Text to analyze:\n${text}`
    }

    console.log('🚀 Calling OpenAI API...')
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    })

    const aiResponse = JSON.parse(completion.choices[0].message.content || '{"suggestions":[]}')
    
    // Process and format suggestions
    const suggestions = (aiResponse.suggestions || []).map((suggestion: any, index: number) => {
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
        offset: offset >= 0 ? offset : 0,
        length: length,
        context: suggestion.originalText || '',
        category: mapTypeToCategory(suggestion.type),
        severity: suggestion.severity || 'medium',
        confidence: suggestion.confidence || 80,
        source: 'ai'
      }
    }).filter((s: any) => s.offset >= 0) // Only include suggestions we could locate

    // Calculate statistics
    const stats = {
      totalIssues: suggestions.length,
      grammarIssues: suggestions.filter((s: any) => s.type === 'grammar').length,
      spellingIssues: suggestions.filter((s: any) => s.type === 'spelling').length,
      styleIssues: suggestions.filter((s: any) => ['style', 'clarity', 'conciseness', 'tone'].includes(s.type)).length,
      highSeverity: suggestions.filter((s: any) => s.severity === 'high').length,
      mediumSeverity: suggestions.filter((s: any) => s.severity === 'medium').length,
      lowSeverity: suggestions.filter((s: any) => s.severity === 'low').length,
      averageConfidence: suggestions.length > 0 
        ? Math.round(suggestions.reduce((sum: number, s: any) => sum + s.confidence, 0) / suggestions.length)
        : 0
    }

    const duration = Date.now() - startTime
    
    console.log('✅ AI Grammar check complete:', {
      suggestions: suggestions.length,
      duration,
      userId: req.user.id,
      stats,
      incremental: !!changedRanges,
      rangesChecked: changedRanges?.length || 0
    })

    res.status(200).json({
      success: true,
      suggestions,
      stats,
      metadata: {
        model: 'gpt-4-turbo',
        checkType,
        documentType,
        textLength: text.length,
        duration
      }
    })

  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error('💥 AI Grammar check error:', error)
    
    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'AI service rate limit exceeded. Please try again later.'
      })
    }
    
    if (error.code === 'invalid_api_key') {
      return res.status(500).json({
        success: false,
        error: 'AI service configuration error'
      })
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to check text with AI',
      details: error.message
    })
  }
})

function getContextSnippet(text: string, offset: number, length: number): string {
  const contextRadius = 40
  const start = Math.max(0, offset - contextRadius)
  const end = Math.min(text.length, offset + length + contextRadius)
  
  let snippet = text.substring(start, end)
  
  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet = snippet + '...'
  
  return snippet
}

// Find all occurrences of a substring in text
function findAllOccurrences(text: string, searchStr: string): number[] {
  const occurrences: number[] = []
  let index = text.indexOf(searchStr)
  
  while (index !== -1) {
    occurrences.push(index)
    index = text.indexOf(searchStr, index + 1)
  }
  
  return occurrences
}

// Find the best matching occurrence based on context
function findBestOccurrence(text: string, searchStr: string, context?: string): number {
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

function mapTypeToCategory(type: string): string {
  const categoryMap: { [key: string]: string } = {
    'grammar': 'Grammar',
    'spelling': 'Spelling',
    'style': 'Style',
    'clarity': 'Clarity',
    'conciseness': 'Conciseness',
    'tone': 'Tone & Voice'
  }
  return categoryMap[type] || 'Other'
}

// Helper functions
function getSuggestionType(categoryId: string, issueType: string): string {
  console.log('Categorizing suggestion:', { categoryId, issueType })
  
  // Spelling/typos
  if (categoryId.includes('TYPOS') || 
      categoryId.includes('MISSPELLING') || 
      issueType === 'misspelling' ||
      categoryId.includes('SPELL')) {
    return 'spelling'
  }
  
  // Grammar errors - comprehensive detection
  if (categoryId.includes('GRAMMAR') || 
      categoryId.includes('VERB') ||
      categoryId.includes('AGREEMENT') ||
      categoryId.includes('TENSE') ||
      categoryId.includes('PRONOUN') ||
      categoryId.includes('ARTICLE') ||
      categoryId.includes('PREPOSITION') ||
      categoryId.includes('SENTENCE') ||
      categoryId.includes('SUBJECT') ||
      categoryId.includes('AUXILIARY') ||
      categoryId.includes('MODAL') ||
      categoryId.includes('PUNCTUATION') ||
      categoryId.includes('CAPITALIZATION') ||
      categoryId.includes('CONJUNCTION') ||
      categoryId.includes('DETERMINER') ||
      categoryId.includes('SYNTAX') ||
      issueType === 'grammar' ||
      issueType === 'typographical') {
    return 'grammar'
  }
  
  // Style suggestions
  if (categoryId.includes('STYLE') || 
      categoryId.includes('REDUNDANCY') ||
      categoryId.includes('WORDINESS') ||
      categoryId.includes('COLLOQUIALISM') ||
      issueType === 'style') {
    return 'style'
  }
  
  // Clarity issues
  if (categoryId.includes('CLARITY') ||
      categoryId.includes('CONFUSION') ||
      categoryId.includes('AMBIGUITY')) {
    return 'clarity'
  }
  
  // Engagement
  if (categoryId.includes('ENGAGEMENT') ||
      categoryId.includes('TONE')) {
    return 'engagement'
  }
  
  // Delivery
  if (categoryId.includes('DELIVERY') ||
      categoryId.includes('FORMATTING')) {
    return 'delivery'
  }
  
  // Default to grammar for unclassified issues that aren't clearly style
  if (issueType === 'other' || issueType === 'uncategorized') {
    return 'grammar'
  }
  
  return 'style'
}

function getSeverity(issueType: string): string {
  if (issueType === 'misspelling' || issueType === 'grammar') {
    return 'high'
  }
  if (issueType === 'style') {
    return 'medium'
  }
  return 'low'
}

// Improve replacement suggestions by fixing common issues
function improveReplacements(originalReplacements: string[], ruleId: string, context: string, offset: number, length: number): string[] {
  const improvedReplacements = [...originalReplacements]
  
  console.log(`Improving replacements for rule ${ruleId}:`, {
    original: originalReplacements,
    context: context.substring(Math.max(0, offset - 10), offset + length + 10),
    offset,
    length
  })
  
  // Fix "a" vs "an" article issues
  if (ruleId === 'A_NNS' || ruleId.includes('ARTICLE')) {
    const improvedArticleReplacements = originalReplacements.map(replacement => {
      // If replacement starts with "a " followed by a vowel sound, change to "an "
      if (replacement.match(/^a\s+[aeiouAEIOU]/)) {
        return replacement.replace(/^a\s+/, 'an ')
      }
      // If replacement starts with "an " followed by a consonant sound, change to "a "
      if (replacement.match(/^an\s+[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/)) {
        return replacement.replace(/^an\s+/, 'a ')
      }
      return replacement
    })
    
    // Add additional smart suggestions for common patterns
    if (ruleId === 'A_NNS') {
      const originalText = context.substring(offset, offset + length)
      
      // For "a errors" -> suggest "an error" (singular with correct article)
      if (originalText.includes('a errors')) {
        improvedArticleReplacements.unshift('an error')
      }
      // For "a issues" -> suggest "an issue" (singular with correct article)  
      else if (originalText.includes('a issues')) {
        improvedArticleReplacements.unshift('an issue')
      }
      // For "a options" -> suggest "an option" (singular with correct article)
      else if (originalText.includes('a options')) {
        improvedArticleReplacements.unshift('an option')
      }
      // For "a items" -> suggest "an item" (singular with correct article)
      else if (originalText.includes('a items')) {
        improvedArticleReplacements.unshift('an item')
      }
      // For "a examples" -> suggest "an example" (singular with correct article)
      else if (originalText.includes('a examples')) {
        improvedArticleReplacements.unshift('an example')
      }
      // Generic pattern: "a [vowel-starting plural]" -> "an [vowel-starting singular]"
      else {
        const match = originalText.match(/a\s+([aeiou]\w+s)\b/i)
        if (match) {
          const pluralWord = match[1]
          // Simple heuristic: remove 's' to get singular (works for most regular plurals)
          let singularWord = pluralWord
          if (pluralWord.endsWith('ies')) {
            singularWord = pluralWord.slice(0, -3) + 'y'
          } else if (pluralWord.endsWith('es')) {
            singularWord = pluralWord.slice(0, -2)
          } else if (pluralWord.endsWith('s')) {
            singularWord = pluralWord.slice(0, -1)
          }
          
          if (singularWord !== pluralWord) {
            improvedArticleReplacements.unshift(`an ${singularWord}`)
          }
        }
      }
    }
    
    const finalReplacements = improvedArticleReplacements.filter((replacement, index, arr) => 
      arr.indexOf(replacement) === index // Remove duplicates
    )
    
    console.log(`Improved replacements for ${ruleId}:`, {
      original: originalReplacements,
      improved: finalReplacements
    })
    
    return finalReplacements
  }
  
  // Fix subject-verb agreement issues
  if (ruleId.includes('AGREEMENT') || ruleId.includes('VERB')) {
    // Add logic for verb agreement improvements if needed
    return improvedReplacements
  }
  
  return improvedReplacements
}

function calculateReadability(text: string) {
  // Enhanced sentence splitting with better punctuation handling
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = text.split(/\s+/).filter(w => w.trim().length > 0)
  const totalSentences = sentences.length
  const totalWords = words.length
  const averageWordsPerSentence = totalWords / Math.max(totalSentences, 1)

  // Enhanced syllable counting with better accuracy
  const syllables = words.reduce((total, word) => {
    return total + countSyllables(word)
  }, 0)
  const averageSyllablesPerWord = syllables / Math.max(totalWords, 1)

  // Flesch-Kincaid Grade Level (more precise calculation)
  const fleschKincaid = 0.39 * averageWordsPerSentence + 11.8 * averageSyllablesPerWord - 15.59

  // Flesch Reading Ease Score (more precise calculation)
  const fleschReadingEase = 206.835 - (1.015 * averageWordsPerSentence) - (84.6 * averageSyllablesPerWord)

  // Enhanced sentence analysis
  const sentenceAnalysis = analyzeSentenceComplexity(sentences)
  
  // Enhanced vocabulary analysis
  const vocabularyAnalysis = analyzeVocabularyComplexity(words)
  
  // Enhanced passive voice detection
  const passiveAnalysis = analyzePassiveVoice(text, sentences)

  return {
    fleschKincaid: Math.round(fleschKincaid * 100) / 100, // Increased precision
    fleschReadingEase: Math.round(fleschReadingEase * 100) / 100, // Increased precision
    readabilityLevel: getReadingEaseLevel(fleschReadingEase),
    readingEaseLevel: getReadingEaseLevel(fleschReadingEase),
    averageWordsPerSentence: Math.round(averageWordsPerSentence * 100) / 100,
    averageSyllablesPerWord: Math.round(averageSyllablesPerWord * 100) / 100,
    totalSentences,
    totalWords,
    totalSyllables: syllables,
    passiveVoicePercentage: Math.round(passiveAnalysis.percentage * 100) / 100,
    longSentences: sentenceAnalysis.longSentences,
    // Enhanced metrics for better guidance
    sentenceComplexity: sentenceAnalysis,
    vocabularyComplexity: vocabularyAnalysis,
    passiveVoiceAnalysis: passiveAnalysis,
    // Readability factors for AI guidance
    readabilityFactors: {
      sentenceLengthVariation: sentenceAnalysis.lengthVariation,
      vocabularyDifficulty: vocabularyAnalysis.difficultyScore,
      syntacticComplexity: sentenceAnalysis.syntacticComplexity,
      cohesionMarkers: vocabularyAnalysis.cohesionMarkers
    }
  }
}

// Enhanced sentence complexity analysis
function analyzeSentenceComplexity(sentences: string[]) {
  const sentenceLengths = sentences.map(sentence => {
    return sentence.split(/\s+/).filter(w => w.trim().length > 0).length
  })
  
  const averageLength = sentenceLengths.reduce((sum, len) => sum + len, 0) / Math.max(sentences.length, 1)
  const lengthVariation = calculateStandardDeviation(sentenceLengths)
  
  // Count different sentence types
  const longSentences = sentenceLengths.filter(len => len > 20).length
  const shortSentences = sentenceLengths.filter(len => len < 8).length
  const mediumSentences = sentences.length - longSentences - shortSentences
  
  // Analyze syntactic complexity
  let complexSentences = 0
  let subordinateClauses = 0
  let coordinatingConjunctions = 0
  
  sentences.forEach(sentence => {
    // Count subordinating conjunctions and relative pronouns
    const subordinators = (sentence.match(/\b(because|since|although|while|when|if|unless|before|after|that|which|who|whom|whose)\b/gi) || []).length
    subordinateClauses += subordinators
    
    // Count coordinating conjunctions
    const coordinators = (sentence.match(/\b(and|but|or|nor|for|yet|so)\b/gi) || []).length
    coordinatingConjunctions += coordinators
    
    // Complex sentence indicators
    if (subordinators > 0 || coordinators > 1 || sentence.includes(',') || sentence.includes(';')) {
      complexSentences++
    }
  })
  
  return {
    averageLength: Math.round(averageLength * 100) / 100,
    lengthVariation: Math.round(lengthVariation * 100) / 100,
    longSentences,
    shortSentences,
    mediumSentences,
    complexSentences,
    subordinateClauses,
    coordinatingConjunctions,
    syntacticComplexity: Math.round(((complexSentences / Math.max(sentences.length, 1)) * 100) * 100) / 100,
    lengthDistribution: {
      short: Math.round((shortSentences / Math.max(sentences.length, 1)) * 100),
      medium: Math.round((mediumSentences / Math.max(sentences.length, 1)) * 100),
      long: Math.round((longSentences / Math.max(sentences.length, 1)) * 100)
    }
  }
}

// Enhanced vocabulary complexity analysis
function analyzeVocabularyComplexity(words: string[]) {
  const cleanWords = words.map(word => word.toLowerCase().replace(/[^a-z]/g, '')).filter(w => w.length > 0)
  
  // Common word lists (frequency-based)
  const veryCommonWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at'])
  const commonWords = new Set(['this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their'])
  
  let veryCommonCount = 0
  let commonCount = 0
  let uncommonCount = 0
  let longWords = 0 // 7+ characters
  let veryLongWords = 0 // 10+ characters
  let academicWords = 0
  
  const academicIndicators = ['tion', 'sion', 'ment', 'ness', 'ity', 'ism', 'ology', 'ography', 'analysis', 'synthesis', 'hypothesis', 'methodology']
  
  cleanWords.forEach(word => {
    if (veryCommonWords.has(word)) {
      veryCommonCount++
    } else if (commonWords.has(word)) {
      commonCount++
    } else {
      uncommonCount++
    }
    
    if (word.length >= 10) {
      veryLongWords++
    } else if (word.length >= 7) {
      longWords++
    }
    
    // Check for academic vocabulary patterns
    if (academicIndicators.some(indicator => word.includes(indicator))) {
      academicWords++
    }
  })
  
  const totalWords = cleanWords.length
  const difficultyScore = Math.round(((uncommonCount + longWords * 1.5 + veryLongWords * 2 + academicWords * 2) / Math.max(totalWords, 1)) * 100)
  
  // Analyze cohesion markers
  const cohesionMarkers = analyzeCohesionMarkers(words)
  
  return {
    totalWords,
    veryCommonWords: veryCommonCount,
    commonWords: commonCount,
    uncommonWords: uncommonCount,
    longWords,
    veryLongWords,
    academicWords,
    difficultyScore,
    averageWordLength: Math.round((cleanWords.reduce((sum, word) => sum + word.length, 0) / Math.max(totalWords, 1)) * 100) / 100,
    vocabularyDistribution: {
      veryCommon: Math.round((veryCommonCount / Math.max(totalWords, 1)) * 100),
      common: Math.round((commonCount / Math.max(totalWords, 1)) * 100),
      uncommon: Math.round((uncommonCount / Math.max(totalWords, 1)) * 100)
    },
    cohesionMarkers
  }
}

// Analyze cohesion and transition markers
function analyzeCohesionMarkers(words: string[]) {
  const text = words.join(' ').toLowerCase()
  
  const transitionWords = {
    addition: ['also', 'furthermore', 'moreover', 'additionally', 'besides', 'in addition'],
    contrast: ['however', 'nevertheless', 'nonetheless', 'although', 'despite', 'whereas', 'while'],
    cause: ['because', 'since', 'therefore', 'thus', 'consequently', 'as a result'],
    sequence: ['first', 'second', 'next', 'then', 'finally', 'subsequently'],
    example: ['for example', 'for instance', 'such as', 'including', 'namely']
  }
  
  let totalMarkers = 0
  const markerTypes: { [key: string]: number } = {}
  
  Object.entries(transitionWords).forEach(([type, markers]) => {
    let count = 0
    markers.forEach(marker => {
      const regex = new RegExp(`\\b${marker}\\b`, 'gi')
      const matches = text.match(regex) || []
      count += matches.length
    })
    markerTypes[type] = count
    totalMarkers += count
  })
  
  return {
    total: totalMarkers,
    types: markerTypes,
    density: Math.round((totalMarkers / Math.max(words.length, 1)) * 1000) / 10 // per 100 words
  }
}

// Enhanced passive voice analysis
function analyzePassiveVoice(text: string, sentences: string[]) {
  const passivePatterns = [
    /\b(was|were|is|are|been|being)\s+\w+ed\b/gi,
    /\b(was|were|is|are|been|being)\s+\w+en\b/gi,
    /\b(was|were|is|are|been|being)\s+(given|taken|made|done|seen|heard|found|felt|known|shown|told|said)\b/gi
  ]
  
  let totalPassive = 0
  const passiveDetails: string[] = []
  
  passivePatterns.forEach(pattern => {
    const matches = text.match(pattern) || []
    totalPassive += matches.length
    passiveDetails.push(...matches)
  })
  
  const percentage = (totalPassive / Math.max(sentences.length, 1)) * 100
  
  return {
    count: totalPassive,
    percentage,
    examples: passiveDetails.slice(0, 5), // First 5 examples
    density: Math.round((totalPassive / Math.max(text.split(/\s+/).length, 1)) * 1000) / 10 // per 100 words
  }
}

// Helper function for standard deviation calculation
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
  const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
  
  return Math.sqrt(avgSquaredDiff)
}

function countSyllables(word: string): number {
  // Enhanced syllable counting algorithm with better accuracy
  if (!word || typeof word !== 'string') return 1
  
  word = word.toLowerCase().trim()
  if (word.length === 0) return 1
  if (word.length <= 2) return 1
  
  // Dictionary of common words with known syllable counts for accuracy
  const syllableDict: { [key: string]: number } = {
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
    'had': 1, 'has': 1, 'said': 1, 'many': 2,
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

function getReadabilityLevel(score: number): string {
  if (score >= 90) return 'Very Easy'
  if (score >= 80) return 'Easy'
  if (score >= 70) return 'Fairly Easy'
  if (score >= 60) return 'Standard'
  if (score >= 50) return 'Fairly Difficult'
  if (score >= 30) return 'Difficult'
  return 'Very Difficult'
}

function getReadingEaseLevel(score: number): string {
  if (score >= 90) return 'Very Easy'
  if (score >= 80) return 'Easy'
  if (score >= 70) return 'Fairly Easy'
  if (score >= 60) return 'Standard'
  if (score >= 50) return 'Fairly Difficult'
  if (score >= 30) return 'Difficult'
  return 'Very Difficult'
}

// Custom sentence structure validation
function validateSentenceStructure(sentence: string, offset: number): any[] {
  const issues: any[] = []
  const words = sentence.trim().split(/\s+/).filter(w => w.length > 0)
  
  if (words.length < 2) {
    return issues // Too short to analyze
  }

  // Track what types of issues we've already found to avoid duplicates
  const foundIssueTypes = new Set<string>()

  // Check for incomplete sentences with gerunds/present participles
  const gerundPattern = /\b(running|walking|jumping|swimming|flying|sleeping|eating|drinking|playing|working|studying|reading|writing|talking|singing|dancing|cooking|driving|sitting|standing|lying|moving|coming|going|looking|watching|listening|thinking|feeling|being|doing|getting|making|taking|giving|seeing|knowing|saying|telling|asking|helping|learning|teaching|buying|selling|building|cleaning|washing|fixing|painting|opening|closing|starting|stopping|continuing|beginning|ending|finishing|trying|wanting|needing|loving|liking|hating|hoping|believing|understanding|remembering|forgetting|choosing|deciding|planning|preparing|organizing|managing|controlling|leading|following|supporting|encouraging|celebrating|enjoying|suffering|struggling|fighting|winning|losing|competing|practicing|training|exercising|relaxing|resting|waking|dreaming)\b/i
  
  // Primary check: Simple gerund pattern like "The case running"
  const simpleGerundPattern = /^(The|A|An|This|That|My|Your|His|Her|Its|Our|Their)\s+(\w+)\s+(\w+ing)\s*\.?$/i
  if (simpleGerundPattern.test(sentence.trim())) {
    const helpingVerbPattern = /\b(is|are|was|were|am|have|has|had|will|would|could|should|might|may|must|can|do|does|did|being|been)\b/i
    
    if (!helpingVerbPattern.test(sentence)) {
      issues.push({
        type: 'grammar',
        message: 'This sentence is incomplete. It needs a helping verb like "is", "are", "was", or "were".',
        ruleId: 'CUSTOM_INCOMPLETE_GERUND',
        category: 'Grammar',
        severity: 'high',
        offset: offset,
        length: sentence.length,
        replacements: generateGerundSuggestions(sentence)
      })
      foundIssueTypes.add('incomplete_gerund')
    }
  }
  // Secondary check: More complex gerund patterns (only if simple pattern didn't match)
  else if (gerundPattern.test(sentence)) {
    const helpingVerbPattern = /\b(is|are|was|were|am|have|has|had|will|would|could|should|might|may|must|can|do|does|did|being|been)\b/i
    
    if (!helpingVerbPattern.test(sentence)) {
      // Check if it's a determiner + noun + gerund pattern
      const complexIncompletePattern = /^(The|A|An|This|That|These|Those|My|Your|His|Her|Its|Our|Their)\s+\w+\s+(running|walking|jumping|swimming|flying|sleeping|eating|drinking|playing|working|studying|reading|writing|talking|singing|dancing|cooking|driving|sitting|standing|lying|moving|coming|going|looking|watching|listening|thinking|feeling|being|doing|getting|making|taking|giving|seeing|knowing|saying|telling|asking|helping|learning|teaching|buying|selling|building|cleaning|washing|fixing|painting|opening|closing|starting|stopping|continuing|beginning|ending|finishing|trying|wanting|needing|loving|liking|hating|hoping|believing|understanding|remembering|forgetting|choosing|deciding|planning|preparing|organizing|managing|controlling|leading|following|supporting|encouraging|celebrating|enjoying|suffering|struggling|fighting|winning|losing|competing|practicing|training|exercising|relaxing|resting|waking|dreaming)\b/i
      
      if (complexIncompletePattern.test(sentence)) {
        issues.push({
          type: 'grammar',
          message: 'This appears to be an incomplete sentence. Consider adding a helping verb like "is", "was", "are", or "were" before the action word.',
          ruleId: 'CUSTOM_INCOMPLETE_COMPLEX_GERUND',
          category: 'Grammar',
          severity: 'high',
          offset: offset,
          length: sentence.length,
          replacements: generateGerundSuggestions(sentence)
        })
        foundIssueTypes.add('incomplete_gerund')
      }
    }
  }

  // Check for sentences that are just noun phrases without verbs (only if no gerund issue found)
  if (!foundIssueTypes.has('incomplete_gerund')) {
    const hasMainVerb = /\b(is|are|was|were|am|have|has|had|will|would|could|should|might|may|must|can|do|does|did|go|goes|went|come|comes|came|see|sees|saw|get|gets|got|make|makes|made|take|takes|took|give|gives|gave|know|knows|knew|think|thinks|thought|say|says|said|tell|tells|told|find|finds|found|become|becomes|became|feel|feels|felt|seem|seems|seemed|look|looks|looked|want|wants|wanted|need|needs|needed|try|tries|tried|ask|asks|asked|work|works|worked|call|calls|called|use|uses|used|start|starts|started|turn|turns|turned|run|runs|ran|move|moves|moved|live|lives|lived|believe|believes|believed|hold|holds|held|bring|brings|brought|happen|happens|happened|write|writes|wrote|provide|provides|provided|sit|sits|sat|stand|stands|stood|lose|loses|lost|pay|pays|paid|meet|meets|met|include|includes|included|continue|continues|continued|set|sets|learn|learns|learned|change|changes|changed|lead|leads|led|understand|understands|understood|watch|watches|watched|follow|follows|followed|stop|stops|stopped|create|creates|created|speak|speaks|spoke|read|reads|allow|allows|allowed|add|adds|added|spend|spends|spent|grow|grows|grew|open|opens|opened|walk|walks|walked|win|wins|won|offer|offers|offered|remember|remembers|remembered|love|loves|loved|consider|considers|considered|appear|appears|appeared|buy|buys|bought|wait|waits|waited|serve|serves|served|die|dies|died|send|sends|sent|expect|expects|expected|build|builds|built|stay|stays|stayed|fall|falls|fell|cut|cuts|reach|reaches|reached|kill|kills|killed|remain|remains|remained)\b/i
    
    if (!hasMainVerb && words.length > 2) {
      // This might be a noun phrase without a main verb
      const startsWithDeterminer = /^(The|A|An|This|That|These|Those|My|Your|His|Her|Its|Our|Their|Some|Many|Few|Several|All|Most|Each|Every|Any|No)\b/i
      
      if (startsWithDeterminer.test(sentence)) {
        issues.push({
          type: 'grammar',
          message: 'This appears to be an incomplete sentence. It seems to be missing a main verb.',
          ruleId: 'CUSTOM_INCOMPLETE_NO_VERB',
          category: 'Grammar',
          severity: 'high',
          offset: offset,
          length: sentence.length,
          replacements: [`${sentence} is`, `${sentence} was`, `${sentence} are`, `${sentence} were`]
        })
        foundIssueTypes.add('no_main_verb')
      }
    }
  }

  // Check for sentence fragments that end abruptly (only if no other structural issues found)
  if (!foundIssueTypes.has('incomplete_gerund') && !foundIssueTypes.has('no_main_verb')) {
    if (sentence.trim().endsWith('...') || sentence.trim().endsWith('.')) {
      const trimmedSentence = sentence.replace(/\.+$/, '').trim()
      if (trimmedSentence.split(/\s+/).length < 3) {
        issues.push({
          type: 'grammar',
          message: 'This sentence seems too short and may be incomplete.',
          ruleId: 'CUSTOM_INCOMPLETE_SHORT',
          category: 'Grammar',
          severity: 'medium',
          offset: offset,
          length: sentence.length,
          replacements: []
        })
      }
    }
  }

  return issues
}

// Generate suggestions for incomplete gerund sentences
function generateGerundSuggestions(sentence: string): string[] {
  const suggestions = []
  
  // Pattern: "The case running" -> "The case is running"
  const match = sentence.match(/^(The|A|An|This|That|These|Those|My|Your|His|Her|Its|Our|Their)\s+(\w+)\s+(\w+ing)\b/i)
  
  if (match) {
    const [, determiner, noun, gerund] = match
    const rest = sentence.substring(match[0].length)
    
    // Determine if singular or plural
    const isPlural = determiner.toLowerCase() === 'these' || determiner.toLowerCase() === 'those' || noun.endsWith('s')
    
    if (isPlural) {
      suggestions.push(`${determiner} ${noun} are ${gerund}${rest}`)
      suggestions.push(`${determiner} ${noun} were ${gerund}${rest}`)
    } else {
      suggestions.push(`${determiner} ${noun} is ${gerund}${rest}`)
      suggestions.push(`${determiner} ${noun} was ${gerund}${rest}`)
    }
  }
  
  return suggestions
}

// Rewrite text in different tone
router.post('/rewrite-tone', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { text, tone } = req.body

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

    // Validate tone options
    const validTones = ['professional', 'casual', 'formal', 'friendly', 'academic', 'creative', 'persuasive', 'concise']
    if (!validTones.includes(tone.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid tone. Must be one of: ${validTones.join(', ')}`
      })
    }

    console.log('🚀🤖 ENHANCED OPENAI TONE REWRITE API v2.0 - Backend Implementation!')
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured'
      })
    }

    const rewrittenText = await rewriteWithOpenAI(text, tone.toLowerCase())

    const hasChanges = rewrittenText !== text && rewrittenText.trim() !== text.trim()

    res.status(200).json({
      success: true,
      originalText: text,
      rewrittenText,
      tone: tone.toLowerCase(),
      changes: hasChanges ? [`Text rewritten using AI for ${tone} tone`] : ['No changes needed'],
      hasChanges,
      method: 'openai',
      version: 'Enhanced OpenAI Backend v2.0',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Tone rewriting error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to rewrite text'
    })
  }
})

// Rewrite text to different grade level
router.post('/rewrite-grade-level', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
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

    console.log('🎓📝 GRADE LEVEL REWRITE API v1.0 - Backend Implementation!')
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured'
      })
    }

    // Calculate original readability before rewriting
    const originalReadability = calculateReadability(text)

    const rewrittenText = await rewriteGradeLevelWithOpenAI(text, gradeLevel.toLowerCase())

    // Calculate new readability after rewriting
    const newReadability = calculateReadability(rewrittenText)

    const hasChanges = rewrittenText !== text && rewrittenText.trim() !== text.trim()

    res.status(200).json({
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
      version: 'Grade Level Rewrite API v1.0',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Grade level rewriting error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to rewrite text for grade level'
    })
  }
})

// Enhanced OpenAI-powered tone rewriting function
async function rewriteWithOpenAI(text: string, tone: string): Promise<string> {
  const toneInstructions: Record<string, { instruction: string; examples: { before: string; after: string }; changes: string[]; temperature: number }> = {
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
  
  const estimatedTokens = Math.ceil(text.length / 3)
  const maxTokens = Math.min(4000, Math.max(800, estimatedTokens * 2))

  console.log('🔧 Enhanced OpenAI request details:', {
    tone,
    textLength: text.length,
    estimatedInputTokens: estimatedTokens,
    maxOutputTokens: maxTokens,
    temperature: selectedTone.temperature
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

    console.log('✅ Enhanced OpenAI completion successful:', {
      inputTokens: completion.usage?.prompt_tokens || 'unknown',
      outputTokens: completion.usage?.completion_tokens || 'unknown',
      totalTokens: completion.usage?.total_tokens || 'unknown',
      model: completion.model
    })

    return rewrittenText

  } catch (error) {
    console.error('Enhanced OpenAI API call failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : 'Unknown'
    })
    
    throw error
  }
}

async function rewriteGradeLevelWithOpenAI(text: string, gradeLevel: string): Promise<string> {
  const gradeLevelInstructions: Record<string, { 
    instruction: string; 
    detailedGuidelines: {
      sentenceLength: string;
      vocabularyComplexity: string;
      syllableCount: string;
      conceptDepth: string;
      syntaxComplexity: string;
      connectors: string;
      pronouns: string;
    };
    specificInstructions: string[];
    examples: { before: string; after: string }; 
    additionalExamples: { before: string; after: string }[];
    changes: string[]; 
    temperature: number; 
    targetFK: string;
    targetReadingEase: string;
    targetFKRange: { min: number; max: number };
    targetRERange: { min: number; max: number };
  }> = {
    'elementary': {
      instruction: 'Rewrite this text for elementary school students (grades 1-5). Use very simple words, short sentences, and basic concepts that young children can understand.',
      detailedGuidelines: {
        sentenceLength: 'Keep sentences between 5-12 words. Aim for an average of 8 words per sentence.',
        vocabularyComplexity: 'Use only high-frequency words from the first 1000 most common English words. Avoid words with more than 2-3 syllables.',
        syllableCount: 'Target average of 1.2-1.4 syllables per word. Replace polysyllabic words with simpler alternatives.',
        conceptDepth: 'Explain one concept at a time. Use concrete examples. Avoid abstract ideas. Use familiar comparisons to everyday objects or experiences.',
        syntaxComplexity: 'Use simple subject-verb-object structure. Avoid compound sentences, complex clauses, or passive voice.',
        connectors: 'Use basic connectors: and, but, so, then, first, next, last.',
        pronouns: 'Use clear pronoun references. Avoid ambiguous "it", "this", "that" without clear antecedents.'
      },
      specificInstructions: [
        'Break long sentences into 2-3 shorter ones',
        'Replace complex terms with simple explanations',
        'Use present tense when possible',
        'Add simple transition words between ideas',
        'Use concrete nouns rather than abstract concepts',
        'Replace technical jargon with everyday language',
        'Use active voice exclusively'
      ],
      examples: {
        before: "The implementation of this methodology requires significant consideration of various factors.",
        after: "This way of doing things needs us to think about many things first. We must look at each part carefully."
      },
      additionalExamples: [
        {
          before: "The students demonstrated exceptional proficiency in mathematics.",
          after: "The kids were very good at math."
        },
        {
          before: "It is imperative that we establish clear guidelines.",
          after: "We need to make rules that are easy to understand."
        },
        {
          before: "The environmental conditions were not conducive to learning.",
          after: "The room was not good for learning. It was too noisy."
        }
      ],
      changes: [
        'Use only simple, common words that elementary students know',
        'Keep sentences under 10-12 words',
        'Replace complex concepts with basic explanations',
        'Use active voice and simple sentence structures',
        'Avoid technical terms and big words'
      ],
      temperature: 0.3,
      targetFK: '3-5',
      targetReadingEase: '80-90',
      targetFKRange: { min: 2, max: 6 },
      targetRERange: { min: 75, max: 95 }
    },
    'middle-school': {
      instruction: 'Rewrite this text for middle school students (grades 6-8). Use clear language and moderate complexity that pre-teens can understand.',
      detailedGuidelines: {
        sentenceLength: 'Keep sentences between 10-18 words. Aim for an average of 14 words per sentence.',
        vocabularyComplexity: 'Use vocabulary from the first 3000 most common English words. Include some academic vocabulary with context clues.',
        syllableCount: 'Target average of 1.4-1.6 syllables per word. Use moderate complexity words but provide context.',
        conceptDepth: 'Introduce concepts with brief explanations. Use familiar analogies. Connect new ideas to students\' experiences.',
        syntaxComplexity: 'Use mix of simple and compound sentences. Limited use of complex sentences with clear subordinate clauses.',
        connectors: 'Use transitional phrases: however, therefore, for example, in addition, as a result, on the other hand.',
        pronouns: 'Use clear pronoun references with occasional complex antecedents if clearly defined.'
      },
      specificInstructions: [
        'Combine related short sentences into compound sentences',
        'Define new vocabulary terms in context',
        'Use cause-and-effect relationships',
        'Include examples that relate to teen experiences',
        'Use both simple and compound sentence structures',
        'Introduce academic vocabulary gradually',
        'Use transitional phrases to connect ideas'
      ],
      examples: {
        before: "The implementation of this methodology requires significant consideration of various factors.",
        after: "Using this method means we need to think carefully about several important things. We must consider different factors that could affect the outcome."
      },
      additionalExamples: [
        {
          before: "The students demonstrated exceptional proficiency in mathematics.",
          after: "The students showed they were really good at math and understood it well."
        },
        {
          before: "It is imperative that we establish clear guidelines.",
          after: "It's important that we create clear rules that everyone can follow."
        },
        {
          before: "The environmental conditions were not conducive to learning.",
          after: "The classroom environment made it hard for students to learn effectively."
        }
      ],
      changes: [
        'Use clear, straightforward vocabulary',
        'Keep sentences moderate length (12-16 words)',
        'Explain concepts clearly without being too simple',
        'Use familiar examples and comparisons',
        'Balance simplicity with some complexity'
      ],
      temperature: 0.4,
      targetFK: '6-8',
      targetReadingEase: '70-80',
      targetFKRange: { min: 5, max: 9 },
      targetRERange: { min: 65, max: 85 }
    },
    'high-school': {
      instruction: 'Rewrite this text for high school students (grades 9-12). Use standard academic language that teenagers can understand.',
      detailedGuidelines: {
        sentenceLength: 'Keep sentences between 15-25 words. Aim for an average of 18-20 words per sentence.',
        vocabularyComplexity: 'Use vocabulary from academic word lists. Include domain-specific terminology with definitions when first introduced.',
        syllableCount: 'Target average of 1.6-1.8 syllables per word. Use sophisticated vocabulary appropriately.',
        conceptDepth: 'Present concepts with supporting details. Use analytical thinking. Connect ideas across disciplines.',
        syntaxComplexity: 'Use complex sentences with subordinate clauses. Balance simple, compound, and complex structures.',
        connectors: 'Use sophisticated transitions: furthermore, consequently, nevertheless, moreover, in contrast, specifically.',
        pronouns: 'Use complex pronoun structures with clear antecedents across sentence boundaries.'
      },
      specificInstructions: [
        'Combine ideas using complex sentence structures',
        'Use academic vocabulary with context support',
        'Include analytical and evaluative language',
        'Use varied sentence beginnings and structures',
        'Incorporate domain-specific terminology appropriately',
        'Use both deductive and inductive reasoning patterns',
        'Include cause-effect and compare-contrast structures'
      ],
      examples: {
        before: "The implementation of this methodology requires significant consideration of various factors.",
        after: "Implementing this approach requires careful consideration of several important factors, which must be analyzed thoroughly before proceeding."
      },
      additionalExamples: [
        {
          before: "The students demonstrated exceptional proficiency in mathematics.",
          after: "The students displayed outstanding mathematical abilities, achieving high levels of competence in various mathematical concepts."
        },
        {
          before: "It is imperative that we establish clear guidelines.",
          after: "It is essential that we develop comprehensive guidelines that clearly define expectations and procedures."
        },
        {
          before: "The environmental conditions were not conducive to learning.",
          after: "The environmental factors present in the classroom negatively impacted students' ability to engage effectively with learning materials."
        }
      ],
      changes: [
        'Use standard academic vocabulary',
        'Keep sentences reasonably complex but clear',
        'Include some advanced concepts with explanation',
        'Use proper academic structure',
        'Balance complexity with clarity'
      ],
      temperature: 0.4,
      targetFK: '9-12',
      targetReadingEase: '60-70',
      targetFKRange: { min: 8, max: 13 },
      targetRERange: { min: 55, max: 75 }
    },
    'college': {
      instruction: 'Rewrite this text for college students and adults. Use sophisticated language and complex concepts appropriate for higher education.',
      detailedGuidelines: {
        sentenceLength: 'Use sentences between 20-35 words. Aim for an average of 22-25 words per sentence.',
        vocabularyComplexity: 'Use advanced academic vocabulary, technical terminology, and discipline-specific jargon appropriately.',
        syllableCount: 'Target average of 1.8-2.0 syllables per word. Use polysyllabic academic terms when precise.',
        conceptDepth: 'Present complex, abstract concepts with nuanced analysis. Use critical thinking and synthesis.',
        syntaxComplexity: 'Use sophisticated sentence structures with multiple clauses, embeddings, and complex relationships.',
        connectors: 'Use advanced transitions: notwithstanding, albeit, insofar as, whereas, given that, to the extent that.',
        pronouns: 'Use complex pronoun relationships and sophisticated referential structures.'
      },
      specificInstructions: [
        'Use embedded clauses and complex syntax',
        'Employ abstract and theoretical language',
        'Include sophisticated analytical frameworks',
        'Use parallel structures and sophisticated rhetoric',
        'Incorporate interdisciplinary connections',
        'Use hedging language and academic qualifiers',
        'Employ nominalizations and academic register'
      ],
      examples: {
        before: "This way of doing things needs us to think about many things first.",
        after: "The implementation of this methodology requires comprehensive analysis of multiple contributing factors, necessitating systematic evaluation of interdependent variables."
      },
      additionalExamples: [
        {
          before: "The students demonstrated exceptional proficiency in mathematics.",
          after: "The cohort of students exhibited extraordinary mathematical competencies, demonstrating sophisticated analytical capabilities across multiple quantitative domains."
        },
        {
          before: "It is imperative that we establish clear guidelines.",
          after: "The establishment of comprehensive regulatory frameworks is imperative to ensure organizational coherence and systematic operational effectiveness."
        },
        {
          before: "The environmental conditions were not conducive to learning.",
          after: "The pedagogical environment exhibited suboptimal characteristics that significantly impeded cognitive engagement and knowledge acquisition processes."
        }
      ],
      changes: [
        'Use advanced vocabulary and terminology',
        'Employ complex sentence structures',
        'Include sophisticated concepts and analysis',
        'Use academic writing conventions',
        'Demonstrate higher-level thinking'
      ],
      temperature: 0.5,
      targetFK: '13-16',
      targetReadingEase: '50-60',
      targetFKRange: { min: 12, max: 15 },
      targetRERange: { min: 50, max: 65 }
    },
    'graduate': {
      instruction: 'Rewrite this text for graduate-level readers and professionals. Use highly sophisticated language, technical terminology, and complex analytical concepts.',
      detailedGuidelines: {
        sentenceLength: 'Use sentences between 25-45 words. Aim for an average of 28-32 words per sentence.',
        vocabularyComplexity: 'Use highly specialized terminology, technical jargon, and field-specific vocabulary. Employ abstract nominalizations.',
        syllableCount: 'Target average of 2.0+ syllables per word. Use polysyllabic academic and technical terms extensively.',
        conceptDepth: 'Present highly abstract, theoretical concepts with sophisticated analysis, synthesis, and critical evaluation.',
        syntaxComplexity: 'Use highly complex sentence structures with multiple embedded clauses, parenthetical expressions, and sophisticated relationships.',
        connectors: 'Use highly sophisticated transitions: concomitantly, paradigmatically, vis-à-vis, qua, ipso facto, mutatis mutandis.',
        pronouns: 'Use sophisticated pronoun structures with complex antecedents across multiple sentences and paragraphs.'
      },
      specificInstructions: [
        'Use highly technical and specialized vocabulary',
        'Employ complex theoretical frameworks',
        'Use sophisticated analytical methodologies',
        'Include interdisciplinary theoretical perspectives',
        'Use advanced rhetorical strategies',
        'Employ meta-analytical commentary',
        'Use specialized disciplinary discourse patterns'
      ],
      examples: {
        before: "This way of doing things needs us to think about many things first.",
        after: "The operationalization of this theoretical framework necessitates a comprehensive, multifaceted evaluation of interdependent variables and their potential ramifications across diverse contextual parameters, requiring systematic methodological consideration of epistemological assumptions."
      },
      additionalExamples: [
        {
          before: "The students demonstrated exceptional proficiency in mathematics.",
          after: "The academic cohort exhibited paradigmatic excellence in quantitative methodologies, demonstrating metacognitive mastery of advanced mathematical constructs through systematic application of theoretical frameworks to complex problem-solving scenarios."
        },
        {
          before: "It is imperative that we establish clear guidelines.",
          after: "The instantiation of comprehensive epistemological frameworks constitutes a categorical imperative for ensuring methodological rigor and operational coherence within the organizational paradigm."
        },
        {
          before: "The environmental conditions were not conducive to learning.",
          after: "The phenomenological characteristics of the pedagogical milieu manifested deleterious effects on cognitive processing mechanisms, thereby inhibiting optimal knowledge construction and metacognitive engagement paradigms."
        }
      ],
      changes: [
        'Use highly technical and specialized vocabulary',
        'Employ complex, nuanced sentence structures',
        'Include advanced theoretical concepts',
        'Use professional/academic jargon appropriately',
        'Demonstrate expert-level analysis and synthesis'
      ],
      temperature: 0.6,
      targetFK: '17+',
      targetReadingEase: '30-50',
      targetFKRange: { min: 17, max: 25 },
      targetRERange: { min: 25, max: 45 }
    }
  }

  const selectedLevel = gradeLevelInstructions[gradeLevel] || gradeLevelInstructions['high-school']
  
  const estimatedTokens = Math.ceil(text.length / 3)
  const maxTokens = Math.min(4000, Math.max(800, estimatedTokens * 2))

  console.log('🎓 Grade Level OpenAI request details with iterative refinement:', {
    gradeLevel,
    targetFK: selectedLevel.targetFK,
    targetReadingEase: selectedLevel.targetReadingEase,
    targetFKRange: selectedLevel.targetFKRange,
    targetRERange: selectedLevel.targetRERange,
    textLength: text.length,
    estimatedInputTokens: estimatedTokens,
    maxOutputTokens: maxTokens,
    temperature: selectedLevel.temperature
  })

  // Calculate original readability to understand starting point
  const originalReadability = calculateReadability(text)
  console.log('📊 Original text readability:', {
    fleschKincaid: originalReadability.fleschKincaid,
    fleschReadingEase: originalReadability.fleschReadingEase,
    level: originalReadability.readabilityLevel
  })

  try {
    // ENHANCED ITERATIVE REFINEMENT LOOP WITH ADVANCED VALIDATION
    let currentText = text
    let bestRewrite = text
    let bestScore = Infinity // Distance from target
    let bestAccuracy = 0 // Track accuracy percentage
    let iteration = 0
    const maxIterations = 3
    let iterationLogs = []

    while (iteration < maxIterations) {
      iteration++
      console.log(`🔄 ITERATION ${iteration}/${maxIterations} - ENHANCED VALIDATION`)

      // Calculate current readability
      const currentReadability = calculateReadability(currentText)
      const currentFK = currentReadability.fleschKincaid
      const currentRE = currentReadability.fleschReadingEase

      console.log(`📊 Current readability (iteration ${iteration}):`, {
        fleschKincaid: currentFK,
        fleschReadingEase: currentRE,
        level: currentReadability.readabilityLevel
      })

      // ADVANCED TARGET RANGE VALIDATION
      const validation = validateTargetRange(currentFK, currentRE, selectedLevel)
      
      console.log(`🎯 TARGET RANGE VALIDATION:`)
      console.log(`- FK Status: ${validation.fkStatus} (${currentFK.toFixed(1)})`)
      console.log(`- RE Status: ${validation.reStatus} (${currentRE.toFixed(1)})`)
      console.log(`- Overall Accuracy: ${validation.accuracy}%`)
      console.log(`- Is Valid: ${validation.isValid}`)
      console.log(`- Recommendations: ${validation.recommendations.join('; ')}`)

      // Enhanced early termination with strict validation
      if (validation.isValid && validation.accuracy >= 90) {
        console.log(`🎯 MATHEMATICAL TARGET ACHIEVED in iteration ${iteration}!`)
        console.log(`   Final Accuracy: ${validation.accuracy}%`)
        console.log(`   FK: ${currentFK.toFixed(1)} ✅ (target: ${selectedLevel.targetFKRange.min}-${selectedLevel.targetFKRange.max})`)
        console.log(`   RE: ${currentRE.toFixed(1)} ✅ (target: ${selectedLevel.targetRERange.min}-${selectedLevel.targetRERange.max})`)
        console.log(`   Early termination with optimal result.`)
        return currentText
      }

      // Enhanced distance calculation with weighted accuracy
      const targetFKCenter = (selectedLevel.targetFKRange.min + selectedLevel.targetFKRange.max) / 2
      const targetRECenter = (selectedLevel.targetRERange.min + selectedLevel.targetRERange.max) / 2
      const fkDistance = Math.abs(currentFK - targetFKCenter)
      const reDistance = Math.abs(currentRE - targetRECenter)
      const totalDistance = fkDistance + (reDistance / 10) // Weight FK more heavily

      // Track best attempt with comprehensive scoring
      const isNewBest = validation.accuracy > bestAccuracy || 
                       (validation.accuracy === bestAccuracy && totalDistance < bestScore)
      
      if (isNewBest) {
        bestScore = totalDistance
        bestAccuracy = validation.accuracy
        bestRewrite = currentText
        console.log(`✅ NEW BEST ATTEMPT! Accuracy: ${validation.accuracy}%, Distance: ${totalDistance.toFixed(2)}`)
      }

      // Log iteration details
      iterationLogs.push({
        iteration,
        readability: currentReadability,
        validation,
        distance: totalDistance,
        accuracy: validation.accuracy
      })

      // Generate enhanced adaptive prompt with mathematical precision
      const adaptivePrompt = generateAdaptivePrompt(currentFK, currentRE, selectedLevel, iteration)

      const systemPrompt = `You are an elite linguistic engineer and educational content architect with advanced expertise in mathematical readability optimization. Your mission is to achieve PRECISE grade-level compliance through data-driven text transformation.

🎯 MATHEMATICAL MISSION PARAMETERS:
- TARGET GRADE LEVEL: ${gradeLevel.toUpperCase()}
- MATHEMATICAL FK TARGET: ${selectedLevel.targetFKRange.min}-${selectedLevel.targetFKRange.max} (MUST achieve exactly ${targetFKCenter.toFixed(1)})
- MATHEMATICAL RE TARGET: ${selectedLevel.targetRERange.min}-${selectedLevel.targetRERange.max} (MUST achieve exactly ${targetRECenter.toFixed(1)})
- REQUIRED ACCURACY: 95%+ mathematical compliance
- SEMANTIC PRESERVATION: 100% meaning retention mandatory

📊 CURRENT MATHEMATICAL STATUS:
ITERATION: ${iteration}/${maxIterations}
CURRENT FK: ${currentFK.toFixed(1)} (target: ${selectedLevel.targetFKRange.min}-${selectedLevel.targetFKRange.max})
CURRENT RE: ${currentRE.toFixed(1)} (target: ${selectedLevel.targetRERange.min}-${selectedLevel.targetRERange.max})
ACCURACY: ${validation ? validation.accuracy : 0}%

⚠️ CRITICAL DIRECTIVE: Your output MUST mathematically achieve a Flesch-Kincaid score between ${selectedLevel.targetFKRange.min} and ${selectedLevel.targetFKRange.max}. This is NOT optional. Use the mathematical formulas:
- FK = 0.39 × (words/sentence) + 11.8 × (syllables/word) - 15.59
- RE = 206.835 - 1.015 × (words/sentence) - 84.6 × (syllables/word)

${adaptivePrompt}

🔬 PRECISION LINGUISTIC SPECIFICATIONS:
📏 SENTENCE ARCHITECTURE: ${selectedLevel.detailedGuidelines.sentenceLength}
   → Target: ${selectedLevel.targetFKRange.min < 6 ? '8' : selectedLevel.targetFKRange.min < 9 ? '14' : selectedLevel.targetFKRange.min < 13 ? '20' : '25'} words per sentence EXACTLY
📚 LEXICAL COMPLEXITY: ${selectedLevel.detailedGuidelines.vocabularyComplexity}
   → Target: ${selectedLevel.targetFKRange.min < 6 ? '1.3' : selectedLevel.targetFKRange.min < 9 ? '1.5' : selectedLevel.targetFKRange.min < 13 ? '1.7' : '1.9'} syllables per word EXACTLY
🔤 SYLLABIC TARGETING: ${selectedLevel.detailedGuidelines.syllableCount}
🧠 COGNITIVE DEPTH: ${selectedLevel.detailedGuidelines.conceptDepth}
⚙️ SYNTACTIC ENGINEERING: ${selectedLevel.detailedGuidelines.syntaxComplexity}
🔗 CONNECTIVE SOPHISTICATION: ${selectedLevel.detailedGuidelines.connectors}
👥 PRONOMINAL COMPLEXITY: ${selectedLevel.detailedGuidelines.pronouns}

🎯 CORE TRANSFORMATION DIRECTIVE:
${selectedLevel.instruction}

⚡ MANDATORY IMPLEMENTATION PROTOCOLS:
${selectedLevel.specificInstructions.map(instruction => `• ${instruction}`).join('\n')}

🔧 REQUIRED TRANSFORMATIONAL CHANGES:
${selectedLevel.changes.map(change => `• ${change}`).join('\n')}

📖 TRANSFORMATION EXAMPLES FOR ${gradeLevel.toUpperCase()}:
Example 1:
Input: "${selectedLevel.examples.before}"
Output: "${selectedLevel.examples.after}"

Example 2:
Input: "The ramifications of this decision will reverberate throughout the organization."
Output: ${gradeLevel === 'elementary' ? '"This choice will affect everyone in our group."' : 
         gradeLevel === 'middle-school' ? '"This decision will have effects that spread through the whole organization."' :
         gradeLevel === 'high-school' ? '"The consequences of this decision will impact the entire organization significantly."' :
         gradeLevel === 'college' ? '"The ramifications of this decision will propagate throughout the organizational structure, affecting multiple stakeholders."' :
         '"The multifaceted ramifications of this strategic decision will reverberate throughout the organizational ecosystem, necessitating comprehensive stakeholder analysis."'}

Example 3:
Input: "We need to fix this problem quickly."
Output: ${gradeLevel === 'elementary' ? '"We must fix this now."' : 
         gradeLevel === 'middle-school' ? '"We need to solve this problem as soon as possible."' :
         gradeLevel === 'high-school' ? '"We must address this issue with urgency and develop an effective solution."' :
         gradeLevel === 'college' ? '"We must expeditiously remediate this problematic situation through systematic intervention."' :
         '"The exigent nature of this problematic paradigm necessitates immediate remediation through comprehensive strategic intervention protocols."'}

🎯 MATHEMATICAL COMPLIANCE VERIFICATION:
✓ EVERY sentence MUST average ${selectedLevel.targetFKRange.min < 6 ? '8±2' : selectedLevel.targetFKRange.min < 9 ? '14±2' : selectedLevel.targetFKRange.min < 13 ? '20±3' : '25±4'} words
✓ EVERY word MUST average ${selectedLevel.targetFKRange.min < 6 ? '1.3±0.1' : selectedLevel.targetFKRange.min < 9 ? '1.5±0.1' : selectedLevel.targetFKRange.min < 13 ? '1.7±0.1' : '1.9±0.2'} syllables
✓ The FINAL output MUST score FK: ${selectedLevel.targetFKRange.min}-${selectedLevel.targetFKRange.max}
✓ The FINAL output MUST score RE: ${selectedLevel.targetRERange.min}-${selectedLevel.targetRERange.max}
✓ You MUST preserve 100% of the original meaning
✓ You MUST make the text flow naturally at the target level

REMEMBER: This is a MATHEMATICAL optimization problem. Your output will be measured and must achieve the exact targets specified.`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
            content: `Transform this text to EXACTLY ${gradeLevel} grade level (FK MUST be ${selectedLevel.targetFKRange.min}-${selectedLevel.targetFKRange.max}, RE MUST be ${selectedLevel.targetRERange.min}-${selectedLevel.targetRERange.max}):

"${currentText}"

CRITICAL REQUIREMENTS:
1. Average sentence length MUST be ${selectedLevel.targetFKRange.min < 6 ? '8' : selectedLevel.targetFKRange.min < 9 ? '14' : selectedLevel.targetFKRange.min < 13 ? '20' : '25'} words (±20%)
2. Average syllables per word MUST be ${selectedLevel.targetFKRange.min < 6 ? '1.3' : selectedLevel.targetFKRange.min < 9 ? '1.5' : selectedLevel.targetFKRange.min < 13 ? '1.7' : '1.9'} (±0.2)
3. The output MUST mathematically achieve FK: ${selectedLevel.targetFKRange.min}-${selectedLevel.targetFKRange.max}
4. Every transformation must move the metrics toward the target
5. Preserve ALL original meaning

Begin your transformation now:`
        }
      ],
      max_tokens: maxTokens,
        temperature: Math.max(0.2, selectedLevel.temperature - (iteration * 0.1)), // Reduce randomness with each iteration
      top_p: 0.95,
      frequency_penalty: 0.2,
      presence_penalty: 0.2
    })

    let rewrittenText = completion.choices[0]?.message?.content?.trim()

    if (!rewrittenText) {
        console.error(`OpenAI returned empty response for iteration ${iteration}`)
        break
    }

    // Remove quotes if OpenAI wrapped the response in quotes
    if (rewrittenText.startsWith('"') && rewrittenText.endsWith('"')) {
      rewrittenText = rewrittenText.slice(1, -1)
    }

      currentText = rewrittenText

      console.log(`📝 Iteration ${iteration} completed:`, {
      inputTokens: completion.usage?.prompt_tokens || 'unknown',
      outputTokens: completion.usage?.completion_tokens || 'unknown',
      totalTokens: completion.usage?.total_tokens || 'unknown',
      model: completion.model,
        textLength: rewrittenText.length,
        temperature: Math.max(0.2, selectedLevel.temperature - (iteration * 0.1))
      })
    }

    // COMPREHENSIVE FINAL ANALYSIS
    const finalReadability = calculateReadability(bestRewrite)
    const finalValidation = validateTargetRange(finalReadability.fleschKincaid, finalReadability.fleschReadingEase, selectedLevel)
    
    console.log('\n=== COMPREHENSIVE FINAL ANALYSIS ===')
    console.log('📊 MATHEMATICAL RESULTS:')
    console.log(`- Target Grade Level: ${gradeLevel}`)
    console.log(`- Final FK: ${finalReadability.fleschKincaid.toFixed(1)} (target: ${selectedLevel.targetFKRange.min}-${selectedLevel.targetFKRange.max})`)
    console.log(`- Final RE: ${finalReadability.fleschReadingEase.toFixed(1)} (target: ${selectedLevel.targetRERange.min}-${selectedLevel.targetRERange.max})`)
    console.log(`- Final Reading Level: ${finalReadability.readabilityLevel}`)
    console.log(`- Mathematical Accuracy: ${finalValidation.accuracy}%`)
    console.log(`- Target Compliance: ${finalValidation.isValid ? '✅ ACHIEVED' : '❌ MISSED'}`)
    console.log(`- FK Status: ${finalValidation.fkStatus}`)
    console.log(`- RE Status: ${finalValidation.reStatus}`)
    
    console.log('\n📈 IMPROVEMENT ANALYSIS:')
    console.log(`- Original FK: ${originalReadability.fleschKincaid.toFixed(1)} → Final FK: ${finalReadability.fleschKincaid.toFixed(1)}`)
    console.log(`- Original RE: ${originalReadability.fleschReadingEase.toFixed(1)} → Final RE: ${finalReadability.fleschReadingEase.toFixed(1)}`)
    console.log(`- Original Level: ${originalReadability.readabilityLevel} → Final Level: ${finalReadability.readabilityLevel}`)
    console.log(`- FK Change: ${(finalReadability.fleschKincaid - originalReadability.fleschKincaid).toFixed(1)} points`)
    console.log(`- RE Change: ${(finalReadability.fleschReadingEase - originalReadability.fleschReadingEase).toFixed(1)} points`)
    
    console.log('\n🔄 ITERATION PERFORMANCE:')
    console.log(`- Total Iterations: ${iteration}`)
    console.log(`- Best Distance Score: ${bestScore.toFixed(2)}`)
    console.log(`- Best Accuracy: ${bestAccuracy}%`)
    console.log(`- Performance Rating: ${finalValidation.accuracy >= 95 ? 'EXCELLENT' : finalValidation.accuracy >= 85 ? 'GOOD' : finalValidation.accuracy >= 70 ? 'ACCEPTABLE' : 'NEEDS IMPROVEMENT'}`)
    
    if (finalValidation.recommendations.length > 0) {
      console.log('\n💡 REMAINING RECOMMENDATIONS:')
      finalValidation.recommendations.forEach(rec => console.log(`- ${rec}`))
    }
    
    console.log('\n✅ ENHANCED ITERATIVE REFINEMENT COMPLETED')
    console.log(`🎯 FINAL RESULT: ${finalValidation.isValid ? 'TARGET ACHIEVED' : 'BEST EFFORT ACHIEVED'} with ${finalValidation.accuracy}% accuracy`)

    return bestRewrite

  } catch (error) {
    console.error('Grade Level OpenAI API call failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : 'Unknown',
      status: (error as any)?.status,
      code: (error as any)?.code,
      gradeLevel
    })
    
    throw error
  }
}

// Enhanced dynamic prompt engineering with mathematical precision and detailed analysis
function generateAdaptivePrompt(currentFK: number, currentRE: number, selectedLevel: any, iteration: number): string {
  const targetFKCenter = (selectedLevel.targetFKRange.min + selectedLevel.targetFKRange.max) / 2
  const targetRECenter = (selectedLevel.targetRERange.min + selectedLevel.targetRERange.max) / 2
  
  const fkDiff = currentFK - targetFKCenter
  const reDiff = currentRE - targetRECenter
  
  // Calculate precision requirements based on iteration
  const precisionLevel = iteration === 1 ? 'major' : iteration === 2 ? 'moderate' : 'precise'
  
  let adaptiveInstructions = []
  let mathematicalTargets = []
  let strategicAdjustments = []
  let specificActions = []
  
  // MATHEMATICAL TARGET SPECIFICATION WITH PRECISION BANDS
  mathematicalTargets.push(`🎯 MATHEMATICAL TARGETS (PRECISION REQUIRED):`)
  mathematicalTargets.push(`• Target Flesch-Kincaid: ${selectedLevel.targetFKRange.min}-${selectedLevel.targetFKRange.max} (current: ${currentFK.toFixed(2)})`)
  mathematicalTargets.push(`• Target Reading Ease: ${selectedLevel.targetRERange.min}-${selectedLevel.targetRERange.max} (current: ${currentRE.toFixed(2)})`)
  mathematicalTargets.push(`• FK Distance: ${Math.abs(fkDiff).toFixed(2)} points (${fkDiff > 0 ? 'REDUCE' : 'INCREASE'})`)
  mathematicalTargets.push(`• RE Distance: ${Math.abs(reDiff).toFixed(2)} points (${reDiff > 0 ? 'INCREASE' : 'DECREASE'})`)
  
  // Calculate required changes with mathematical precision
  const requiredSentenceLengthChange = Math.round(fkDiff * 2.56) // Based on FK formula coefficient
  const requiredSyllableChange = Math.round(fkDiff * 0.085 * 100) / 100 // Based on FK formula
  
  mathematicalTargets.push(`• Required Sentence Length Adjustment: ${Math.abs(requiredSentenceLengthChange)} words per sentence`)
  mathematicalTargets.push(`• Required Syllable Complexity Change: ${Math.abs(requiredSyllableChange)} syllables per word`)
  
  // PRECISION-BASED FLESCH-KINCAID ADJUSTMENTS
  if (Math.abs(fkDiff) > 0.25) { // Even smaller threshold for precision
    if (fkDiff > 3) {
      adaptiveInstructions.push('🔻 CRITICAL FK REDUCTION: Text severely exceeds target complexity')
      specificActions.push(`• IMMEDIATE: Reduce EVERY sentence by 8-12 words`)
      specificActions.push(`• IMMEDIATE: Replace ALL words >3 syllables with 1-2 syllable alternatives`)
      specificActions.push(`• IMMEDIATE: Convert ALL compound/complex sentences to simple sentences`)
      specificActions.push(`• TARGET: Average sentence length must be ${Math.max(8, Math.round(targetFKCenter * 2.5))} words`)
    } else if (fkDiff > 2) {
      adaptiveInstructions.push('📉 MAJOR FK REDUCTION: Substantial simplification required')
      specificActions.push(`• Reduce sentence length by ${Math.abs(requiredSentenceLengthChange)} words on average`)
      specificActions.push(`• Replace 60%+ of polysyllabic words with simpler alternatives`)
      specificActions.push(`• Target sentence length: ${Math.round(targetFKCenter * 2.5)} words average`)
      specificActions.push(`• Target syllable average: ${(1.2 + targetFKCenter * 0.05).toFixed(2)} per word`)
    } else if (fkDiff > 1) {
      adaptiveInstructions.push('📊 MODERATE FK REDUCTION: Fine-tune complexity downward')
      specificActions.push(`• Reduce sentence length by ${Math.abs(requiredSentenceLengthChange)} words on average`)
      specificActions.push(`• Replace 30%+ of complex words with simpler alternatives`)
      specificActions.push(`• Eliminate unnecessary prepositional phrases`)
      specificActions.push(`• Use active voice instead of passive voice`)
    } else if (fkDiff > 0.5) {
      adaptiveInstructions.push('🔧 MINOR FK REDUCTION: Small adjustments needed')
      specificActions.push(`• Reduce sentence length by 2-3 words on average`)
      specificActions.push(`• Replace 15%+ of complex words`)
      specificActions.push(`• Simplify 2-3 complex sentences`)
    } else if (fkDiff < -3) {
      adaptiveInstructions.push('🔺 CRITICAL FK INCREASE: Text severely below target complexity')
      specificActions.push(`• IMMEDIATE: Increase EVERY sentence by 8-12 words`)
      specificActions.push(`• IMMEDIATE: Add sophisticated, polysyllabic vocabulary`)
      specificActions.push(`• IMMEDIATE: Combine simple sentences into complex structures`)
      specificActions.push(`• TARGET: Average sentence length must be ${Math.round(targetFKCenter * 2.5)} words`)
    } else if (fkDiff < -2) {
      adaptiveInstructions.push('📈 MAJOR FK INCREASE: Substantial complexity boost needed')
      specificActions.push(`• Increase sentence length by ${Math.abs(requiredSentenceLengthChange)} words on average`)
      specificActions.push(`• Add advanced vocabulary (3+ syllables)`)
      specificActions.push(`• Combine sentences with subordinate clauses`)
      specificActions.push(`• Target sentence length: ${Math.round(targetFKCenter * 2.5)} words average`)
    } else if (fkDiff < -1) {
      adaptiveInstructions.push('📊 MODERATE FK INCREASE: Fine-tune complexity upward')
      specificActions.push(`• Increase sentence length by ${Math.abs(requiredSentenceLengthChange)} words on average`)
      specificActions.push(`• Add sophisticated terminology`)
      specificActions.push(`• Use more complex sentence structures`)
    } else if (fkDiff < -0.5) {
      adaptiveInstructions.push('🔧 MINOR FK INCREASE: Small adjustments needed')
      specificActions.push(`• Increase sentence length by 2-3 words on average`)
      specificActions.push(`• Add some advanced vocabulary`)
      specificActions.push(`• Combine 2-3 short sentences`)
    }
  }
  
  // PRECISION-BASED READING EASE ADJUSTMENTS
  if (Math.abs(reDiff) > 2.5) { // Smaller threshold for precision
    if (reDiff < -15) {
      adaptiveInstructions.push('🔻 CRITICAL RE INCREASE: Text extremely difficult to read')
      specificActions.push(`• EMERGENCY: Break ALL sentences >15 words into 2+ sentences`)
      specificActions.push(`• EMERGENCY: Replace 80%+ of difficult words with common alternatives`)
      specificActions.push(`• EMERGENCY: Use only the 1000 most common English words`)
    } else if (reDiff < -10) {
      adaptiveInstructions.push('📉 MAJOR RE INCREASE: Significant readability improvement needed')
      specificActions.push(`• Target maximum sentence length: 15 words`)
      specificActions.push(`• Replace 60%+ of difficult words`)
      specificActions.push(`• Use simple, direct language patterns`)
    } else if (reDiff < -5) {
      adaptiveInstructions.push('📊 MODERATE RE INCREASE: Improve readability')
      specificActions.push(`• Reduce average sentence length by 20%`)
      specificActions.push(`• Replace 40%+ of difficult words`)
      specificActions.push(`• Simplify complex constructions`)
    } else if (reDiff > 15) {
      adaptiveInstructions.push('🔺 CRITICAL RE DECREASE: Text too easy to read')
      specificActions.push(`• IMMEDIATE: Increase sentence length by 40%+`)
      specificActions.push(`• IMMEDIATE: Add challenging terminology`)
      specificActions.push(`• IMMEDIATE: Use complex sentence structures`)
    } else if (reDiff > 10) {
      adaptiveInstructions.push('📈 MAJOR RE DECREASE: Add significant complexity')
      specificActions.push(`• Increase average sentence length by 30%`)
      specificActions.push(`• Add sophisticated vocabulary`)
      specificActions.push(`• Use embedded clauses and phrases`)
    } else if (reDiff > 5) {
      adaptiveInstructions.push('📊 MODERATE RE DECREASE: Add appropriate complexity')
      specificActions.push(`• Increase sentence length by 20%`)
      specificActions.push(`• Use more precise terminology`)
      specificActions.push(`• Add transitional complexity`)
    }
  }
  
  // MATHEMATICAL VALIDATION REQUIREMENTS
  let validationInstructions = []
  validationInstructions.push(`🎯 MATHEMATICAL VALIDATION REQUIREMENTS:`)
  
  // Precise FK validation
  if (currentFK < selectedLevel.targetFKRange.min) {
    const deficit = selectedLevel.targetFKRange.min - currentFK
    validationInstructions.push(`• FK DEFICIT: Must increase by exactly ${deficit.toFixed(2)} points`)
    validationInstructions.push(`• SENTENCE ACTION: Add ${Math.ceil(deficit * 2.5)} words per sentence OR`)
    validationInstructions.push(`• SYLLABLE ACTION: Increase complexity by ${(deficit * 0.085).toFixed(2)} syllables per word`)
  } else if (currentFK > selectedLevel.targetFKRange.max) {
    const excess = currentFK - selectedLevel.targetFKRange.max
    validationInstructions.push(`• FK EXCESS: Must decrease by exactly ${excess.toFixed(2)} points`)
    validationInstructions.push(`• SENTENCE ACTION: Remove ${Math.ceil(excess * 2.5)} words per sentence OR`)
    validationInstructions.push(`• SYLLABLE ACTION: Reduce complexity by ${(excess * 0.085).toFixed(2)} syllables per word`)
  } else {
    validationInstructions.push(`• FK STATUS: ✅ Within target range (${currentFK.toFixed(2)})`)
  }
  
  // Precise RE validation
  if (currentRE < selectedLevel.targetRERange.min) {
    const deficit = selectedLevel.targetRERange.min - currentRE
    validationInstructions.push(`• RE DEFICIT: Must increase by exactly ${deficit.toFixed(2)} points`)
    validationInstructions.push(`• READABILITY ACTION: Simplify ${Math.ceil(deficit / 3)} words per sentence`)
  } else if (currentRE > selectedLevel.targetRERange.max) {
    const excess = currentRE - selectedLevel.targetRERange.max
    validationInstructions.push(`• RE EXCESS: Must decrease by exactly ${excess.toFixed(2)} points`)
    validationInstructions.push(`• COMPLEXITY ACTION: Add difficulty to ${Math.ceil(excess / 3)} words per sentence`)
  } else {
    validationInstructions.push(`• RE STATUS: ✅ Within target range (${currentRE.toFixed(2)})`)
  }
  
  // ITERATION-SPECIFIC PRECISION STRATEGY
  let iterationStrategy = []
  if (iteration === 1) {
    iterationStrategy.push('🎯 ITERATION 1: FOUNDATIONAL MATHEMATICAL RESTRUCTURING')
    iterationStrategy.push('• Focus on achieving 80% of target accuracy through major structural changes')
    iterationStrategy.push('• Prioritize sentence length adjustments for immediate FK impact')
    iterationStrategy.push('• Make vocabulary changes for immediate RE impact')
    iterationStrategy.push('• Aim to get within 1.0 points of target ranges')
  } else if (iteration === 2) {
    iterationStrategy.push('🎯 ITERATION 2: PRECISION MATHEMATICAL REFINEMENT')
    iterationStrategy.push('• Focus on achieving 95% of target accuracy through targeted adjustments')
    iterationStrategy.push('• Fine-tune specific words and sentence structures')
    iterationStrategy.push('• Address remaining mathematical gaps with surgical precision')
    iterationStrategy.push('• Aim to get within 0.5 points of target ranges')
  } else {
    iterationStrategy.push('🎯 ITERATION 3: SURGICAL MATHEMATICAL OPTIMIZATION')
    iterationStrategy.push('• Focus on achieving 99%+ target accuracy through minimal changes')
    iterationStrategy.push('• Make word-level and phrase-level micro-adjustments')
    iterationStrategy.push('• Perfect mathematical compliance while preserving meaning')
    iterationStrategy.push('• Aim to hit exact center of target ranges')
  }
  
  // MANDATORY MATHEMATICAL COMPLIANCE
  let complianceChecklist = []
  complianceChecklist.push('📋 MANDATORY MATHEMATICAL COMPLIANCE VERIFICATION:')
  complianceChecklist.push('• VERIFY: Every sentence length change moves FK toward target')
  complianceChecklist.push('• VERIFY: Every vocabulary change moves RE toward target')
  complianceChecklist.push('• VERIFY: Final FK must be within 0.25 points of target range')
  complianceChecklist.push('• VERIFY: Final RE must be within 2.5 points of target range')
  complianceChecklist.push('• VERIFY: 100% semantic preservation maintained')
  complianceChecklist.push('• VERIFY: Text flows naturally despite mathematical constraints')
  
  // Combine all sections with clear separation
  let fullPrompt = []
  fullPrompt.push(...mathematicalTargets)
  fullPrompt.push('')
  
  if (adaptiveInstructions.length > 0) {
    fullPrompt.push(...adaptiveInstructions)
    fullPrompt.push('')
  }
  
  if (specificActions.length > 0) {
    fullPrompt.push('⚡ SPECIFIC MATHEMATICAL ACTIONS REQUIRED:')
    fullPrompt.push(...specificActions)
    fullPrompt.push('')
  }
  
  fullPrompt.push(...validationInstructions)
  fullPrompt.push('')
  fullPrompt.push(...iterationStrategy)
  fullPrompt.push('')
  fullPrompt.push(...complianceChecklist)
  
  return fullPrompt.join('\n')
}

// Advanced target range validation with enhanced precision and statistical analysis
function validateTargetRange(currentFK: number, currentRE: number, selectedLevel: any): {
  isValid: boolean
  fkStatus: 'low' | 'target' | 'high'
  reStatus: 'low' | 'target' | 'high'
  accuracy: number
  recommendations: string[]
  precisionAnalysis: {
    fkPrecision: number
    rePrecision: number
    overallPrecision: number
    distanceFromOptimal: number
    confidenceLevel: 'excellent' | 'good' | 'acceptable' | 'poor'
  }
} {
  const fkInRange = currentFK >= selectedLevel.targetFKRange.min && currentFK <= selectedLevel.targetFKRange.max
  const reInRange = currentRE >= selectedLevel.targetRERange.min && currentRE <= selectedLevel.targetRERange.max
  
  const fkStatus = currentFK < selectedLevel.targetFKRange.min ? 'low' : 
                   currentFK > selectedLevel.targetFKRange.max ? 'high' : 'target'
  const reStatus = currentRE < selectedLevel.targetRERange.min ? 'low' : 
                   currentRE > selectedLevel.targetRERange.max ? 'high' : 'target'
  
  // Enhanced accuracy calculation with tighter precision requirements
  const fkCenter = (selectedLevel.targetFKRange.min + selectedLevel.targetFKRange.max) / 2
  const reCenter = (selectedLevel.targetRERange.min + selectedLevel.targetRERange.max) / 2
  const fkRange = selectedLevel.targetFKRange.max - selectedLevel.targetFKRange.min
  const reRange = selectedLevel.targetRERange.max - selectedLevel.targetRERange.min
  
  // Calculate distance from optimal center point
  const fkDistance = Math.abs(currentFK - fkCenter)
  const reDistance = Math.abs(currentRE - reCenter)
  const distanceFromOptimal = Math.sqrt(Math.pow(fkDistance, 2) + Math.pow(reDistance / 10, 2)) // Normalize RE to FK scale
  
  // Enhanced precision scoring (0-100)
  const fkPrecision = Math.max(0, 100 - (fkDistance / (fkRange / 2)) * 100)
  const rePrecision = Math.max(0, 100 - (reDistance / (reRange / 2)) * 100)
  const overallPrecision = (fkPrecision + rePrecision) / 2
  
  // Stricter accuracy calculation for better results
  let accuracy = overallPrecision
  
  // Apply precision bonuses/penalties
  if (fkInRange && reInRange) {
    // Bonus for being in range
    accuracy = Math.min(100, accuracy + 10)
    
    // Additional bonus for being very close to center
    if (fkDistance < fkRange * 0.25 && reDistance < reRange * 0.25) {
      accuracy = Math.min(100, accuracy + 15) // Excellent precision bonus
    } else if (fkDistance < fkRange * 0.5 && reDistance < reRange * 0.5) {
      accuracy = Math.min(100, accuracy + 5) // Good precision bonus
    }
  } else {
    // Penalty for being out of range
    const fkPenalty = fkInRange ? 0 : Math.min(30, Math.abs(currentFK - (fkStatus === 'low' ? selectedLevel.targetFKRange.min : selectedLevel.targetFKRange.max)) * 5)
    const rePenalty = reInRange ? 0 : Math.min(30, Math.abs(currentRE - (reStatus === 'low' ? selectedLevel.targetRERange.min : selectedLevel.targetRERange.max)) * 2)
    accuracy = Math.max(0, accuracy - fkPenalty - rePenalty)
  }
  
  // Determine confidence level
  let confidenceLevel: 'excellent' | 'good' | 'acceptable' | 'poor'
  if (accuracy >= 95 && distanceFromOptimal < 0.5) {
    confidenceLevel = 'excellent'
  } else if (accuracy >= 85 && distanceFromOptimal < 1.0) {
    confidenceLevel = 'good'
  } else if (accuracy >= 70 && distanceFromOptimal < 2.0) {
    confidenceLevel = 'acceptable'
  } else {
    confidenceLevel = 'poor'
  }
  
  // Generate enhanced, specific recommendations
  const recommendations = []
  
  // FK-specific recommendations with mathematical precision
  if (fkStatus === 'low') {
    const deficit = selectedLevel.targetFKRange.min - currentFK
    if (deficit > 2) {
      recommendations.push(`CRITICAL FK INCREASE: Add ${Math.ceil(deficit * 2.5)} words per sentence AND increase vocabulary complexity by ${(deficit * 0.08).toFixed(2)} syllables per word`)
    } else if (deficit > 1) {
      recommendations.push(`MAJOR FK INCREASE: Add ${Math.ceil(deficit * 2.5)} words per sentence OR increase vocabulary complexity`)
    } else if (deficit > 0.5) {
      recommendations.push(`MODERATE FK INCREASE: Add ${Math.ceil(deficit * 2)} words per sentence OR use more complex vocabulary`)
    } else {
      recommendations.push(`MINOR FK INCREASE: Add 1-2 words per sentence OR replace 10% of words with more complex alternatives`)
    }
  } else if (fkStatus === 'high') {
    const excess = currentFK - selectedLevel.targetFKRange.max
    if (excess > 2) {
      recommendations.push(`CRITICAL FK REDUCTION: Remove ${Math.ceil(excess * 2.5)} words per sentence AND simplify vocabulary by ${(excess * 0.08).toFixed(2)} syllables per word`)
    } else if (excess > 1) {
      recommendations.push(`MAJOR FK REDUCTION: Remove ${Math.ceil(excess * 2.5)} words per sentence OR simplify vocabulary significantly`)
    } else if (excess > 0.5) {
      recommendations.push(`MODERATE FK REDUCTION: Remove ${Math.ceil(excess * 2)} words per sentence OR simplify vocabulary`)
    } else {
      recommendations.push(`MINOR FK REDUCTION: Remove 1-2 words per sentence OR replace 10% of words with simpler alternatives`)
    }
  }
  
  // RE-specific recommendations with mathematical precision
  if (reStatus === 'low') {
    const deficit = selectedLevel.targetRERange.min - currentRE
    if (deficit > 15) {
      recommendations.push(`CRITICAL RE INCREASE: Drastically simplify ALL sentences to max 12 words AND replace 70%+ of difficult words`)
    } else if (deficit > 10) {
      recommendations.push(`MAJOR RE INCREASE: Reduce sentence length by 30% AND replace 50%+ of difficult words`)
    } else if (deficit > 5) {
      recommendations.push(`MODERATE RE INCREASE: Reduce sentence length by 20% AND replace 30%+ of difficult words`)
    } else {
      recommendations.push(`MINOR RE INCREASE: Reduce sentence length by 10% OR replace 15% of difficult words`)
    }
  } else if (reStatus === 'high') {
    const excess = currentRE - selectedLevel.targetRERange.max
    if (excess > 15) {
      recommendations.push(`CRITICAL RE DECREASE: Increase sentence length by 40%+ AND add sophisticated vocabulary`)
    } else if (excess > 10) {
      recommendations.push(`MAJOR RE DECREASE: Increase sentence length by 30% AND add complex vocabulary`)
    } else if (excess > 5) {
      recommendations.push(`MODERATE RE DECREASE: Increase sentence length by 20% AND add more precise terminology`)
    } else {
      recommendations.push(`MINOR RE DECREASE: Increase sentence length by 10% OR add some advanced vocabulary`)
    }
  }
  
  // Precision-specific recommendations to avoid "very close" responses
  if (accuracy >= 80 && accuracy < 95) {
    recommendations.push(`PRECISION TUNING NEEDED: Make micro-adjustments to achieve 95%+ accuracy`)
    if (fkDistance > 0.25) {
      recommendations.push(`FK FINE-TUNING: Adjust by ${fkDistance.toFixed(2)} points through word-level changes`)
    }
    if (reDistance > 2.5) {
      recommendations.push(`RE FINE-TUNING: Adjust by ${reDistance.toFixed(1)} points through sentence-level changes`)
    }
  }
  
  // Add mathematical formula guidance
  if (recommendations.length > 0) {
    recommendations.push(`MATHEMATICAL GUIDANCE: FK = 0.39 × avg_sentence_length + 11.8 × avg_syllables_per_word - 15.59`)
    recommendations.push(`MATHEMATICAL GUIDANCE: RE = 206.835 - 1.015 × avg_sentence_length - 84.6 × avg_syllables_per_word`)
  }
  
  return {
    isValid: fkInRange && reInRange && accuracy >= 90, // Stricter validation
    fkStatus,
    reStatus,
    accuracy: Math.round(accuracy * 10) / 10,
    recommendations,
    precisionAnalysis: {
      fkPrecision: Math.round(fkPrecision * 10) / 10,
      rePrecision: Math.round(rePrecision * 10) / 10,
      overallPrecision: Math.round(overallPrecision * 10) / 10,
      distanceFromOptimal: Math.round(distanceFromOptimal * 100) / 100,
      confidenceLevel
    }
  }
}

// Test endpoint to verify LanguageTool API
router.post('/test', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    // Test text with known grammar and spelling errors
    const testText = "I has many errors in this sentence. Teh cat are running to the tree. She dont like it when they goes there. The cat running. The dog jumping."
    const languageToolUrl = process.env.LANGUAGETOOL_API_URL || 'https://api.languagetool.org/v2'
    
    const params = new URLSearchParams({
      text: testText,
      language: 'en-US',
      enabledOnly: 'false',
      level: 'picky',
      enabledCategories: 'GRAMMAR,SENTENCE_WHITESPACE,MISC,COMPOUNDING,SEMANTICS,PUNCTUATION,CASING,TYPOS,CONFUSED_WORDS,LOGIC,TYPOGRAPHY,PRONOUN_AGREEMENT,SUBJECT_VERB_AGREEMENT,STYLE,COLLOQUIALISMS,REDUNDANCY,WORDINESS,CREATIVE_WRITING',
      enabledRules: 'FRAGMENT_SENTENCE,MISSING_VERB,INCOMPLETE_SENTENCE,SENTENCE_FRAGMENT,GRAMMAR_AGREEMENT,VERB_FORM'
    })

    const response = await axios.post<LanguageToolResponse>(
      `${languageToolUrl}/check`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      }
    )

    const suggestions = response.data.matches.map((match, index) => ({
      id: `${match.rule.id}-${match.offset}-${index}`,
      type: getSuggestionType(match.rule.category.id, match.rule.issueType),
      message: match.message,
      replacements: match.replacements.map(r => r.value),
      offset: match.offset,
      length: match.length,
      context: match.context.text,
      explanation: match.shortMessage || match.message,
      category: match.rule.category.name,
      categoryId: match.rule.category.id,
      issueType: match.rule.issueType,
      ruleId: match.rule.id,
      severity: getSeverity(match.rule.issueType),
    }))

    res.status(200).json({
      success: true,
      testText,
      suggestions,
      stats: {
        totalIssues: suggestions.length,
        grammarIssues: suggestions.filter(s => s.type === 'grammar').length,
        spellingIssues: suggestions.filter(s => s.type === 'spelling').length,
        styleIssues: suggestions.filter(s => s.type === 'style').length,
      },
      raw: response.data.matches
    })
  } catch (error) {
    console.error('Language test error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to test language API',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router 