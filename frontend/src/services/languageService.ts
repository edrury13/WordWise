import axios from 'axios'
import { supabase } from '../config/supabase'
import { Suggestion, ReadabilityScore } from '../store/slices/suggestionSlice'

// const LANGUAGETOOL_API_URL = import.meta.env.VITE_LANGUAGETOOL_API_URL || 'https://api.languagetool.org/v2'

// Simple rate limiter to prevent too many simultaneous API calls
// class RateLimiter {
//   private lastCallTime: number = 0
//   private minInterval: number = 1000 // Minimum 1 second between calls

//   async throttle(): Promise<void> {
//     const now = Date.now()
//     const timeSinceLastCall = now - this.lastCallTime
    
//     if (timeSinceLastCall < this.minInterval) {
//       const waitTime = this.minInterval - timeSinceLastCall
//       console.log(`⏳ Rate limiting: waiting ${waitTime}ms before API call`)
//       await new Promise(resolve => setTimeout(resolve, waitTime))
//     }
    
//     this.lastCallTime = Date.now()
//   }
// }

// const grammarRateLimiter = new RateLimiter()
// const sentenceRateLimiter = new RateLimiter()

// interface LanguageToolMatch {
//   offset: number
//   length: number
//   message: string
//   shortMessage?: string
//   replacements: Array<{ value: string }>
//   context: {
//     text: string
//     offset: number
//     length: number
//   }
//   rule: {
//     id: string
//     category: {
//       id: string
//       name: string
//     }
//     issueType: string
//   }
// }

// interface LanguageToolResponse {
//   matches: LanguageToolMatch[]
// }

