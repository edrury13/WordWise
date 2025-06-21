import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { updateResponses } from '../../store/slices/onboardingSlice'
import { selectOnboardingResponses } from '../../store/slices/onboardingSlice'
import { AppDispatch, RootState } from '../../store'
import { fetchUserProfiles } from '../../store/slices/styleProfileSlice'
import { BookOpen, Briefcase, Edit3, Wrench, Mail, MessageSquare, Sparkles } from 'lucide-react'

interface StyleProfileSelectionProps {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

const PROFILE_ICONS = {
  academic: BookOpen,
  business: Briefcase,
  creative: Edit3,
  technical: Wrench,
  email: Mail,
  social: MessageSquare,
}

const PROFILE_DESCRIPTIONS = {
  academic: 'Formal tone, complex sentences, citations, no contractions',
  business: 'Clear, concise, action-oriented, professional tone',
  creative: 'Flexible grammar, stylistic fragments, rich language',
  technical: 'Imperative mood, consistent terminology, step-by-step',
  email: 'Adaptive tone, clear CTAs, appropriate greetings',
  social: 'Character limits, hashtags, engagement-focused',
}

const StyleProfileSelection: React.FC<StyleProfileSelectionProps> = ({ onNext, onBack, onSkip }) => {
  const dispatch = useDispatch<AppDispatch>()
  const responses = useSelector(selectOnboardingResponses)
  const { profiles } = useSelector((state: RootState) => state.styleProfiles)
  
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    responses.defaultStyleProfileId || ''
  )
  const [autoDetect, setAutoDetect] = useState(responses.autoDetectStyle || false)
  const [alwaysAsk, setAlwaysAsk] = useState(responses.alwaysAskStyle || false)
  const [recommendedProfile, setRecommendedProfile] = useState<string>('')

  useEffect(() => {
    // Load style profiles if not already loaded
    if (profiles.length === 0) {
      dispatch(fetchUserProfiles())
    }
  }, [dispatch, profiles.length])

  useEffect(() => {
    // Recommend a profile based on user's purposes
    if (responses.writingPurposes && responses.writingPurposes.length > 0) {
      const purposes = responses.writingPurposes
      if (purposes.includes('academic')) {
        setRecommendedProfile('academic')
      } else if (purposes.includes('business')) {
        setRecommendedProfile('business')
      } else if (purposes.includes('creative')) {
        setRecommendedProfile('creative')
      } else if (purposes.includes('technical')) {
        setRecommendedProfile('technical')
      } else if (purposes.includes('email')) {
        setRecommendedProfile('email')
      } else if (purposes.includes('social')) {
        setRecommendedProfile('social')
      }
    }
  }, [responses.writingPurposes])

  const handleContinue = () => {
    dispatch(updateResponses({
      defaultStyleProfileId: selectedProfileId,
      autoDetectStyle: autoDetect,
      alwaysAskStyle: alwaysAsk
    }))
    onNext()
  }

  const canContinue = selectedProfileId || autoDetect

  // Filter for built-in profiles only
  const builtInProfiles = profiles.filter(p => !p.isCustom)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Choose your default writing style
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
          Select a style profile that matches your most common writing needs
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <span>Step 4 of 6</span>
          <div className="flex gap-1">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`h-1 w-8 rounded-full ${
                  i < 4 ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        {recommendedProfile && (
          <div className="mb-6 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-600" />
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                Based on your selections, we recommend: {builtInProfiles.find(p => p.profileType === recommendedProfile)?.name}
              </span>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {builtInProfiles.map((profile) => {
            const Icon = PROFILE_ICONS[profile.profileType as keyof typeof PROFILE_ICONS] || BookOpen
            const isRecommended = profile.profileType === recommendedProfile
            
            return (
              <button
                key={profile.id}
                onClick={() => setSelectedProfileId(profile.id)}
                className={`relative p-6 rounded-lg border-2 text-left transition-all duration-200 ${
                  selectedProfileId === profile.id
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                {isRecommended && (
                  <div className="absolute -top-2 -right-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-600 text-white">
                      ✨ Recommended
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${
                    selectedProfileId === profile.id
                      ? 'bg-primary-100 dark:bg-primary-800/30'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <Icon className={`w-6 h-6 ${
                      selectedProfileId === profile.id
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {profile.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {PROFILE_DESCRIPTIONS[profile.profileType as keyof typeof PROFILE_DESCRIPTIONS]}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedProfileId === profile.id
                        ? 'border-primary-600 bg-primary-600'
                        : 'border-gray-400 dark:border-gray-600'
                    }`}
                  >
                    {selectedProfileId === profile.id && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoDetect}
              onChange={(e) => {
                setAutoDetect(e.target.checked)
                if (e.target.checked) {
                  setAlwaysAsk(false)
                }
              }}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Auto-detect style for each document
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={alwaysAsk}
              onChange={(e) => {
                setAlwaysAsk(e.target.checked)
                if (e.target.checked) {
                  setAutoDetect(false)
                }
              }}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Always ask me when creating new documents
            </span>
          </label>
        </div>

        <div className="flex justify-between items-center mt-10">
          <button
            onClick={onBack}
            className="px-6 py-3 text-gray-700 dark:text-gray-300 font-medium hover:text-gray-900 dark:hover:text-gray-100"
          >
            ← Back
          </button>
          <div className="flex gap-4">
            <button
              onClick={onSkip}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-medium"
            >
              Skip onboarding
            </button>
            <button
              onClick={handleContinue}
              disabled={!canContinue}
              className={`px-8 py-3 rounded-lg font-medium transition-all ${
                canContinue
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StyleProfileSelection 