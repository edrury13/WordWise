import { Suggestion } from '../store/slices/suggestionSlice';
import { StyleProfile, StyleProfileSettings } from '../types/styleProfile';

export interface ProfileAdjustedSuggestion extends Suggestion {
  profileSeverity?: 'ignore' | 'info' | 'warning' | 'error';
  profileMessage?: string;
}

class ProfileGrammarService {
  /**
   * Apply profile rules to suggestions
   */
  applyProfileRules(
    suggestions: Suggestion[],
    profile: StyleProfile | null,
    documentContent: string
  ): ProfileAdjustedSuggestion[] {
    if (!profile) {
      return suggestions;
    }

    return suggestions.map(suggestion => {
      const adjusted = { ...suggestion } as ProfileAdjustedSuggestion;
      const settings = profile.settings;

      // Apply grammar strictness rules
      if (settings.grammar) {
        adjusted.profileSeverity = this.adjustGrammarSeverity(
          suggestion,
          settings.grammar,
          adjusted.profileSeverity
        );
      }

      // Apply vocabulary preferences
      if (settings.vocabulary) {
        const vocabAdjustment = this.adjustVocabularySuggestion(
          suggestion,
          settings.vocabulary,
          documentContent
        );
        if (vocabAdjustment) {
          adjusted.profileSeverity = vocabAdjustment.severity;
          adjusted.profileMessage = vocabAdjustment.message;
        }
      }

      // Apply structure rules
      if (settings.structure) {
        const structureAdjustment = this.adjustStructureSuggestion(
          suggestion,
          settings.structure,
          documentContent
        );
        if (structureAdjustment) {
          adjusted.profileSeverity = structureAdjustment.severity;
          adjusted.profileMessage = structureAdjustment.message;
        }
      }

      // Apply style enforcement
      if (settings.style) {
        const styleAdjustment = this.adjustStyleSuggestion(
          suggestion,
          settings.style
        );
        if (styleAdjustment) {
          adjusted.profileSeverity = styleAdjustment.severity;
          adjusted.profileMessage = styleAdjustment.message;
        }
      }

      // Apply conditional rules
      if (settings.conditionalRules && settings.conditionalRules.length > 0) {
        const conditionalAdjustment = this.applyConditionalRules(
          suggestion,
          settings.conditionalRules,
          documentContent
        );
        if (conditionalAdjustment) {
          adjusted.profileSeverity = conditionalAdjustment.severity;
          adjusted.profileMessage = conditionalAdjustment.message;
        }
      }

      return adjusted;
    });
  }

  /**
   * Adjust grammar severity based on profile settings
   */
  private adjustGrammarSeverity(
    suggestion: Suggestion,
    grammarSettings: StyleProfileSettings['grammar'],
    currentSeverity?: 'ignore' | 'info' | 'warning' | 'error'
  ): 'ignore' | 'info' | 'warning' | 'error' | undefined {
    const message = suggestion.message.toLowerCase();

    // Fragment tolerance
    if (grammarSettings.fragmentTolerance && 
        (message.includes('fragment') || message.includes('incomplete sentence'))) {
      return 'ignore';
    }

    // Comma splice acceptance
    if (grammarSettings.commaSpliceAcceptance && message.includes('comma splice')) {
      return 'ignore';
    }

    // Ending preposition
    if (grammarSettings.endingPrepositionAllowed && 
        message.includes('ending with a preposition')) {
      return 'ignore';
    }

    // Split infinitive
    if (grammarSettings.splitInfinitiveAllowed && 
        message.includes('split infinitive')) {
      return 'ignore';
    }

    // Contractions
    if (grammarSettings.contractionUsage === 'never' && 
        message.includes('contraction')) {
      return 'error';
    } else if (grammarSettings.contractionUsage === 'always' && 
               message.includes('avoid contraction')) {
      return 'ignore';
    }

    // Oxford comma
    if (!grammarSettings.oxfordComma && message.includes('oxford comma')) {
      return 'ignore';
    }

    return currentSeverity;
  }

