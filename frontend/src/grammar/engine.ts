import { 
  GrammarRule, 
  GrammarSuggestion, 
  RuleEngineConfig, 
  RuleEngineResult, 
  RuleContext
} from './types'
import { GRAMMAR_RULES, getActiveRules, getRulesByPriority } from './rules'
import { contextValidators } from './enhanced-patterns'

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
        'adjective-adverb-confusion',
        'commonly-confused-words',
        'sentence-fragment',
        'comma-usage',
        'apostrophe-usage',
        'redundancy'
      ],
      minConfidence: 70,
      maxSuggestions: 50,
      language: 'en-US',
      qualityThreshold: 60,
      prioritizeByImpact: true,
      enableAdvancedRules: false,
      ...config
    }
  }

  /**
   * Main method to check text for grammar issues
   */
  async checkText(text: string, config?: Partial<RuleEngineConfig>): Promise<RuleEngineResult> {
    const startTime = Date.now()
    const mergedConfig = { ...this.config, ...config }
    
    console.log('🔍 Grammar Engine: checkText called', {
      textLength: text.length,
      textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      config: mergedConfig
    })
    
    // Check cache first
    const cacheKey = this.generateCacheKey(text, mergedConfig)
    if (this.cache.has(cacheKey)) {
      this.performanceStats.cacheHits++
      console.log('📋 Grammar Engine: Using cached result')
      return this.cache.get(cacheKey)!
    }

    // Get relevant rules
    const rules = this.getRelevantRules(mergedConfig)
    console.log('📋 Grammar Engine: Processing rules', {
      totalRules: rules.length,
      ruleIds: rules.map(r => r.id)
    })
    
    const context: RuleContext = {
      text,
      language: mergedConfig.language,
      documentType: mergedConfig.documentType,
      userLevel: mergedConfig.userLevel
    }

    // Process all rules
    const allSuggestions: GrammarSuggestion[] = []
    const categoryBreakdown: Record<string, number> = {}
    
    for (const rule of rules) {
      const ruleSuggestions = await this.processRule(rule, context)
      allSuggestions.push(...ruleSuggestions)
      
      // Update category breakdown
      if (ruleSuggestions.length > 0) {
        categoryBreakdown[rule.category] = (categoryBreakdown[rule.category] || 0) + ruleSuggestions.length
      }
    }

    // Filter by quality threshold
    const qualityFilteredSuggestions = allSuggestions.filter(
      suggestion => suggestion.confidence >= (mergedConfig.qualityThreshold || 60)
    )

    // Sort suggestions by priority, quality, and impact
    const sortedSuggestions = this.sortSuggestions(qualityFilteredSuggestions, mergedConfig)

    // Limit results
    const finalSuggestions = sortedSuggestions.slice(0, mergedConfig.maxSuggestions)

    // Calculate quality statistics
    const qualityStats = this.calculateQualityStats(finalSuggestions)

    const result: RuleEngineResult = {
      suggestions: finalSuggestions,
      totalRulesProcessed: rules.length,
      executionTime: Date.now() - startTime,
      qualityStats,
      categoryBreakdown: categoryBreakdown as Record<any, number>
    }

    // Cache result
    this.cache.set(cacheKey, result)
    
    // Update performance stats
    this.performanceStats.totalChecks++
    this.performanceStats.totalExecutionTime += result.executionTime

    console.log('✅ Grammar Engine: checkText complete', {
      suggestionsFound: result.suggestions.length,
      executionTime: result.executionTime,
      rulesProcessed: result.totalRulesProcessed,
      categoryBreakdown: result.categoryBreakdown
    })

    return result
  }

  /**
   * Process a single rule against text with enhanced quality scoring
   */
  private async processRule(
    rule: GrammarRule,
    context: RuleContext
  ): Promise<GrammarSuggestion[]> {
    const suggestions: GrammarSuggestion[] = []
    let match: RegExpExecArray | null
    
    // Reset regex state
    rule.pattern.lastIndex = 0
    
    while ((match = rule.pattern.exec(context.text)) !== null) {
      const matchText = match[0]
      const offset = match.index ?? 0 // Handle undefined case with nullish coalescing
      
      // Enhanced context for this specific match
      const matchContext: RuleContext = {
        ...context,
        precedingText: context.text.substring(Math.max(0, offset - 50), offset),
        followingText: context.text.substring(offset + matchText.length, Math.min(context.text.length, offset + matchText.length + 50))
      }
      
      // Calculate quality score using enhanced factors
      const qualityScore = this.calculateQualityScore(rule, matchContext, matchText)
      
      // Apply quality threshold with rule-specific adjustments
      const effectiveThreshold = (this.config.qualityThreshold || 60) * (rule.priority / 100)
      if (qualityScore < effectiveThreshold) {
        console.log(`🔍 Grammar Engine: Rule ${rule.id} suggestion below threshold`, {
          quality: qualityScore,
          threshold: effectiveThreshold,
          match: matchText.substring(0, 30) + (matchText.length > 30 ? '...' : '')
        })
        continue
      }
      
      // Generate replacements using the rule's replacement function
      let replacements: string[] = []
      if (rule.replacement) {
        try {
          const replacement = rule.replacement(matchText, match.slice(1))
          if (replacement && replacement !== matchText) {
            replacements = Array.isArray(replacement) ? replacement : [replacement]
          }
        } catch (error) {
          console.warn(`⚠️ Grammar Engine: Error generating replacement for rule ${rule.id}:`, error)
        }
      }
      
      // Enhanced validation of replacements
      if (replacements.length > 0) {
        replacements = replacements.filter(replacement => {
          // Basic validation
          if (!contextValidators.validateSentenceStructure(context.text, replacement, offset, matchText.length)) {
            return false
          }
          
          // Tense consistency validation
          if (!contextValidators.validateTenseConsistency(matchContext, replacement)) {
            return false
          }
          
          return true
        })
      }
      
      // Skip if no valid replacements
      if (replacements.length === 0) {
        console.log(`🔍 Grammar Engine: No valid replacements for rule ${rule.id}`, {
          match: matchText.substring(0, 30) + (matchText.length > 30 ? '...' : '')
        })
        continue
      }
      
      // Create suggestion with enhanced metadata
      const suggestion: GrammarSuggestion = {
        id: `${rule.id}-${offset}-${Date.now()}`,
        type: rule.type,
        message: rule.message,
        replacements: replacements.slice(0, 3), // Limit to top 3 replacements
        offset,
        length: matchText.length,
        context: matchText,
        explanation: rule.examples?.[0]?.explanation || rule.message,
        category: rule.category,
        subcategory: rule.subcategory,
        severity: rule.severity,
        confidence: Math.round(qualityScore),
        ruleId: rule.id,
        rulePriority: rule.priority,
        qualityFactors: rule.qualityFactors?.map(factor => ({
          name: factor.name,
          score: Math.round(factor.calculator(matchContext, matchText)),
          weight: factor.weight
        })) || [],
        impactAnalysis: this.analyzeImpact(rule, matchText, replacements[0]),
        tags: rule.tags || []
      }
      
      suggestions.push(suggestion)
      
      // Prevent infinite loops for global patterns
      if (!rule.pattern.global) break
      if (rule.pattern.lastIndex === (match.index ?? 0)) {
        rule.pattern.lastIndex++
      }
    }
    
    return suggestions
  }

  /**
   * Calculate enhanced quality score using multiple factors
   */
  private calculateQualityScore(
    rule: GrammarRule,
    context: RuleContext,
    match: string
  ): number {
    // Base scores
    let accuracy = 75
    let relevance = 70
    let impact = 65
    let confidence = 70

    // Apply quality factors if available
    if (rule.qualityFactors) {
      let totalWeight = 0
      let weightedScore = 0

      for (const factor of rule.qualityFactors) {
        const factorScore = factor.calculator(context, match)
        weightedScore += factorScore * factor.weight
        totalWeight += factor.weight
      }

      if (totalWeight > 0) {
        const averageFactorScore = weightedScore / totalWeight
        // Blend with base scores
        accuracy = (accuracy + averageFactorScore) / 2
        relevance = (relevance + averageFactorScore) / 2
      }
    }

    // Adjust based on rule characteristics
    if (rule.severity === 'critical') impact += 15
    else if (rule.severity === 'high') impact += 10
    else if (rule.severity === 'medium') impact += 5

    if (rule.priority > 80) confidence += 10
    else if (rule.priority > 60) confidence += 5

    // Adjust based on replacement quality
    if (match.length === 1 && match.length > 0) {
      accuracy += 5
    } else if (match.length > 3) {
      accuracy -= 5 // Too many options might indicate uncertainty
    }

    // Adjust based on context quality
    if (context.precedingText && context.followingText) {
      relevance += 10
    }

    // Ensure scores are within bounds
    accuracy = Math.max(0, Math.min(100, accuracy))
    relevance = Math.max(0, Math.min(100, relevance))
    impact = Math.max(0, Math.min(100, impact))
    confidence = Math.max(0, Math.min(100, confidence))

    const overall = (accuracy * 0.3 + relevance * 0.25 + impact * 0.25 + confidence * 0.2)

    return Math.round(overall)
  }

  /**
   * Calculate suggestion impact on different aspects of writing
   */
  private analyzeImpact(
    rule: GrammarRule,
    _original: string,
    _replacement: string
  ): {
    correctness: 'fixes' | 'improves' | 'neutral'
    clarity: 'improves' | 'neutral' | 'degrades'
    readability: 'improves' | 'neutral' | 'degrades'
    engagement: 'improves' | 'neutral' | 'degrades'
    formality: 'increases' | 'neutral' | 'decreases'
  } {
    const impact = {
      correctness: 'neutral' as 'fixes' | 'improves' | 'neutral',
      clarity: 'neutral' as 'improves' | 'neutral' | 'degrades',
      readability: 'neutral' as 'improves' | 'neutral' | 'degrades',
      engagement: 'neutral' as 'improves' | 'neutral' | 'degrades',
      formality: 'neutral' as 'increases' | 'neutral' | 'decreases'
    }
    
    // Analyze based on rule category and severity
    switch (rule.category) {
      case 'subject-verb-agreement':
      case 'commonly-confused-words':
        impact.correctness = 'fixes'
        impact.clarity = 'improves'
        break
        
      case 'incomplete-sentence':
        impact.correctness = 'fixes'
        impact.clarity = 'improves'
        impact.readability = 'improves'
        break
        
      case 'redundancy':
      case 'wordiness':
        impact.clarity = 'improves'
        impact.readability = 'improves'
        impact.engagement = 'improves'
        break
    }
    
    // Adjust based on severity
    if (rule.severity === 'critical' || rule.severity === 'high') {
      impact.correctness = 'fixes'
    }
    
    return impact
  }

  /**
   * Sort suggestions by priority, quality, and impact
   */
  private sortSuggestions(
    suggestions: GrammarSuggestion[],
    config: RuleEngineConfig
  ): GrammarSuggestion[] {
    return suggestions.sort((a, b) => {
      // Primary sort: severity (critical > high > medium > low > suggestion)
      const severityOrder = { 'critical': 5, 'high': 4, 'medium': 3, 'low': 2, 'suggestion': 1 }
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
      if (severityDiff !== 0) return severityDiff

      // Secondary sort: quality score
      const qualityDiff = b.confidence - a.confidence
      if (qualityDiff !== 0) return qualityDiff

      // Final sort: impact priority (correctness fixes first)
      if (config.prioritizeByImpact) {
        const aImpactScore = this.calculateImpactScore(a.impactAnalysis)
        const bImpactScore = this.calculateImpactScore(b.impactAnalysis)
        return bImpactScore - aImpactScore
      }

      return 0
    })
  }

  /**
   * Calculate numerical impact score for sorting
   */
  private calculateImpactScore(impact?: {
    correctness: 'fixes' | 'improves' | 'neutral'
    clarity: 'improves' | 'neutral' | 'degrades'
    readability: 'improves' | 'neutral' | 'degrades'
    engagement: 'improves' | 'neutral' | 'degrades'
    formality: 'increases' | 'neutral' | 'decreases'
  }): number {
    if (!impact) return 0
    
    let score = 0
    
    // Correctness fixes are highest priority
    if (impact.correctness === 'fixes') score += 50
    else if (impact.correctness === 'improves') score += 30
    
    // Clarity improvements
    if (impact.clarity === 'improves') score += 20
    else if (impact.clarity === 'degrades') score -= 10
    
    // Readability improvements
    if (impact.readability === 'improves') score += 15
    else if (impact.readability === 'degrades') score -= 8
    
    // Engagement improvements
    if (impact.engagement === 'improves') score += 10
    else if (impact.engagement === 'degrades') score -= 5
    
    // Formality changes (neutral impact on priority)
    if (impact.formality === 'increases') score += 5
    else if (impact.formality === 'decreases') score += 5
    
    return score
  }

  /**
   * Calculate quality statistics for the result
   */
  private calculateQualityStats(suggestions: GrammarSuggestion[]) {
    if (suggestions.length === 0) {
      return {
        averageQuality: 0,
        highQualitySuggestions: 0,
        mediumQualitySuggestions: 0,
        lowQualitySuggestions: 0
      }
    }

    const totalQuality = suggestions.reduce((sum, s) => sum + s.confidence, 0)
    const averageQuality = Math.round(totalQuality / suggestions.length)

    const highQuality = suggestions.filter(s => s.confidence >= 80).length
    const mediumQuality = suggestions.filter(s => s.confidence >= 60 && s.confidence < 80).length
    const lowQuality = suggestions.filter(s => s.confidence < 60).length

    return {
      averageQuality,
      highQualitySuggestions: highQuality,
      mediumQualitySuggestions: mediumQuality,
      lowQualitySuggestions: lowQuality
    }
  }

  /**
   * Get relevant rules based on configuration
   */
  private getRelevantRules(config: RuleEngineConfig): GrammarRule[] {
    let rules = getActiveRules()

    // Filter by enabled categories
    if (config.enabledCategories.length > 0) {
      rules = rules.filter(rule => config.enabledCategories.includes(rule.category))
    }

    // Filter by user level (exclude advanced rules for beginners)
    if (config.userLevel === 'beginner' && !config.enableAdvancedRules) {
      rules = rules.filter(rule => !rule.tags?.includes('advanced-grammar'))
    }

    // Filter by document type
    if (config.documentType) {
      // Include rules that are general or match the document type
      rules = rules.filter(rule => 
        !rule.tags?.some(tag => tag.includes('formal-writing') || tag.includes('casual-writing')) ||
        rule.tags?.includes(`${config.documentType}-writing`)
      )
    }

    return getRulesByPriority(0).filter(rule => rules.includes(rule))
  }

  /**
   * Generate cache key for memoization
   */
  private generateCacheKey(text: string, config: RuleEngineConfig): string {
    const configStr = JSON.stringify({
      categories: config.enabledCategories.sort(),
      minConfidence: config.minConfidence,
      maxSuggestions: config.maxSuggestions,
      language: config.language,
      documentType: config.documentType,
      userLevel: config.userLevel,
      qualityThreshold: config.qualityThreshold,
      prioritizeByImpact: config.prioritizeByImpact,
      enableAdvancedRules: config.enableAdvancedRules
    })
    return `${text.substring(0, 100)}-${btoa(configStr)}`
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
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
  clearCache() {
    this.cache.clear()
  }

  /**
   * Get engine information
   */
  getEngineInfo() {
    return {
      version: this.version,
      totalRules: GRAMMAR_RULES.length,
      enabledRules: getActiveRules().length,
      supportedCategories: [...new Set(GRAMMAR_RULES.map(r => r.category))],
      supportedTypes: [...new Set(GRAMMAR_RULES.map(r => r.type))],
      config: this.config
    }
  }
}

// Export singleton instance for easy use
export const grammarEngine = new GrammarRuleEngine()

// Export factory function for custom configurations
export function createGrammarEngine(config?: Partial<RuleEngineConfig>): GrammarRuleEngine {
  return new GrammarRuleEngine(config)
} 