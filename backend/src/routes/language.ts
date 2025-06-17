import express from 'express'
import axios from 'axios'
import { AuthenticatedRequest } from '../middleware/auth'

const router = express.Router()

interface LanguageToolMatch {
  offset: number
  length: number
  message: string
  shortMessage?: string
  replacements: Array<{ value: string }>
  context: {
    text: string
    offset: number
    length: number
  }
  rule: {
    id: string
    category: {
      id: string
      name: string
    }
    issueType: string
  }
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[]
}

// Check grammar and spelling
router.post('/check', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { text, language = 'en-US' } = req.body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      })
    }

    if (text.length > 50000) {
      return res.status(400).json({
        success: false,
        error: 'Text is too long (maximum 50,000 characters)'
      })
    }

    // Use LanguageTool API with enhanced grammar checking
    const languageToolUrl = process.env.LANGUAGETOOL_API_URL || 'https://api.languagetool.org/v2'
    
    // Enhanced parameters for better grammar detection
    const params = new URLSearchParams({
      text,
      language,
      enabledOnly: 'false',
      // Level of checking (1 = default, 2 = picky)
      level: 'picky',
      // Enable comprehensive sentence-level grammar categories
      enabledCategories: 'GRAMMAR,SENTENCE_WHITESPACE,MISC,COMPOUNDING,SEMANTICS,PUNCTUATION,CASING,TYPOS',
      // Enable specific sentence-level grammar rules
      enabledRules: [
        // Sentence structure and completeness
        'FRAGMENT_SENTENCE',
        'MISSING_VERB',
        'INCOMPLETE_SENTENCE', 
        'SENTENCE_FRAGMENT',
        'RUN_ON_SENTENCE',
        'COMMA_SPLICE',
        
        // Subject-verb agreement
        'GRAMMAR_AGREEMENT',
        'SUBJECT_VERB_AGREEMENT',
        'VERB_FORM',
        'VERB_AGREEMENT_VS_NOUN',
        'SINGULAR_PLURAL_VERB',
        
        // Tense consistency
        'TENSE_AGREEMENT',
        'VERB_TENSE',
        'PAST_TENSE_VERB',
        'PRESENT_TENSE_VERB',
        
        // Pronoun usage
        'PRONOUN_AGREEMENT',
        'PRONOUN_REFERENCE',
        'REFLEXIVE_PRONOUN',
        'PERSONAL_PRONOUN_AGREEMENT',
        
        // Articles and determiners
        'ARTICLE_MISSING',
        'DT_DT', // Double determiners
        'MISSING_DETERMINER',
        'A_VS_AN',
        'THE_SUPERLATIVE',
        
        // Prepositions
        'PREPOSITION_VERB',
        'MISSING_PREPOSITION',
        'WRONG_PREPOSITION',
        
        // Sentence connectors
        'CONJUNCTION_COMMA',
        'MISSING_CONJUNCTION',
        'COORDINATING_CONJUNCTION',
        
        // Punctuation in sentences
        'COMMA_BEFORE_CONJUNCTION',
        'MISSING_COMMA',
        'UNNECESSARY_COMMA',
        'APOSTROPHE_MISSING',
        
        // Capitalization
        'SENTENCE_CAPITALIZATION',
        'PROPER_NOUN_CAPITALIZATION'
      ].join(','),
      // Disable overly aggressive style suggestions to focus on grammar
      disabledCategories: 'STYLE,COLLOQUIALISMS,REDUNDANCY,WORDINESS'
    })

    console.log('Checking text with enhanced sentence-level grammar rules:', text.substring(0, 100) + '...')
    
    const response = await axios.post<LanguageToolResponse>(
      `${languageToolUrl}/check`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000, // 30 second timeout
      }
    )

    console.log('LanguageTool response:', {
      matchCount: response.data.matches.length,
      matches: response.data.matches.map(m => ({
        rule: m.rule.id,
        category: m.rule.category.id,
        issueType: m.rule.issueType,
        message: m.message.substring(0, 50),
        replacements: m.replacements.map(r => r.value),
        offset: m.offset,
        length: m.length,
        context: m.context.text
      }))
    })

    // Transform LanguageTool response to our format
    const suggestions = response.data.matches.map((match, index) => ({
      id: `${match.rule.id}-${match.offset}-${index}`,
      type: getSuggestionType(match.rule.category.id, match.rule.issueType),
      message: match.message,
      replacements: improveReplacements(match.replacements.map(r => r.value), match.rule.id, match.context.text, match.offset, match.length),
      offset: match.offset,
      length: match.length,
      context: match.context.text,
      explanation: match.shortMessage || match.message,
      category: match.rule.category.name,
      severity: getSeverity(match.rule.issueType),
    }))

    res.status(200).json({
      success: true,
      suggestions,
      stats: {
        totalIssues: suggestions.length,
        grammarIssues: suggestions.filter(s => s.type === 'grammar').length,
        spellingIssues: suggestions.filter(s => s.type === 'spelling').length,
        styleIssues: suggestions.filter(s => s.type === 'style').length,
      }
    })
  } catch (error) {
    console.error('Language check error:', error)
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        return res.status(408).json({
          success: false,
          error: 'Language check service timeout'
        })
      }
      
      if (error.response?.status === 429) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded for language check service'
        })
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to check text'
    })
  }
})

