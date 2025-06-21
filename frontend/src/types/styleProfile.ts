// Style Profile Types and Interfaces

export type ProfileType = 'academic' | 'business' | 'creative' | 'technical' | 'email' | 'social' | 'custom';

export interface ToneSettings {
  formalityLevel: number; // 1-10 scale
  emotionalTone: 'neutral' | 'positive' | 'urgent' | 'empathetic' | 'professional';
  voicePreference: 'active' | 'passive' | 'balanced';
  sentimentTarget?: 'positive' | 'negative' | 'neutral';
}

export interface GrammarStrictness {
  fragmentTolerance: boolean;
  commaSpliceAcceptance: boolean;
  endingPrepositionAllowed: boolean;
  splitInfinitiveAllowed: boolean;
  contractionUsage: 'never' | 'informal' | 'always';
  oxfordComma: boolean;
}

export interface VocabularyPreferences {
  complexityLevel: 'simple' | 'moderate' | 'sophisticated';
  technicalTermsAllowed: boolean;
  industryTermsWhitelist: string[];
  bannedWords: string[];
  regionalVariant: 'us' | 'uk' | 'au' | 'ca';
  jargonTolerance: 'none' | 'minimal' | 'moderate' | 'high';
}

export interface StructureRules {
  sentenceLengthMin: number;
  sentenceLengthMax: number;
  sentenceLengthIdeal: number;
  paragraphLengthMin: number;
  paragraphLengthMax: number;
  paragraphLengthIdeal: number;
  transitionWordFrequency: 'minimal' | 'moderate' | 'frequent';
  repetitionTolerance: 'none' | 'low' | 'medium' | 'high';
}

export interface StyleEnforcement {
  passiveVoiceMaxPercentage: number;
  adverbUsage: 'minimal' | 'moderate' | 'liberal';
  sentenceVarietyRequired: boolean;
  paragraphOpeningVariety: boolean;
  clicheDetection: boolean;
}

export interface ProfileSpecificSettings {
  // Academic specific
  citationStyle?: 'apa' | 'mla' | 'chicago' | 'harvard';
  bibliographyRequired?: boolean;
  academicPhraseBank?: boolean;
  plagiarismSensitivity?: 'low' | 'medium' | 'high';
  
  // Business specific
  bulletPointsPreferred?: boolean;
  executiveSummaryRequired?: boolean;
  actionItemsHighlighted?: boolean;
  smartGoalsFormat?: boolean;
  
  // Creative specific
  dialogueFormatting?: boolean;
  showVsTellBalance?: number; // 0-100, where 100 is all "show"
  metaphorDensity?: 'sparse' | 'moderate' | 'rich';
  paceVariation?: boolean;
  
  // Technical specific
  codeSnippetFormatting?: boolean;
  stepByStepRequired?: boolean;
  technicalAccuracy?: 'flexible' | 'strict';
  versionSpecificLanguage?: boolean;
  
  // Email specific
  greetingRequired?: boolean;
  closingRequired?: boolean;
  subjectLineAnalysis?: boolean;
  callToActionClarity?: boolean;
  
  // Social media specific
  characterLimit?: number;
  hashtagSuggestions?: boolean;
  emojiGuidance?: boolean;
  engagementOptimized?: boolean;
}

export interface RuleWeight {
  ruleName: string;
  weight: number; // 0-1, where 1 is highest priority
  enabled: boolean;
}

export interface ConditionalRule {
  condition: string; // e.g., "starts_with:however"
  action: string; // e.g., "suggest_alternative_transition"
  severity: 'info' | 'warning' | 'error';
}

export interface StyleProfileSettings {
  tone: ToneSettings;
  grammar: GrammarStrictness;
  vocabulary: VocabularyPreferences;
  structure: StructureRules;
  style: StyleEnforcement;
  specificSettings: ProfileSpecificSettings;
  ruleWeights: RuleWeight[];
  conditionalRules: ConditionalRule[];
  customPrompt?: string; // For AI to understand unique requirements
}

