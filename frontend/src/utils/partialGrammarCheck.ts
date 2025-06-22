// Helper to run a grammar check only on a small slice of text and then
// convert returned offsets back to global coordinates.
// Uses existing languageService utilities so no backend changes are required.

import { checkGrammarWithAI } from '../services/aiGrammarService'
import { checkGrammarAndSpelling } from '../services/languageService'
import { Suggestion } from '../store/slices/suggestionSlice'

const CONTEXT = 40 // characters of context kept left & right of the change

export async function runPartialGrammarCheck(
  fullText: string,
  range: { start: number; end: number },
  useAI: boolean
): Promise<Suggestion[]> {
  // Clamp & expand range to include context so grammar rules still fire properly
  const snippetStart = Math.max(0, range.start - CONTEXT)
  const snippetEnd   = Math.min(fullText.length, range.end + CONTEXT)
  const snippet      = fullText.slice(snippetStart, snippetEnd)

  // Fire the same service your app already uses but only with the snippet
  let suggestions: Suggestion[]
  if (useAI) {
    const res: any = await checkGrammarWithAI({
      text: snippet,
      documentType: 'general',
      checkType: 'comprehensive',
      enableAI: true
    } as any)
    suggestions = res.suggestions || []
  } else {
    const res = await checkGrammarAndSpelling(snippet)
    suggestions = res.suggestions || []
  }

  // Shift snippet-relative offsets so they match the global text again
  return suggestions.map(s => ({
    ...s,
    offset: s.offset + snippetStart
  }))
} 