// Sentence-level grammar analysis endpoint
router.post('/sentence-analysis', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { text, language = 'en-US' } = req.body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      })
    }

    if (text.length > 50000) {
      return res.status(400).json({
        success: false,
        error: 'Text is too long (maximum 50,000 characters)'
      })
    }

    const languageToolUrl = process.env.LANGUAGETOOL_API_URL || 'https://api.languagetool.org/v2'
    
    // Split text into sentences for individual analysis
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const sentenceAnalysis = []

    console.log(`Analyzing ${sentences.length} sentences for sentence-level grammar...`)

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim()
      if (sentence.length < 3) continue

      // Calculate sentence position in original text
      let sentenceOffset = 0
      for (let j = 0; j < i; j++) {
        sentenceOffset += sentences[j].length + 1 // +1 for punctuation
      }

      // Add proper punctuation for analysis
      const sentenceWithPunctuation = sentence + '.'

      // Focused sentence-level parameters
      const sentenceParams = new URLSearchParams({
        text: sentenceWithPunctuation,
        language,
        enabledOnly: 'false',
        level: 'picky',
        // Focus on sentence structure issues
        enabledCategories: 'GRAMMAR,PUNCTUATION,CASING',
        enabledRules: [
          // Core sentence structure
          'FRAGMENT_SENTENCE',
          'MISSING_VERB',
          'INCOMPLETE_SENTENCE',
          'SENTENCE_FRAGMENT',
          'RUN_ON_SENTENCE',
          'COMMA_SPLICE',
          
          // Subject-verb agreement (critical for sentence validity)
          'SUBJECT_VERB_AGREEMENT',
          'GRAMMAR_AGREEMENT',
          'VERB_FORM',
          'SINGULAR_PLURAL_VERB',
          
          // Essential sentence components
          'ARTICLE_MISSING',
          'MISSING_DETERMINER',
          'MISSING_PREPOSITION',
          'MISSING_CONJUNCTION',
          
          // Sentence-level punctuation
          'COMMA_BEFORE_CONJUNCTION',
          'MISSING_COMMA',
          'SENTENCE_CAPITALIZATION'
        ].join(',')
      })

      try {
        const sentenceResponse = await axios.post<LanguageToolResponse>(
          `${languageToolUrl}/check`,
          sentenceParams,
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000
          }
        )

        // Analyze sentence structure
        const issues = sentenceResponse.data.matches.map(match => ({
          type: getSuggestionType(match.rule.category.id, match.rule.issueType),
          message: match.message,
          ruleId: match.rule.id,
          category: match.rule.category.name,
          severity: getSeverity(match.rule.issueType),
          offset: sentenceOffset + match.offset,
          length: match.length,
          replacements: match.replacements.map(r => r.value)
        }))

        // Add custom sentence structure validation
        const customIssues = validateSentenceStructure(sentence, sentenceOffset)
        issues.push(...customIssues)

        // Determine sentence quality
        const grammarIssues = issues.filter(issue => issue.type === 'grammar').length
        const structureIssues = issues.filter(issue => 
          issue.ruleId.includes('FRAGMENT') || 
          issue.ruleId.includes('MISSING_VERB') ||
          issue.ruleId.includes('INCOMPLETE') ||
          issue.ruleId.includes('CUSTOM_INCOMPLETE')
        ).length

        let sentenceQuality = 'good'
        if (structureIssues > 0) {
          sentenceQuality = 'incomplete'
        } else if (grammarIssues > 2) {
          sentenceQuality = 'poor'
        } else if (grammarIssues > 0) {
          // Any sentence with grammar issues should be at least 'poor'
          sentenceQuality = 'poor'
        }

        sentenceAnalysis.push({
          sentenceIndex: i,
          text: sentence,
          offset: sentenceOffset,
          length: sentence.length,
          quality: sentenceQuality,
          wordCount: sentence.split(/\s+/).filter(w => w.trim().length > 0).length,
          issues,
          issueCount: issues.length,
          grammarIssueCount: grammarIssues,
          structureIssueCount: structureIssues
        })

        console.log(`Sentence ${i + 1}: "${sentence.substring(0, 50)}..." - Quality: ${sentenceQuality}, Issues: ${issues.length}`)

      } catch (error) {
        console.error(`Error analyzing sentence ${i + 1}:`, error)
        // Continue with other sentences
        sentenceAnalysis.push({
          sentenceIndex: i,
          text: sentence,
          offset: sentenceOffset,
          length: sentence.length,
          quality: 'unknown',
          wordCount: sentence.split(/\s+/).filter(w => w.trim().length > 0).length,
          issues: [],
          issueCount: 0,
          grammarIssueCount: 0,
          structureIssueCount: 0,
          error: 'Analysis failed'
        })
      }
    }

    // Overall text analysis
    const totalIssues = sentenceAnalysis.reduce((sum, s) => sum + s.issueCount, 0)
    const totalGrammarIssues = sentenceAnalysis.reduce((sum, s) => sum + s.grammarIssueCount, 0)
    const totalStructureIssues = sentenceAnalysis.reduce((sum, s) => sum + s.structureIssueCount, 0)
    
    const qualityDistribution = {
      good: sentenceAnalysis.filter(s => s.quality === 'good').length,
      fair: sentenceAnalysis.filter(s => s.quality === 'fair').length,
      poor: sentenceAnalysis.filter(s => s.quality === 'poor').length,
      incomplete: sentenceAnalysis.filter(s => s.quality === 'incomplete').length
    }

    // Calculate overall text quality
    let overallQuality = 'good'
    const incompletePercentage = (qualityDistribution.incomplete / sentences.length) * 100
    const poorPercentage = (qualityDistribution.poor / sentences.length) * 100

    if (incompletePercentage > 20) {
      overallQuality = 'needs_major_revision'
    } else if (poorPercentage > 30 || incompletePercentage > 10) {
      overallQuality = 'needs_revision'
    } else if (poorPercentage > 10 || qualityDistribution.fair > qualityDistribution.good) {
      overallQuality = 'fair'
    }

    // Calculate Flesch-Kincaid readability score for the entire text
    const readabilityData = calculateReadability(text)

    res.status(200).json({
      success: true,
      analysis: {
        totalSentences: sentences.length,
        overallQuality,
        qualityDistribution,
        totalIssues,
        totalGrammarIssues,
        totalStructureIssues,
        fleschKincaidScore: readabilityData.fleschKincaid,
        readabilityLevel: readabilityData.readabilityLevel,
        sentences: sentenceAnalysis
      }
    })

  } catch (error) {
    console.error('Sentence analysis error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to analyze sentences'
    })
  }
})

