import express from 'express'
import axios from 'axios'
import OpenAI from 'openai'
import { AuthenticatedRequest } from '../middleware/auth'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

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
      level: 'picky',
      enabledCategories: 'GRAMMAR,SENTENCE_WHITESPACE,MISC,COMPOUNDING,SEMANTICS,PUNCTUATION,CASING,TYPOS,CONFUSED_WORDS,LOGIC,TYPOGRAPHY,PRONOUN_AGREEMENT,SUBJECT_VERB_AGREEMENT,STYLE,COLLOQUIALISMS,REDUNDANCY,WORDINESS,CREATIVE_WRITING',
      enabledRules: 'FRAGMENT_SENTENCE,MISSING_VERB,INCOMPLETE_SENTENCE,SENTENCE_FRAGMENT,RUN_ON_SENTENCE,COMMA_SPLICE,GRAMMAR_AGREEMENT,SUBJECT_VERB_AGREEMENT,VERB_FORM,VERB_AGREEMENT_VS_NOUN,SINGULAR_PLURAL_VERB,TENSE_AGREEMENT,VERB_TENSE,PAST_TENSE_VERB,PRESENT_TENSE_VERB,PRONOUN_AGREEMENT,PRONOUN_REFERENCE,REFLEXIVE_PRONOUN,PERSONAL_PRONOUN_AGREEMENT,ARTICLE_MISSING,DT_DT,MISSING_DETERMINER,A_VS_AN,THE_SUPERLATIVE,PREPOSITION_VERB,MISSING_PREPOSITION,WRONG_PREPOSITION,CONJUNCTION_COMMA,MISSING_CONJUNCTION,COORDINATING_CONJUNCTION,COMMA_BEFORE_CONJUNCTION,MISSING_COMMA,UNNECESSARY_COMMA,APOSTROPHE_MISSING,SENTENCE_CAPITALIZATION,PROPER_NOUN_CAPITALIZATION'
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
    
    // Simple and reliable sentence detection
    const sentences = []
    const sentenceOffsets = []
    
    console.log(`📄 Analyzing text of length ${text.length}`)
    
    // Use a simple approach: split by sentence endings and find each in the original text
    const rawSentences = text.split(/[.!?]+/).filter(s => s.trim().length >= 3)
    
    console.log(`📝 Found ${rawSentences.length} raw sentences`)
    
    let searchStartIndex = 0
    
    for (let i = 0; i < rawSentences.length; i++) {
      const sentenceText = rawSentences[i].trim()
      
      // Find this sentence in the original text starting from where we left off
      const sentenceIndex = text.indexOf(sentenceText, searchStartIndex)
      
      if (sentenceIndex !== -1) {
        sentences.push(sentenceText)
        sentenceOffsets.push(sentenceIndex)
        
        // Update search start for next sentence
        searchStartIndex = sentenceIndex + sentenceText.length
        
        console.log(`📍 Sentence ${i + 1}: "${sentenceText.substring(0, 30)}..." at offset ${sentenceIndex}, length ${sentenceText.length}`)
      } else {
        console.log(`⚠️ Could not find sentence in text: "${sentenceText.substring(0, 30)}..."`)
      }
    }

    const sentenceAnalysis = []
    console.log(`Analyzing ${sentences.length} sentences for sentence-level grammar...`)

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]
      const sentenceOffset = sentenceOffsets[i]

      // Add proper punctuation for analysis
      const sentenceWithPunctuation = sentence + '.'

      // Focused sentence-level parameters
      const sentenceParams = new URLSearchParams({
        text: sentenceWithPunctuation,
        language,
        enabledOnly: 'false',
        level: 'picky',
        enabledCategories: 'GRAMMAR,SENTENCE_WHITESPACE,MISC,COMPOUNDING,SEMANTICS,PUNCTUATION,CASING,TYPOS,CONFUSED_WORDS,LOGIC,TYPOGRAPHY,PRONOUN_AGREEMENT,SUBJECT_VERB_AGREEMENT,STYLE,COLLOQUIALISMS,REDUNDANCY,WORDINESS,CREATIVE_WRITING',
        enabledRules: 'FRAGMENT_SENTENCE,MISSING_VERB,INCOMPLETE_SENTENCE,SENTENCE_FRAGMENT,RUN_ON_SENTENCE,COMMA_SPLICE,SUBJECT_VERB_AGREEMENT,GRAMMAR_AGREEMENT,VERB_FORM,SINGULAR_PLURAL_VERB,ARTICLE_MISSING,MISSING_DETERMINER,MISSING_PREPOSITION,MISSING_CONJUNCTION,COMMA_BEFORE_CONJUNCTION,MISSING_COMMA,SENTENCE_CAPITALIZATION'
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
        const spellingIssues = issues.filter(issue => issue.type === 'spelling').length
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
        } else if (spellingIssues > 0) {
          // Any sentence with spelling errors should be marked 'fair' at best
          sentenceQuality = 'fair'
        }

        // Additional check: if sentence has spelling errors, it cannot be better than 'fair'
        if (spellingIssues > 0 && (sentenceQuality === 'good' || sentenceQuality === 'poor')) {
          sentenceQuality = sentenceQuality === 'poor' ? 'poor' : 'fair'
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
          spellingIssueCount: spellingIssues,
          structureIssueCount: structureIssues
        })

        console.log(`Sentence ${i + 1}: "${sentence.substring(0, 50)}..." - Quality: ${sentenceQuality}, Issues: ${issues.length} (Grammar: ${grammarIssues}, Spelling: ${spellingIssues}, Structure: ${structureIssues})`)

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
          spellingIssueCount: 0,
          structureIssueCount: 0,
          error: 'Analysis failed'
        })
      }
    }

    // Overall text analysis
    const totalIssues = sentenceAnalysis.reduce((sum, s) => sum + s.issueCount, 0)
    const totalGrammarIssues = sentenceAnalysis.reduce((sum, s) => sum + s.grammarIssueCount, 0)
    const totalSpellingIssues = sentenceAnalysis.reduce((sum, s) => sum + s.spellingIssueCount, 0)
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
        totalSpellingIssues,
        totalStructureIssues,
        fleschKincaidScore: readabilityData.fleschKincaid,
        fleschReadingEase: readabilityData.fleschReadingEase,
        readabilityLevel: readabilityData.readabilityLevel,
        readingEaseLevel: readabilityData.readingEaseLevel,
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

  // Flesch Reading Ease Score
  const fleschReadingEase = 206.835 - (1.015 * averageWordsPerSentence) - (84.6 * averageSyllablesPerWord)

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
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    readabilityLevel: getReadabilityLevel(fleschKincaid),
    readingEaseLevel: getReadingEaseLevel(fleschReadingEase),
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