  /**
   * Adjust vocabulary suggestions based on profile
   */
  private adjustVocabularySuggestion(
    suggestion: Suggestion,
    vocabSettings: StyleProfileSettings['vocabulary'],
    documentContent: string
  ): { severity: 'ignore' | 'info' | 'warning' | 'error'; message: string } | null {
    const suggestedWord = this.extractSuggestedWord(suggestion, documentContent);
    
    // Check banned words
    if (vocabSettings.bannedWords?.some(banned => 
        suggestedWord.toLowerCase().includes(banned.toLowerCase()))) {
      return {
        severity: 'error',
        message: `This word is on your banned list for this profile`
      };
    }

    // Check complexity level
    if (vocabSettings.complexityLevel === 'simple' && 
        this.isComplexWord(suggestedWord)) {
      return {
        severity: 'warning',
        message: 'Consider using a simpler alternative'
      };
    } else if (vocabSettings.complexityLevel === 'sophisticated' && 
               this.isSimpleWord(suggestedWord)) {
      return {
        severity: 'info',
        message: 'Consider using a more sophisticated alternative'
      };
    }

    // Technical terms
    if (!vocabSettings.technicalTermsAllowed && 
        this.isTechnicalTerm(suggestedWord)) {
      return {
        severity: 'warning',
        message: 'Technical jargon may not be appropriate for this profile'
      };
    }

    return null;
  }

  /**
   * Adjust structure suggestions based on profile
   */
  private adjustStructureSuggestion(
    suggestion: Suggestion,
    structureSettings: StyleProfileSettings['structure'],
    documentContent: string
  ): { severity: 'ignore' | 'info' | 'warning' | 'error'; message: string } | null {
    const message = suggestion.message.toLowerCase();

    // Sentence length checks
    if (message.includes('sentence') && message.includes('long')) {
      const sentenceLength = this.estimateSentenceLength(suggestion, documentContent);
      if (sentenceLength > structureSettings.sentenceLengthMax) {
        return {
          severity: 'error',
          message: `Sentence exceeds maximum length of ${structureSettings.sentenceLengthMax} words`
        };
      }
    }

    // Paragraph length checks
    if (message.includes('paragraph') && message.includes('long')) {
      return {
        severity: 'warning',
        message: `Consider breaking up long paragraphs (ideal: ${structureSettings.paragraphLengthIdeal} words)`
      };
    }

    // Repetition tolerance
    if (message.includes('repetition') || message.includes('repeated')) {
      switch (structureSettings.repetitionTolerance) {
        case 'none':
          return { severity: 'error', message: 'Avoid repetition in this writing style' };
        case 'low':
          return { severity: 'warning', message: 'Minimize repetition' };
        case 'high':
          return { severity: 'ignore', message: '' };
      }
    }

    return null;
  }

  /**
   * Adjust style suggestions based on profile
   */
  private adjustStyleSuggestion(
    suggestion: Suggestion,
    styleSettings: StyleProfileSettings['style']
  ): { severity: 'ignore' | 'info' | 'warning' | 'error'; message: string } | null {
    const message = suggestion.message.toLowerCase();

    // Passive voice
    if (message.includes('passive voice')) {
      // This would need actual passive voice percentage calculation
      return {
        severity: 'warning',
        message: `Passive voice should not exceed ${styleSettings.passiveVoiceMaxPercentage}%`
      };
    }

    // Adverb usage
    if (message.includes('adverb')) {
      switch (styleSettings.adverbUsage) {
        case 'minimal':
          return { severity: 'warning', message: 'Minimize adverb usage' };
        case 'liberal':
          return { severity: 'ignore', message: '' };
      }
    }

    // Cliche detection
    if (message.includes('cliche') && !styleSettings.clicheDetection) {
      return { severity: 'ignore', message: '' };
    }

    return null;
  }

  /**
   * Apply conditional rules
   */
  private applyConditionalRules(
    suggestion: Suggestion,
    conditionalRules: StyleProfileSettings['conditionalRules'],
    documentContent: string
  ): { severity: 'info' | 'warning' | 'error'; message: string } | null {
    const text = documentContent.substring(
      suggestion.offset,
      suggestion.offset + suggestion.length
    ).toLowerCase();

    for (const rule of conditionalRules) {
      if (rule.condition.startsWith('starts_with:')) {
        const prefix = rule.condition.substring('starts_with:'.length);
        if (text.startsWith(prefix)) {
          return {
            severity: rule.severity,
            message: this.getConditionalRuleMessage(rule.action)
          };
        }
      }
      // Add more condition types as needed
    }

    return null;
  }