// Analyze text readability
router.post('/readability', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { text } = req.body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      })
    }

    const readabilityScore = calculateReadability(text)

    res.status(200).json({
      success: true,
      readability: readabilityScore
    })
  } catch (error) {
    console.error('Readability analysis error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to analyze text readability'
    })
  }
})

// Helper functions
function getSuggestionType(categoryId: string, issueType: string): string {
  console.log('Categorizing suggestion:', { categoryId, issueType })
  
  // Spelling/typos
  if (categoryId.includes('TYPOS') || 
      categoryId.includes('MISSPELLING') || 
      issueType === 'misspelling' ||
      categoryId.includes('SPELL')) {
    return 'spelling'
  }
  
  // Grammar errors - comprehensive detection
  if (categoryId.includes('GRAMMAR') || 
      categoryId.includes('VERB') ||
      categoryId.includes('AGREEMENT') ||
      categoryId.includes('TENSE') ||
      categoryId.includes('PRONOUN') ||
      categoryId.includes('ARTICLE') ||
      categoryId.includes('PREPOSITION') ||
      categoryId.includes('SENTENCE') ||
      categoryId.includes('SUBJECT') ||
      categoryId.includes('AUXILIARY') ||
      categoryId.includes('MODAL') ||
      categoryId.includes('PUNCTUATION') ||
      categoryId.includes('CAPITALIZATION') ||
      categoryId.includes('CONJUNCTION') ||
      categoryId.includes('DETERMINER') ||
      categoryId.includes('SYNTAX') ||
      issueType === 'grammar' ||
      issueType === 'typographical') {
    return 'grammar'
  }
  
  // Style suggestions
  if (categoryId.includes('STYLE') || 
      categoryId.includes('REDUNDANCY') ||
      categoryId.includes('WORDINESS') ||
      categoryId.includes('COLLOQUIALISM') ||
      issueType === 'style') {
    return 'style'
  }
  
  // Clarity issues
  if (categoryId.includes('CLARITY') ||
      categoryId.includes('CONFUSION') ||
      categoryId.includes('AMBIGUITY')) {
    return 'clarity'
  }
  
  // Engagement
  if (categoryId.includes('ENGAGEMENT') ||
      categoryId.includes('TONE')) {
    return 'engagement'
  }
  
  // Delivery
  if (categoryId.includes('DELIVERY') ||
      categoryId.includes('FORMATTING')) {
    return 'delivery'
  }
  
  // Default to grammar for unclassified issues that aren't clearly style
  if (issueType === 'other' || issueType === 'uncategorized') {
    return 'grammar'
  }
  
  return 'style'
}