export const checkGrammarAndSpelling = async (
  text: string,
  language: string = 'en-US'
): Promise<{ suggestions: Suggestion[], apiStatus: 'api' | 'client-fallback' | 'mixed' }> => {
  try {
    if (!text || text.trim().length === 0) {
      return { suggestions: [], apiStatus: 'client-fallback' }
    }

    // Add a small delay to prevent rapid API calls
    await new Promise(resolve => setTimeout(resolve, 100))

    // Get auth token from Supabase session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const token = session?.access_token

    console.log('🔍 Grammar check:', {
      textLength: text.length,
      hasToken: !!token,
      sessionError: sessionError?.message,
      isProd: import.meta.env.PROD
    })

    if (!token) {
      console.warn('🚨 No authentication token available - using client-side checking')
      return { suggestions: performClientSideGrammarCheck(text), apiStatus: 'client-fallback' }
    }

    // Try backend API first (only in production or when explicitly configured)
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : null)
    
    if (API_BASE_URL) {
      try {
        console.log('📡 Trying backend API...', text.substring(0, 50) + '...')

        const response = await axios.post(
          `${API_BASE_URL}/language-check`,
          { text, language },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            timeout: 15000
          }
        )

        console.log('✅ Backend API response:', {
          success: response.data.success,
          suggestionsCount: response.data.suggestions?.length || 0
        })

        const suggestions = response.data.suggestions || []
        
        // Still add client-side checks for comprehensive coverage
        const clientSideGrammarSuggestions = performClientSideGrammarCheck(text)
        const mergedSuggestions = [...suggestions]
        
        clientSideGrammarSuggestions.forEach(clientSuggestion => {
          const hasOverlappingSuggestion = suggestions.some((apiSuggestion: Suggestion) => {
            const clientStart = clientSuggestion.offset
            const clientEnd = clientSuggestion.offset + clientSuggestion.length
            const apiStart = apiSuggestion.offset
            const apiEnd = apiSuggestion.offset + apiSuggestion.length
            return (clientStart < apiEnd && clientEnd > apiStart)
          })
          
          if (!hasOverlappingSuggestion) {
            mergedSuggestions.push(clientSuggestion)
          }
        })

        const apiStatus = suggestions.length > 0 
          ? (clientSideGrammarSuggestions.length > 0 ? 'mixed' : 'api')
          : 'client-fallback'

        return { suggestions: mergedSuggestions, apiStatus }
      } catch (backendError) {
        console.warn('🔄 Backend API failed, trying LanguageTool directly:', 
          axios.isAxiosError(backendError) ? backendError.response?.status : backendError)
      }
    }

    // Fallback to direct LanguageTool API call
    console.log('📡 Calling LanguageTool API directly...')
    
    const languageToolUrl = 'https://api.languagetool.org/v2'
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

    console.log('✅ LanguageTool API response:', {
      matches: ltResponse.data.matches?.length || 0
    })

    const suggestions = ltResponse.data.matches.map((match: any, index: number) => ({
      id: `lt-${match.rule.id}-${match.offset}-${index}`,
      type: getSuggestionType(match.rule.category.id, match.rule.issueType),
      message: match.message,
      replacements: match.replacements.map((r: any) => r.value),
      offset: match.offset,
      length: match.length,
      context: match.context.text,
      explanation: match.shortMessage || match.message,
      category: match.rule.category.name,
      severity: getSeverity(match.rule.issueType),
    })) || []
    
    console.log('📋 Received suggestions:', {
      total: suggestions.length,
      grammar: suggestions.filter((s: Suggestion) => s.type === 'grammar').length,
      spelling: suggestions.filter((s: Suggestion) => s.type === 'spelling').length,
      style: suggestions.filter((s: Suggestion) => s.type === 'style').length,
    })

    // Always run client-side grammar checks to catch patterns the API might miss
    console.log('🔄 Adding client-side grammar checks')
    const clientSideGrammarSuggestions = performClientSideGrammarCheck(text)
    
    // Merge client-side suggestions with API suggestions, avoiding duplicates
    const mergedSuggestions = [...suggestions]
    
    clientSideGrammarSuggestions.forEach(clientSuggestion => {
      // Check if there's already a suggestion covering this text range
      const hasOverlappingSuggestion = suggestions.some((apiSuggestion: Suggestion) => {
        const clientStart = clientSuggestion.offset
        const clientEnd = clientSuggestion.offset + clientSuggestion.length
        const apiStart = apiSuggestion.offset
        const apiEnd = apiSuggestion.offset + apiSuggestion.length
        
        // Check for overlap: ranges overlap if one starts before the other ends
        return (clientStart < apiEnd && clientEnd > apiStart)
      })
      
      // Only add client-side suggestion if there's no overlapping API suggestion
      if (!hasOverlappingSuggestion) {
        mergedSuggestions.push(clientSuggestion)
      }
    })

    console.log('📋 Final suggestions after merge:', {
      total: mergedSuggestions.length,
      fromAPI: suggestions.length,
      fromClient: clientSideGrammarSuggestions.length,
      added: mergedSuggestions.length - suggestions.length
    })

    // Determine API status based on what was used
    const apiStatus = suggestions.length > 0 
      ? (clientSideGrammarSuggestions.length > 0 ? 'mixed' : 'api')
      : 'client-fallback'

    return { suggestions: mergedSuggestions, apiStatus }
  } catch (error) {
    console.error('❌ Grammar check failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      isAxiosError: axios.isAxiosError(error),
      status: axios.isAxiosError(error) ? error.response?.status : null,
      data: axios.isAxiosError(error) ? error.response?.data : null
    })
    
    // Handle rate limiting specifically
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      console.warn('🚨 Rate limit exceeded - using client-side grammar checking as fallback')
      return { suggestions: performClientSideGrammarCheck(text), apiStatus: 'client-fallback' }
    }
    
    // Fallback to client-side checking if backend fails
    if (axios.isAxiosError(error)) {
      console.warn('🔄 Backend API failed, using client-side grammar checking as fallback')
      return { suggestions: performClientSideGrammarCheck(text), apiStatus: 'client-fallback' }
    }
    
    throw new Error('Failed to check grammar and spelling')
  }
}