function getReadingEaseLevel(score: number): string {
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

// Rewrite text in different tone
router.post('/rewrite-tone', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { text, tone } = req.body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      })
    }

    if (!tone || typeof tone !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Tone is required and must be a string'
      })
    }

    // Validate tone options
    const validTones = ['professional', 'casual', 'formal', 'friendly', 'academic', 'creative', 'persuasive', 'concise']
    if (!validTones.includes(tone.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid tone. Must be one of: ${validTones.join(', ')}`
      })
    }

    console.log('🚀🤖 ENHANCED OPENAI TONE REWRITE API v2.0 - Backend Implementation!')
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured'
      })
    }

    const rewrittenText = await rewriteWithOpenAI(text, tone.toLowerCase())

    const hasChanges = rewrittenText !== text && rewrittenText.trim() !== text.trim()

    res.status(200).json({
      success: true,
      originalText: text,
      rewrittenText,
      tone: tone.toLowerCase(),
      changes: hasChanges ? [`Text rewritten using AI for ${tone} tone`] : ['No changes needed'],
      hasChanges,
      method: 'openai',
      version: 'Enhanced OpenAI Backend v2.0',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Tone rewriting error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to rewrite text'
    })
  }
})

// Rewrite text to different grade level
router.post('/rewrite-grade-level', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { text, gradeLevel } = req.body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      })
    }

    if (!gradeLevel || typeof gradeLevel !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Grade level is required and must be a string'
      })
    }

    // Validate grade level options
    const validGradeLevels = ['elementary', 'middle-school', 'high-school', 'college', 'graduate']
    if (!validGradeLevels.includes(gradeLevel.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid grade level. Must be one of: ${validGradeLevels.join(', ')}`
      })
    }

    console.log('🎓📝 GRADE LEVEL REWRITE API v1.0 - Backend Implementation!')
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured'
      })
    }

    // Calculate original readability before rewriting
    const originalReadability = calculateReadability(text)

    const rewrittenText = await rewriteGradeLevelWithOpenAI(text, gradeLevel.toLowerCase())

    // Calculate new readability after rewriting
    const newReadability = calculateReadability(rewrittenText)

    const hasChanges = rewrittenText !== text && rewrittenText.trim() !== text.trim()

    res.status(200).json({
      success: true,
      originalText: text,
      rewrittenText,
      gradeLevel: gradeLevel.toLowerCase(),
      originalReadability: {
        fleschKincaid: originalReadability.fleschKincaid,
        readingEase: originalReadability.fleschReadingEase,
        level: originalReadability.readabilityLevel
      },
      newReadability: {
        fleschKincaid: newReadability.fleschKincaid,
        readingEase: newReadability.fleschReadingEase,
        level: newReadability.readabilityLevel
      },
      changes: hasChanges ? [`Text rewritten for ${gradeLevel} grade level`] : ['No changes needed'],
      hasChanges,
      method: 'openai',
      version: 'Grade Level Rewrite API v1.0',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Grade level rewriting error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to rewrite text for grade level'
    })
  }
})