function getSeverity(issueType: string): string {
  if (issueType === 'misspelling' || issueType === 'grammar') {
    return 'high'
  }
  if (issueType === 'style') {
    return 'medium'
  }
  return 'low'
}

// Improve replacement suggestions by fixing common issues
function improveReplacements(originalReplacements: string[], ruleId: string, context: string, offset: number, length: number): string[] {
  const improvedReplacements = [...originalReplacements]
  
  console.log(`Improving replacements for rule ${ruleId}:`, {
    original: originalReplacements,
    context: context.substring(Math.max(0, offset - 10), offset + length + 10),
    offset,
    length
  })
  
  // Fix "a" vs "an" article issues
  if (ruleId === 'A_NNS' || ruleId.includes('ARTICLE')) {
    const improvedArticleReplacements = originalReplacements.map(replacement => {
      // If replacement starts with "a " followed by a vowel sound, change to "an "
      if (replacement.match(/^a\s+[aeiouAEIOU]/)) {
        return replacement.replace(/^a\s+/, 'an ')
      }
      // If replacement starts with "an " followed by a consonant sound, change to "a "
      if (replacement.match(/^an\s+[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/)) {
        return replacement.replace(/^an\s+/, 'a ')
      }
      return replacement
    })
    
    // Add additional smart suggestions for common patterns
    if (ruleId === 'A_NNS') {
      const originalText = context.substring(offset, offset + length)
      
      // For "a errors" -> suggest "an error" (singular with correct article)
      if (originalText.includes('a errors')) {
        improvedArticleReplacements.unshift('an error')
      }
      // For "a issues" -> suggest "an issue" (singular with correct article)  
      else if (originalText.includes('a issues')) {
        improvedArticleReplacements.unshift('an issue')
      }
      // For "a options" -> suggest "an option" (singular with correct article)
      else if (originalText.includes('a options')) {
        improvedArticleReplacements.unshift('an option')
      }
      // For "a items" -> suggest "an item" (singular with correct article)
      else if (originalText.includes('a items')) {
        improvedArticleReplacements.unshift('an item')
      }
      // For "a examples" -> suggest "an example" (singular with correct article)
      else if (originalText.includes('a examples')) {
        improvedArticleReplacements.unshift('an example')
      }
      // Generic pattern: "a [vowel-starting plural]" -> "an [vowel-starting singular]"
      else {
        const match = originalText.match(/a\s+([aeiou]\w+s)\b/i)
        if (match) {
          const pluralWord = match[1]
          // Simple heuristic: remove 's' to get singular (works for most regular plurals)
          let singularWord = pluralWord
          if (pluralWord.endsWith('ies')) {
            singularWord = pluralWord.slice(0, -3) + 'y'
          } else if (pluralWord.endsWith('es')) {
            singularWord = pluralWord.slice(0, -2)
          } else if (pluralWord.endsWith('s')) {
            singularWord = pluralWord.slice(0, -1)
          }
          
          if (singularWord !== pluralWord) {
            improvedArticleReplacements.unshift(`an ${singularWord}`)
          }
        }
      }
    }
    
    const finalReplacements = improvedArticleReplacements.filter((replacement, index, arr) => 
      arr.indexOf(replacement) === index // Remove duplicates
    )
    
    console.log(`Improved replacements for ${ruleId}:`, {
      original: originalReplacements,
      improved: finalReplacements
    })
    
    return finalReplacements
  }
  
  // Fix subject-verb agreement issues
  if (ruleId.includes('AGREEMENT') || ruleId.includes('VERB')) {
    // Add logic for verb agreement improvements if needed
    return improvedReplacements
  }
  
  return improvedReplacements
}

function calculateReadability(text: string) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = text.split(/\s+/).filter(w => w.trim().length > 0)
  const totalSentences = sentences.length
  const totalWords = words.length
  const averageWordsPerSentence = totalWords / Math.max(totalSentences, 1)

  // Estimate syllables
  const syllables = words.reduce((total, word) => {
    return total + countSyllables(word)
  }, 0)
  const averageSyllablesPerWord = syllables / Math.max(totalWords, 1)

  // Flesch-Kincaid Grade Level
  const fleschKincaid = 0.39 * averageWordsPerSentence + 11.8 * averageSyllablesPerWord - 15.59

  // Long sentences (>20 words)
  const longSentences = sentences.filter(sentence => {
    const sentenceWords = sentence.split(/\s+/).filter(w => w.trim().length > 0)
    return sentenceWords.length > 20
  }).length

  // Simple passive voice detection
  const passiveIndicators = /(was|were|been|being)\s+\w+ed\b/gi
  const passiveMatches = text.match(passiveIndicators) || []
  const passiveVoicePercentage = (passiveMatches.length / Math.max(totalSentences, 1)) * 100

  return {
    fleschKincaid: Math.round(fleschKincaid * 10) / 10,
    readabilityLevel: getReadabilityLevel(fleschKincaid),
    averageWordsPerSentence: Math.round(averageWordsPerSentence * 10) / 10,
    averageSyllablesPerWord: Math.round(averageSyllablesPerWord * 10) / 10,
    totalSentences,
    passiveVoicePercentage: Math.round(passiveVoicePercentage * 10) / 10,
    longSentences,
  }
}

