// User Preferences Types

export type EducationLevel = 
  | 'high_school'
  | 'undergraduate'
  | 'graduate'
  | 'phd'
  | 'postdoc'
  | 'professor'
  | 'professional';

export type WritingPurpose = 
  | 'academic'
  | 'business'
  | 'email'
  | 'creative'
  | 'technical'
  | 'social'
  | 'general';

export type WritingGoal = 
  | 'improve_grammar'
  | 'write_clearly'
  | 'expand_vocabulary'
  | 'consistent_tone'
  | 'academic_standards'
  | 'reduce_time'
  | 'improve_readability'
  | 'learn_mistakes';

export type WritingChallenge = 
  | 'esl'
  | 'formal_tone'
  | 'run_on_sentences'
  | 'punctuation'
  | 'organization'
  | 'procrastination';

export type GrammarSensitivity = 'strict' | 'balanced' | 'relaxed';

export type DocumentType = 
  | 'research_paper'
  | 'essay'
  | 'report'
  | 'email'
  | 'blog_post'
  | 'letter'
  | 'technical_doc'
  | 'creative'
  | 'social_post';

export type FieldOfStudy = 
  | 'sciences'
  | 'humanities'
  | 'business'
  | 'technology'
  | 'arts'
  | 'medicine'
  | 'law'
  | 'education'
  | 'other';

export type TutorialOption = 
  | 'interactive'
  | 'templates'
  | 'jump_in'
  | 'import_doc'
  | 'import';

export interface UserPreferences {
  id: string;
  userId: string;
  
  // Background
  educationLevel?: EducationLevel;
  fieldOfStudy?: FieldOfStudy;
  primaryLanguage: string;
  nativeLanguage?: string;
  
  // Writing Purpose
  writingPurposes: WritingPurpose[];
  
  // Goals & Challenges
  writingGoals: WritingGoal[];
  writingChallenges: WritingChallenge[];
  
  // Style Preferences
  defaultStyleProfileId?: string;
  autoDetectStyle: boolean;
  alwaysAskStyle: boolean;
  
  // Writing Preferences
  formalityLevel: number; // 1-10
  grammarSensitivity: GrammarSensitivity;
  preferredDocumentTypes: DocumentType[];
  
  // Features
  enableAiSuggestions: boolean;
  enableLearningMode: boolean;
  showTips: boolean;
  enableAutoSave: boolean;
  
  // Notifications
  dailyWritingReminders: boolean;
  weeklyProgressReports: boolean;
  grammarTips: boolean;
  featureAnnouncements: boolean;
  
  // Accessibility
  largerTextSize: boolean;
  highContrastMode: boolean;
  screenReaderOptimized: boolean;
  reducedAnimations: boolean;
  keyboardNavHints: boolean;
  
  // Onboarding Status
  onboardingCompleted: boolean;
  onboardingCompletedAt?: Date;
  onboardingSkipped: boolean;
  onboardingCurrentStep: number;
  tutorialCompleted: boolean;
  tutorialCompletedAt?: Date;
  tutorialOption?: TutorialOption;
  
