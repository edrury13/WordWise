import { 
  GrammarRule, 
  GrammarSuggestion, 
  RuleEngineConfig, 
  RuleEngineResult, 
  RuleContext 
} from './types'
import { GRAMMAR_RULES, getActiveRules } from './rules'

export class GrammarRuleEngine {
  private version = '1.0.0'
  private config: RuleEngineConfig

  constructor(config: Partial<RuleEngineConfig> = {}) {
    this.config = {
      enabledCategories: [
        'subject-verb-agreement',
        'incomplete-sentence', 
        'verb-form',
        'adjective-adverb',
        'contractions',
        'article-usage',
        'pronoun-agreement'
      ],
      minConfidence: 70,
      maxSuggestions: 50,
      language: 'en-US',
      ...config
    }
  }

  /**
   * Main method to check text for grammar issues
   */
  async checkText(text: string, options: Partial<RuleEngineConfig> = {}): Promise<RuleEngineResult> {
    const startTime = Date.now()
    
    // Merge options with default config
    const mergedConfig = { ...this.config, ...options }
    
    // Create rule context
    const context: RuleContext = {
      fullText: text,
      wordCount: text.split(/\s+/).length,
      language: mergedConfig.language,
      documentType: mergedConfig.documentType
    }

    // Get applicable rules
    const applicableRules = this.getApplicableRules(mergedConfig)
    
    // Process rules and generate suggestions
    const suggestions: GrammarSuggestion[] = []
    let rulesChecked = 0

    for (const rule of applicableRules) {
      try {
        const ruleSuggestions = await this.processRule(rule, text, context)
        suggestions.push(...ruleSuggestions)
        rulesChecked++
      } catch (error) {
        console.warn(`Error processing rule ${rule.id}:`, error)
      }
    }

    // Sort suggestions by priority and confidence
    suggestions.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 }
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
      if (severityDiff !== 0) return severityDiff
      return b.confidence - a.confidence
    })

    // Limit and filter suggestions
    const filteredSuggestions = suggestions
      .slice(0, mergedConfig.maxSuggestions)
      .filter(s => s.confidence >= mergedConfig.minConfidence)

    const executionTime = Date.now() - startTime

    const result: RuleEngineResult = {
      suggestions: filteredSuggestions,
      stats: {
        rulesChecked,
        suggestionsFound: filteredSuggestions.length,
        executionTime
      },
      metadata: {
        version: this.version,
        source: 'client',
        language: mergedConfig.language
      }
    }
    
    return result
  }

  /**
   * Process a single rule against text
   */
  private async processRule(
    rule: GrammarRule,
    text: string,
    context: RuleContext
  ): Promise<GrammarSuggestion[]> {
    const suggestions: GrammarSuggestion[] = []

    try {
      let match: RegExpMatchArray | null
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags)
      
      while ((match = regex.exec(text)) !== null) {
        const matchText = match[0]
        const matchOffset = match.index ?? 0

        // Generate replacements
        let replacements: string[]
        try {
          const replacement = rule.replacement(matchText, match.slice(1))
          replacements = Array.isArray(replacement) ? replacement : [replacement]
        } catch (error) {
          console.warn(`Error generating replacement for rule ${rule.id}:`, error)
          continue
        }

        // Calculate confidence
        const confidence = this.calculateConfidence(rule, matchText, context)

        // Create suggestion
        const suggestion: GrammarSuggestion = {
          id: `${rule.id}-${matchOffset}-${Date.now()}`,
          ruleId: rule.id,
          type: rule.type,
          message: rule.message,
          replacements,
          offset: matchOffset,
          length: matchText.length,
          context: this.getContextSnippet(text, matchOffset, matchText.length),
          explanation: rule.description || rule.message,
          category: rule.category,
          severity: rule.severity,
          confidence,
          source: 'client'
        }

        suggestions.push(suggestion)

        if (!rule.pattern.global) break
      }
    } catch (error) {
      console.error(`Error processing rule ${rule.id}:`, error)
    }

    return suggestions
  }

  /**
   * Calculate confidence score for a suggestion
   */
  private calculateConfidence(
    rule: GrammarRule,
    matchText: string,
    context: RuleContext
  ): number {
    let baseConfidence = 85
    baseConfidence += (rule.priority - 50) * 0.3
    
    if (matchText.length > 10) baseConfidence += 5
    if (matchText.length < 3) baseConfidence -= 10
    if (context.wordCount < 10) baseConfidence -= 5

    return Math.max(0, Math.min(100, Math.round(baseConfidence)))
  }

  /**
   * Get context snippet around a match
   */
  private getContextSnippet(text: string, offset: number, length: number): string {
    const contextRadius = 30
    const start = Math.max(0, offset - contextRadius)
    const end = Math.min(text.length, offset + length + contextRadius)
    
    let snippet = text.substring(start, end)
    
    if (start > 0) snippet = '...' + snippet
    if (end < text.length) snippet = snippet + '...'
    
    return snippet
  }

  /**
   * Get applicable rules based on configuration
   */
  private getApplicableRules(config: RuleEngineConfig): GrammarRule[] {
    let rules = getActiveRules()

    if (config.enabledCategories.length > 0) {
      rules = rules.filter(rule => config.enabledCategories.includes(rule.category))
    }

    return rules.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Get rule by ID
   */
  public getRuleById(id: string): GrammarRule | undefined {
    return GRAMMAR_RULES.find(rule => rule.id === id)
  }

  /**
   * Enable/disable a rule
   */
  public setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.getRuleById(ruleId)
    if (rule) {
      rule.enabled = enabled
      return true
    }
    return false
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<RuleEngineConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// Export singleton instance for easy use
export const grammarEngine = new GrammarRuleEngine()

// Export factory function for custom configurations
export function createGrammarEngine(config?: Partial<RuleEngineConfig>): GrammarRuleEngine {
  return new GrammarRuleEngine(config)
} 