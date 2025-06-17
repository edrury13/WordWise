import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

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

    const { text, language = 'en-US' } = body

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
    
    // First, check the entire text for overall issues
    const params = new URLSearchParams({
      text,
      language,
      enabledOnly: 'false',
      level: 'picky',
      enabledCategories: 'GRAMMAR,SENTENCE_WHITESPACE,MISC,COMPOUNDING,SEMANTICS,PUNCTUATION,CASING,TYPOS',
      disabledCategories: 'STYLE,COLLOQUIALISMS,REDUNDANCY,WORDINESS'
    })

    const response = await axios.post(`${languageToolUrl}/check`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000,
    })

    let allSuggestions = response.data.matches.map((match, index) => ({
      id: `full-${match.rule.id}-${match.offset}-${index}`,
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

    // Now check each sentence individually to catch sentence-specific issues
    const sentences = []
    const sentenceOffsets = []
    
    // Split sentences and find their positions
    let currentOffset = 0
    const sentenceRegex = /[.!?]+/g
    let lastEnd = 0
    let match
    
    while ((match = sentenceRegex.exec(text)) !== null) {
      const sentenceText = text.substring(lastEnd, match.index + match[0].length).trim()
      if (sentenceText.length > 3) {
        sentences.push(sentenceText)
        sentenceOffsets.push(lastEnd)
      }
      lastEnd = match.index + match[0].length
    }
    
    // Add the last sentence if it doesn't end with punctuation
    const lastSentence = text.substring(lastEnd).trim()
    if (lastSentence.length > 3) {
      sentences.push(lastSentence)
      sentenceOffsets.push(lastEnd)
    }

    console.log(`📝 Checking ${sentences.length} individual sentences for grammar issues`)

    // Check each sentence individually
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]
      const sentenceOffset = sentenceOffsets[i]
      
      // Add period if sentence doesn't end with punctuation for better analysis
      const sentenceForAnalysis = /[.!?]$/.test(sentence.trim()) ? sentence : sentence + '.'
      
      try {
        const sentenceParams = new URLSearchParams({
          text: sentenceForAnalysis,
          language,
          enabledOnly: 'false',
          level: 'picky',
          enabledCategories: 'GRAMMAR,PUNCTUATION,CASING,TYPOS',
          enabledRules: [
            'SUBJECT_VERB_AGREEMENT',
            'GRAMMAR_AGREEMENT', 
            'VERB_FORM',
            'SINGULAR_PLURAL_VERB',
            'MISSING_VERB',
            'INCOMPLETE_SENTENCE',
            'SENTENCE_FRAGMENT',
            'ARTICLE_MISSING',
            'MISSING_DETERMINER',
            'WRONG_VERB_FORM',
            'ADJECTIVE_ADVERB_CONFUSION'
          ].join(',')
        })

        const sentenceResponse = await axios.post(`${languageToolUrl}/check`, sentenceParams, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15000,
        })

        // Add sentence-specific suggestions, adjusting offsets to match original text
        const sentenceSuggestions = sentenceResponse.data.matches.map((match, index) => ({
          id: `sent-${i}-${match.rule.id}-${match.offset}-${index}`,
          type: getSuggestionType(match.rule.category.id, match.rule.issueType),
          message: match.message,
          replacements: match.replacements.map(r => r.value),
          offset: sentenceOffset + match.offset,
          length: match.length,
          context: match.context.text,
          explanation: match.shortMessage || match.message,
          category: match.rule.category.name + ' (Sentence-level)',
          severity: getSeverity(match.rule.issueType),
        }))

        // Only add sentence suggestions that don't overlap with existing ones
        sentenceSuggestions.forEach(sentSugg => {
          const hasOverlap = allSuggestions.some(existingSugg => {
            const existingStart = existingSugg.offset
            const existingEnd = existingSugg.offset + existingSugg.length
            const newStart = sentSugg.offset
            const newEnd = sentSugg.offset + sentSugg.length
            
            return (newStart < existingEnd && newEnd > existingStart)
          })
          
          if (!hasOverlap) {
            allSuggestions.push(sentSugg)
          }
        })

      } catch (error) {
        console.error(`Error checking sentence ${i + 1}:`, error)
        // Continue with other sentences
      }
    }

    // Add custom client-side grammar rules for additional coverage
    const customSuggestions = performCustomGrammarCheck(text)
    
    // Merge custom suggestions, avoiding duplicates
    customSuggestions.forEach(customSugg => {
      const hasOverlap = allSuggestions.some(existingSugg => {
        const existingStart = existingSugg.offset
        const existingEnd = existingSugg.offset + existingSugg.length
        const newStart = customSugg.offset
        const newEnd = customSugg.offset + customSugg.length
        
        return (newStart < existingEnd && newEnd > existingStart)
      })
      
      if (!hasOverlap) {
        allSuggestions.push(customSugg)
      }
    })

    const suggestions = allSuggestions

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
    console.error('Grammar check API error:', error)
    
    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded for language check service'
      })
    }
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
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