  /**
   * Helper methods
   */
  private extractSuggestedWord(suggestion: Suggestion, documentContent: string): string {
    return documentContent.substring(
      suggestion.offset,
      suggestion.offset + suggestion.length
    );
  }

  private isComplexWord(word: string): boolean {
    // Simple heuristic: words with 3+ syllables or 10+ characters
    return word.length >= 10 || this.countSyllables(word) >= 3;
  }

  private isSimpleWord(word: string): boolean {
    // Common simple words
    const simpleWords = ['get', 'got', 'thing', 'stuff', 'good', 'bad', 'big', 'small'];
    return simpleWords.includes(word.toLowerCase()) || word.length <= 4;
  }

  private isTechnicalTerm(word: string): boolean {
    // Simple check for technical terms
    const techPatterns = [/tion$/, /ment$/, /ize$/, /ify$/];
    return techPatterns.some(pattern => pattern.test(word));
  }

  private estimateSentenceLength(suggestion: Suggestion, documentContent: string): number {
    // Find the sentence containing the suggestion
    const start = Math.max(0, suggestion.offset - 200);
    const end = Math.min(documentContent.length, suggestion.offset + suggestion.length + 200);
    const context = documentContent.substring(start, end);
    
    // Simple word count estimation
    const words = context.split(/\s+/).filter(w => w.length > 0);
    return words.length;
  }

  private countSyllables(word: string): number {
    // Simple syllable counting heuristic
    word = word.toLowerCase();
    let count = 0;
    let previousWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = 'aeiou'.includes(word[i]);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }
    
    // Adjust for silent e
    if (word.endsWith('e')) {
      count--;
    }
    
    // Ensure at least 1 syllable
    return Math.max(1, count);
  }

  private getConditionalRuleMessage(action: string): string {
    const messages: Record<string, string> = {
      'suggest_alternative_transition': 'Consider using an alternative transition word',
      'avoid_passive': 'Avoid passive voice in this context',
      'use_active': 'Use active voice here',
      // Add more action messages
    };
    return messages[action] || action;
  }

  /**
   * Generate AI prompt based on profile settings
   */
  generateProfilePrompt(profile: StyleProfile): string {
    const settings = profile.settings;
    const parts: string[] = [];

    parts.push(`You are checking text according to the "${profile.name}" style profile.`);

    // Tone
    if (settings.tone) {
      parts.push(`Formality level: ${settings.tone.formalityLevel}/10`);
      parts.push(`Emotional tone: ${settings.tone.emotionalTone}`);
      parts.push(`Voice preference: ${settings.tone.voicePreference}`);
    }

    // Grammar
    if (settings.grammar) {
      const rules = [];
      if (!settings.grammar.fragmentTolerance) rules.push('no sentence fragments');
      if (!settings.grammar.commaSpliceAcceptance) rules.push('no comma splices');
      if (settings.grammar.contractionUsage === 'never') rules.push('no contractions');
      if (settings.grammar.oxfordComma) rules.push('use Oxford comma');
      if (rules.length > 0) {
        parts.push(`Grammar rules: ${rules.join(', ')}`);
      }
    }

    // Vocabulary
    if (settings.vocabulary) {
      parts.push(`Vocabulary complexity: ${settings.vocabulary.complexityLevel}`);
      if (settings.vocabulary.bannedWords?.length > 0) {
        parts.push(`Avoid these words: ${settings.vocabulary.bannedWords.join(', ')}`);
      }
    }

    // Structure
    if (settings.structure) {
      parts.push(`Ideal sentence length: ${settings.structure.sentenceLengthIdeal} words`);
      parts.push(`Transition frequency: ${settings.structure.transitionWordFrequency}`);
    }

    // Custom prompt
    if (settings.customPrompt) {
      parts.push(`Additional instructions: ${settings.customPrompt}`);
    }

    return parts.join('\n');
  }
}

// Export singleton instance
export const profileGrammarService = new ProfileGrammarService(); 