export interface StyleProfile {
  id: string;
  userId: string;
  name: string;
  isCustom: boolean;
  isActive: boolean;
  profileType: ProfileType;
  settings: StyleProfileSettings;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentProfileAssociation {
  id: string;
  documentId: string;
  profileId: string;
  userId: string;
  createdAt: string;
}

export interface ProfileUsageAnalytics {
  id: string;
  userId: string;
  profileId: string;
  documentCount: number;
  suggestionAcceptanceRate: number;
  lastUsedAt: string;
  createdAt: string;
}

// Default profile settings for each type
export const defaultProfileSettings: Record<ProfileType, Partial<StyleProfileSettings>> = {
  academic: {
    tone: {
      formalityLevel: 9,
      emotionalTone: 'neutral',
      voicePreference: 'balanced'
    },
    grammar: {
      fragmentTolerance: false,
      commaSpliceAcceptance: false,
      endingPrepositionAllowed: false,
      splitInfinitiveAllowed: false,
      contractionUsage: 'never',
      oxfordComma: true
    },
    vocabulary: {
      complexityLevel: 'sophisticated',
      technicalTermsAllowed: true,
      industryTermsWhitelist: [],
      bannedWords: ['get', 'got', 'thing', 'stuff'],
      regionalVariant: 'us',
      jargonTolerance: 'moderate'
    },
    structure: {
      sentenceLengthMin: 15,
      sentenceLengthMax: 40,
      sentenceLengthIdeal: 25,
      paragraphLengthMin: 100,
      paragraphLengthMax: 250,
      paragraphLengthIdeal: 150,
      transitionWordFrequency: 'frequent',
      repetitionTolerance: 'low'
    },
    style: {
      passiveVoiceMaxPercentage: 20,
      adverbUsage: 'minimal',
      sentenceVarietyRequired: true,
      paragraphOpeningVariety: true,
      clicheDetection: true
    },
    specificSettings: {
      citationStyle: 'apa',
      bibliographyRequired: true,
      academicPhraseBank: true,
      plagiarismSensitivity: 'high'
    }
  },
  business: {
    tone: {
      formalityLevel: 7,
      emotionalTone: 'professional',
      voicePreference: 'active'
    },
    grammar: {
      fragmentTolerance: false,
      commaSpliceAcceptance: false,
      endingPrepositionAllowed: true,
      splitInfinitiveAllowed: true,
      contractionUsage: 'informal',
      oxfordComma: true
    },
    vocabulary: {
      complexityLevel: 'moderate',
      technicalTermsAllowed: true,
      industryTermsWhitelist: [],
      bannedWords: [],
      regionalVariant: 'us',
      jargonTolerance: 'moderate'
    },
    structure: {
      sentenceLengthMin: 10,
      sentenceLengthMax: 25,
      sentenceLengthIdeal: 18,
      paragraphLengthMin: 50,
      paragraphLengthMax: 150,
      paragraphLengthIdeal: 100,
      transitionWordFrequency: 'moderate',
      repetitionTolerance: 'medium'
    },
    style: {
      passiveVoiceMaxPercentage: 10,
      adverbUsage: 'minimal',
      sentenceVarietyRequired: true,
      paragraphOpeningVariety: false,
      clicheDetection: true
    },
    specificSettings: {
      bulletPointsPreferred: true,
      executiveSummaryRequired: false,
      actionItemsHighlighted: true,
      smartGoalsFormat: true
    }
  },
  creative: {
    tone: {
      formalityLevel: 5,
      emotionalTone: 'neutral',
      voicePreference: 'balanced'
    },
    grammar: {
      fragmentTolerance: true,
      commaSpliceAcceptance: true,
      endingPrepositionAllowed: true,
      splitInfinitiveAllowed: true,
      contractionUsage: 'always',
      oxfordComma: false
    },
    vocabulary: {
      complexityLevel: 'moderate',
      technicalTermsAllowed: false,
      industryTermsWhitelist: [],
      bannedWords: [],
      regionalVariant: 'us',
      jargonTolerance: 'high'
    },
    structure: {
      sentenceLengthMin: 1,
      sentenceLengthMax: 60,
      sentenceLengthIdeal: 20,
      paragraphLengthMin: 20,
      paragraphLengthMax: 300,
      paragraphLengthIdeal: 100,
      transitionWordFrequency: 'minimal',
      repetitionTolerance: 'high'
    },
    style: {
      passiveVoiceMaxPercentage: 50,
      adverbUsage: 'liberal',
      sentenceVarietyRequired: true,
      paragraphOpeningVariety: true,
      clicheDetection: false
    },
    specificSettings: {
      dialogueFormatting: true,
      showVsTellBalance: 80,
      metaphorDensity: 'moderate',
      paceVariation: true
    }
  },
  technical: {
    tone: {
      formalityLevel: 6,
      emotionalTone: 'neutral',
      voicePreference: 'active'
    },
    grammar: {
      fragmentTolerance: false,
      commaSpliceAcceptance: false,
      endingPrepositionAllowed: true,
      splitInfinitiveAllowed: true,
      contractionUsage: 'never',
      oxfordComma: true
    },
    vocabulary: {
      complexityLevel: 'sophisticated',
      technicalTermsAllowed: true,
      industryTermsWhitelist: [],
      bannedWords: [],
      regionalVariant: 'us',
      jargonTolerance: 'high'
    },
    structure: {
      sentenceLengthMin: 10,
      sentenceLengthMax: 30,
      sentenceLengthIdeal: 20,
      paragraphLengthMin: 50,
      paragraphLengthMax: 200,
      paragraphLengthIdeal: 100,
      transitionWordFrequency: 'moderate',
      repetitionTolerance: 'medium'
    },
    style: {
      passiveVoiceMaxPercentage: 15,
      adverbUsage: 'minimal',
      sentenceVarietyRequired: false,
      paragraphOpeningVariety: false,
      clicheDetection: false
    },
    specificSettings: {
      codeSnippetFormatting: true,
      stepByStepRequired: true,
      technicalAccuracy: 'strict',
      versionSpecificLanguage: true
    }
  },
  email: {
    tone: {
      formalityLevel: 6,
      emotionalTone: 'professional',
      voicePreference: 'active'
    },
    grammar: {
      fragmentTolerance: true,
      commaSpliceAcceptance: false,
      endingPrepositionAllowed: true,
      splitInfinitiveAllowed: true,
      contractionUsage: 'informal',
      oxfordComma: false
    },
    vocabulary: {
      complexityLevel: 'simple',
      technicalTermsAllowed: false,
      industryTermsWhitelist: [],
      bannedWords: [],
      regionalVariant: 'us',
      jargonTolerance: 'minimal'
    },
    structure: {
      sentenceLengthMin: 5,
      sentenceLengthMax: 25,
      sentenceLengthIdeal: 15,
      paragraphLengthMin: 20,
      paragraphLengthMax: 100,
      paragraphLengthIdeal: 50,
      transitionWordFrequency: 'minimal',
      repetitionTolerance: 'medium'
    },
    style: {
      passiveVoiceMaxPercentage: 10,
      adverbUsage: 'moderate',
      sentenceVarietyRequired: false,
      paragraphOpeningVariety: false,
      clicheDetection: false
    },
    specificSettings: {
      greetingRequired: true,
      closingRequired: true,
      subjectLineAnalysis: true,
      callToActionClarity: true
    }
  },
  social: {
    tone: {
      formalityLevel: 3,
      emotionalTone: 'positive',
      voicePreference: 'active'
    },
    grammar: {
      fragmentTolerance: true,
      commaSpliceAcceptance: true,
      endingPrepositionAllowed: true,
      splitInfinitiveAllowed: true,
      contractionUsage: 'always',
      oxfordComma: false
    },
    vocabulary: {
      complexityLevel: 'simple',
      technicalTermsAllowed: false,
      industryTermsWhitelist: [],
      bannedWords: [],
      regionalVariant: 'us',
      jargonTolerance: 'high'
    },
    structure: {
      sentenceLengthMin: 1,
      sentenceLengthMax: 20,
      sentenceLengthIdeal: 10,
      paragraphLengthMin: 10,
      paragraphLengthMax: 280,
      paragraphLengthIdeal: 50,
      transitionWordFrequency: 'minimal',
      repetitionTolerance: 'high'
    },
    style: {
      passiveVoiceMaxPercentage: 5,
      adverbUsage: 'liberal',
      sentenceVarietyRequired: false,
      paragraphOpeningVariety: false,
      clicheDetection: false
    },
    specificSettings: {
      characterLimit: 280,
      hashtagSuggestions: true,
      emojiGuidance: true,
      engagementOptimized: true
    }
  },
  custom: {
    // Will be filled by user
  }
}; 