  // Writing Sample
  writingSampleAnalyzed: boolean;
  writingSampleMetrics?: Record<string, any>;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingStep {
  id: number;
  title: string;
  description?: string;
  component: string;
  isOptional?: boolean;
}

export interface OnboardingState {
  currentStep: number;
  totalSteps: number;
  responses: Partial<UserPreferences>;
  isLoading: boolean;
  error: string | null;
  skipAvailable: boolean;
}

// Form data interfaces for each step
export interface PurposeSelectionData {
  writingPurposes: WritingPurpose[];
}

export interface BackgroundData {
  educationLevel: EducationLevel;
  fieldOfStudy: FieldOfStudy;
  primaryLanguage: string;
  nativeLanguage?: string;
}

export interface GoalsData {
  writingGoals: WritingGoal[];
  writingChallenges: WritingChallenge[];
}

export interface StyleProfileData {
  defaultStyleProfileId: string;
  autoDetectStyle: boolean;
  alwaysAskStyle: boolean;
}

export interface WritingPreferencesData {
  formalityLevel: number;
  preferredDocumentTypes: DocumentType[];
  grammarSensitivity: GrammarSensitivity;
  enableAiSuggestions: boolean;
  enableLearningMode: boolean;
  showTips: boolean;
}

export interface TutorialSetupData {
  tutorialOption: TutorialOption;
  showTips: boolean;
  emailNotifications: {
    weeklyInsights: boolean;
    grammarTips: boolean;
  };
}

// Helper data
export const EDUCATION_LEVELS: { value: EducationLevel; label: string; description?: string }[] = [
  { value: 'high_school', label: 'High School' },
  { value: 'undergraduate', label: 'Undergraduate Student' },
  { value: 'graduate', label: 'Graduate Student (Masters)' },
  { value: 'phd', label: 'PhD Candidate' },
  { value: 'postdoc', label: 'Post-Doctoral' },
  { value: 'professor', label: 'Professor/Educator' },
  { value: 'professional', label: 'Professional (Non-Academic)' }
];

export const FIELDS_OF_STUDY: { value: FieldOfStudy; label: string }[] = [
  { value: 'sciences', label: 'Sciences' },
  { value: 'humanities', label: 'Humanities' },
  { value: 'business', label: 'Business' },
  { value: 'technology', label: 'Technology' },
  { value: 'arts', label: 'Arts' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'law', label: 'Law' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' }
];

export const WRITING_PURPOSES_DATA: { value: WritingPurpose; label: string; icon: string; description: string }[] = [
  { value: 'academic', label: 'Academic Writing', icon: '📚', description: 'Essays, Research Papers, Dissertations' },
  { value: 'business', label: 'Professional Documents', icon: '💼', description: 'Reports, Proposals, Memos' },
  { value: 'email', label: 'Email & Communication', icon: '📧', description: 'Professional and personal emails' },
  { value: 'creative', label: 'Creative Writing', icon: '✍️', description: 'Stories, Blogs, Articles' },
  { value: 'technical', label: 'Technical Documentation', icon: '🔧', description: 'Guides, manuals, specifications' },
  { value: 'social', label: 'Social Media Content', icon: '💬', description: 'Posts, captions, threads' },
  { value: 'general', label: 'General Writing Improvement', icon: '📝', description: 'All-purpose writing enhancement' }
];

export const WRITING_GOALS_DATA: { value: WritingGoal; label: string }[] = [
  { value: 'improve_grammar', label: 'Improve grammar and punctuation' },
  { value: 'write_clearly', label: 'Write more clearly and concisely' },
  { value: 'expand_vocabulary', label: 'Expand vocabulary' },
  { value: 'consistent_tone', label: 'Maintain consistent tone' },
  { value: 'academic_standards', label: 'Meet academic standards' },
  { value: 'reduce_time', label: 'Reduce writing time' },
  { value: 'improve_readability', label: 'Improve readability scores' },
  { value: 'learn_mistakes', label: 'Learn from my mistakes' }
];

export const WRITING_CHALLENGES_DATA: { value: WritingChallenge; label: string }[] = [
  { value: 'esl', label: 'English is my second language' },
  { value: 'formal_tone', label: 'Struggle with formal/academic tone' },
  { value: 'run_on_sentences', label: 'Tend to write run-on sentences' },
  { value: 'punctuation', label: 'Unsure about punctuation rules' },
  { value: 'organization', label: 'Difficulty organizing thoughts' },
  { value: 'procrastination', label: 'Procrastination/writer\'s block' }
];

export const DOCUMENT_TYPES_DATA: { value: DocumentType; label: string }[] = [
  { value: 'research_paper', label: 'Research Papers' },
  { value: 'essay', label: 'Essays' },
  { value: 'report', label: 'Reports' },
  { value: 'email', label: 'Emails' },
  { value: 'blog_post', label: 'Blog Posts' },
  { value: 'letter', label: 'Letters' },
  { value: 'technical_doc', label: 'Technical Docs' },
  { value: 'creative', label: 'Creative Works' },
  { value: 'social_post', label: 'Social Posts' }
]; 