// Helper functions for LanguageTool API response processing
function getSuggestionType(categoryId: string, issueType: string): Suggestion['type'] {
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

function getSeverity(issueType: string): Suggestion['severity'] {
  if (issueType === 'misspelling' || issueType === 'grammar') {
    return 'high'
  }
  if (issueType === 'style') {
    return 'medium'
  }
  return 'low'
}

// Client-side basic grammar checking as fallback
function performClientSideGrammarCheck(text: string): Suggestion[] {
  const suggestions: Suggestion[] = []
  // let offset = 0
  
  // Basic grammar rules
  const grammarRules = [
    // First sentence specific rules - use ^ to match start of text
    {
      pattern: /^(the|a|an)\s+\w+\s+(run|walk|jump|swim|fly|sleep|eat|drink|play|work|study|read|write|talk|sing|dance|cook|drive|sit|stand|lie|move|come|go|look|watch|listen|think|feel|be|do|get|make|take|give|see|know|say|tell|ask|help|learn|teach|buy|sell|build|clean|wash|fix|paint|open|close|start|stop|continue|begin|end|finish|try|want|need|love|like|hate|hope|believe|understand|remember|forget|choose|decide|plan|prepare|organize|manage|control|lead|follow|support|encourage|celebrate|enjoy|suffer|struggle|fight|win|lose|compete|practice|train|exercise|relax|rest|wake|dream)\b(?![.,!?;:])/gi,
      message: "This appears to be an incomplete sentence. Consider adding 'is', 'was', 'are', or 'were' before the verb.",
      replacement: (match: string) => {
        const parts = match.split(/\s+/)
        const article = parts[0]
        const noun = parts[1]
        const verb = parts[2]
        
        // Determine if singular or plural
        const isPlural = article.toLowerCase() === 'the' && (noun.endsWith('s') || noun.endsWith('es'))
        const auxVerb = isPlural ? 'are' : 'is'
        
        return `${article} ${noun} ${auxVerb} ${verb}`
      },
      type: 'grammar' as const
    },
    
    // First sentence pronoun + verb without auxiliary
    {
      pattern: /^(he|she|it|i|you|we|they)\s+(run|walk|jump|swim|fly|sleep|eat|drink|play|work|study|read|write|talk|sing|dance|cook|drive|sit|stand|lie|move|come|go|look|watch|listen|think|feel|be|do|get|make|take|give|see|know|say|tell|ask|help|learn|teach|buy|sell|build|clean|wash|fix|paint|open|close|start|stop|continue|begin|end|finish|try|want|need|love|like|hate|hope|believe|understand|remember|forget|choose|decide|plan|prepare|organize|manage|control|lead|follow|support|encourage|celebrate|enjoy|suffer|struggle|fight|win|lose|compete|practice|train|exercise|relax|rest|wake|dream)\b(?![.,!?;:])/gi,
      message: "This appears to be an incomplete sentence. Consider adding 'is', 'was', 'are', or 'were' before the verb.",
      replacement: (match: string) => {
        const parts = match.split(/\s+/)
        const pronoun = parts[0].toLowerCase()
        const verb = parts[1]
        
        // Determine correct auxiliary verb based on pronoun
        let auxVerb = 'is'
        if (pronoun === 'i') {
          auxVerb = 'am'
        } else if (pronoun === 'you' || pronoun === 'we' || pronoun === 'they') {
          auxVerb = 'are'
        }
        
        return `${parts[0]} ${auxVerb} ${verb}`
      },
      type: 'grammar' as const
    },
    
    // Subject-verb agreement errors
    {
      pattern: /\b(I|you|we|they)\s+was\b/gi,
      message: "Subject-verb disagreement. Use 'were' instead of 'was' with plural subjects.",
      replacement: (match: string) => match.replace(/was/, 'were'),
      type: 'grammar' as const
    },
    {
      pattern: /\b(he|she|it)\s+were\b/gi,
      message: "Subject-verb disagreement. Use 'was' instead of 'were' with singular subjects.",
      replacement: (match: string) => match.replace(/were/, 'was'),
      type: 'grammar' as const
    },
    
    // Present tense verb agreement errors
    {
      pattern: /\b(the\s+\w+)\s+(run|walk|jump|swim|fly|sleep|eat|drink|play|work|study|read|write|talk|sing|dance|cook|drive|sit|stand|move|come|go|look|watch|listen|think|feel|get|make|take|give|see|know|say|tell|ask|help|learn|teach|buy|sell|build|clean|wash|fix|paint|open|close|start|stop|continue|begin|end|finish|try|want|need|love|like|hate|hope|believe|understand|remember|forget|choose|decide|plan|prepare|organize|manage|control|lead|follow|support|encourage|celebrate|enjoy|suffer|struggle|fight|win|lose|compete|practice|train|exercise|relax|rest|wake|dream)\b(?!\w)/gi,
      message: "Subject-verb disagreement. Singular subjects need 's' at the end of the verb.",
      replacement: (match: string) => {
        const parts = match.split(/\s+/)
        const subject = parts.slice(0, -1).join(' ')
        const verb = parts[parts.length - 1]
        
        // Add 's' to make it third person singular
        const correctedVerb = verb.endsWith('s') ? verb : 
                            verb === 'go' ? 'goes' :
                            verb === 'do' ? 'does' :
                            verb === 'have' ? 'has' :
                            verb + 's'
        
        return `${subject} ${correctedVerb}`
      },
      type: 'grammar' as const
    },
    
    // He/She/It + base form verb (should be third person singular)
    {
      pattern: /\b(he|she|it|He|She|It)\s+(run|walk|jump|swim|fly|sleep|eat|drink|play|work|study|read|write|talk|sing|dance|cook|drive|sit|stand|move|come|go|look|watch|listen|think|feel|get|make|take|give|see|know|say|tell|ask|help|learn|teach|buy|sell|build|clean|wash|fix|paint|open|close|start|stop|continue|begin|end|finish|try|want|need|love|like|hate|hope|believe|understand|remember|forget|choose|decide|plan|prepare|organize|manage|control|lead|follow|support|encourage|celebrate|enjoy|suffer|struggle|fight|win|lose|compete|practice|train|exercise|relax|rest|wake|dream)\b(?!\w)/gi,
      message: "Subject-verb disagreement. Use the third person singular form of the verb with 'he', 'she', or 'it'.",
      replacement: (match: string) => {
        const parts = match.split(/\s+/)
        const pronoun = parts[0]
        const verb = parts[1]
        
        // Convert to third person singular
        const correctedVerb = verb === 'go' ? 'goes' :
                            verb === 'do' ? 'does' :
                            verb === 'have' ? 'has' :
                            verb + 's'
        
        return `${pronoun} ${correctedVerb}`
      },
      type: 'grammar' as const
    },
    
    // Adjective/Adverb confusion - "runs good" should be "runs well"
    {
      pattern: /\b(runs?|walks?|talks?|works?|plays?|moves?|drives?|writes?|reads?|sings?|dances?|cooks?|sleeps?|eats?|drinks?|goes?|comes?|looks?|watches?|listens?|thinks?|feels?|gets?|makes?|takes?|gives?|sees?|knows?|says?|tells?|asks?|helps?|learns?|teaches?|buys?|sells?|builds?|cleans?|washes?|fixes?|paints?|opens?|closes?|starts?|stops?|continues?|begins?|ends?|finishes?|tries?|wants?|needs?|loves?|likes?|hates?|hopes?|believes?|understands?|remembers?|forgets?|chooses?|decides?|plans?|prepares?|organizes?|manages?|controls?|leads?|follows?|supports?|encourages?|celebrates?|enjoys?|suffers?|struggles?|fights?|wins?|loses?|competes?|practices?|trains?|exercises?|relaxes?|rests?|wakes?|dreams?)\s+(good|bad|quick|slow|loud|quiet|easy|hard|nice|beautiful|careful|careless|perfect|terrible|awful|amazing|wonderful|excellent|poor|great|fine)\b/gi,
      message: "Use an adverb to describe how an action is performed. Most adverbs end in '-ly'.",
      replacement: (match: string) => {
        const parts = match.split(/\s+/)
        const verb = parts[0]
        const adjective = parts[1].toLowerCase()
        
        // Convert adjective to adverb
        const adverbMap: { [key: string]: string } = {
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
          'careless': 'carelessly',
          'perfect': 'perfectly',
          'terrible': 'terribly',
          'awful': 'awfully',
          'amazing': 'amazingly',
          'wonderful': 'wonderfully',
          'excellent': 'excellently',
          'poor': 'poorly',
          'great': 'greatly',
          'fine': 'finely'
        }
        
        const adverb = adverbMap[adjective] || adjective + 'ly'
        return `${verb} ${adverb}`
      },
      type: 'grammar' as const
    },
    {
      pattern: /\b(I|you|we|they)\s+don't\s+has\b/gi,
      message: "Incorrect verb form. Use 'have' instead of 'has' with plural subjects.",
      replacement: (match: string) => match.replace(/has/, 'have'),
      type: 'grammar' as const
    },
    {
      pattern: /\b(he|she|it)\s+don't\b/gi,
      message: "Incorrect contraction. Use 'doesn't' instead of 'don't' with singular subjects.",
      replacement: (match: string) => match.replace(/don't/, "doesn't"),
      type: 'grammar' as const
    },
    {
      pattern: /\b(I|you|we|they)\s+goes\b/gi,
      message: "Subject-verb disagreement. Use 'go' instead of 'goes' with plural subjects.",
      replacement: (match: string) => match.replace(/goes/, 'go'),
      type: 'grammar' as const
    },
    {
      pattern: /\b(he|she|it)\s+go\b/gi,
      message: "Subject-verb disagreement. Use 'goes' instead of 'go' with singular subjects.",
      replacement: (match: string) => match.replace(/go/, 'goes'),
      type: 'grammar' as const
    },
    {
      pattern: /\b(I|you|we|they)\s+has\b/gi,
      message: "Subject-verb disagreement. Use 'have' instead of 'has' with plural subjects.",
      replacement: (match: string) => match.replace(/has/, 'have'),
      type: 'grammar' as const
    },
    {
      pattern: /\b(he|she|it)\s+have\b/gi,
      message: "Subject-verb disagreement. Use 'has' instead of 'have' with singular subjects.",
      replacement: (match: string) => match.replace(/have/, 'has'),
      type: 'grammar' as const
    },
    
    // Incomplete sentences with gerunds (missing auxiliary verbs)
    {
      pattern: /\b(The|A|An)\s+\w+\s+(running|walking|jumping|swimming|flying|sleeping|eating|drinking|playing|working|studying|reading|writing|talking|singing|dancing|cooking|driving|sitting|standing|lying|moving|coming|going|looking|watching|listening|thinking|feeling|being|doing|getting|making|taking|giving|seeing|knowing|saying|telling|asking|helping|learning|teaching|buying|selling|building|cleaning|washing|fixing|painting|opening|closing|starting|stopping|continuing|beginning|ending|finishing|trying|wanting|needing|loving|liking|hating|hoping|believing|understanding|remembering|forgetting|choosing|deciding|planning|preparing|organizing|managing|controlling|leading|following|supporting|encouraging|celebrating|enjoying|suffering|struggling|fighting|winning|losing|competing|practicing|training|exercising|relaxing|resting|sleeping|waking|dreaming)\b(?![.,!?;:])/gi,
      message: "This appears to be an incomplete sentence. Consider adding 'is', 'was', 'are', or 'were' before the verb.",
      replacement: (match: string) => {
        const parts = match.split(/\s+/)
        const article = parts[0]
        const noun = parts[1]
        const verb = parts[2]
        
        // Determine if singular or plural
        const isPlural = article.toLowerCase() === 'the' && (noun.endsWith('s') || noun.endsWith('es'))
        const auxVerb = isPlural ? 'are' : 'is'
        
        return `${article} ${noun} ${auxVerb} ${verb}`
      },
      type: 'grammar' as const
    },
    
    // Incomplete sentences starting with pronouns + gerunds
    {
      pattern: /\b(He|She|It|I|You|We|They)\s+(running|walking|jumping|swimming|flying|sleeping|eating|drinking|playing|working|studying|reading|writing|talking|singing|dancing|cooking|driving|sitting|standing|lying|moving|coming|going|looking|watching|listening|thinking|feeling|being|doing|getting|making|taking|giving|seeing|knowing|saying|telling|asking|helping|learning|teaching|buying|selling|building|cleaning|washing|fixing|painting|opening|closing|starting|stopping|continuing|beginning|ending|finishing|trying|wanting|needing|loving|liking|hating|hoping|believing|understanding|remembering|forgetting|choosing|deciding|planning|preparing|organizing|managing|controlling|leading|following|supporting|encouraging|celebrating|enjoying|suffering|struggling|fighting|winning|losing|competing|practicing|training|exercising|relaxing|resting|sleeping|waking|dreaming)\b(?![.,!?;:])/gi,
      message: "This appears to be an incomplete sentence. Consider adding 'is', 'was', 'are', or 'were' before the verb.",
      replacement: (match: string) => {
        const parts = match.split(/\s+/)
        const pronoun = parts[0].toLowerCase()
        const verb = parts[1]
        
        // Determine correct auxiliary verb based on pronoun
        let auxVerb = 'is'
        if (pronoun === 'i') {
          auxVerb = 'am'
        } else if (pronoun === 'you' || pronoun === 'we' || pronoun === 'they') {
          auxVerb = 'are'
        }
        
        return `${parts[0]} ${auxVerb} ${verb}`
      },
      type: 'grammar' as const
    },
    
    // Missing articles before nouns
    {
      pattern: /(?:^|\s)(cat|dog|bird|car|house|book|table|chair|computer|phone|tree|flower|person|man|woman|child|student|teacher|doctor|nurse|engineer|artist|writer|musician|actor|singer|dancer|athlete|chef|farmer|driver|pilot|scientist|researcher|manager|director|president|minister|judge|lawyer|police|soldier|firefighter|paramedic|mechanic|electrician|plumber|carpenter|painter|cleaner|waiter|waitress|cashier|salesperson|customer|client|patient|visitor|guest|friend|family|parent|mother|father|brother|sister|son|daughter|husband|wife|boyfriend|girlfriend|neighbor|colleague|classmate|teammate|partner|boss|employee|worker|volunteer|member|leader|follower|speaker|listener|reader|writer|viewer|player|performer|participant|competitor|winner|loser|expert|beginner|professional|amateur|specialist|generalist)\s+(running|walking|jumping|swimming|flying|sleeping|eating|drinking|playing|working|studying|reading|writing|talking|singing|dancing|cooking|driving|sitting|standing|lying|moving|coming|going|looking|watching|listening|thinking|feeling|being|doing|getting|making|taking|giving|seeing|knowing|saying|telling|asking|helping|learning|teaching|buying|selling|building|cleaning|washing|fixing|painting|opening|closing|starting|stopping|continuing|beginning|ending|finishing|trying|wanting|needing|loving|liking|hating|hoping|believing|understanding|remembering|forgetting|choosing|deciding|planning|preparing|organizing|managing|controlling|leading|following|supporting|encouraging|celebrating|enjoying|suffering|struggling|fighting|winning|losing|competing|practicing|training|exercising|relaxing|resting|sleeping|waking|dreaming)\b/gi,
      message: "Consider adding an article ('the', 'a', or 'an') before the noun, and a helping verb ('is', 'are', 'was', 'were') before the action.",
      replacement: (match: string) => {
        const trimmed = match.trim()
        const parts = trimmed.split(/\s+/)
        const noun = parts[0]
        const verb = parts[1]
        
        // Choose article
        const article = /^[aeiou]/i.test(noun) ? 'An' : 'A'
        
        return ` ${article} ${noun} is ${verb}`
      },
      type: 'grammar' as const
    },
    
    // Common contractions errors
    {
      pattern: /\b(should|would|could|might|must|can|will|shall)\s+of\b/gi,
      message: "Use 'have' instead of 'of' after modal verbs.",
      replacement: (match: string) => match.replace(/\s+of/, ' have'),
      type: 'grammar' as const
    },
    
    // Double negatives
    {
      pattern: /\b(don't|doesn't|didn't|won't|wouldn't|shouldn't|couldn't|can't|mustn't)\s+\w*\s+(no|nobody|nothing|nowhere|never|none)\b/gi,
      message: "Avoid double negatives. Use either the negative verb or the negative word, not both.",
      replacement: (match: string) => {
        // Simplified correction - replace don't with do
        return match.replace(/(don't|doesn't|didn't|won't|wouldn't|shouldn't|couldn't|can't|mustn't)/, (neg) => {
          const positives: { [key: string]: string } = {
            "don't": "do",
            "doesn't": "does", 
            "didn't": "did",
            "won't": "will",
            "wouldn't": "would",
            "shouldn't": "should",
            "couldn't": "could",
            "can't": "can",
            "mustn't": "must"
          }
          return positives[neg.toLowerCase()] || neg
        })
      },
      type: 'grammar' as const
    }
  ]

  grammarRules.forEach((rule, ruleIndex) => {
    let match
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags)
    
    while ((match = regex.exec(text)) !== null) {
      const matchText = match[0]
      const matchOffset = match.index
      
      suggestions.push({
        id: `client-grammar-${ruleIndex}-${matchOffset}`,
        type: rule.type,
        message: rule.message,
        replacements: [rule.replacement(matchText)],
        offset: matchOffset,
        length: matchText.length,
        context: text.substring(Math.max(0, matchOffset - 20), matchOffset + matchText.length + 20),
        explanation: rule.message,
        category: 'Grammar (Client-side)',
        severity: 'high'
      })
    }
  })

  console.log('Added client-side grammar suggestions:', suggestions.length)
  return suggestions
}

// Test function to check if LanguageTool API is working

export const testLanguageAPI = async (): Promise<any> => {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api')
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    if (!token) {
      throw new Error('No authentication token available')
    }

    const response = await axios.post(
      `${API_BASE_URL}/language/test`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000
      }
    )

    return response.data
  } catch (error) {
    console.error('Language API test failed:', error)
    throw error
  }
}