function performCustomGrammarCheck(text) {
  const suggestions = []
  
  // Enhanced grammar rules for comprehensive checking
  const grammarRules = [
    // Subject-verb agreement errors
    {
      pattern: /\b(I|you|we|they)\s+was\b/gi,
      message: "Subject-verb disagreement. Use 'were' instead of 'was' with plural subjects.",
      replacement: (match) => match.replace(/was/, 'were'),
      type: 'grammar'
    },
    {
      pattern: /\b(he|she|it)\s+were\b/gi,
      message: "Subject-verb disagreement. Use 'was' instead of 'were' with singular subjects.",
      replacement: (match) => match.replace(/were/, 'was'),
      type: 'grammar'
    },
    {
      pattern: /\b(I|you|we|they)\s+goes\b/gi,
      message: "Subject-verb disagreement. Use 'go' instead of 'goes' with plural subjects.",
      replacement: (match) => match.replace(/goes/, 'go'),
      type: 'grammar'
    },
    {
      pattern: /\b(he|she|it)\s+go\b/gi,
      message: "Subject-verb disagreement. Use 'goes' instead of 'go' with singular subjects.",
      replacement: (match) => match.replace(/go/, 'goes'),
      type: 'grammar'
    },
    {
      pattern: /\b(I|you|we|they)\s+has\b/gi,
      message: "Subject-verb disagreement. Use 'have' instead of 'has' with plural subjects.",
      replacement: (match) => match.replace(/has/, 'have'),
      type: 'grammar'
    },
    {
      pattern: /\b(he|she|it)\s+have\b/gi,
      message: "Subject-verb disagreement. Use 'has' instead of 'have' with singular subjects.",
      replacement: (match) => match.replace(/have/, 'has'),
      type: 'grammar'
    },
    
    // Adjective/Adverb confusion
    {
      pattern: /\b(runs?|walks?|talks?|works?|plays?|moves?|drives?|writes?|reads?|sings?|dances?|cooks?|sleeps?|eats?|drinks?)\s+(good|bad|quick|slow|loud|quiet|easy|hard|nice|beautiful|careful|careless)\b/gi,
      message: "Use an adverb (ending in -ly) to describe how an action is performed.",
      replacement: (match) => {
        const parts = match.split(/\s+/)
        const verb = parts[0]
        const adjective = parts[1].toLowerCase()
        
        const adverbMap = {
          'good': 'well',
          'bad': 'badly', 
          'quick': 'quickly',
          'slow': 'slowly',
          'loud': 'loudly',
          'quiet': 'quietly',
          'easy': 'easily',
          'hard': 'hard', // 'hard' can be both adjective and adverb
          'nice': 'nicely',
          'beautiful': 'beautifully',
          'careful': 'carefully',
          'careless': 'carelessly'
        }
        
        const adverb = adverbMap[adjective] || adjective + 'ly'
        return `${verb} ${adverb}`
      },
      type: 'grammar'
    },
    
    // Incomplete sentences with gerunds
    {
      pattern: /(?:^|\.\s*)(The|A|An)\s+\w+\s+(running|walking|jumping|swimming|flying|sleeping|eating|drinking|playing|working|studying|reading|writing|talking|singing|dancing|cooking|driving|sitting|standing|lying|moving|coming|going|looking|watching|listening|thinking|feeling|being|doing|getting|making|taking|giving|seeing|knowing|saying|telling|asking|helping|learning|teaching|buying|selling|building|cleaning|washing|fixing|painting|opening|closing|starting|stopping|continuing|beginning|ending|finishing|trying|wanting|needing|loving|liking|hating|hoping|believing|understanding|remembering|forgetting|choosing|deciding|planning|preparing|organizing|managing|controlling|leading|following|supporting|encouraging|celebrating|enjoying|suffering|struggling|fighting|winning|losing|competing|practicing|training|exercising|relaxing|resting|waking|dreaming)\b(?![.,!?;:])/gi,
      message: "This appears to be an incomplete sentence. Consider adding 'is', 'was', 'are', or 'were' before the verb.",
      replacement: (match) => {
        const parts = match.trim().split(/\s+/)
        const article = parts[0]
        const noun = parts[1]
        const verb = parts[2]
        
        const isPlural = article.toLowerCase() === 'the' && (noun.endsWith('s') || noun.endsWith('es'))
        const auxVerb = isPlural ? 'are' : 'is'
        
        return `${article} ${noun} ${auxVerb} ${verb}`
      },
      type: 'grammar'
    },
    
    // Incomplete sentences with pronouns
    {
      pattern: /(?:^|\.\s*)(He|She|It|I|You|We|They)\s+(running|walking|jumping|swimming|flying|sleeping|eating|drinking|playing|working|studying|reading|writing|talking|singing|dancing|cooking|driving|sitting|standing|lying|moving|coming|going|looking|watching|listening|thinking|feeling|being|doing|getting|making|taking|giving|seeing|knowing|saying|telling|asking|helping|learning|teaching|buying|selling|building|cleaning|washing|fixing|painting|opening|closing|starting|stopping|continuing|beginning|ending|finishing|trying|wanting|needing|loving|liking|hating|hoping|believing|understanding|remembering|forgetting|choosing|deciding|planning|preparing|organizing|managing|controlling|leading|following|supporting|encouraging|celebrating|enjoying|suffering|struggling|fighting|winning|losing|competing|practicing|training|exercising|relaxing|resting|waking|dreaming)\b(?![.,!?;:])/gi,
      message: "This appears to be an incomplete sentence. Consider adding 'is', 'was', 'are', or 'were' before the verb.",
      replacement: (match) => {
        const parts = match.trim().split(/\s+/)
        const pronoun = parts[0].toLowerCase()
        const verb = parts[1]
        
        let auxVerb = 'is'
        if (pronoun === 'i') {
          auxVerb = 'am'
        } else if (pronoun === 'you' || pronoun === 'we' || pronoun === 'they') {
          auxVerb = 'are'
        }
        
        return `${parts[0]} ${auxVerb} ${verb}`
      },
      type: 'grammar'
    }
  ]

  grammarRules.forEach((rule, ruleIndex) => {
    let match
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags)
    
    while ((match = regex.exec(text)) !== null) {
      const matchText = match[0]
      const matchOffset = match.index
      
      suggestions.push({
        id: `custom-grammar-${ruleIndex}-${matchOffset}`,
        type: rule.type,
        message: rule.message,
        replacements: [rule.replacement(matchText)],
        offset: matchOffset,
        length: matchText.length,
        context: text.substring(Math.max(0, matchOffset - 20), matchOffset + matchText.length + 20),
        explanation: rule.message,
        category: 'Grammar (Enhanced)',
        severity: 'high'
      })
    }
  })

  return suggestions
} 