// Enhanced OpenAI-powered tone rewriting function
async function rewriteWithOpenAI(text: string, tone: string): Promise<string> {
  const toneInstructions: Record<string, { instruction: string; examples: { before: string; after: string }; changes: string[]; temperature: number }> = {
    'professional': {
      instruction: 'Transform this text into a highly professional, business-appropriate tone. You MUST make significant changes to achieve a formal, polished style.',
      examples: {
        before: "Hey, this is awesome and I can't wait to see how it works out!",
        after: "I am pleased to express my enthusiasm for this development and look forward to observing its implementation and outcomes."
      },
      changes: [
        'Replace all contractions with full forms',
        'Use sophisticated business vocabulary',
        'Structure sentences formally',
        'Add professional courtesy language',
        'Eliminate casual expressions entirely'
      ],
      temperature: 0.4
    },
    'casual': {
      instruction: 'Convert this text to a relaxed, conversational style that sounds like friendly chat. You MUST make it sound completely informal and approachable.',
      examples: {
        before: "I am writing to inform you that the project has been completed successfully.",
        after: "Hey! Just wanted to let you know the project's all done and it turned out great!"
      },
      changes: [
        'Use lots of contractions',
        'Add casual filler words and phrases',
        'Make sentences shorter and punchier',
        'Include friendly exclamations',
        'Use informal vocabulary throughout'
      ],
      temperature: 0.6
    },
    'formal': {
      instruction: 'Elevate this text to an extremely formal, academic register with sophisticated language structures. You MUST use complex vocabulary and formal constructions.',
      examples: {
        before: "This is a good idea that will help our company.",
        after: "This proposal represents a commendable initiative that shall facilitate the advancement of our organizational objectives."
      },
      changes: [
        'Use complex sentence structures',
        'Employ sophisticated academic vocabulary',
        'Add formal transitional phrases',
        'Use passive voice where appropriate',
        'Eliminate all informal elements'
      ],
      temperature: 0.3
    },
    'friendly': {
      instruction: 'Make this text warm, welcoming, and genuinely personable. You MUST infuse it with positive energy and approachable warmth.',
      examples: {
        before: "The meeting is scheduled for tomorrow.",
        after: "I'm so excited to let you know our meeting is all set for tomorrow - looking forward to seeing you there!"
      },
      changes: [
        'Add enthusiastic and welcoming language',
        'Include positive emotional words',
        'Use inclusive and warm phrasing',
        'Add personal touches and encouragement',
        'Make it sound genuinely caring'
      ],
      temperature: 0.5
    },
    'academic': {
      instruction: 'Transform this into scholarly academic prose with precise terminology and rigorous intellectual structure. You MUST use academic conventions and scholarly language.',
      examples: {
        before: "Our research shows that this method works well.",
        after: "The empirical evidence demonstrates that this methodological approach yields consistently favorable outcomes across multiple parameters."
      },
      changes: [
        'Use precise academic terminology',
        'Employ objective, third-person perspective',
        'Add scholarly qualifiers and hedging',
        'Structure arguments with academic rigor',
        'Include formal academic phrases'
      ],
      temperature: 0.3
    },
    'creative': {
      instruction: 'Completely reimagine this text with vivid, imaginative language that captivates and engages. You MUST use creative literary techniques and colorful expressions.',
      examples: {
        before: "The product launch was successful.",
        after: "Our product burst onto the scene like a shooting star, dazzling the market and leaving competitors scrambling in its luminous wake."
      },
      changes: [
        'Use vivid metaphors and imagery',
        'Add creative adjectives and descriptors',
        'Employ literary devices and figurative language',
        'Create engaging, story-like elements',
        'Transform mundane statements into compelling prose'
      ],
      temperature: 0.8
    },
    'persuasive': {
      instruction: 'Rewrite this to be powerfully convincing and compelling. You MUST use strong persuasive techniques to make the content irresistibly appealing.',
      examples: {
        before: "You should consider this option.",
        after: "Imagine the incredible transformation you'll experience when you choose this game-changing solution that smart leaders are already embracing!"
      },
      changes: [
        'Use strong action verbs and power words',
        'Add compelling emotional appeals',
        'Include social proof and urgency',
        'Frame benefits as transformative',
        'Use persuasive psychological triggers'
      ],
      temperature: 0.6
    },
    'concise': {
      instruction: 'Strip this text down to its absolute essentials while making it punchy and direct. You MUST eliminate every unnecessary word and make it incredibly tight.',
      examples: {
        before: "I would like to take this opportunity to inform you that we have successfully completed the project.",
        after: "Project completed successfully."
      },
      changes: [
        'Remove all redundant words and phrases',
        'Use active voice exclusively',
        'Eliminate unnecessary qualifiers',
        'Make every word count',
        'Create maximum impact with minimum words'
      ],
      temperature: 0.4
    }
  }

  const selectedTone = toneInstructions[tone] || toneInstructions['professional']
  
  const estimatedTokens = Math.ceil(text.length / 3)
  const maxTokens = Math.min(4000, Math.max(800, estimatedTokens * 2))

  console.log('🔧 Enhanced OpenAI request details:', {
    tone,
    textLength: text.length,
    estimatedInputTokens: estimatedTokens,
    maxOutputTokens: maxTokens,
    temperature: selectedTone.temperature
  })

  try {
    const systemPrompt = `You are an expert text transformation specialist. Your job is to COMPLETELY REWRITE the given text to match the requested tone. 

CRITICAL REQUIREMENTS:
- You MUST make substantial changes to the text
- The rewritten version should sound significantly different from the original
- You MUST apply the tone transformation throughout the entire text
- Never return text that is too similar to the original
- Always aim for dramatic improvement in the requested style

TONE: ${tone.toUpperCase()}
INSTRUCTION: ${selectedTone.instruction}

REQUIRED CHANGES:
${selectedTone.changes.map(change => `• ${change}`).join('\n')}

EXAMPLE TRANSFORMATION:
Original: "${selectedTone.examples.before}"
Target Style: "${selectedTone.examples.after}"

Your rewrite should demonstrate this level of transformation. Be bold and make significant changes while preserving the core meaning.`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Transform this text to ${tone} tone (make substantial changes):\n\n"${text}"`
        }
      ],
      max_tokens: maxTokens,
      temperature: selectedTone.temperature,
      top_p: 0.95,
      frequency_penalty: 0.2,
      presence_penalty: 0.2
    })

    let rewrittenText = completion.choices[0]?.message?.content?.trim()

    if (!rewrittenText) {
      console.error('OpenAI returned empty response')
      throw new Error('OpenAI returned empty response')
    }

    // Remove quotes if OpenAI wrapped the response in quotes
    if (rewrittenText.startsWith('"') && rewrittenText.endsWith('"')) {
      rewrittenText = rewrittenText.slice(1, -1)
    }

    console.log('✅ Enhanced OpenAI completion successful:', {
      inputTokens: completion.usage?.prompt_tokens || 'unknown',
      outputTokens: completion.usage?.completion_tokens || 'unknown',
      totalTokens: completion.usage?.total_tokens || 'unknown',
      model: completion.model
    })

    return rewrittenText

  } catch (error) {
    console.error('Enhanced OpenAI API call failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : 'Unknown'
    })
    
    throw error
  }
}

async function rewriteGradeLevelWithOpenAI(text: string, gradeLevel: string): Promise<string> {
  const gradeLevelInstructions: Record<string, { 
    instruction: string; 
    detailedGuidelines: {
      sentenceLength: string;
      vocabularyComplexity: string;
      syllableCount: string;
      conceptDepth: string;
      syntaxComplexity: string;
      connectors: string;
      pronouns: string;
    };
    specificInstructions: string[];
    examples: { before: string; after: string }; 
    changes: string[]; 
    temperature: number; 
    targetFK: string;
    targetReadingEase: string;
  }> = {
    'elementary': {
      instruction: 'Rewrite this text for elementary school students (grades 1-5). Use very simple words, short sentences, and basic concepts that young children can understand.',
      detailedGuidelines: {
        sentenceLength: 'Keep sentences between 5-12 words. Aim for an average of 8 words per sentence.',
        vocabularyComplexity: 'Use only high-frequency words from the first 1000 most common English words. Avoid words with more than 2-3 syllables.',
        syllableCount: 'Target average of 1.2-1.4 syllables per word. Replace polysyllabic words with simpler alternatives.',
        conceptDepth: 'Explain one concept at a time. Use concrete examples. Avoid abstract ideas. Use familiar comparisons to everyday objects or experiences.',
        syntaxComplexity: 'Use simple subject-verb-object structure. Avoid compound sentences, complex clauses, or passive voice.',
        connectors: 'Use basic connectors: and, but, so, then, first, next, last.',
        pronouns: 'Use clear pronoun references. Avoid ambiguous "it", "this", "that" without clear antecedents.'
      },
      specificInstructions: [
        'Break long sentences into 2-3 shorter ones',
        'Replace complex terms with simple explanations',
        'Use present tense when possible',
        'Add simple transition words between ideas',
        'Use concrete nouns rather than abstract concepts',
        'Replace technical jargon with everyday language',
        'Use active voice exclusively'
      ],
      examples: {
        before: "The implementation of this methodology requires significant consideration of various factors.",
        after: "This way of doing things needs us to think about many things first. We must look at each part carefully."
      },
      changes: [
        'Use only simple, common words that elementary students know',
        'Keep sentences under 10-12 words',
        'Replace complex concepts with basic explanations',
        'Use active voice and simple sentence structures',
        'Avoid technical terms and big words'
      ],
      temperature: 0.3,
      targetFK: '3-5',
      targetReadingEase: '80-90'
    },
    'middle-school': {
      instruction: 'Rewrite this text for middle school students (grades 6-8). Use clear language and moderate complexity that pre-teens can understand.',
      detailedGuidelines: {
        sentenceLength: 'Keep sentences between 10-18 words. Aim for an average of 14 words per sentence.',
        vocabularyComplexity: 'Use vocabulary from the first 3000 most common English words. Include some academic vocabulary with context clues.',
        syllableCount: 'Target average of 1.4-1.6 syllables per word. Use moderate complexity words but provide context.',
        conceptDepth: 'Introduce concepts with brief explanations. Use familiar analogies. Connect new ideas to students\' experiences.',
        syntaxComplexity: 'Use mix of simple and compound sentences. Limited use of complex sentences with clear subordinate clauses.',
        connectors: 'Use transitional phrases: however, therefore, for example, in addition, as a result, on the other hand.',
        pronouns: 'Use clear pronoun references with occasional complex antecedents if clearly defined.'
      },
      specificInstructions: [
        'Combine related short sentences into compound sentences',
        'Define new vocabulary terms in context',
        'Use cause-and-effect relationships',
        'Include examples that relate to teen experiences',
        'Use both simple and compound sentence structures',
        'Introduce academic vocabulary gradually',
        'Use transitional phrases to connect ideas'
      ],
      examples: {
        before: "The implementation of this methodology requires significant consideration of various factors.",
        after: "Using this method means we need to think carefully about several important things. We must consider different factors that could affect the outcome."
      },
      changes: [
        'Use clear, straightforward vocabulary',
        'Keep sentences moderate length (12-16 words)',
        'Explain concepts clearly without being too simple',
        'Use familiar examples and comparisons',
        'Balance simplicity with some complexity'
      ],
      temperature: 0.4,
      targetFK: '6-8',
      targetReadingEase: '70-80'
    },
    'high-school': {
      instruction: 'Rewrite this text for high school students (grades 9-12). Use standard academic language that teenagers can understand.',
      detailedGuidelines: {
        sentenceLength: 'Keep sentences between 15-25 words. Aim for an average of 18-20 words per sentence.',
        vocabularyComplexity: 'Use vocabulary from academic word lists. Include domain-specific terminology with definitions when first introduced.',
        syllableCount: 'Target average of 1.6-1.8 syllables per word. Use sophisticated vocabulary appropriately.',
        conceptDepth: 'Present concepts with supporting details. Use analytical thinking. Connect ideas across disciplines.',
        syntaxComplexity: 'Use complex sentences with subordinate clauses. Balance simple, compound, and complex structures.',
        connectors: 'Use sophisticated transitions: furthermore, consequently, nevertheless, moreover, in contrast, specifically.',
        pronouns: 'Use complex pronoun structures with clear antecedents across sentence boundaries.'
      },
      specificInstructions: [
        'Combine ideas using complex sentence structures',
        'Use academic vocabulary with context support',
        'Include analytical and evaluative language',
        'Use varied sentence beginnings and structures',
        'Incorporate domain-specific terminology appropriately',
        'Use both deductive and inductive reasoning patterns',
        'Include cause-effect and compare-contrast structures'
      ],
      examples: {
        before: "The implementation of this methodology requires significant consideration of various factors.",
        after: "Implementing this approach requires careful consideration of several important factors, which must be analyzed thoroughly before proceeding."
      },
      changes: [
        'Use standard academic vocabulary',
        'Keep sentences reasonably complex but clear',
        'Include some advanced concepts with explanation',
        'Use proper academic structure',
        'Balance complexity with clarity'
      ],
      temperature: 0.4,
      targetFK: '9-12',
      targetReadingEase: '60-70'
    },
    'college': {
      instruction: 'Rewrite this text for college students and adults. Use sophisticated language and complex concepts appropriate for higher education.',
      detailedGuidelines: {
        sentenceLength: 'Use sentences between 20-35 words. Aim for an average of 22-25 words per sentence.',
        vocabularyComplexity: 'Use advanced academic vocabulary, technical terminology, and discipline-specific jargon appropriately.',
        syllableCount: 'Target average of 1.8-2.0 syllables per word. Use polysyllabic academic terms when precise.',
        conceptDepth: 'Present complex, abstract concepts with nuanced analysis. Use critical thinking and synthesis.',
        syntaxComplexity: 'Use sophisticated sentence structures with multiple clauses, embeddings, and complex relationships.',
        connectors: 'Use advanced transitions: notwithstanding, albeit, insofar as, whereas, given that, to the extent that.',
        pronouns: 'Use complex pronoun relationships and sophisticated referential structures.'
      },
      specificInstructions: [
        'Use embedded clauses and complex syntax',
        'Employ abstract and theoretical language',
        'Include sophisticated analytical frameworks',
        'Use parallel structures and sophisticated rhetoric',
        'Incorporate interdisciplinary connections',
        'Use hedging language and academic qualifiers',
        'Employ nominalizations and academic register'
      ],
      examples: {
        before: "This way of doing things needs us to think about many things first.",
        after: "The implementation of this methodology requires comprehensive analysis of multiple contributing factors, necessitating systematic evaluation of interdependent variables."
      },
      changes: [
        'Use advanced vocabulary and terminology',
        'Employ complex sentence structures',
        'Include sophisticated concepts and analysis',
        'Use academic writing conventions',
        'Demonstrate higher-level thinking'
      ],
      temperature: 0.5,
      targetFK: '13-16',
      targetReadingEase: '50-60'
    },
    'graduate': {
      instruction: 'Rewrite this text for graduate-level readers and professionals. Use highly sophisticated language, technical terminology, and complex analytical concepts.',
      detailedGuidelines: {
        sentenceLength: 'Use sentences between 25-45 words. Aim for an average of 28-32 words per sentence.',
        vocabularyComplexity: 'Use highly specialized terminology, technical jargon, and field-specific vocabulary. Employ abstract nominalizations.',
        syllableCount: 'Target average of 2.0+ syllables per word. Use polysyllabic academic and technical terms extensively.',
        conceptDepth: 'Present highly abstract, theoretical concepts with sophisticated analysis, synthesis, and critical evaluation.',
        syntaxComplexity: 'Use highly complex sentence structures with multiple embedded clauses, parenthetical expressions, and sophisticated relationships.',
        connectors: 'Use highly sophisticated transitions: concomitantly, paradigmatically, vis-à-vis, qua, ipso facto, mutatis mutandis.',
        pronouns: 'Use sophisticated pronoun structures with complex antecedents across multiple sentences and paragraphs.'
      },
      specificInstructions: [
        'Use highly technical and specialized vocabulary',
        'Employ complex theoretical frameworks',
        'Use sophisticated analytical methodologies',
        'Include interdisciplinary theoretical perspectives',
        'Use advanced rhetorical strategies',
        'Employ meta-analytical commentary',
        'Use specialized disciplinary discourse patterns'
      ],
      examples: {
        before: "This way of doing things needs us to think about many things first.",
        after: "The operationalization of this theoretical framework necessitates a comprehensive, multifaceted evaluation of interdependent variables and their potential ramifications across diverse contextual parameters, requiring systematic methodological consideration of epistemological assumptions."
      },
      changes: [
        'Use highly technical and specialized vocabulary',
        'Employ complex, nuanced sentence structures',
        'Include advanced theoretical concepts',
        'Use professional/academic jargon appropriately',
        'Demonstrate expert-level analysis and synthesis'
      ],
      temperature: 0.6,
      targetFK: '17+',
      targetReadingEase: '30-50'
    }
  }

  const selectedLevel = gradeLevelInstructions[gradeLevel] || gradeLevelInstructions['high-school']
  
  const estimatedTokens = Math.ceil(text.length / 3)
  const maxTokens = Math.min(4000, Math.max(800, estimatedTokens * 2))

  console.log('🎓 Grade Level OpenAI request details:', {
    gradeLevel,
    targetFK: selectedLevel.targetFK,
    targetReadingEase: selectedLevel.targetReadingEase,
    textLength: text.length,
    estimatedInputTokens: estimatedTokens,
    maxOutputTokens: maxTokens,
    temperature: selectedLevel.temperature
  })

  try {
    const systemPrompt = `You are an expert educational content specialist and linguistic engineer who rewrites text for specific grade levels. Your expertise includes psycholinguistics, readability science, and educational content design.

CRITICAL REQUIREMENTS:
- You MUST rewrite for ${gradeLevel.toUpperCase()} level (Flesch-Kincaid Grade Level: ${selectedLevel.targetFK})
- Target Reading Ease Score: ${selectedLevel.targetReadingEase}
- The rewritten version should be significantly different from the original
- You MUST preserve all the original meaning and information
- Never lose important details or concepts
- Always aim for the exact target reading level while maintaining accuracy

GRADE LEVEL: ${gradeLevel.toUpperCase()}
TARGET FLESCH-KINCAID: ${selectedLevel.targetFK}
TARGET READING EASE: ${selectedLevel.targetReadingEase}

SPECIFIC LINGUISTIC GUIDELINES:
📏 SENTENCE LENGTH: ${selectedLevel.detailedGuidelines.sentenceLength}
📚 VOCABULARY COMPLEXITY: ${selectedLevel.detailedGuidelines.vocabularyComplexity}
🔤 SYLLABLE COUNT: ${selectedLevel.detailedGuidelines.syllableCount}
🧠 CONCEPT DEPTH: ${selectedLevel.detailedGuidelines.conceptDepth}
⚙️ SYNTAX COMPLEXITY: ${selectedLevel.detailedGuidelines.syntaxComplexity}
🔗 CONNECTORS: ${selectedLevel.detailedGuidelines.connectors}
👥 PRONOUNS: ${selectedLevel.detailedGuidelines.pronouns}

INSTRUCTION: ${selectedLevel.instruction}

SPECIFIC IMPLEMENTATION REQUIREMENTS:
${selectedLevel.specificInstructions.map(instruction => `• ${instruction}`).join('\n')}

MANDATORY CHANGES:
${selectedLevel.changes.map(change => `• ${change}`).join('\n')}

EXAMPLE TRANSFORMATION:
Original: "${selectedLevel.examples.before}"
Target Level: "${selectedLevel.examples.after}"

QUALITY ASSURANCE CHECKLIST:
✓ Sentence length matches target range
✓ Vocabulary complexity appropriate for grade level
✓ Syllable count per word within target range
✓ Concept explanation depth matches audience
✓ Syntax complexity appropriate for readers
✓ Transitional words/phrases match sophistication level
✓ All original meaning preserved
✓ Target Flesch-Kincaid grade level achieved
✓ Target Reading Ease score achieved

Your rewrite should demonstrate this level of transformation while meeting all linguistic specifications and targeting the exact grade level metrics.`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Rewrite this text for ${gradeLevel} grade level (target FK: ${selectedLevel.targetFK}, target Reading Ease: ${selectedLevel.targetReadingEase}):\n\n"${text}"\n\nRemember to follow all linguistic guidelines for sentence length, vocabulary complexity, syllable count, and concept depth specified for this grade level.`
        }
      ],
      max_tokens: maxTokens,
      temperature: selectedLevel.temperature,
      top_p: 0.95,
      frequency_penalty: 0.2,
      presence_penalty: 0.2
    })

    let rewrittenText = completion.choices[0]?.message?.content?.trim()

    if (!rewrittenText) {
      console.error('OpenAI returned empty response for grade level rewrite')
      throw new Error('OpenAI returned empty response')
    }

    // Remove quotes if OpenAI wrapped the response in quotes
    if (rewrittenText.startsWith('"') && rewrittenText.endsWith('"')) {
      rewrittenText = rewrittenText.slice(1, -1)
    }

    console.log('✅ Grade Level OpenAI completion successful:', {
      inputTokens: completion.usage?.prompt_tokens || 'unknown',
      outputTokens: completion.usage?.completion_tokens || 'unknown',
      totalTokens: completion.usage?.total_tokens || 'unknown',
      model: completion.model,
      targetGradeLevel: gradeLevel,
      targetFK: selectedLevel.targetFK,
      targetReadingEase: selectedLevel.targetReadingEase
    })

    return rewrittenText

  } catch (error) {
    console.error('Grade Level OpenAI API call failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : 'Unknown',
      status: (error as any)?.status,
      code: (error as any)?.code,
      gradeLevel
    })
    
    throw error
  }
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
      enabledCategories: 'GRAMMAR,SENTENCE_WHITESPACE,MISC,COMPOUNDING,SEMANTICS,PUNCTUATION,CASING,TYPOS,CONFUSED_WORDS,LOGIC,TYPOGRAPHY,PRONOUN_AGREEMENT,SUBJECT_VERB_AGREEMENT,STYLE,COLLOQUIALISMS,REDUNDANCY,WORDINESS,CREATIVE_WRITING',
      enabledRules: 'FRAGMENT_SENTENCE,MISSING_VERB,INCOMPLETE_SENTENCE,SENTENCE_FRAGMENT,GRAMMAR_AGREEMENT,VERB_FORM'
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