export const analyzeReadability = async (text: string): Promise<ReadabilityScore> => {
  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for readability analysis')
  }

  console.log('📊 Analyzing readability client-side for text:', text.substring(0, 50) + '...')
  
  // Use client-side readability analysis directly - it's fast, reliable, and doesn't require API calls
  return performClientSideReadabilityAnalysis(text)
}

// const getSuggestionType = (categoryId: string, issueType: string): Suggestion['type'] => {
//   if (categoryId.includes('TYPOS') || issueType === 'misspelling') {
//     return 'spelling'
//   }
//   if (categoryId.includes('GRAMMAR') || issueType === 'grammar') {
//     return 'grammar'
//   }
//   if (categoryId.includes('STYLE') || issueType === 'style') {
//     return 'style'
//   }
//   if (categoryId.includes('CLARITY')) {
//     return 'clarity'
//   }
//   if (categoryId.includes('ENGAGEMENT')) {
//     return 'engagement'
//   }
//   if (categoryId.includes('DELIVERY')) {
//     return 'delivery'
//   }
//   return 'style'
// }

// const getSeverity = (issueType: string): Suggestion['severity'] => {
//   if (issueType === 'misspelling' || issueType === 'grammar') {
//     return 'high'
//   }
//   if (issueType === 'style') {
//     return 'medium'
//   }
//   return 'low'
// }

