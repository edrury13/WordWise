export interface GrammarRule {
  id: string
  name: string
  description: string
  pattern: RegExp
  message: string
  category: GrammarCategory
  severity: SuggestionSeverity
  type: SuggestionType
  version: string
  priority: number
  enabled: boolean
  replacement: (match: string, groups?: string[]) => string | string[]
  conditions?: RuleCondition[]
}

export interface RuleCondition {
  type: 'context' | 'position' | 'length' | 'language'
  check: (text: string, match: RegExpMatchArray, context: RuleContext) => boolean
}

export interface RuleContext {
  fullText: string
  sentenceIndex?: number
  wordCount: number
  language: string
  documentType?: 'formal' | 'casual' | 'technical' | 'creative'
}

export interface GrammarSuggestion {
  id: string
  ruleId: string
  type: SuggestionType
  message: string
  replacements: string[]
  offset: number
  length: number
  context: string
  explanation: string
  category: string
  severity: SuggestionSeverity
  confidence: number
  source: 'client' | 'api' | 'hybrid'
}

export type SuggestionType = 'grammar' | 'spelling' | 'style' | 'clarity' | 'engagement' | 'delivery'
export type SuggestionSeverity = 'low' | 'medium' | 'high'
export type GrammarCategory = 
  | 'subject-verb-agreement'
  | 'incomplete-sentence'
  | 'verb-form'
  | 'pronoun-agreement'
  | 'article-usage'
  | 'adjective-adverb'
  | 'contractions'
  | 'double-negative'
  | 'sentence-structure'
  | 'punctuation'
  | 'capitalization'
  | 'word-choice'

export interface RuleEngineConfig {
  enabledCategories: GrammarCategory[]
  minConfidence: number
  maxSuggestions: number
  language: string
  documentType?: 'formal' | 'casual' | 'technical' | 'creative'
  userLevel?: 'beginner' | 'intermediate' | 'advanced'
}

export interface RuleEngineResult {
  suggestions: GrammarSuggestion[]
  stats: {
    rulesChecked: number
    suggestionsFound: number
    executionTime: number
  }
  metadata: {
    version: string
    source: 'client' | 'api' | 'hybrid'
    language: string
  }
} 