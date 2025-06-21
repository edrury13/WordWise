import { supabase } from '../config/supabase'
import { UserPreferences } from '../types/userPreferences'

export const userPreferencesService = {
  // Get user preferences
  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No preferences found, create them
          console.log('No preferences found, creating default preferences...')
          
          // Create default preferences
          const { data: newPrefs, error: createError } = await supabase
            .from('user_preferences')
            .insert({ user_id: userId })
            .select()
            .single()
          
          if (createError) {
            console.error('Error creating default preferences:', createError)
            return null
          }
          
          return this.mapDbToPreferences(newPrefs)
        }
        throw error
      }

      return this.mapDbToPreferences(data)
    } catch (error) {
      console.error('Error fetching user preferences:', error)
      throw error
    }
  },

  // Create or update user preferences
  async saveUserPreferences(
    userId: string, 
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    try {
      const dbData = this.mapPreferencesToDb(preferences)
      
      const { data, error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          ...dbData
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single()

      if (error) throw error

      return this.mapDbToPreferences(data)
    } catch (error) {
      console.error('Error saving user preferences:', error)
      throw error
    }
  },

  // Update specific preferences
  async updatePreferences(
    userId: string,
    updates: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    try {
      const dbUpdates = this.mapPreferencesToDb(updates)
      
      const { data, error } = await supabase
        .from('user_preferences')
        .update(dbUpdates)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      return this.mapDbToPreferences(data)
    } catch (error) {
      console.error('Error updating user preferences:', error)
      throw error
    }
  },

  // Mark onboarding as completed
  async completeOnboarding(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) throw error
    } catch (error) {
      console.error('Error completing onboarding:', error)
      throw error
    }
  },

  // Skip onboarding
  async skipOnboarding(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({
          onboarding_skipped: true
        })
        .eq('user_id', userId)

      if (error) throw error
    } catch (error) {
      console.error('Error skipping onboarding:', error)
      throw error
    }
  },

  // Update onboarding progress
  async updateOnboardingStep(userId: string, step: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({
          onboarding_current_step: step
        })
        .eq('user_id', userId)

      if (error) throw error
    } catch (error) {
      console.error('Error updating onboarding step:', error)
      throw error
    }
  },

  // Check if user needs onboarding
  async checkNeedsOnboarding(userId: string): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId)
      
      if (!preferences) {
        // If we couldn't get or create preferences, assume they need onboarding
        return true
      }

      return !preferences.onboardingCompleted && !preferences.onboardingSkipped
    } catch (error) {
      console.error('Error checking onboarding status:', error)
      // Default to true if there's an error, so users can complete onboarding
      return true
    }
  },

  // Helper function to map database fields to frontend types
  mapDbToPreferences(data: any): UserPreferences {
    return {
      id: data.id,
      userId: data.user_id,
      
      // Background
      educationLevel: data.education_level,
      fieldOfStudy: data.field_of_study,
      primaryLanguage: data.primary_language,
      nativeLanguage: data.native_language,
      
      // Writing Purpose
      writingPurposes: data.writing_purposes || [],
      
      // Goals & Challenges
      writingGoals: data.writing_goals || [],
      writingChallenges: data.writing_challenges || [],
      
      // Style Preferences
      defaultStyleProfileId: data.default_style_profile_id,
      autoDetectStyle: data.auto_detect_style,
      alwaysAskStyle: data.always_ask_style,
      
      // Writing Preferences
      formalityLevel: data.formality_level,
      grammarSensitivity: data.grammar_sensitivity,
      preferredDocumentTypes: data.preferred_document_types || [],
      
      // Features
      enableAiSuggestions: data.enable_ai_suggestions,
      enableLearningMode: data.enable_learning_mode,
      showTips: data.show_tips,
      enableAutoSave: data.enable_auto_save,
      
      // Notifications
      dailyWritingReminders: data.daily_writing_reminders,
      weeklyProgressReports: data.weekly_progress_reports,
      grammarTips: data.grammar_tips,
      featureAnnouncements: data.feature_announcements,
      
      // Accessibility
      largerTextSize: data.larger_text_size,
      highContrastMode: data.high_contrast_mode,
      screenReaderOptimized: data.screen_reader_optimized,
      reducedAnimations: data.reduced_animations,
      keyboardNavHints: data.keyboard_nav_hints,
      
      // Onboarding Status
      onboardingCompleted: data.onboarding_completed,
      onboardingCompletedAt: data.onboarding_completed_at ? new Date(data.onboarding_completed_at) : undefined,
      onboardingSkipped: data.onboarding_skipped,
      onboardingCurrentStep: data.onboarding_current_step,
      tutorialCompleted: data.tutorial_completed,
      tutorialCompletedAt: data.tutorial_completed_at ? new Date(data.tutorial_completed_at) : undefined,
      
      // Writing Sample
      writingSampleAnalyzed: data.writing_sample_analyzed,
      writingSampleMetrics: data.writing_sample_metrics,
      
      // Metadata
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  },

  // Helper function to map frontend types to database fields
  mapPreferencesToDb(preferences: Partial<UserPreferences>): any {
    const dbData: any = {}

    // Map fields that exist
    if (preferences.educationLevel !== undefined) dbData.education_level = preferences.educationLevel
    if (preferences.fieldOfStudy !== undefined) dbData.field_of_study = preferences.fieldOfStudy
    if (preferences.primaryLanguage !== undefined) dbData.primary_language = preferences.primaryLanguage
    if (preferences.nativeLanguage !== undefined) dbData.native_language = preferences.nativeLanguage
    
    if (preferences.writingPurposes !== undefined) dbData.writing_purposes = preferences.writingPurposes
    if (preferences.writingGoals !== undefined) dbData.writing_goals = preferences.writingGoals
    if (preferences.writingChallenges !== undefined) dbData.writing_challenges = preferences.writingChallenges
    
    if (preferences.defaultStyleProfileId !== undefined) dbData.default_style_profile_id = preferences.defaultStyleProfileId
    if (preferences.autoDetectStyle !== undefined) dbData.auto_detect_style = preferences.autoDetectStyle
    if (preferences.alwaysAskStyle !== undefined) dbData.always_ask_style = preferences.alwaysAskStyle
    
    if (preferences.formalityLevel !== undefined) dbData.formality_level = preferences.formalityLevel
    if (preferences.grammarSensitivity !== undefined) dbData.grammar_sensitivity = preferences.grammarSensitivity
    if (preferences.preferredDocumentTypes !== undefined) dbData.preferred_document_types = preferences.preferredDocumentTypes
    
    if (preferences.enableAiSuggestions !== undefined) dbData.enable_ai_suggestions = preferences.enableAiSuggestions
    if (preferences.enableLearningMode !== undefined) dbData.enable_learning_mode = preferences.enableLearningMode
    if (preferences.showTips !== undefined) dbData.show_tips = preferences.showTips
    if (preferences.enableAutoSave !== undefined) dbData.enable_auto_save = preferences.enableAutoSave
    
    if (preferences.dailyWritingReminders !== undefined) dbData.daily_writing_reminders = preferences.dailyWritingReminders
    if (preferences.weeklyProgressReports !== undefined) dbData.weekly_progress_reports = preferences.weeklyProgressReports
    if (preferences.grammarTips !== undefined) dbData.grammar_tips = preferences.grammarTips
    if (preferences.featureAnnouncements !== undefined) dbData.feature_announcements = preferences.featureAnnouncements
    
    if (preferences.largerTextSize !== undefined) dbData.larger_text_size = preferences.largerTextSize
    if (preferences.highContrastMode !== undefined) dbData.high_contrast_mode = preferences.highContrastMode
    if (preferences.screenReaderOptimized !== undefined) dbData.screen_reader_optimized = preferences.screenReaderOptimized
    if (preferences.reducedAnimations !== undefined) dbData.reduced_animations = preferences.reducedAnimations
    if (preferences.keyboardNavHints !== undefined) dbData.keyboard_nav_hints = preferences.keyboardNavHints
    
    if (preferences.onboardingCompleted !== undefined) dbData.onboarding_completed = preferences.onboardingCompleted
    if (preferences.onboardingCompletedAt !== undefined) dbData.onboarding_completed_at = preferences.onboardingCompletedAt
    if (preferences.onboardingSkipped !== undefined) dbData.onboarding_skipped = preferences.onboardingSkipped
    if (preferences.onboardingCurrentStep !== undefined) dbData.onboarding_current_step = preferences.onboardingCurrentStep
    if (preferences.tutorialCompleted !== undefined) dbData.tutorial_completed = preferences.tutorialCompleted
    if (preferences.tutorialCompletedAt !== undefined) dbData.tutorial_completed_at = preferences.tutorialCompletedAt
    
    if (preferences.writingSampleAnalyzed !== undefined) dbData.writing_sample_analyzed = preferences.writingSampleAnalyzed
    if (preferences.writingSampleMetrics !== undefined) dbData.writing_sample_metrics = preferences.writingSampleMetrics

    return dbData
  }
} 