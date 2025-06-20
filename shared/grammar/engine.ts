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
    matchText: string
  ): number {
    if (!rule.qualityFactors || rule.qualityFactors.length === 0) {
      return rule.baseQualityScore || 80 // Default score if no factors
    }
    
    let totalScore = 0
    let totalWeight = 0
    
    for (const factor of rule.qualityFactors) {
      const score = factor.calculator(context, matchText)
      totalScore += score * factor.weight
      totalWeight += factor.weight
    }
    
    const weightedAverage = totalWeight > 0 ? totalScore / totalWeight : 0
    
    // Combine with base score
    const finalScore = (rule.baseQualityScore || 80) * 0.5 + weightedAverage * 0.5
    
    return Math.min(100, Math.max(0, finalScore))
  }

  /**
   * Provides a structured analysis of a suggestion's impact on the text.
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
    // Default impact based on rule severity and type
    const correctness = rule.severity === 'critical' ? 'fixes' : 'improves'
    let clarity: 'improves' | 'neutral' | 'degrades' = 'neutral'
    let readability: 'improves' | 'neutral' | 'degrades' = 'neutral'
    
    if (rule.category.includes('clarity') || rule.category.includes('conciseness')) {
      clarity = 'improves'
    }
    if (rule.category.includes('readability') || rule.category.includes('sentence-structure')) {
      readability = 'improves'
    }

    return {
      correctness,
      clarity,
      readability,
      engagement: 'neutral', // Requires deeper semantic analysis
      formality: 'neutral' // Requires deeper stylistic analysis
    }
  }

  /**
   * Sorts suggestions based on configured priority
   */
  private sortSuggestions(
    suggestions: GrammarSuggestion[],
    config: RuleEngineConfig
  ): GrammarSuggestion[] {
    return suggestions.sort((a, b) => {
      // Primary sort: priority
      const priorityDiff = (b.rulePriority || 0) - (a.rulePriority || 0)
      if (priorityDiff !== 0) return priorityDiff
      
      // Secondary sort: quality/confidence
      const qualityDiff = b.confidence - a.confidence
      if (qualityDiff !== 0) return qualityDiff
      
      // Tertiary sort: impact score
      if (config.prioritizeByImpact) {
        const impactScoreA = this.calculateImpactScore(a.impactAnalysis)
        const impactScoreB = this.calculateImpactScore(b.impactAnalysis)
        const impactDiff = impactScoreB - impactScoreA
        if (impactDiff !== 0) return impactDiff
      }
      
      // Final sort: position in text
      return a.offset - b.offset
    })
  }
  
  private calculateImpactScore(impact?: {
    correctness: 'fixes' | 'improves' | 'neutral'
    clarity: 'improves' | 'neutral' | 'degrades'
    readability: 'improves' | 'neutral' | 'degrades'
    engagement: 'improves' | 'neutral' | 'degrades'
    formality: 'increases' | 'neutral' | 'decreases'
  }): number {
    if (!impact) return 0
    let score = 0
    
    // Define weights for each impact category
    const weights = {
      correctness: { fixes: 5, improves: 3, neutral: 0 },
      clarity: { improves: 2, neutral: 0, degrades: -2 },
      readability: { improves: 2, neutral: 0, degrades: -2 },
      engagement: { improves: 1, neutral: 0, degrades: -1 },
      formality: { increases: 1, neutral: 0, decreases: -1 }
    }
    
    score += weights.correctness[impact.correctness] || 0
    score += weights.clarity[impact.clarity] || 0
    score += weights.readability[impact.readability] || 0
    score += weights.engagement[impact.engagement] || 0
    score += weights.formality[impact.formality] || 0
    
    return score
  }

  private calculateQualityStats(suggestions: GrammarSuggestion[]) {
    if (suggestions.length === 0) {
      return {
        averageConfidence: 0,
        confidenceDistribution: {},
        topProblematicRules: []
      }
    }
    
    const avgConfidence = suggestions.reduce((acc, s) => acc + s.confidence, 0) / suggestions.length
    
    const confidenceDist = suggestions.reduce((acc, s) => {
      const bucket = Math.floor(s.confidence / 10) * 10
      acc[bucket] = (acc[bucket] || 0) + 1
      return acc
    }, {} as Record<number, number>)
    
    const ruleCounts = suggestions.reduce((acc, s) => {
      acc[s.ruleId] = (acc[s.ruleId] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const topRules = Object.entries(ruleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ruleId, count]) => ({ ruleId, count }))
      
    return {
      averageConfidence: Math.round(avgConfidence),
      confidenceDistribution: confidenceDist,
      topProblematicRules: topRules
    }
  }

  private getRelevantRules(config: RuleEngineConfig): GrammarRule[] {
    let rules = getActiveRules()

    if (config.enabledCategories && config.enabledCategories.length > 0) {
      const categorySet = new Set(config.enabledCategories)
      rules = rules.filter(rule => categorySet.has(rule.category))
    }
    
    if (config.enableAdvancedRules) {
      // Logic to potentially add more complex or experimental rules
      // For now, this just returns all active rules
    }
    
    if (config.prioritizeByImpact) {
      return getRulesByPriority().filter(rule => rules.includes(rule))
    }
    
    return rules
  }

  private generateCacheKey(text: string, config: RuleEngineConfig): string {
    const configString = JSON.stringify(Object.entries(config).sort())
    // Basic hash function (not for crypto, just for cache keys)
    const hash = text.split('').reduce((acc, char) => {
      acc = ((acc << 5) - acc) + char.charCodeAt(0)
      return acc & acc
    }, 0)
    
    return `${hash}-${text.length}-${configString}`
  }

  getPerformanceStats() {
    return {
      ...this.performanceStats,
      averageExecutionTime: this.performanceStats.totalChecks > 0 
        ? this.performanceStats.totalExecutionTime / this.performanceStats.totalChecks
        : 0,
      rulePerformance: Array.from(this.performanceStats.rulePerfStats.entries()).map(([id, stats]) => ({
        id,
        ...stats,
        averageTime: stats.calls > 0 ? stats.totalTime / stats.calls : 0
      })).sort((a, b) => b.totalTime - a.totalTime)
    }
  }

  clearCache() {
    this.cache.clear()
    console.log('🧹 Grammar Engine: Cache cleared')
  }

  getEngineInfo() {
    return {
      version: this.version,
      config: this.config,
      totalRulesAvailable: GRAMMAR_RULES.length,
      activeCategories: this.config.enabledCategories
    }
  }
}

/**
 * Factory function to create a new instance of the grammar engine.
 * @param config - Initial configuration for the engine.
 * @returns A new GrammarRuleEngine instance.
 */
export function createGrammarEngine(config?: Partial<RuleEngineConfig>): GrammarRuleEngine {
  return new GrammarRuleEngine(config)
}
