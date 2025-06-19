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