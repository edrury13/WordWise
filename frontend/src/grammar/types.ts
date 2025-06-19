export interface GrammarRule {
  id: string
  name: string
  description: string
  pattern: RegExp
  message: string
  category: GrammarCategory
  subcategory?: string
  severity: SuggestionSeverity
  type: SuggestionType
  version: string
  priority: number
  enabled: boolean
  replacement: (match: string, groups?: string[]) => string | string[]
  conditions?: RuleCondition[]
  qualityFactors?: QualityFactor[]
  tags?: string[]
  examples?: {
    incorrect: string
    correct: string
    explanation?: string
  }[]
}

export interface RuleCondition {
  type: 'context' | 'position' | 'frequency' | 'document-type' | 'user-level'
  check: (context: RuleContext) => boolean
}

export interface RuleContext {
  text: string
  language: string
  documentType?: DocumentType
  userLevel?: UserLevel
  precedingText?: string
  followingText?: string
  sentenceIndex?: number
  paragraphIndex?: number
}

export interface GrammarSuggestion {
  id: string
  type: SuggestionType
  message: string
  replacements: string[]
  offset: number
  length: number
  context: string
  explanation: string
  category: string
  subcategory?: string
  severity: SuggestionSeverity
  confidence: number
  ruleId: string
  rulePriority?: number
  qualityFactors?: Array<{
    name: string
    score: number
    weight: number
  }>
  impactAnalysis?: {
    correctness: 'fixes' | 'improves' | 'neutral'
    clarity: 'improves' | 'neutral' | 'degrades'
    readability: 'improves' | 'neutral' | 'degrades'
    engagement: 'improves' | 'neutral' | 'degrades'
    formality: 'increases' | 'neutral' | 'decreases'
  }
  tags?: string[]
}

export type SuggestionType = 
  | 'grammar'        // Core grammatical errors
  | 'spelling'       // Misspellings and typos
  | 'style'          // Style and readability improvements
  | 'clarity'        // Clarity and comprehension issues
  | 'engagement'     // Engagement and tone improvements
  | 'delivery'       // Presentation and formatting
  | 'consistency'    // Consistency issues
  | 'conciseness'    // Wordiness and redundancy

export type SuggestionSeverity = 'critical' | 'high' | 'medium' | 'low' | 'suggestion'

export type GrammarCategory = 
  // Core Grammar Categories
  | 'subject-verb-agreement'
  | 'verb-tense-consistency'
  | 'pronoun-agreement'
  | 'article-usage'
  | 'preposition-usage'
  | 'adjective-adverb-confusion'
  | 'incomplete-sentence'
  | 'run-on-sentence'
  | 'sentence-fragment'
  | 'comma-splice'
  | 'dangling-modifier'
  | 'misplaced-modifier'
  | 'parallel-structure'
  | 'conditional-sentences'
  | 'passive-voice-overuse'
  
  // Punctuation & Mechanics
  | 'comma-usage'
  | 'apostrophe-usage'
  | 'quotation-marks'
  | 'semicolon-usage'
  | 'capitalization'
  | 'hyphenation'
  
  // Word Choice & Usage
  | 'commonly-confused-words'
  | 'homophones'
  | 'word-choice'
  | 'redundancy'
  | 'wordiness'
  | 'colloquialisms'
  | 'jargon-usage'
  | 'archaic-language'
  
  // Style & Clarity
  | 'sentence-variety'
  | 'transition-words'
  | 'paragraph-structure'
  | 'tone-consistency'
  | 'formality-level'
  | 'audience-appropriateness'
  
  // Advanced Grammar
  | 'subjunctive-mood'
  | 'gerund-infinitive'
  | 'reported-speech'
  | 'complex-sentence-structure'

export interface QualityScore {
  overall: number           // 0-100 overall quality score
  accuracy: number         // How accurate the suggestion is (0-100)
  relevance: number        // How relevant to the context (0-100)
  impact: number           // How much it improves the text (0-100)
  confidence: number       // How confident we are in the suggestion (0-100)
  userFeedback?: number    // User feedback score if available (0-100)
}

export interface QualityFactor {
  name: string
  weight: number           // 0-1, how much this factor affects quality
  calculator: (context: RuleContext, match: string) => number // 0-100
}

export interface SuggestionImpact {
  readability: 'improves' | 'neutral' | 'degrades'
  clarity: 'improves' | 'neutral' | 'degrades'
  formality: 'increases' | 'neutral' | 'decreases'
  engagement: 'improves' | 'neutral' | 'degrades'
  correctness: 'fixes' | 'improves' | 'neutral'
}

export interface RuleEngineConfig {
  enabledCategories: GrammarCategory[]
  minConfidence: number
  maxSuggestions: number
  language: string
  documentType?: DocumentType
  userLevel?: UserLevel
  qualityThreshold?: number      // Minimum quality score to show suggestion
  prioritizeByImpact?: boolean   // Whether to prioritize by impact
  enableAdvancedRules?: boolean  // Whether to enable advanced grammar rules
}

export interface RuleEngineResult {
  suggestions: GrammarSuggestion[]
  totalRulesProcessed: number
  executionTime: number
  qualityStats: {
    averageQuality: number
    highQualitySuggestions: number
    mediumQualitySuggestions: number
    lowQualitySuggestions: number
  }
  categoryBreakdown: Record<GrammarCategory, number>
}

export type DocumentType = 'formal' | 'casual' | 'technical' | 'creative' | 'academic' | 'business' | 'email'
export type UserLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert'

// Enhanced suggestion metadata for better categorization
export interface SuggestionMetadata {
  ruleFamily: string          // Group of related rules
  linguisticFeature: string   // What linguistic feature this addresses
  difficulty: UserLevel       // Difficulty level of the concept
  frequency: 'common' | 'uncommon' | 'rare'  // How common this error is
  teachingMoment?: string     // Educational explanation
}

// Quality assessment framework
export interface QualityAssessment {
  factors: {
    patternAccuracy: number      // How accurate the regex pattern is
    contextAwareness: number     // How well it considers context
    falsePositiveRate: number    // Estimated false positive rate
    replacementQuality: number   // Quality of suggested replacements
    userAcceptanceRate?: number  // Historical user acceptance rate
  }
  weights: {
    accuracy: number
    relevance: number
    impact: number
    confidence: number
  }
  overallScore: number
} 