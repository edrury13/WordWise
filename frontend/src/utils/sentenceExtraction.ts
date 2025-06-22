/**
 * Utility functions for extracting sentences from text
 */

/**
 * Extract the sentence containing a specific position in the text
 * @param text - The full text
 * @param position - The position within the text
 * @returns Object containing the sentence, its start and end positions
 */
export function extractSentenceAtPosition(
  text: string,
  position: number
): { sentence: string; start: number; end: number } | null {
  if (!text || position < 0 || position > text.length) {
    return null
  }

  // Find sentence boundaries (. ! ? followed by space or end of text)
  const sentenceEndRegex = /[.!?](?:\s|$)/g
  
  // Find all sentence boundaries
  const boundaries: number[] = [0] // Start of text is a boundary
  let match
  
  while ((match = sentenceEndRegex.exec(text)) !== null) {
    // Add the position after the punctuation
    boundaries.push(match.index + match[0].length)
  }
  
  // Add end of text if it's not already there
  if (boundaries[boundaries.length - 1] < text.length) {
    boundaries.push(text.length)
  }
  
  // Find which sentence contains the position
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i]
    const end = boundaries[i + 1]
    
    if (position >= start && position < end) {
      // Extract the sentence and trim it
      let sentence = text.substring(start, end).trim()
      
      // Find the actual start position after trimming
      const actualStart = text.indexOf(sentence, start)
      if (actualStart === -1) {
        return { sentence, start, end: start + sentence.length }
      }
      
      return {
        sentence,
        start: actualStart,
        end: actualStart + sentence.length
      }
    }
  }
  
  return null
}

/**
 * Extract sentences with expanded context for better grammar checking
 * @param text - The full text
 * @param position - The position within the text
 * @param contextChars - Number of characters to include before and after (default: 50)
 * @returns Object containing the sentence with context and offset information
 */
export function extractSentenceWithContext(
  text: string,
  position: number,
  contextChars: number = 50
): { 
  sentence: string
  sentenceStart: number
  sentenceEnd: number
  contextText: string
  contextStart: number
} | null {
  const sentenceInfo = extractSentenceAtPosition(text, position)
  if (!sentenceInfo) {
    return null
  }
  
  // Calculate context boundaries
  const contextStart = Math.max(0, sentenceInfo.start - contextChars)
  const contextEnd = Math.min(text.length, sentenceInfo.end + contextChars)
  const contextText = text.substring(contextStart, contextEnd)
  
  return {
    sentence: sentenceInfo.sentence,
    sentenceStart: sentenceInfo.start,
    sentenceEnd: sentenceInfo.end,
    contextText,
    contextStart
  }
} 