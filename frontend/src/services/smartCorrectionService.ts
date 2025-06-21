import { supabase } from '../config/supabase'
import { Suggestion } from '../store/slices/suggestionSlice'

interface UserCorrectionPattern {
  id?: string
  user_id: string
  original_text: string
  corrected_text: string
  suggestion_type: string
  context_before: string
  context_after: string
  document_type?: string
  accepted: boolean
  confidence_gained: number
  created_at?: string
}

interface SmartCorrection {
  suggestion: Suggestion
  confidence: number
  reason: string
  quickAccept: boolean
  learningBased: boolean
}

class SmartCorrectionService {
  private userPatterns: Map<string, UserCorrectionPattern[]> = new Map()
  private commonCorrections: Map<string, string> = new Map()
  private contextualPatterns: Map<string, { correction: string; contexts: string[] }> = new Map()
  private ignoredPatterns: Map<string, Set<string>> = new Map()
  private ignoredContexts: Map<string, Array<{ pattern: string; context: string; count: number }>> = new Map()
  private lastSyncTime: number = 0
  private syncInterval: number = 30000 // 30 seconds
  
  constructor() {
    this.initializeCommonCorrections()
  }

  private initializeCommonCorrections() {
    // Common contractions and corrections
    this.commonCorrections.set("dont", "don't")
    this.commonCorrections.set("doesnt", "doesn't")
    this.commonCorrections.set("wont", "won't")
    this.commonCorrections.set("cant", "can't")
    this.commonCorrections.set("its", "it's") // when used as "it is"
    this.commonCorrections.set("thats", "that's")
    this.commonCorrections.set("whats", "what's")
    this.commonCorrections.set("hes", "he's")
    this.commonCorrections.set("shes", "she's")
    this.commonCorrections.set("theyre", "they're")
    this.commonCorrections.set("were", "we're") // when contextually "we are"
    this.commonCorrections.set("your", "you're") // when contextually "you are"
  }

