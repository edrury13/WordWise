import { QualityFactor, RuleContext } from './types'

// Enhanced quality factor calculators with better accuracy
export const enhancedQualityFactors: Record<string, QualityFactor> = {
  contextualAccuracy: {
    name: 'Contextual Accuracy',
    weight: 0.35,
    calculator: (_context: RuleContext, match: string) => {
      let score = 75
      
      // Check for surrounding punctuation (reduces false positives)
      if (_context.precedingText?.match(/[.!?]\s*$/) || _context.followingText?.match(/^[.!?]/)) {
        score += 10 // Sentence boundaries increase accuracy
      }
      
      // Check for capitalization context
      if (match.charAt(0).toUpperCase() === match.charAt(0) && 
          _context.precedingText?.match(/[.!?]\s*$/)) {
        score += 5 // Proper capitalization after sentence end
      }
      
      // Penalize if in quotes or parentheses (might be intentional)
      if (_context.precedingText?.match(/["'(]\s*$/) || 
          _context.followingText?.match(/^["')]/)) {
        score -= 15
      }
      
      return Math.min(100, Math.max(0, score))
    }
  },
  
  linguisticComplexity: {
    name: 'Linguistic Complexity',
    weight: 0.25,
    calculator: (_context: RuleContext, match: string) => {
      let score = 70
      
      // Longer matches tend to be more accurate
      if (match.length > 15) score += 10
      else if (match.length < 5) score -= 10
      
      // Check for common words that might have exceptions
      const commonWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'have', 'has', 'do', 'does']
      if (commonWords.some(word => match.toLowerCase().includes(word))) {
        score += 15 // Common words are usually reliable
      }
      
      // Check for proper nouns (might have different rules)
      if (match.match(/[A-Z][a-z]+/)) {
        score -= 5 // Proper nouns might be exceptions
      }
      
      return Math.min(100, Math.max(0, score))
    }
  },
  
  frequencyBasedAccuracy: {
    name: 'Frequency-Based Accuracy',
    weight: 0.20,
    calculator: (_context: RuleContext, match: string) => {
      // Common error patterns get higher scores
      const veryCommonErrors = [
        /\byour\s+going\b/i,
        /\bthere\s+going\b/i,
        /\bits\s+a\b/i,
        /\bwas\s+were\b/i
      ]
      
      const commonErrors = [
        /\b(he|she|it)\s+(run|walk|go)\b/i,
        /\b(i|you|we|they)\s+was\b/i
      ]
      
      if (veryCommonErrors.some(pattern => pattern.test(match))) return 95
      if (commonErrors.some(pattern => pattern.test(match))) return 85
      
      return 75
    }
  },
  
  negativeContextDetection: {
    name: 'Negative Context Detection',
    weight: 0.20,
    calculator: (_context: RuleContext, _match: string) => {
      let score = 80
      
      // Check for negation context that might make the suggestion wrong
      const negationWords = ['not', 'never', 'no', 'none', 'nothing', 'neither', 'nor']
      const precedingText = _context.precedingText?.toLowerCase() || ''
      
      if (negationWords.some(word => precedingText.includes(word))) {
        score -= 20 // Negation might change the grammar rule
      }
      
      // Check for conditional context
      const conditionalWords = ['if', 'unless', 'when', 'while', 'although', 'though']
      if (conditionalWords.some(word => precedingText.includes(word))) {
        score -= 10 // Conditional context might have different rules
      }
      
      // Check for question context
      if (_context.precedingText?.includes('?')) {
        score -= 5 // Questions might have different grammar
      }
      
      return Math.min(100, Math.max(0, score))
    }
  }
}

// Enhanced pattern generators for better accuracy
export const createEnhancedPattern = {
  // Creates a pattern that avoids false positives in quotes and parentheses
  withContextBoundaries: (basePattern: string): RegExp => {
    return new RegExp(
      `(?<!["'(]\\s*)${basePattern}(?!\\s*["')])`,
      'gi'
    )
  },
  
  // Creates a pattern that respects word boundaries and sentence structure
  withSentenceBoundaries: (basePattern: string): RegExp => {
    return new RegExp(
      `(?:^|[.!?]\\s+)${basePattern}(?=\\s+|[.!?]|$)`,
      'gi'
    )
  },
  
  // Creates a pattern that excludes proper nouns and technical terms
  excludingProperNouns: (basePattern: string): RegExp => {
    return new RegExp(
      `(?<!\\b[A-Z][a-z]+\\s+)${basePattern}(?!\\s+[A-Z][a-z]+\\b)`,
      'gi'
    )
  },
  
  // Creates a pattern with negative lookbehind/lookahead for common exceptions
  withExceptions: (basePattern: string, exceptions: string[]): RegExp => {
    const exceptionPattern = exceptions.join('|')
    return new RegExp(
      `(?<!\\b(?:${exceptionPattern})\\s+)${basePattern}(?!\\s+(?:${exceptionPattern})\\b)`,
      'gi'
    )
  }
}

// Enhanced replacement generators with context awareness
export const createSmartReplacement = {
  // Preserves original capitalization
  preserveCapitalization: (original: string, replacement: string): string => {
    if (original.charAt(0) === original.charAt(0).toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1)
    }
    return replacement.toLowerCase()
  },
  
  // Provides multiple contextually appropriate replacements
  contextualReplacements: (
    match: string, 
    _context: RuleContext, 
    baseReplacements: string[]
  ): string[] => {
    const results: string[] = []
    
    for (const replacement of baseReplacements) {
      // Apply capitalization preservation
      const adjustedReplacement = createSmartReplacement.preserveCapitalization(match, replacement)
      
      // Check if replacement fits the context
      const precedingText = _context.precedingText || ''
      
      // Skip replacements that would create obvious errors
      if (precedingText.match(/\bis\s*$/) && adjustedReplacement.startsWith('are')) {
        continue // Don't suggest "are" after "is"
      }
      
      if (precedingText.match(/\bare\s*$/) && adjustedReplacement.startsWith('is')) {
        continue // Don't suggest "is" after "are"
      }
      
      results.push(adjustedReplacement)
    }
    
    return results.length > 0 ? results : baseReplacements
  }
}

// Performance optimized patterns that avoid catastrophic backtracking
export const optimizedPatterns = {
  // Efficient subject-verb agreement pattern
  subjectVerbAgreement: /\b(?:(?:I|you|we|they)|(?:the\s+)?(?:people|children|students|teachers|parents|friends|workers|employees|customers|clients|members))\s+was\b/gi,
  
  // Efficient your/you're detection
  yourYoureDetection: /\b(your|you're)\s+(going|coming|ready|right|wrong|welcome|sure|certain|happy|sad|angry|excited|tired|busy|free|available|late|early|good|bad|nice|kind|smart|funny|quiet|loud|tall|short|big|small|old|young|new|beautiful|rich|poor|healthy|sick|strong|weak|brave|scared|confident|nervous|proud|grateful|sorry|glad|surprised|confused|lost|found|done|finished|learning|working|playing|studying|reading|writing|thinking|feeling|being|doing|having|getting|making|taking|giving|seeing|knowing|saying|telling|asking|helping|trying|wanting|needing|loving|liking|hoping|believing|understanding|remembering|choosing|deciding)\b/gi,
  
  // Efficient there/their/they're detection
  thereTheirTheyre: /\b(there|their|they're)\s+(?:(going|coming|running|walking|playing|working|studying|happy|sad|ready|sure|right|wrong|good|bad|nice|kind|smart|funny|tired|busy|free|late|early|done|finished|learning|being|doing|having|getting|making|taking)|(house|car|home|room|job|family|children|parents|friend|friends|dog|cat|book|phone|computer|money|clothes|shoes|idea|plan|dream|goal|problem|work|life|time))\b/gi,
  
  // Efficient incomplete sentence detection
  incompleteSentence: /^(?:the|a|an)\s+\w+\s+(?:running|walking|jumping|swimming|flying|sleeping|eating|drinking|playing|working|studying|reading|writing|talking|singing|dancing|cooking|driving|sitting|standing|moving|looking|watching|listening|thinking|feeling|being|doing|getting|making|taking|giving|seeing|knowing|saying|telling|asking|helping|learning|teaching|trying|wanting|needing|loving|liking|hoping|believing|understanding|remembering|choosing|deciding)\b(?![.!?])/gi
}

// Context-aware validation functions
export const contextValidators = {
  // Validates that the suggestion makes sense in the sentence context
  validateSentenceStructure: (
    originalText: string, 
    replacement: string, 
    offset: number, 
    length: number
  ): boolean => {
    const newText = originalText.substring(0, offset) + replacement + originalText.substring(offset + length)
    
    // Basic validation: check for obvious grammatical issues
    const basicErrors = [
      /\bis\s+are\b/gi,      // "is are"
      /\bare\s+is\b/gi,      // "are is"
      /\bwas\s+were\b/gi,    // "was were"
      /\bwere\s+was\b/gi,    // "were was"
      /\ba\s+are\b/gi,       // "a are"
      /\ban\s+is\b/gi,       // "an is" (sometimes wrong)
    ]
    
    return !basicErrors.some(pattern => pattern.test(newText))
  },
  
  // Validates that the replacement maintains proper tense consistency
  validateTenseConsistency: (context: RuleContext, replacement: string): boolean => {
    const text = context.text.toLowerCase()
    
    // Simple tense detection
    const hasPastTense = /\b(was|were|had|did|went|came|saw|said|told|made|took|gave|got)\b/.test(text)
    const hasPresentTense = /\b(is|are|have|do|go|come|see|say|tell|make|take|give|get)\b/.test(text)
    
    const replacementPast = /\b(was|were|had|did)\b/.test(replacement.toLowerCase())
    const replacementPresent = /\b(is|are|have|do)\b/.test(replacement.toLowerCase())
    
    // If text is predominantly past tense, prefer past tense replacements
    if (hasPastTense && !hasPresentTense && replacementPresent && !replacementPast) {
      return false
    }
    
    // If text is predominantly present tense, prefer present tense replacements
    if (hasPresentTense && !hasPastTense && replacementPast && !replacementPresent) {
      return false
    }
    
    return true
  }
} 