function countSyllables(word: string): number {
  word = word.toLowerCase()
  if (word.length <= 3) return 1
  
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
  word = word.replace(/^y/, '')
  
  const matches = word.match(/[aeiouy]{1,2}/g)
  return Math.max(1, matches ? matches.length : 1)
}

function getReadabilityLevel(score: number): string {
  if (score >= 90) return 'Very Easy'
  if (score >= 80) return 'Easy'
  if (score >= 70) return 'Fairly Easy'
  if (score >= 60) return 'Standard'
  if (score >= 50) return 'Fairly Difficult'
  if (score >= 30) return 'Difficult'
  return 'Very Difficult'
}

// Custom sentence structure validation
function validateSentenceStructure(sentence: string, offset: number): any[] {
  const issues: any[] = []
  const words = sentence.trim().split(/\s+/).filter(w => w.length > 0)
  
  if (words.length < 2) {
    return issues // Too short to analyze
  }

  // Track what types of issues we've already found to avoid duplicates
  const foundIssueTypes = new Set<string>()

  // Check for incomplete sentences with gerunds/present participles
  const gerundPattern = /\b(running|walking|jumping|swimming|flying|sleeping|eating|drinking|playing|working|studying|reading|writing|talking|singing|dancing|cooking|driving|sitting|standing|lying|moving|coming|going|looking|watching|listening|thinking|feeling|being|doing|getting|making|taking|giving|seeing|knowing|saying|telling|asking|helping|learning|teaching|buying|selling|building|cleaning|washing|fixing|painting|opening|closing|starting|stopping|continuing|beginning|ending|finishing|trying|wanting|needing|loving|liking|hating|hoping|believing|understanding|remembering|forgetting|choosing|deciding|planning|preparing|organizing|managing|controlling|leading|following|supporting|encouraging|celebrating|enjoying|suffering|struggling|fighting|winning|losing|competing|practicing|training|exercising|relaxing|resting|waking|dreaming)\b/i
  
  // Primary check: Simple gerund pattern like "The case running"
  const simpleGerundPattern = /^(The|A|An|This|That|My|Your|His|Her|Its|Our|Their)\s+(\w+)\s+(\w+ing)\s*\.?$/i
  if (simpleGerundPattern.test(sentence.trim())) {
    const helpingVerbPattern = /\b(is|are|was|were|am|have|has|had|will|would|could|should|might|may|must|can|do|does|did|being|been)\b/i
    
    if (!helpingVerbPattern.test(sentence)) {
      issues.push({
        type: 'grammar',
        message: 'This sentence is incomplete. It needs a helping verb like "is", "are", "was", or "were".',
        ruleId: 'CUSTOM_INCOMPLETE_GERUND',
        category: 'Grammar',
        severity: 'high',
        offset: offset,
        length: sentence.length,
        replacements: generateGerundSuggestions(sentence)
      })
      foundIssueTypes.add('incomplete_gerund')
    }
  }
  // Secondary check: More complex gerund patterns (only if simple pattern didn't match)
  else if (gerundPattern.test(sentence)) {
    const helpingVerbPattern = /\b(is|are|was|were|am|have|has|had|will|would|could|should|might|may|must|can|do|does|did|being|been)\b/i
    
    if (!helpingVerbPattern.test(sentence)) {
      // Check if it's a determiner + noun + gerund pattern
      const complexIncompletePattern = /^(The|A|An|This|That|These|Those|My|Your|His|Her|Its|Our|Their)\s+\w+\s+(running|walking|jumping|swimming|flying|sleeping|eating|drinking|playing|working|studying|reading|writing|talking|singing|dancing|cooking|driving|sitting|standing|lying|moving|coming|going|looking|watching|listening|thinking|feeling|being|doing|getting|making|taking|giving|seeing|knowing|saying|telling|asking|helping|learning|teaching|buying|selling|building|cleaning|washing|fixing|painting|opening|closing|starting|stopping|continuing|beginning|ending|finishing|trying|wanting|needing|loving|liking|hating|hoping|believing|understanding|remembering|forgetting|choosing|deciding|planning|preparing|organizing|managing|controlling|leading|following|supporting|encouraging|celebrating|enjoying|suffering|struggling|fighting|winning|losing|competing|practicing|training|exercising|relaxing|resting|waking|dreaming)\b/i
      
      if (complexIncompletePattern.test(sentence)) {
        issues.push({
          type: 'grammar',
          message: 'This appears to be an incomplete sentence. Consider adding a helping verb like "is", "was", "are", or "were" before the action word.',
          ruleId: 'CUSTOM_INCOMPLETE_COMPLEX_GERUND',
          category: 'Grammar',
          severity: 'high',
          offset: offset,
          length: sentence.length,
          replacements: generateGerundSuggestions(sentence)
        })
        foundIssueTypes.add('incomplete_gerund')
      }
    }
  }

  // Check for sentences that are just noun phrases without verbs (only if no gerund issue found)
  if (!foundIssueTypes.has('incomplete_gerund')) {
    const hasMainVerb = /\b(is|are|was|were|am|have|has|had|will|would|could|should|might|may|must|can|do|does|did|go|goes|went|come|comes|came|see|sees|saw|get|gets|got|make|makes|made|take|takes|took|give|gives|gave|know|knows|knew|think|thinks|thought|say|says|said|tell|tells|told|find|finds|found|become|becomes|became|feel|feels|felt|seem|seems|seemed|look|looks|looked|want|wants|wanted|need|needs|needed|try|tries|tried|ask|asks|asked|work|works|worked|call|calls|called|use|uses|used|start|starts|started|turn|turns|turned|run|runs|ran|move|moves|moved|live|lives|lived|believe|believes|believed|hold|holds|held|bring|brings|brought|happen|happens|happened|write|writes|wrote|provide|provides|provided|sit|sits|sat|stand|stands|stood|lose|loses|lost|pay|pays|paid|meet|meets|met|include|includes|included|continue|continues|continued|set|sets|learn|learns|learned|change|changes|changed|lead|leads|led|understand|understands|understood|watch|watches|watched|follow|follows|followed|stop|stops|stopped|create|creates|created|speak|speaks|spoke|read|reads|allow|allows|allowed|add|adds|added|spend|spends|spent|grow|grows|grew|open|opens|opened|walk|walks|walked|win|wins|won|offer|offers|offered|remember|remembers|remembered|love|loves|loved|consider|considers|considered|appear|appears|appeared|buy|buys|bought|wait|waits|waited|serve|serves|served|die|dies|died|send|sends|sent|expect|expects|expected|build|builds|built|stay|stays|stayed|fall|falls|fell|cut|cuts|reach|reaches|reached|kill|kills|killed|remain|remains|remained)\b/i
    
    if (!hasMainVerb && words.length > 2) {
      // This might be a noun phrase without a main verb
      const startsWithDeterminer = /^(The|A|An|This|That|These|Those|My|Your|His|Her|Its|Our|Their|Some|Many|Few|Several|All|Most|Each|Every|Any|No)\b/i
      
      if (startsWithDeterminer.test(sentence)) {
        issues.push({
          type: 'grammar',
          message: 'This appears to be an incomplete sentence. It seems to be missing a main verb.',
          ruleId: 'CUSTOM_INCOMPLETE_NO_VERB',
          category: 'Grammar',
          severity: 'high',
          offset: offset,
          length: sentence.length,
          replacements: [`${sentence} is`, `${sentence} was`, `${sentence} are`, `${sentence} were`]
        })
        foundIssueTypes.add('no_main_verb')
      }
    }
  }

  // Check for sentence fragments that end abruptly (only if no other structural issues found)
  if (!foundIssueTypes.has('incomplete_gerund') && !foundIssueTypes.has('no_main_verb')) {
    if (sentence.trim().endsWith('...') || sentence.trim().endsWith('.')) {
      const trimmedSentence = sentence.replace(/\.+$/, '').trim()
      if (trimmedSentence.split(/\s+/).length < 3) {
        issues.push({
          type: 'grammar',
          message: 'This sentence seems too short and may be incomplete.',
          ruleId: 'CUSTOM_INCOMPLETE_SHORT',
          category: 'Grammar',
          severity: 'medium',
          offset: offset,
          length: sentence.length,
          replacements: []
        })
      }
    }
  }

  return issues
}

