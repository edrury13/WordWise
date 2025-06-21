import { supabase } from '../config/supabase'

export interface IgnoredWord {
  id: string
  user_id: string
  word: string
  word_lower: string
  context?: string
  document_type?: string
  is_proper_noun: boolean
  created_at: string
}

class IgnoredWordsService {
  private cache: Map<string, IgnoredWord> = new Map()
  private loaded: boolean = false

  /**
   * Load all ignored words for the current user
   */
  async loadIgnoredWords(): Promise<IgnoredWord[]> {
    try {
      const { data: session } = await supabase.auth.getSession()
      if (!session?.session?.user) {
        console.warn('No user session found')
        return []
      }

      const { data, error } = await supabase
        .from('user_ignored_words')
        .select('*')
        .eq('user_id', session.session.user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading ignored words:', error)
        throw error
      }

      // Update cache
      this.cache.clear()
      data?.forEach(word => {
        this.cache.set(word.word_lower, word)
      })
      this.loaded = true

      return data || []
    } catch (error) {
      console.error('Failed to load ignored words:', error)
      return []
    }
  }

  /**
   * Add a word to the ignored list
   */
  async addIgnoredWord(word: string, options?: {
    context?: string
    documentType?: string
    isProperNoun?: boolean
  }): Promise<IgnoredWord | null> {
    try {
      const { data: session } = await supabase.auth.getSession()
      if (!session?.session?.user) {
        throw new Error('User not authenticated')
      }

      const wordTrimmed = word.trim()
      const wordLower = wordTrimmed.toLowerCase()

      // Check if already exists in cache
      if (this.cache.has(wordLower)) {
        console.log('Word already in ignore list:', wordLower)
        return this.cache.get(wordLower)!
      }

      const { data, error } = await supabase
        .from('user_ignored_words')
        .insert({
          user_id: session.session.user.id,
          word: wordTrimmed,
          word_lower: wordLower,
          context: options?.context || null,
          document_type: options?.documentType || null,
          is_proper_noun: options?.isProperNoun || false
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          console.log('Word already exists:', wordLower)
          // Try to fetch it
          await this.loadIgnoredWords()
          return this.cache.get(wordLower) || null
        }
        console.error('Error adding ignored word:', error)
        throw error
      }

      // Update cache
      if (data) {
        this.cache.set(data.word_lower, data)
      }

      return data
    } catch (error) {
      console.error('Failed to add ignored word:', error)
      return null
    }
  }

  /**
   * Remove a word from the ignored list
   */
  async removeIgnoredWord(wordId: string): Promise<boolean> {
    try {
      const { data: session } = await supabase.auth.getSession()
      if (!session?.session?.user) {
        throw new Error('User not authenticated')
      }

      const { error } = await supabase
        .from('user_ignored_words')
        .delete()
        .eq('id', wordId)
        .eq('user_id', session.session.user.id)

      if (error) {
        console.error('Error removing ignored word:', error)
        throw error
      }

      // Remove from cache
      for (const [key, value] of this.cache.entries()) {
        if (value.id === wordId) {
          this.cache.delete(key)
          break
        }
      }

      return true
    } catch (error) {
      console.error('Failed to remove ignored word:', error)
      return false
    }
  }

  /**
   * Clear all ignored words for the user
   */
  async clearAllIgnoredWords(): Promise<boolean> {
    try {
      const { data: session } = await supabase.auth.getSession()
      if (!session?.session?.user) {
        throw new Error('User not authenticated')
      }

      const { error } = await supabase
        .from('user_ignored_words')
        .delete()
        .eq('user_id', session.session.user.id)

      if (error) {
        console.error('Error clearing ignored words:', error)
        throw error
      }

      // Clear cache
      this.cache.clear()

      return true
    } catch (error) {
      console.error('Failed to clear ignored words:', error)
      return false
    }
  }

  /**
   * Check if a word is ignored (case-insensitive)
   */
  isWordIgnored(word: string): boolean {
    if (!this.loaded) {
      // If cache not loaded, return false and trigger a load
      this.loadIgnoredWords().catch(console.error)
      return false
    }
    return this.cache.has(word.toLowerCase())
  }

  /**
   * Get all ignored words from cache
   */
  getIgnoredWords(): IgnoredWord[] {
    return Array.from(this.cache.values())
  }

  /**
   * Filter suggestions to remove ignored words
   */
  filterSuggestions<T extends { type: string; offset: number; length: number }>(
    suggestions: T[],
    text: string
  ): T[] {
    if (!this.loaded || this.cache.size === 0) {
      return suggestions
    }

    return suggestions.filter(suggestion => {
      // Only filter spelling suggestions
      if (suggestion.type !== 'spelling') {
        return true
      }

      // Extract the word from the text
      const word = text.substring(suggestion.offset, suggestion.offset + suggestion.length)
      
      // Check if the word (or its lowercase version) is ignored
      return !this.isWordIgnored(word)
    })
  }

  /**
   * Detect if a word is likely a proper noun
   */
  isLikelyProperNoun(word: string, context?: string): boolean {
    // Check if word starts with capital letter
    if (word.length > 0 && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
      // If we have context, check if it's at the beginning of a sentence
      if (context) {
        const beforeWord = context.substring(0, context.indexOf(word)).trim()
        // If it's not after a period, question mark, or exclamation mark, it's likely a proper noun
        if (beforeWord.length > 0 && !beforeWord.match(/[.!?]\s*$/)) {
          return true
        }
      } else {
        // No context, but starts with capital - likely proper noun
        return true
      }
    }
    return false
  }
}

// Export singleton instance
export const ignoredWordsService = new IgnoredWordsService() 