const countSyllables = (word: string): number => {
  word = word.toLowerCase()
  if (word.length <= 3) return 1
  
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
  word = word.replace(/^y/, '')
  
  const matches = word.match(/[aeiouy]{1,2}/g)
  return Math.max(1, matches ? matches.length : 1)
}

const getReadabilityLevel = (score: number): string => {
  if (score >= 16) return 'Graduate'
  if (score >= 13) return 'College'
  if (score >= 10) return 'High School'
  if (score >= 8) return 'Middle School'
  if (score >= 6) return 'Elementary'
  return 'Very Easy'
}

// Client-side readability analysis as fallback
function performClientSideReadabilityAnalysis(text: string): ReadabilityScore {
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

  // Flesch Reading Ease Score
  const fleschReadingEase = 206.835 - (1.015 * averageWordsPerSentence) - (84.6 * averageSyllablesPerWord)

  // Long sentences (>20 words)
  const longSentences = sentences.filter(sentence => {
    const sentenceWords = sentence.split(/\s+/).filter(w => w.trim().length > 0)
    return sentenceWords.length > 20
  }).length

  // Simple passive voice detection
  const passiveIndicators = /(was|were|been|being)\s+\w+ed\b/gi
  const passiveMatches = text.match(passiveIndicators) || []
  const passiveVoicePercentage = (passiveMatches.length / Math.max(totalSentences, 1)) * 100

  console.log('📊 Readability calculations:', {
    fleschKincaid: Math.round(fleschKincaid * 10) / 10,
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    averageWordsPerSentence: Math.round(averageWordsPerSentence * 10) / 10,
    averageSyllablesPerWord: Math.round(averageSyllablesPerWord * 10) / 10,
    totalSentences,
    longSentences,
    passiveVoicePercentage: Math.round(passiveVoicePercentage * 10) / 10
  })

  const readabilityScore: ReadabilityScore = {
    fleschKincaid: Math.round(fleschKincaid * 10) / 10,
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    readabilityLevel: getReadabilityLevel(fleschKincaid),
    averageWordsPerSentence: Math.round(averageWordsPerSentence * 10) / 10,
    averageSyllablesPerWord: Math.round(averageSyllablesPerWord * 10) / 10,
    totalSentences,
    passiveVoicePercentage: Math.round(passiveVoicePercentage * 10) / 10,
    longSentences,
  }

  return readabilityScore
}

