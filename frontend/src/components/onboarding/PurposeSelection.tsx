import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { updateResponses } from '../../store/slices/onboardingSlice'
import { selectOnboardingResponses } from '../../store/slices/onboardingSlice'
import { WRITING_PURPOSES_DATA, WritingPurpose } from '../../types/userPreferences'

interface PurposeSelectionProps {
  onNext: () => void
  onSkip: () => void
}

const PurposeSelection: React.FC<PurposeSelectionProps> = ({ onNext, onSkip }) => {
  const dispatch = useDispatch()
  const responses = useSelector(selectOnboardingResponses)
  const [selectedPurposes, setSelectedPurposes] = useState<WritingPurpose[]>(
    responses.writingPurposes || []
  )

  const handleTogglePurpose = (purpose: WritingPurpose) => {
    setSelectedPurposes(prev => {
      if (prev.includes(purpose)) {
        return prev.filter(p => p !== purpose)
      } else {
        return [...prev, purpose]
      }
    })
  }

  const handleContinue = () => {
    dispatch(updateResponses({ writingPurposes: selectedPurposes }))
    onNext()
  }

  const canContinue = selectedPurposes.length > 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Welcome to WordWise! 👋
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
          Let's personalize your writing experience in just 2 minutes.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <span>Step 1 of 6</span>
          <div className="flex gap-1">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`h-1 w-8 rounded-full ${
                  i === 0 ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          What brings you to WordWise today?
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Select all that apply - this helps us customize features for your needs.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {WRITING_PURPOSES_DATA.map((purpose) => (
            <button
              key={purpose.value}
              onClick={() => handleTogglePurpose(purpose.value)}
              className={`group relative p-6 rounded-lg border-2 text-left transition-all duration-200 ${
                selectedPurposes.includes(purpose.value)
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl" role="img" aria-label={purpose.label}>
                  {purpose.icon}
                </span>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {purpose.label}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {purpose.description}
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedPurposes.includes(purpose.value)
                      ? 'border-primary-600 bg-primary-600'
                      : 'border-gray-400 dark:border-gray-600'
                  }`}
                >
                  {selectedPurposes.includes(purpose.value) && (
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
          ))}
        </div>

        <div className="flex justify-between items-center mt-10">
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
  )
}

export default PurposeSelection 