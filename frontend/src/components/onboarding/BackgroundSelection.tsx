import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { updateResponses } from '../../store/slices/onboardingSlice'
import { selectOnboardingResponses } from '../../store/slices/onboardingSlice'
import { 
  EDUCATION_LEVELS, 
  FIELDS_OF_STUDY,
  EducationLevel,
  FieldOfStudy
} from '../../types/userPreferences'

interface BackgroundSelectionProps {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

const LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-AU', label: 'English (AU)' },
  { value: 'en-CA', label: 'English (CA)' },
]

const COMMON_LANGUAGES = [
  { value: 'es', label: 'Spanish' },
  { value: 'zh', label: 'Chinese' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ar', label: 'Arabic' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'ko', label: 'Korean' },
  { value: 'it', label: 'Italian' },
  { value: 'other', label: 'Other' },
]

const BackgroundSelection: React.FC<BackgroundSelectionProps> = ({ onNext, onBack, onSkip }) => {
  const dispatch = useDispatch()
  const responses = useSelector(selectOnboardingResponses)
  
  const [educationLevel, setEducationLevel] = useState<EducationLevel | ''>(
    responses.educationLevel || ''
  )
  const [fieldOfStudy, setFieldOfStudy] = useState<FieldOfStudy | ''>(
    responses.fieldOfStudy || ''
  )
  const [primaryLanguage, setPrimaryLanguage] = useState(
    responses.primaryLanguage || 'en-US'
  )
  const [nativeLanguage, setNativeLanguage] = useState(
    responses.nativeLanguage || ''
  )
  const [isDifferentNative, setIsDifferentNative] = useState(
    !!responses.nativeLanguage && responses.nativeLanguage !== ''
  )

  const handleContinue = () => {
    const updates: any = {
      primaryLanguage,
    }
    
    if (educationLevel) updates.educationLevel = educationLevel
    if (fieldOfStudy) updates.fieldOfStudy = fieldOfStudy
    if (isDifferentNative && nativeLanguage) {
      updates.nativeLanguage = nativeLanguage
    }

    dispatch(updateResponses(updates))
    onNext()
  }

  const canContinue = educationLevel && fieldOfStudy

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Tell us about your background
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
          This helps us tailor suggestions to your context
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <span>Step 2 of 6</span>
          <div className="flex gap-1">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`h-1 w-8 rounded-full ${
                  i < 2 ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <div className="space-y-6">
          {/* Education Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Education Level
            </label>
            <select
              value={educationLevel}
              onChange={(e) => setEducationLevel(e.target.value as EducationLevel)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">Select your education level</option>
              {EDUCATION_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          {/* Field of Study */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Field of Study/Work
            </label>
            <select
              value={fieldOfStudy}
              onChange={(e) => setFieldOfStudy(e.target.value as FieldOfStudy)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">Select your field</option>
              {FIELDS_OF_STUDY.map((field) => (
                <option key={field.value} value={field.value}>
                  {field.label}
                </option>
              ))}
            </select>
          </div>

          {/* Primary Language */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Primary Writing Language
            </label>
            <select
              value={primaryLanguage}
              onChange={(e) => setPrimaryLanguage(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Native Language Check */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="differentNative"
              checked={isDifferentNative}
              onChange={(e) => setIsDifferentNative(e.target.checked)}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label 
              htmlFor="differentNative" 
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              My native language is different from my writing language
            </label>
          </div>

          {/* Native Language Selection */}
          {isDifferentNative && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Native Language
              </label>
              <select
                value={nativeLanguage}
                onChange={(e) => setNativeLanguage(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="">Select your native language</option>
                {COMMON_LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                This helps us provide better suggestions for common ESL patterns
              </p>
            </div>
          )}
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

export default BackgroundSelection 