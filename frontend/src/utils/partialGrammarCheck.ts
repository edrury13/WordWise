// Helper to run a grammar check only on a small slice of text and then
// convert returned offsets back to global coordinates.
// Uses existing languageService utilities so no backend changes are required.

import { checkGrammarWithAI } from '../services/aiGrammarService'
import { checkGrammarAndSpelling } from '../services/languageService'
import { Suggestion } from '../store/slices/suggestionSlice'
import { extractSentenceWithContext } from './sentenceExtraction'

export async function runPartialGrammarCheck(
  fullText: string,
  range: { start: number; end: number },
  useAI: boolean,
  isDemo: boolean = false
): Promise<Suggestion[]> {
  // Instead of fixed context, extract the sentence containing the change
  // Use the middle of the range to find the sentence
  const middlePosition = Math.floor((range.start + range.end) / 2)
  const sentenceInfo = extractSentenceWithContext(fullText, middlePosition, 20) // Small context for better grammar detection
  
  if (!sentenceInfo) {
    // Fallback to just the range if sentence extraction fails
    const snippet = fullText.slice(range.start, range.end)
    const suggestions = await checkSnippet(snippet, useAI, isDemo)
    return suggestions.map(s => ({
      ...s,
      offset: s.offset + range.start
    }))
  }
  
  // Use the sentence with minimal context as the snippet
  const snippet = sentenceInfo.contextText
  const snippetStart = sentenceInfo.contextStart
  
  // Check the snippet
  const suggestions = await checkSnippet(snippet, useAI, isDemo)
  
  // Shift snippet-relative offsets to match global text
  // and filter to only suggestions within the actual sentence (not the context)
  return suggestions
    .map(s => ({
      ...s,
      offset: s.offset + snippetStart
    }))
    .filter(s => {
      // Only keep suggestions that are within the actual sentence bounds
      const suggestionStart = s.offset
      const suggestionEnd = s.offset + s.length
      return suggestionStart >= sentenceInfo.sentenceStart && 
             suggestionEnd <= sentenceInfo.sentenceEnd
    })
}

async function checkSnippet(snippet: string, useAI: boolean, isDemo: boolean): Promise<Suggestion[]> {
  if (useAI) {
    const res: any = await checkGrammarWithAI({
      text: snippet,
      documentType: 'general',
      checkType: 'comprehensive',
      enableAI: true,
      isDemo: isDemo
    } as any)
    return res.suggestions || []
  } else {
    const res = await checkGrammarAndSpelling(snippet)
    return res.suggestions || []
  }
} 