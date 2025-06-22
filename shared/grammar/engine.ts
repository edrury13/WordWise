import { 
  GrammarRule, 
  GrammarSuggestion, 
  RuleEngineConfig, 
  RuleEngineResult, 
  RuleContext
} from './types'
import { GRAMMAR_RULES, getActiveRules, getRulesByCategory } from './rules'

export class GrammarRuleEngine {
  private version = '1.0.0'
  private config: RuleEngineConfig
  private cache: Map<string, RuleEngineResult> = new Map()
  private performanceStats = {
    totalChecks: 0,
    totalExecutionTime: 0,
    cacheHits: 0,
    rulePerfStats: new Map<string, { calls: number, totalTime: number }>()
  }

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
    this.performanceStats.totalChecks++

    // Merge options with default config
    const mergedConfig = { ...this.config, ...options }
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(text, mergedConfig)
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      this.performanceStats.cacheHits++
      return this.cache.get(cacheKey)!
    }

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
      // First by severity (high > medium > low)
      const severityOrder = { high: 3, medium: 2, low: 1 }
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
      if (severityDiff !== 0) return severityDiff
      
      // Then by confidence
      return b.confidence - a.confidence
    })

    // Limit suggestions
    const limitedSuggestions = suggestions.slice(0, mergedConfig.maxSuggestions)

    // Filter by minimum confidence
    const filteredSuggestions = limitedSuggestions.filter(
      s => s.confidence >= mergedConfig.minConfidence
    )

    const endTime = Date.now()
    const executionTime = endTime - startTime
    this.performanceStats.totalExecutionTime += executionTime

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

    // Cache result
    this.cache.set(cacheKey, result)
    
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
    const startTime = Date.now()
    const suggestions: GrammarSuggestion[] = []

    try {
      // Track performance for this rule
      if (!this.performanceStats.rulePerfStats.has(rule.id)) {
        this.performanceStats.rulePerfStats.set(rule.id, { calls: 0, totalTime: 0 })
      }
      const ruleStats = this.performanceStats.rulePerfStats.get(rule.id)!
      ruleStats.calls++

      let match: RegExpMatchArray | null
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags)
      
      while ((match = regex.exec(text)) !== null) {
        // Check rule conditions if any
        if (rule.conditions && !this.checkRuleConditions(rule, text, match, context)) {
          continue
        }

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

        // Calculate confidence based on rule priority and other factors
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

        // Prevent infinite loops with global regex
        if (!rule.pattern.global) break
      }

      const endTime = Date.now()
      ruleStats.totalTime += endTime - startTime

    } catch (error) {
      console.error(`Error processing rule ${rule.id}:`, error)
    }

    return suggestions
  }

  /**
   * Check if rule conditions are met
   */
  private checkRuleConditions(
    rule: GrammarRule,
    text: string,
    match: RegExpMatchArray,
    context: RuleContext
  ): boolean {
    if (!rule.conditions) return true

    return rule.conditions.every(condition => {
      try {
        return condition.check(text, match, context)
      } catch (error) {
        console.warn(`Error checking condition for rule ${rule.id}:`, error)
        return false
      }
    })
  }

  /**
   * Calculate confidence score for a suggestion
   */
  private calculateConfidence(
    rule: GrammarRule,
    matchText: string,
    context: RuleContext
  ): number {
    let baseConfidence = 85 // Base confidence

    // Adjust based on rule priority
    baseConfidence += (rule.priority - 50) * 0.3

    // Adjust based on match length (longer matches often more reliable)
    if (matchText.length > 10) baseConfidence += 5
    if (matchText.length < 3) baseConfidence -= 10

    // Adjust based on context
    if (context.wordCount < 10) baseConfidence -= 5 // Very short texts less reliable

    // Ensure confidence is within bounds
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
    
    // Add ellipsis if truncated
    if (start > 0) snippet = '...' + snippet
    if (end < text.length) snippet = snippet + '...'
    
    return snippet
  }

  /**
   * Get applicable rules based on configuration
   */
  private getApplicableRules(config: RuleEngineConfig): GrammarRule[] {
    let rules = getActiveRules()

    // Filter by enabled categories
    if (config.enabledCategories.length > 0) {
      rules = rules.filter(rule => config.enabledCategories.includes(rule.category))
    }

    // Sort by priority
    return rules.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Generate cache key for a text/config combination
   */
  private generateCacheKey(text: string, config: RuleEngineConfig): string {
    const textHash = this.simpleHash(text)
    const configHash = this.simpleHash(JSON.stringify(config))
    return `${textHash}-${configHash}`
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats() {
    return {
      ...this.performanceStats,
      averageExecutionTime: this.performanceStats.totalChecks > 0 
        ? this.performanceStats.totalExecutionTime / this.performanceStats.totalChecks 
        : 0,
      cacheHitRate: this.performanceStats.totalChecks > 0
        ? this.performanceStats.cacheHits / this.performanceStats.totalChecks
        : 0
    }
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear()
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
      this.clearCache() // Clear cache when rules change
      return true
    }
    return false
  }

  /**
   * Get rules by category
   */
  public getRulesByCategory(category: string): GrammarRule[] {
    return getRulesByCategory(category)
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<RuleEngineConfig>): void {
    this.config = { ...this.config, ...config }
    this.clearCache() // Clear cache when config changes
  }
}

// Export singleton instance for easy use
export const grammarEngine = new GrammarRuleEngine()

// Export factory function for custom configurations
export function createGrammarEngine(config?: Partial<RuleEngineConfig>): GrammarRuleEngine {
  return new GrammarRuleEngine(config)
} 