# WordWise Onboarding Experience Guide

## Overview

WordWise now includes a comprehensive 6-step onboarding experience that personalizes the application for each user's specific writing needs. The onboarding collects user preferences, background information, and writing goals to provide tailored suggestions and features.

## Features

### 🎯 6-Step Onboarding Flow

1. **Purpose Selection** - Users select their primary writing purposes
2. **Background Information** - Academic/professional background and language preferences
3. **Goals & Challenges** - Writing objectives and areas for improvement
4. **Style Profile Selection** - Default writing style with smart recommendations
5. **Writing Preferences** - Formality level, document types, and AI settings
6. **Tutorial Setup** - Choose how to get started with WordWise

### 🔄 Progressive Disclosure

- Users can skip onboarding at any time
- Progress is automatically saved between steps
- Can return to complete onboarding later
- Each step takes ~30 seconds

### 🎨 Smart Recommendations

- Style profiles are recommended based on user's purposes
- Personalized suggestions throughout the app
- Adaptive learning from user corrections

### 📊 User Preferences Stored

- Education level and field of study
- Native language (for ESL support)
- Writing goals (up to 3 primary goals)
- Writing challenges
- Default style profile
- Grammar sensitivity level
- Preferred document types
- AI and learning preferences
- Notification settings
- Accessibility options

## Database Schema

### user_preferences Table

```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  
  -- Background
  education_level TEXT,
  field_of_study TEXT,
  primary_language TEXT DEFAULT 'en-US',
  native_language TEXT,
  
  -- Purposes & Goals
  writing_purposes TEXT[],
  writing_goals TEXT[],
  writing_challenges TEXT[],
  
  -- Style Settings
  default_style_profile_id UUID,
  auto_detect_style BOOLEAN,
  formality_level INTEGER (1-10),
  grammar_sensitivity TEXT,
  
  -- Features
  enable_ai_suggestions BOOLEAN,
  enable_learning_mode BOOLEAN,
  show_tips BOOLEAN,
  
  -- Onboarding Status
  onboarding_completed BOOLEAN,
  onboarding_current_step INTEGER,
  tutorial_option TEXT,
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Implementation Details

### Frontend Components

1. **OnboardingPage** (`/src/pages/OnboardingPage.tsx`)
   - Main container managing the flow
   - Handles navigation between steps
   - Saves progress automatically

2. **Step Components** (`/src/components/onboarding/`)
   - PurposeSelection
   - BackgroundSelection
   - GoalsSelection
   - StyleProfileSelection
   - WritingPreferences
   - TutorialSetup

3. **Redux State Management** (`/src/store/slices/onboardingSlice.ts`)
   - Manages onboarding state
   - Handles async operations
   - Persists user responses

4. **User Preferences Service** (`/src/services/userPreferencesService.ts`)
   - CRUD operations for preferences
   - Onboarding status checks
   - Data transformation utilities

### Protected Route Enhancement

The `ProtectedRoute` component now checks if users need onboarding and automatically redirects them to `/onboarding` if they haven't completed it.

### Navigation Flow

```
Registration/First Login
         ↓
   Onboarding Check
         ↓
   [Needs Onboarding?]
    Yes ↓        ↓ No
  /onboarding   /dashboard
```

## User Experience

### First-Time Users

1. After registration, users are automatically directed to onboarding
2. Can skip at any time and set preferences later
3. Progress is saved between sessions

### Returning Users

- If onboarding was skipped, gentle reminders in dashboard
- Can access onboarding from user settings
- Preferences can be updated anytime

### Benefits

1. **Personalized Experience** - Grammar checking tailored to user's needs
2. **Better Suggestions** - Context-aware based on education and goals
3. **ESL Support** - Special handling for non-native speakers
4. **Reduced Friction** - Users understand features immediately
5. **Higher Engagement** - Users feel the app is built for them

## Future Enhancements

1. **Writing Sample Analysis** - Analyze user's writing to auto-configure settings
2. **Team Onboarding** - Shared preferences for organizations
3. **Progressive Onboarding** - Additional steps unlocked over time
4. **A/B Testing** - Optimize flow based on completion rates
5. **Integration Preferences** - Connect Google Docs, Word, etc.

## Analytics to Track

- Completion rate per step
- Skip rate and reasons
- Time spent per step
- Most selected options
- Correlation between preferences and feature usage

## Accessibility

- All components are keyboard navigable
- Screen reader friendly
- High contrast mode support
- Reduced motion options
- Clear focus indicators

## Testing Checklist

- [ ] New user sees onboarding after registration
- [ ] Progress saves between sessions
- [ ] Skip button works at each step
- [ ] Style profile recommendations match purposes
- [ ] Preferences apply to grammar checking
- [ ] Protected routes redirect to onboarding
- [ ] Completed users bypass onboarding
- [ ] Mobile responsive design
- [ ] Dark mode support
- [ ] Error handling for failed saves 