export const analyzeSentences = async (text: string) => {
  try {
    // Add a small delay to prevent rapid API calls
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Use backend API with Supabase authentication
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api')
    
    // Get auth token from Supabase session (consistent with other functions)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const token = session?.access_token

    console.log('📊 Sentence analysis request:', {
      textLength: text.length,
      hasToken: !!token,
      sessionError: sessionError?.message
    })

    if (!token) {
      console.warn('🚨 No authentication token available for sentence analysis')
      return {
        success: false,
        error: 'Authentication required. Please log in to analyze sentences.'
      }
    }

    const response = await axios.post(
      `${API_BASE_URL}/language/sentence-analysis`,
      { text },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000
      }
    )

    if (response.status === 429) {
      // Rate limited - return graceful fallback
      return {
        success: false,
        error: 'Rate limited. Please wait a moment before trying again.'
      }
    }

    return response.data
  } catch (error) {
    console.error('Sentence analysis error:', error)
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        return {
          success: false,
          error: 'Rate limited. Please wait a moment before trying again.'
        }
      } else if (error.response?.status === 401) {
        return {
          success: false,
          error: 'Authentication failed. Please log in again.'
        }
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze sentences'
    }
  }
}

export const rewriteTone = async (text: string, tone: string) => {
  try {
    // Use backend API with Supabase authentication
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api')
    
    // Get auth token from Supabase session (consistent with other functions)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const token = session?.access_token

    console.log('🎨 Tone rewrite request:', {
      textLength: text.length,
      tone,
      hasToken: !!token,
      sessionError: sessionError?.message
    })

    if (!token) {
      console.warn('🚨 No authentication token available for tone rewriting')
      throw new Error('Authentication required. Please log in to use tone rewriting.')
    }

    console.log('📡 Making tone rewrite API call...')

    const response = await axios.post(
      `${API_BASE_URL}/language/rewrite-tone`,
      { text, tone },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000
      }
    )

    console.log('✅ Tone rewrite API response:', {
      success: response.data.success,
      originalLength: response.data.originalText?.length || 0,
      rewrittenLength: response.data.rewrittenText?.length || 0,
      tone: response.data.tone
    })

    return response.data
  } catch (error) {
    console.error('❌ Tone rewriting failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      isAxiosError: axios.isAxiosError(error),
      status: axios.isAxiosError(error) ? error.response?.status : null,
      data: axios.isAxiosError(error) ? error.response?.data : null
    })
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        throw new Error('Rate limited. Please wait a moment before trying again.')
      } else if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please log in again.')
      } else if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
    }
    
    throw error
  }
} 