// Generate suggestions for incomplete gerund sentences
function generateGerundSuggestions(sentence: string): string[] {
  const suggestions = []
  
  // Pattern: "The case running" -> "The case is running"
  const match = sentence.match(/^(The|A|An|This|That|These|Those|My|Your|His|Her|Its|Our|Their)\s+(\w+)\s+(\w+ing)\b/i)
  
  if (match) {
    const [, determiner, noun, gerund] = match
    const rest = sentence.substring(match[0].length)
    
    // Determine if singular or plural
    const isPlural = determiner.toLowerCase() === 'these' || determiner.toLowerCase() === 'those' || noun.endsWith('s')
    
    if (isPlural) {
      suggestions.push(`${determiner} ${noun} are ${gerund}${rest}`)
      suggestions.push(`${determiner} ${noun} were ${gerund}${rest}`)
    } else {
      suggestions.push(`${determiner} ${noun} is ${gerund}${rest}`)
      suggestions.push(`${determiner} ${noun} was ${gerund}${rest}`)
    }
  }
  
  return suggestions
}

// Test endpoint to verify LanguageTool API
router.post('/test', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    // Test text with known grammar and spelling errors
    const testText = "I has many errors in this sentence. Teh cat are running to the tree. She dont like it when they goes there. The cat running. The dog jumping."
    const languageToolUrl = process.env.LANGUAGETOOL_API_URL || 'https://api.languagetool.org/v2'
    
    const params = new URLSearchParams({
      text: testText,
      language: 'en-US',
      enabledOnly: 'false',
      level: 'picky',
      enabledCategories: 'GRAMMAR,SENTENCE_WHITESPACE,MISC,COMPOUNDING,SEMANTICS',
      enabledRules: 'FRAGMENT_SENTENCE,MISSING_VERB,INCOMPLETE_SENTENCE,SENTENCE_FRAGMENT,GRAMMAR_AGREEMENT,VERB_FORM',
      disabledCategories: 'STYLE,COLLOQUIALISMS,REDUNDANCY'
    })

    const response = await axios.post<LanguageToolResponse>(
      `${languageToolUrl}/check`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      }
    )

    const suggestions = response.data.matches.map((match, index) => ({
      id: `${match.rule.id}-${match.offset}-${index}`,
      type: getSuggestionType(match.rule.category.id, match.rule.issueType),
      message: match.message,
      replacements: match.replacements.map(r => r.value),
      offset: match.offset,
      length: match.length,
      context: match.context.text,
      explanation: match.shortMessage || match.message,
      category: match.rule.category.name,
      categoryId: match.rule.category.id,
      issueType: match.rule.issueType,
      ruleId: match.rule.id,
      severity: getSeverity(match.rule.issueType),
    }))

    res.status(200).json({
      success: true,
      testText,
      suggestions,
      stats: {
        totalIssues: suggestions.length,
        grammarIssues: suggestions.filter(s => s.type === 'grammar').length,
        spellingIssues: suggestions.filter(s => s.type === 'spelling').length,
        styleIssues: suggestions.filter(s => s.type === 'style').length,
      },
      raw: response.data.matches
    })
  } catch (error) {
    console.error('Language test error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to test language API',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router 