  /**
   * Record when a user accepts or rejects a suggestion
   */
  async recordUserChoice(
    suggestion: Suggestion,
    accepted: boolean,
    originalText: string,
    correctedText: string,
    documentContent: string
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Extract context around the correction
      const offset = suggestion.offset
      const contextRadius = 50
      const contextBefore = documentContent.substring(
        Math.max(0, offset - contextRadius),
        offset
      ).trim()
      const contextAfter = documentContent.substring(
        offset + suggestion.length,
        Math.min(documentContent.length, offset + suggestion.length + contextRadius)
      ).trim()

      const pattern: UserCorrectionPattern = {
        user_id: user.id,
        original_text: originalText,
        corrected_text: correctedText,
        suggestion_type: suggestion.type,
        context_before: contextBefore,
        context_after: contextAfter,
        document_type: this.detectDocumentType(documentContent),
        accepted,
        confidence_gained: accepted ? 10 : -5, // Gain confidence when accepted, lose when rejected
      }

      // Store locally for immediate use
      const userKey = user.id
      if (!this.userPatterns.has(userKey)) {
        this.userPatterns.set(userKey, [])
      }
      this.userPatterns.get(userKey)!.push(pattern)

      // Store in database (async, don't wait)
      this.storeCorrectionPattern(pattern).catch(console.error)

      // Update contextual patterns if accepted
      if (accepted && originalText.toLowerCase() !== correctedText.toLowerCase()) {
        const contextKey = `${contextBefore}|${originalText.toLowerCase()}|${contextAfter}`
        this.contextualPatterns.set(contextKey, {
          correction: correctedText,
          contexts: [contextBefore, contextAfter]
        })
      }

      // Track ignored patterns for future filtering
      if (!accepted) {
        // Track ignored pattern by user
        if (!this.ignoredPatterns.has(userKey)) {
          this.ignoredPatterns.set(userKey, new Set())
        }
        
        // Create a pattern key that combines the error type and text
        const patternKey = `${suggestion.type}:${originalText.toLowerCase()}`
        this.ignoredPatterns.get(userKey)!.add(patternKey)
        
        // Track ignored contexts
        if (!this.ignoredContexts.has(userKey)) {
          this.ignoredContexts.set(userKey, [])
        }
        
        const contextPatterns = this.ignoredContexts.get(userKey)!
        const contextPattern = {
          pattern: originalText.toLowerCase(),
          context: `${contextBefore}|${contextAfter}`,
          count: 1
        }
        
        // Check if this context pattern already exists
        const existingPattern = contextPatterns.find(cp => 
          cp.pattern === contextPattern.pattern && 
          cp.context === contextPattern.context
        )
        
        if (existingPattern) {
          existingPattern.count++
        } else {
          contextPatterns.push(contextPattern)
        }
        
        // If ignored 3+ times in any context, it's a strong ignore signal
        const totalIgnores = contextPatterns
          .filter(cp => cp.pattern === originalText.toLowerCase())
          .reduce((sum, cp) => sum + cp.count, 0)
          
        if (totalIgnores >= 3) {
          console.log(`🚫 Pattern "${originalText}" ignored ${totalIgnores} times - will suppress similar suggestions`)
        }
      }

      console.log('📝 Recorded user correction choice:', {
        type: suggestion.type,
        accepted,
        original: originalText,
        corrected: correctedText
      })

    } catch (error) {
      console.error('Error recording user choice:', error)
    }
  }

  /**
   * Get smart corrections based on user history and context
   */
  async getSmartCorrections(
    suggestions: Suggestion[],
    documentContent: string
  ): Promise<SmartCorrection[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return this.getDefaultSmartCorrections(suggestions)

      // Sync user patterns if needed
      await this.syncUserPatterns(user.id)

      const smartCorrections: SmartCorrection[] = []
      const userKey = user.id
      const patterns = this.userPatterns.get(userKey) || []

      for (const suggestion of suggestions) {
        const originalText = documentContent.substring(
          suggestion.offset,
          suggestion.offset + suggestion.length
        )

        // Calculate confidence based on user history
        const confidence = this.calculateConfidence(
          suggestion,
          originalText,
          patterns,
          documentContent
        )

        // Skip suggestions with very low confidence (likely to be ignored)
        if (confidence < 20) {
          console.log(`⏭️ Skipping low-confidence suggestion: ${suggestion.type} "${originalText}" (confidence: ${confidence})`)
          continue
        }

        // Determine if this should be a quick-accept suggestion
        const quickAccept = this.shouldQuickAccept(
          suggestion,
          originalText,
          confidence,
          patterns
        )

        // Check if this is based on user's learned patterns
        const learningBased = this.isLearningBased(
          suggestion,
          originalText,
          patterns
        )

        // Generate reason for the suggestion
        const reason = this.generateReason(
          suggestion,
          confidence,
          learningBased,
          patterns
        )

        smartCorrections.push({
          suggestion,
          confidence,
          reason,
          quickAccept,
          learningBased
        })
      }

      // Sort by confidence (highest first)
      return smartCorrections.sort((a, b) => b.confidence - a.confidence)

    } catch (error) {
      console.error('Error getting smart corrections:', error)
      return this.getDefaultSmartCorrections(suggestions)
    }
  }

  /**
   * Calculate confidence score based on user history
   */
  private calculateConfidence(
    suggestion: Suggestion,
    originalText: string,
    patterns: UserCorrectionPattern[],
    documentContent: string
  ): number {
    let baseConfidence = suggestion.confidence || 70

    // Check if this pattern has been frequently ignored
    const userKey = this.userPatterns.size > 0 ? Array.from(this.userPatterns.keys())[0] : null
    if (userKey && this.ignoredPatterns.has(userKey)) {
      const patternKey = `${suggestion.type}:${originalText.toLowerCase()}`
      if (this.ignoredPatterns.get(userKey)!.has(patternKey)) {
        // This exact pattern has been ignored before
        baseConfidence -= 30
        console.log(`📉 Reducing confidence for previously ignored pattern: ${patternKey}`)
      }
    }
    
    // Check contextual ignores
    if (userKey && this.ignoredContexts.has(userKey)) {
      const contextPatterns = this.ignoredContexts.get(userKey)!
      const relevantPatterns = contextPatterns.filter(cp => 
        cp.pattern === originalText.toLowerCase()
      )
      
      if (relevantPatterns.length > 0) {
        // Calculate total ignores for this pattern
        const totalIgnores = relevantPatterns.reduce((sum, cp) => sum + cp.count, 0)
        
        // Heavily penalize frequently ignored patterns
        if (totalIgnores >= 5) {
          baseConfidence -= 50 // Very likely to be ignored again
        } else if (totalIgnores >= 3) {
          baseConfidence -= 35 // Likely to be ignored
        } else if (totalIgnores >= 1) {
          baseConfidence -= 20 // Has been ignored before
        }
        
        // Check if current context matches any ignored context
        const currentContext = this.extractContext(suggestion, documentContent)
        const matchingContext = relevantPatterns.find(cp => 
          this.isContextSimilar(cp.context, currentContext)
        )
        
        if (matchingContext) {
          // Extra penalty for same context
          baseConfidence -= 15
          console.log(`📉 Pattern ignored in similar context ${matchingContext.count} times`)
        }
      }
    }

    // Check if user has accepted similar corrections before
    const similarAccepted = patterns.filter(p =>
      p.accepted &&
      p.suggestion_type === suggestion.type &&
      this.isSimilarCorrection(p.original_text, originalText)
    ).length

    const similarRejected = patterns.filter(p =>
      !p.accepted &&
      p.suggestion_type === suggestion.type &&
      this.isSimilarCorrection(p.original_text, originalText)
    ).length

    // Adjust confidence based on history
    baseConfidence += similarAccepted * 10
    baseConfidence -= similarRejected * 15

    // Check contextual patterns
    const contextBonus = this.getContextualBonus(
      suggestion,
      originalText,
      documentContent
    )
    baseConfidence += contextBonus

    // Check if it's a common correction
    if (this.commonCorrections.has(originalText.toLowerCase())) {
      baseConfidence += 20
    }

    // Cap confidence between 0 and 100
    return Math.max(0, Math.min(100, baseConfidence))
  }

  /**
   * Extract context from suggestion and document
   */
  private extractContext(suggestion: Suggestion, documentContent: string): string {
    const contextRadius = 50
    const contextBefore = documentContent.substring(
      Math.max(0, suggestion.offset - contextRadius),
      suggestion.offset
    ).trim()
    const contextAfter = documentContent.substring(
      suggestion.offset + suggestion.length,
      Math.min(documentContent.length, suggestion.offset + suggestion.length + contextRadius)
    ).trim()
    
    return `${contextBefore}|${contextAfter}`
  }

  /**
   * Check if two contexts are similar
   */
  private isContextSimilar(context1: string, context2: string): boolean {
    const [before1, after1] = context1.split('|')
    const [before2, after2] = context2.split('|')
    
    // Check if contexts share significant words
    const words1 = new Set([...before1.toLowerCase().split(/\s+/), ...after1.toLowerCase().split(/\s+/)])
    const words2 = new Set([...before2.toLowerCase().split(/\s+/), ...after2.toLowerCase().split(/\s+/)])
    
    const commonWords = [...words1].filter(w => words2.has(w) && w.length > 3).length
    const similarity = commonWords / Math.min(words1.size, words2.size)
    
    return similarity > 0.5 // More than 50% word overlap
  }

  /**
   * Determine if a suggestion should be quick-accept
   */
  private shouldQuickAccept(
    suggestion: Suggestion,
    originalText: string,
    confidence: number,
    patterns: UserCorrectionPattern[]
  ): boolean {
    // High confidence threshold
    if (confidence < 90) return false

    // Must be a spelling or obvious grammar error
    if (!['spelling', 'grammar'].includes(suggestion.type)) return false

    // Check if user frequently accepts this exact correction
    const exactMatches = patterns.filter(p =>
      p.accepted &&
      p.original_text.toLowerCase() === originalText.toLowerCase() &&
      p.suggestion_type === suggestion.type
    )

    // If accepted 3+ times before, it's a quick accept
    if (exactMatches.length >= 3) return true

    // Common corrections are quick accept
    if (this.commonCorrections.has(originalText.toLowerCase())) return true

    return false
  }

  /**
   * Check if suggestion is based on learned patterns
   */
  private isLearningBased(
    suggestion: Suggestion,
    originalText: string,
    patterns: UserCorrectionPattern[]
  ): boolean {
    return patterns.some(p =>
      p.accepted &&
      p.original_text.toLowerCase() === originalText.toLowerCase() &&
      p.suggestion_type === suggestion.type
    )
  }

  /**
   * Generate human-readable reason for the suggestion
   */
  private generateReason(
    suggestion: Suggestion,
    confidence: number,
    learningBased: boolean,
    patterns: UserCorrectionPattern[]
  ): string {
    // Check if this has been frequently ignored
    const userKey = this.userPatterns.size > 0 ? Array.from(this.userPatterns.keys())[0] : null
    if (userKey && this.ignoredContexts.has(userKey)) {
      const contextPatterns = this.ignoredContexts.get(userKey)!
      const originalText = suggestion.context || ''
      const relevantPatterns = contextPatterns.filter(cp => 
        cp.pattern === originalText.toLowerCase()
      )
      
      if (relevantPatterns.length > 0) {
        const totalIgnores = relevantPatterns.reduce((sum, cp) => sum + cp.count, 0)
        if (totalIgnores >= 3) {
          return `You've ignored this suggestion ${totalIgnores} times - showing with low priority`
        } else if (totalIgnores >= 1) {
          return `Previously ignored ${totalIgnores} time${totalIgnores > 1 ? 's' : ''}`
        }
      }
    }

    if (learningBased) {
      const acceptCount = patterns.filter(p =>
        p.accepted &&
        p.original_text.toLowerCase() === 
        patterns[0]?.original_text.toLowerCase()
      ).length
      return `You've accepted this correction ${acceptCount} time${acceptCount > 1 ? 's' : ''} before`
    }

    if (confidence >= 90) {
      return 'High confidence correction based on your writing style'
    } else if (confidence >= 70) {
      return 'Suggested based on common patterns'
    } else if (confidence >= 40) {
      return 'Possible improvement'
    } else {
      return 'Low priority suggestion'
    }
  }

  /**
   * Check if two corrections are similar
   */
  private isSimilarCorrection(text1: string, text2: string): boolean {
    const normalized1 = text1.toLowerCase().trim()
    const normalized2 = text2.toLowerCase().trim()

    // Exact match
    if (normalized1 === normalized2) return true

    // Levenshtein distance for similar words
    if (this.levenshteinDistance(normalized1, normalized2) <= 2) return true

    // Same root word (simple check)
    if (normalized1.length > 4 && normalized2.length > 4) {
      const root1 = normalized1.substring(0, 4)
      const root2 = normalized2.substring(0, 4)
      if (root1 === root2) return true
    }

    return false
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length
    const n = str2.length
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,    // deletion
            dp[i][j - 1] + 1,    // insertion
            dp[i - 1][j - 1] + 1 // substitution
          )
        }
      }
    }

    return dp[m][n]
  }

  /**
   * Get contextual bonus for confidence
   */
  private getContextualBonus(
    suggestion: Suggestion,
    originalText: string,
    documentContent: string
  ): number {
    const offset = suggestion.offset
    const contextRadius = 50
    const contextBefore = documentContent.substring(
      Math.max(0, offset - contextRadius),
      offset
    ).trim()
    const contextAfter = documentContent.substring(
      offset + suggestion.length,
      Math.min(documentContent.length, offset + suggestion.length + contextRadius)
    ).trim()

    const contextKey = `${contextBefore}|${originalText.toLowerCase()}|${contextAfter}`
    
    if (this.contextualPatterns.has(contextKey)) {
      return 25 // High bonus for exact context match
    }

    // Check partial context matches
    for (const [key] of this.contextualPatterns) {
      if (key.includes(originalText.toLowerCase()) &&
          (key.includes(contextBefore) || key.includes(contextAfter))) {
        return 15 // Medium bonus for partial context match
      }
    }

    return 0
  }

  /**
   * Detect document type from content
   */
  private detectDocumentType(content: string): string {
    const lowercaseContent = content.toLowerCase()
    
    if (lowercaseContent.includes('dear') && lowercaseContent.includes('sincerely')) {
      return 'email'
    }
    if (lowercaseContent.includes('abstract') && lowercaseContent.includes('conclusion')) {
      return 'academic'
    }
    if (lowercaseContent.includes('meeting') && lowercaseContent.includes('agenda')) {
      return 'business'
    }
    
    return 'general'
  }

  /**
   * Get default smart corrections when no user data available
   */
  private getDefaultSmartCorrections(suggestions: Suggestion[]): SmartCorrection[] {
    return suggestions.map(suggestion => ({
      suggestion,
      confidence: suggestion.confidence || 70,
      reason: 'Standard correction',
      quickAccept: false,
      learningBased: false
    }))
  }

  /**
   * Store correction pattern in database
   */
  private async storeCorrectionPattern(pattern: UserCorrectionPattern): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_correction_patterns')
        .insert(pattern)

      if (error) {
        console.error('Error storing correction pattern:', error)
      }
    } catch (error) {
      console.error('Error storing correction pattern:', error)
    }
  }

  /**
   * Sync user patterns from database
   */
  private async syncUserPatterns(userId: string): Promise<void> {
    const now = Date.now()
    if (now - this.lastSyncTime < this.syncInterval) return

    try {
      const { data, error } = await supabase
        .from('user_correction_patterns')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(500)

      if (!error && data) {
        this.userPatterns.set(userId, data)
        
        // Rebuild ignored patterns from database data
        this.ignoredPatterns.set(userId, new Set())
        this.ignoredContexts.set(userId, [])
        
        const ignoredSet = this.ignoredPatterns.get(userId)!
        const contextPatterns = this.ignoredContexts.get(userId)!
        
        // Process patterns to build ignore lists
        data.forEach(pattern => {
          if (!pattern.accepted) {
            // Add to ignored patterns
            const patternKey = `${pattern.suggestion_type}:${pattern.original_text.toLowerCase()}`
            ignoredSet.add(patternKey)
            
            // Add to context patterns
            const contextPattern = {
              pattern: pattern.original_text.toLowerCase(),
              context: `${pattern.context_before || ''}|${pattern.context_after || ''}`,
              count: 1
            }
            
            // Check if this context pattern already exists
            const existingPattern = contextPatterns.find(cp => 
              cp.pattern === contextPattern.pattern && 
              cp.context === contextPattern.context
            )
            
            if (existingPattern) {
              existingPattern.count++
            } else {
              contextPatterns.push(contextPattern)
            }
          }
        })
        
        this.lastSyncTime = now
        console.log(`📊 Synced ${data.length} correction patterns for user (${ignoredSet.size} unique ignored patterns)`)
      }
    } catch (error) {
      console.error('Error syncing user patterns:', error)
    }
  }

  /**
   * Get personalized writing insights
   */
  async getWritingInsights(userId: string): Promise<{
    commonMistakes: Array<{ text: string; count: number }>
    acceptanceRate: number
    improvementAreas: string[]
    ignoredPatterns: Array<{ text: string; type: string; count: number }>
  }> {
    const patterns = this.userPatterns.get(userId) || []
    
    // Count common mistakes
    const mistakeCount = new Map<string, number>()
    patterns.forEach(p => {
      if (p.accepted) {
        const key = p.original_text.toLowerCase()
        mistakeCount.set(key, (mistakeCount.get(key) || 0) + 1)
      }
    })

    // Count ignored patterns
    const ignoredCount = new Map<string, { type: string; count: number }>()
    patterns.forEach(p => {
      if (!p.accepted) {
        const key = p.original_text.toLowerCase()
        const existing = ignoredCount.get(key) || { type: p.suggestion_type, count: 0 }
        existing.count++
        ignoredCount.set(key, existing)
      }
    })

    // Calculate acceptance rate
    const totalSuggestions = patterns.length
    const acceptedSuggestions = patterns.filter(p => p.accepted).length
    const acceptanceRate = totalSuggestions > 0 
      ? Math.round((acceptedSuggestions / totalSuggestions) * 100)
      : 0

    // Identify improvement areas
    const typeCount = new Map<string, number>()
    patterns.filter(p => p.accepted).forEach(p => {
      typeCount.set(p.suggestion_type, (typeCount.get(p.suggestion_type) || 0) + 1)
    })

    const improvementAreas = Array.from(typeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type)

    return {
      commonMistakes: Array.from(mistakeCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([text, count]) => ({ text, count })),
      acceptanceRate,
      improvementAreas,
      ignoredPatterns: Array.from(ignoredCount.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([text, data]) => ({ text, type: data.type, count: data.count }))
    }
  }

  /**
   * Check if a suggestion should be suppressed based on ignore history
   */
  async shouldSuppressSuggestion(
    suggestion: Suggestion,
    documentContent: string
  ): Promise<{ suppress: boolean; reason?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { suppress: false }

      const userKey = user.id
      const originalText = documentContent.substring(
        suggestion.offset,
        suggestion.offset + suggestion.length
      )

      // Check if this exact pattern has been frequently ignored
      if (this.ignoredPatterns.has(userKey)) {
        const patternKey = `${suggestion.type}:${originalText.toLowerCase()}`
        if (this.ignoredPatterns.get(userKey)!.has(patternKey)) {
          // Check how many times it's been ignored
          if (this.ignoredContexts.has(userKey)) {
            const contextPatterns = this.ignoredContexts.get(userKey)!
            const relevantPatterns = contextPatterns.filter(cp => 
              cp.pattern === originalText.toLowerCase()
            )
            
            const totalIgnores = relevantPatterns.reduce((sum, cp) => sum + cp.count, 0)
            
            if (totalIgnores >= 5) {
              return { 
                suppress: true, 
                reason: `Frequently ignored (${totalIgnores} times)` 
              }
            }
          }
        }
      }

      return { suppress: false }
    } catch (error) {
      console.error('Error checking suppression:', error)
      return { suppress: false }
    }
  }

  /**
   * Get ignore statistics for a user
   */
  async getIgnoreStats(userId: string): Promise<{
    totalIgnored: number
    mostIgnoredTypes: Array<{ type: string; count: number }>
    frequentlyIgnoredWords: Array<{ word: string; count: number }>
  }> {
    await this.syncUserPatterns(userId)
    const patterns = this.userPatterns.get(userId) || []
    
    const ignoredPatterns = patterns.filter(p => !p.accepted)
    const typeCount = new Map<string, number>()
    const wordCount = new Map<string, number>()
    
    ignoredPatterns.forEach(p => {
      // Count by type
      typeCount.set(p.suggestion_type, (typeCount.get(p.suggestion_type) || 0) + 1)
      
      // Count by word
      const word = p.original_text.toLowerCase()
      wordCount.set(word, (wordCount.get(word) || 0) + 1)
    })
    
    return {
      totalIgnored: ignoredPatterns.length,
      mostIgnoredTypes: Array.from(typeCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count })),
      frequentlyIgnoredWords: Array.from(wordCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }))
    }
  }

  /**
   * Clear user patterns cache
   */
  clearCache(): void {
    this.userPatterns.clear()
    this.contextualPatterns.clear()
    this.ignoredPatterns.clear()
    this.ignoredContexts.clear()
    this.lastSyncTime = 0
    console.log('🗑️ Cleared smart correction cache')
  }
}

// Export singleton instance
export const smartCorrectionService = new SmartCorrectionService()

// Export types
export type { SmartCorrection, UserCorrectionPattern } 