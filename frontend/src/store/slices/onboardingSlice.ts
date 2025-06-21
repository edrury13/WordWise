import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { userPreferencesService } from '../../services/userPreferencesService'
import { UserPreferences, OnboardingState } from '../../types/userPreferences'
import { RootState } from '..'

// Initial state
const initialState: OnboardingState = {
  currentStep: 1,
  totalSteps: 6,
  responses: {
    // Default values
    primaryLanguage: 'en-US',
    writingPurposes: [],
    writingGoals: [],
    writingChallenges: [],
    autoDetectStyle: false,
    alwaysAskStyle: false,
    formalityLevel: 5,
    grammarSensitivity: 'balanced',
    preferredDocumentTypes: [],
    enableAiSuggestions: true,
    enableLearningMode: true,
    showTips: true,
    enableAutoSave: true,
    dailyWritingReminders: false,
    weeklyProgressReports: false,
    grammarTips: false,
    featureAnnouncements: true,
    largerTextSize: false,
    highContrastMode: false,
    screenReaderOptimized: false,
    reducedAnimations: false,
    keyboardNavHints: false,
  },
  isLoading: false,
  error: null,
  skipAvailable: true,
}

// Async thunks
export const loadOnboardingProgress = createAsyncThunk(
  'onboarding/loadProgress',
  async (userId: string) => {
    const preferences = await userPreferencesService.getUserPreferences(userId)
    return preferences
  }
)

export const saveOnboardingProgress = createAsyncThunk(
  'onboarding/saveProgress',
  async ({ userId, preferences }: { userId: string; preferences: Partial<UserPreferences> }) => {
    const saved = await userPreferencesService.saveUserPreferences(userId, preferences)
    return saved
  }
)

export const completeOnboarding = createAsyncThunk(
  'onboarding/complete',
  async ({ userId, preferences }: { userId: string; preferences: Partial<UserPreferences> }) => {
    // Save all preferences and mark onboarding complete
    const finalPreferences = {
      ...preferences,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date()
    }
    const saved = await userPreferencesService.saveUserPreferences(userId, finalPreferences)
    return saved
  }
)

export const skipOnboarding = createAsyncThunk(
  'onboarding/skip',
  async (userId: string) => {
    await userPreferencesService.skipOnboarding(userId)
  }
)

// Slice
const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    setCurrentStep: (state, action: PayloadAction<number>) => {
      state.currentStep = action.payload
    },
    
    nextStep: (state) => {
      if (state.currentStep < state.totalSteps) {
        state.currentStep++
      }
    },
    
    previousStep: (state) => {
      if (state.currentStep > 1) {
        state.currentStep--
      }
    },
    
    updateResponses: (state, action: PayloadAction<Partial<UserPreferences>>) => {
      state.responses = {
        ...state.responses,
        ...action.payload
      }
    },
    
    resetOnboarding: (state) => {
      Object.assign(state, initialState)
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    }
  },
  
  extraReducers: (builder) => {
    // Load progress
    builder
      .addCase(loadOnboardingProgress.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadOnboardingProgress.fulfilled, (state, action) => {
        state.isLoading = false
        if (action.payload) {
          // Update responses with existing preferences
          state.responses = {
            ...state.responses,
            ...action.payload
          }
          // Set current step based on saved progress
          if (action.payload.onboardingCurrentStep) {
            state.currentStep = action.payload.onboardingCurrentStep
          }
        }
      })
      .addCase(loadOnboardingProgress.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to load onboarding progress'
      })
    
    // Save progress
    builder
      .addCase(saveOnboardingProgress.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(saveOnboardingProgress.fulfilled, (state) => {
        state.isLoading = false
      })
      .addCase(saveOnboardingProgress.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to save onboarding progress'
      })
    
    // Complete onboarding
    builder
      .addCase(completeOnboarding.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(completeOnboarding.fulfilled, (state) => {
        state.isLoading = false
        // Reset state after completion
        Object.assign(state, initialState)
      })
      .addCase(completeOnboarding.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to complete onboarding'
      })
    
    // Skip onboarding
    builder
      .addCase(skipOnboarding.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(skipOnboarding.fulfilled, (state) => {
        state.isLoading = false
        // Reset state after skipping
        Object.assign(state, initialState)
      })
      .addCase(skipOnboarding.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to skip onboarding'
      })
  }
})

// Actions
export const {
  setCurrentStep,
  nextStep,
  previousStep,
  updateResponses,
  resetOnboarding,
  setError
} = onboardingSlice.actions

// Selectors
export const selectOnboardingState = (state: RootState) => state.onboarding
export const selectCurrentStep = (state: RootState) => state.onboarding.currentStep
export const selectOnboardingResponses = (state: RootState) => state.onboarding.responses
export const selectOnboardingLoading = (state: RootState) => state.onboarding.isLoading
export const selectOnboardingError = (state: RootState) => state.onboarding.error

// Export reducer
export default onboardingSlice.reducer 