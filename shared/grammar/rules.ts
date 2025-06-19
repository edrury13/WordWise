import { GrammarRule } from './types'

export const GRAMMAR_RULES: GrammarRule[] = [
  // INCOMPLETE SENTENCE RULES
  {
    id: 'incomplete-sentence-article-verb',
    name: 'Incomplete Sentence with Article + Noun + Verb',
    description: 'Detects incomplete sentences like "The cat run" that need auxiliary verbs',
    pattern: /^(the|a|an)\s+\w+\s+(run|walk|jump|swim|fly|sleep|eat|drink|play|work|study|read|write|talk|sing|dance|cook|drive|sit|stand|lie|move|come|go|look|watch|listen|think|feel|be|do|get|make|take|give|see|know|say|tell|ask|help|learn|teach|buy|sell|build|clean|wash|fix|paint|open|close|start|stop|continue|begin|end|finish|try|want|need|love|like|hate|hope|believe|understand|remember|forget|choose|decide|plan|prepare|organize|manage|control|lead|follow|support|encourage|celebrate|enjoy|suffer|struggle|fight|win|lose|compete|practice|train|exercise|relax|rest|wake|dream)\b(?![.,!?;:])/gi,
    message: "This appears to be an incomplete sentence. Consider adding 'is', 'was', 'are', or 'were' before the verb.",
    category: 'incomplete-sentence',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 100,
    enabled: true,
    replacement: (match: string) => {
      const parts = match.split(/\s+/)
      const article = parts[0]
      const noun = parts[1]
      const verb = parts[2]
      
      const isPlural = article.toLowerCase() === 'the' && (noun.endsWith('s') || noun.endsWith('es'))
      const auxVerb = isPlural ? 'are' : 'is'
      
      return `${article} ${noun} ${auxVerb} ${verb}`
    }
  },
  
  {
    id: 'incomplete-sentence-pronoun-verb',
    name: 'Incomplete Sentence with Pronoun + Verb',
    description: 'Detects incomplete sentences like "He run" that need auxiliary verbs',
    pattern: /^(he|she|it|i|you|we|they)\s+(run|walk|jump|swim|fly|sleep|eat|drink|play|work|study|read|write|talk|sing|dance|cook|drive|sit|stand|lie|move|come|go|look|watch|listen|think|feel|be|do|get|make|take|give|see|know|say|tell|ask|help|learn|teach|buy|sell|build|clean|wash|fix|paint|open|close|start|stop|continue|begin|end|finish|try|want|need|love|like|hate|hope|believe|understand|remember|forget|choose|decide|plan|prepare|organize|manage|control|lead|follow|support|encourage|celebrate|enjoy|suffer|struggle|fight|win|lose|compete|practice|train|exercise|relax|rest|wake|dream)\b(?![.,!?;:])/gi,
    message: "This appears to be an incomplete sentence. Consider adding 'is', 'was', 'are', or 'were' before the verb.",
    category: 'incomplete-sentence',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 100,
    enabled: true,
    replacement: (match: string) => {
      const parts = match.split(/\s+/)
      const pronoun = parts[0].toLowerCase()
      const verb = parts[1]
      
      let auxVerb = 'is'
      if (pronoun === 'i') {
        auxVerb = 'am'
      } else if (pronoun === 'you' || pronoun === 'we' || pronoun === 'they') {
        auxVerb = 'are'
      }
      
      return `${parts[0]} ${auxVerb} ${verb}`
    }
  },

  {
    id: 'incomplete-gerund-article',
    name: 'Incomplete Gerund with Article',
    description: 'Detects incomplete sentences with gerunds like "The cat running"',
    pattern: /\b(The|A|An)\s+\w+\s+(running|walking|jumping|swimming|flying|sleeping|eating|drinking|playing|working|studying|reading|writing|talking|singing|dancing|cooking|driving|sitting|standing|lying|moving|coming|going|looking|watching|listening|thinking|feeling|being|doing|getting|making|taking|giving|seeing|knowing|saying|telling|asking|helping|learning|teaching|buying|selling|building|cleaning|washing|fixing|painting|opening|closing|starting|stopping|continuing|beginning|ending|finishing|trying|wanting|needing|loving|liking|hating|hoping|believing|understanding|remembering|forgetting|choosing|deciding|planning|preparing|organizing|managing|controlling|leading|following|supporting|encouraging|celebrating|enjoying|suffering|struggling|fighting|winning|losing|competing|practicing|training|exercising|relaxing|resting|sleeping|waking|dreaming)\b(?![.,!?;:])/gi,
    message: "This appears to be an incomplete sentence. Consider adding 'is', 'was', 'are', or 'were' before the verb.",
    category: 'incomplete-sentence',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 95,
    enabled: true,
    replacement: (match: string) => {
      const parts = match.split(/\s+/)
      const article = parts[0]
      const noun = parts[1]
      const verb = parts[2]
      
      const isPlural = article.toLowerCase() === 'the' && (noun.endsWith('s') || noun.endsWith('es'))
      const auxVerb = isPlural ? 'are' : 'is'
      
      return `${article} ${noun} ${auxVerb} ${verb}`
    }
  },

  {
    id: 'incomplete-gerund-pronoun',
    name: 'Incomplete Gerund with Pronoun',
    description: 'Detects incomplete sentences with pronouns and gerunds like "He running"',
    pattern: /\b(He|She|It|I|You|We|They)\s+(running|walking|jumping|swimming|flying|sleeping|eating|drinking|playing|working|studying|reading|writing|talking|singing|dancing|cooking|driving|sitting|standing|lying|moving|coming|going|looking|watching|listening|thinking|feeling|being|doing|getting|making|taking|giving|seeing|knowing|saying|telling|asking|helping|learning|teaching|buying|selling|building|cleaning|washing|fixing|painting|opening|closing|starting|stopping|continuing|beginning|ending|finishing|trying|wanting|needing|loving|liking|hating|hoping|believing|understanding|remembering|forgetting|choosing|deciding|planning|preparing|organizing|managing|controlling|leading|following|supporting|encouraging|celebrating|enjoying|suffering|struggling|fighting|winning|losing|competing|practicing|training|exercising|relaxing|resting|sleeping|waking|dreaming)\b(?![.,!?;:])/gi,
    message: "This appears to be an incomplete sentence. Consider adding 'is', 'was', 'are', or 'were' before the verb.",
    category: 'incomplete-sentence',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 95,
    enabled: true,
    replacement: (match: string) => {
      const parts = match.split(/\s+/)
      const pronoun = parts[0].toLowerCase()
      const verb = parts[1]
      
      let auxVerb = 'is'
      if (pronoun === 'i') {
        auxVerb = 'am'
      } else if (pronoun === 'you' || pronoun === 'we' || pronoun === 'they') {
        auxVerb = 'are'
      }
      
      return `${parts[0]} ${auxVerb} ${verb}`
    }
  },

  // SUBJECT-VERB AGREEMENT RULES
  {
    id: 'subject-verb-was-were',
    name: 'Subject-Verb Agreement: was/were',
    description: 'Corrects "I/you/we/they was" to "were"',
    pattern: /\b(I|you|we|they)\s+was\b/gi,
    message: "Subject-verb disagreement. Use 'were' instead of 'was' with plural subjects.",
    category: 'subject-verb-agreement',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 90,
    enabled: true,
    replacement: (match: string) => match.replace(/was/i, 'were')
  },

  {
    id: 'subject-verb-were-was',
    name: 'Subject-Verb Agreement: were/was',
    description: 'Corrects "he/she/it were" to "was"',
    pattern: /\b(he|she|it)\s+were\b/gi,
    message: "Subject-verb disagreement. Use 'was' instead of 'were' with singular subjects.",
    category: 'subject-verb-agreement',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 90,
    enabled: true,
    replacement: (match: string) => match.replace(/were/i, 'was')
  },

  {
    id: 'subject-verb-third-person-singular',
    name: 'Third Person Singular Verb Agreement',
    description: 'Adds "s" to verbs with he/she/it subjects',
    pattern: /\b(he|she|it|He|She|It)\s+(run|walk|jump|swim|fly|sleep|eat|drink|play|work|study|read|write|talk|sing|dance|cook|drive|sit|stand|move|come|go|look|watch|listen|think|feel|get|make|take|give|see|know|say|tell|ask|help|learn|teach|buy|sell|build|clean|wash|fix|paint|open|close|start|stop|continue|begin|end|finish|try|want|need|love|like|hate|hope|believe|understand|remember|forget|choose|decide|plan|prepare|organize|manage|control|lead|follow|support|encourage|celebrate|enjoy|suffer|struggle|fight|win|lose|compete|practice|train|exercise|relax|rest|wake|dream)\b(?!\w)/gi,
    message: "Subject-verb disagreement. Use the third person singular form of the verb with 'he', 'she', or 'it'.",
    category: 'subject-verb-agreement',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 85,
    enabled: true,
    replacement: (match: string) => {
      const parts = match.split(/\s+/)
      const pronoun = parts[0]
      const verb = parts[1]
      
      const correctedVerb = verb === 'go' ? 'goes' :
                          verb === 'do' ? 'does' :
                          verb === 'have' ? 'has' :
                          verb + 's'
      
      return `${pronoun} ${correctedVerb}`
    }
  },

  {
    id: 'subject-verb-singular-noun',
    name: 'Singular Noun Verb Agreement',
    description: 'Adds "s" to verbs with singular noun subjects',
    pattern: /\b(the\s+\w+)\s+(run|walk|jump|swim|fly|sleep|eat|drink|play|work|study|read|write|talk|sing|dance|cook|drive|sit|stand|move|come|go|look|watch|listen|think|feel|get|make|take|give|see|know|say|tell|ask|help|learn|teach|buy|sell|build|clean|wash|fix|paint|open|close|start|stop|continue|begin|end|finish|try|want|need|love|like|hate|hope|believe|understand|remember|forget|choose|decide|plan|prepare|organize|manage|control|lead|follow|support|encourage|celebrate|enjoy|suffer|struggle|fight|win|lose|compete|practice|train|exercise|relax|rest|wake|dream)\b(?!\w)/gi,
    message: "Subject-verb disagreement. Singular subjects need 's' at the end of the verb.",
    category: 'subject-verb-agreement',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 85,
    enabled: true,
    replacement: (match: string) => {
      const parts = match.split(/\s+/)
      const subject = parts.slice(0, -1).join(' ')
      const verb = parts[parts.length - 1]
      
      const correctedVerb = verb.endsWith('s') ? verb : 
                          verb === 'go' ? 'goes' :
                          verb === 'do' ? 'does' :
                          verb === 'have' ? 'has' :
                          verb + 's'
      
      return `${subject} ${correctedVerb}`
    }
  },

  // CONTRACTIONS AND VERB FORMS
  {
    id: 'contraction-dont-doesnt',
    name: 'Don\'t vs Doesn\'t',
    description: 'Corrects "he/she/it don\'t" to "doesn\'t"',
    pattern: /\b(he|she|it)\s+don't\b/gi,
    message: "Incorrect contraction. Use 'doesn't' instead of 'don't' with singular subjects.",
    category: 'contractions',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 80,
    enabled: true,
    replacement: (match: string) => match.replace(/don't/i, "doesn't")
  },

  {
    id: 'verb-form-has-have-plural',
    name: 'Has/Have with Plural Subjects',
    description: 'Corrects "I/you/we/they has" to "have"',
    pattern: /\b(I|you|we|they)\s+has\b/gi,
    message: "Subject-verb disagreement. Use 'have' instead of 'has' with plural subjects.",
    category: 'verb-form',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 80,
    enabled: true,
    replacement: (match: string) => match.replace(/has/i, 'have')
  },

  {
    id: 'verb-form-have-has-singular',
    name: 'Have/Has with Singular Subjects',
    description: 'Corrects "he/she/it have" to "has"',
    pattern: /\b(he|she|it)\s+have\b/gi,
    message: "Subject-verb disagreement. Use 'has' instead of 'have' with singular subjects.",
    category: 'verb-form',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 80,
    enabled: true,
    replacement: (match: string) => match.replace(/have/i, 'has')
  },

  {
    id: 'verb-form-go-goes-plural',
    name: 'Go/Goes with Plural Subjects',
    description: 'Corrects "I/you/we/they goes" to "go"',
    pattern: /\b(I|you|we|they)\s+goes\b/gi,
    message: "Subject-verb disagreement. Use 'go' instead of 'goes' with plural subjects.",
    category: 'verb-form',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 80,
    enabled: true,
    replacement: (match: string) => match.replace(/goes/i, 'go')
  },

  {
    id: 'verb-form-goes-go-singular',
    name: 'Goes/Go with Singular Subjects',
    description: 'Corrects "he/she/it go" to "goes"',
    pattern: /\b(he|she|it)\s+go\b/gi,
    message: "Subject-verb disagreement. Use 'goes' instead of 'go' with singular subjects.",
    category: 'verb-form',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 80,
    enabled: true,
    replacement: (match: string) => match.replace(/go/i, 'goes')
  },

  // ADJECTIVE/ADVERB RULES
  {
    id: 'adjective-adverb-confusion',
    name: 'Adjective/Adverb Confusion',
    description: 'Corrects "runs good" to "runs well"',
    pattern: /\b(runs?|walks?|works?|plays?|moves?)\s+(good|bad|quick|slow)\b/gi,
    message: "Use an adverb to describe how an action is performed. Most adverbs end in '-ly'.",
    category: 'adjective-adverb',
    severity: 'medium',
    type: 'grammar',
    version: '1.0.0',
    priority: 70,
    enabled: true,
    replacement: (match: string) => {
      const parts = match.split(/\s+/)
      const verb = parts[0]
      const adjective = parts[1].toLowerCase()
      
      const adverbMap: { [key: string]: string } = {
        'good': 'well',
        'bad': 'badly',
        'quick': 'quickly',
        'slow': 'slowly'
      }
      
      const adverb = adverbMap[adjective] || adjective + 'ly'
      return `${verb} ${adverb}`
    }
  },

  // ARTICLE USAGE RULES
  {
    id: 'missing-article-singular-noun',
    name: 'Missing Article Before Singular Noun',
    description: 'Detects missing articles like "I want bottle" → "I want a bottle"',
    pattern: /\b(I|you|we|they|he|she|it)\s+(want|need|have|see|buy|get|take|find|like|love|hate|prefer|choose|pick|grab|hold|carry|bring|give|show|use|eat|drink|wear|own|lose|break|fix|make|build|create|design|paint|draw|write|read|watch|play|hear|listen|smell|taste|feel|touch|know|understand|remember|forget|learn|teach|study|practice|try|attempt|start|begin|finish|complete|stop|continue|avoid|prevent|cause|create|destroy|damage|repair|clean|wash|organize|arrange|move|place|put|set|leave|keep|store|save|throw|drop|catch|hit|kick|push|pull|lift|carry|drag|slide|roll|spin|turn|twist|bend|fold|cut|slice|chop)\s+(bottle|book|car|house|phone|computer|chair|table|pen|pencil|paper|bag|box|cup|glass|plate|bowl|knife|fork|spoon|shirt|dress|shoe|hat|coat|jacket|watch|ring|necklace|bracelet|key|door|window|lamp|mirror|picture|photo|flower|tree|plant|animal|dog|cat|bird|fish|horse|cow|pig|sheep|chicken|apple|banana|orange|lemon|tomato|potato|carrot|onion|bread|cake|cookie|sandwich|pizza|burger|salad|soup|coffee|tea|water|juice|milk|beer|wine|song|movie|game|sport|job|work|school|college|university|hospital|restaurant|store|shop|bank|library|museum|park|beach|mountain|river|lake|ocean|city|town|village|street|road|bridge|building|office|room|kitchen|bathroom|bedroom|garden|yard|garage|basement|attic|roof|wall|floor|ceiling|stairs|elevator|bus|train|plane|boat|ship|truck|bike|motorcycle|radio|television|camera|clock|calendar|magazine|newspaper|letter|email|message|website|internet|laptop|tablet|smartphone)\b(?!\w)/gi,
    message: "Singular countable nouns usually need an article ('a', 'an', or 'the').",
    category: 'article-usage',
    severity: 'medium',
    type: 'grammar',
    version: '1.0.0',
    priority: 60,
    enabled: true,
    replacement: (match: string) => {
      const parts = match.trim().split(/\s+/)
      const subject = parts[0]
      const verb = parts[1]
      const noun = parts[2]
      
      const startsWithVowelSound = /^[aeiou]/i.test(noun)
      const article = startsWithVowelSound ? 'an' : 'a'
      
      return `${subject} ${verb} ${article} ${noun}`
    }
  },

  // PRONOUN RULES
  {
    id: 'pronoun-me-subject',
    name: 'Me as Subject Pronoun',
    description: 'Corrects "Me want" to "I want"',
    pattern: /\bMe\s+(want|need|have|like|love|hate|see|know|think|believe|feel|understand|remember|forget|hope|wish|prefer|choose|decide|plan|try|attempt|start|begin|finish|complete|stop|continue|work|study|learn|teach|read|write|speak|talk|say|tell|ask|answer|help|support|encourage|celebrate|enjoy|play|sing|dance|cook|eat|drink|sleep|wake|rest|relax|exercise|run|walk|jump|swim|fly|drive|ride|travel|go|come|stay|leave|arrive|depart|return|visit|meet|greet|welcome|invite|join|participate|compete|win|lose|succeed|fail|achieve|accomplish|create|make|build|design|paint|draw|fix|repair|clean|wash|organize|arrange|buy|sell|pay|spend|save|earn|invest|donate|give|receive|take|get|obtain|acquire|find|search|look|watch|listen|hear|smell|taste|touch|feel|hold|carry|lift|push|pull|throw|catch|hit|kick|open|close|lock|unlock|turn|move|place|put|set|remove|delete|add|include|exclude|choose|select|pick|grab|release|drop|fall|rise|climb|descend|enter|exit|pass|cross|follow|lead|guide|direct|control|manage|operate|use|apply|install|remove|replace|change|modify|adjust|improve|enhance|develop|grow|expand|increase|decrease|reduce|minimize|maximize|optimize|solve|resolve|address|handle|deal|cope|struggle|fight|defend|protect|attack|destroy|damage|harm|hurt|heal|cure|treat|diagnose|prevent|avoid|escape|hide|reveal|show|display|demonstrate|prove|confirm|verify|check|test|examine|inspect|investigate|research|study|analyze|evaluate|assess|judge|rate|rank|compare|contrast|distinguish|identify|recognize|realize|discover|explore|experiment|innovate|invent|create)\b/gi,
    message: "Use 'I' instead of 'Me' as the subject of a sentence.",
    category: 'pronoun-agreement',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 85,
    enabled: true,
    replacement: (match: string) => match.replace(/^Me\b/i, 'I')
  },

  // MODAL VERB RULES
  {
    id: 'modal-verb-of-have',
    name: 'Modal Verb + Of → Have',
    description: 'Corrects "should of" to "should have"',
    pattern: /\b(should|would|could|might|must|can|will|shall)\s+of\b/gi,
    message: "Use 'have' instead of 'of' after modal verbs.",
    category: 'verb-form',
    severity: 'high',
    type: 'grammar',
    version: '1.0.0',
    priority: 75,
    enabled: true,
    replacement: (match: string) => match.replace(/\s+of/i, ' have')
  },

  // DOUBLE NEGATIVE RULES
  {
    id: 'double-negative',
    name: 'Double Negative',
    description: 'Corrects double negatives like "don\'t have no"',
    pattern: /\b(don't|doesn't|didn't|won't|wouldn't|shouldn't|couldn't|can't|mustn't)\s+\w*\s+(no|nobody|nothing|nowhere|never|none)\b/gi,
    message: "Avoid double negatives. Use either the negative verb or the negative word, not both.",
    category: 'double-negative',
    severity: 'medium',
    type: 'grammar',
    version: '1.0.0',
    priority: 65,
    enabled: true,
    replacement: (match: string) => {
      return match.replace(/(don't|doesn't|didn't|won't|wouldn't|shouldn't|couldn't|can't|mustn't)/i, (neg) => {
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
    }
  }
]

// Export rules by category for easy filtering
export const getRulesByCategory = (category: string): GrammarRule[] => {
  return GRAMMAR_RULES.filter(rule => rule.category === category && rule.enabled)
}

// Export rules by priority
export const getRulesByPriority = (minPriority: number = 0): GrammarRule[] => {
  return GRAMMAR_RULES
    .filter(rule => rule.priority >= minPriority && rule.enabled)
    .sort((a, b) => b.priority - a.priority)
}

// Export active rules
export const getActiveRules = (): GrammarRule[] => {
  return GRAMMAR_RULES.filter(rule => rule.enabled)
} 