import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { updateResponses } from '../../store/slices/onboardingSlice'
import { selectOnboardingResponses } from '../../store/slices/onboardingSlice'
import { 
  WRITING_GOALS_DATA,
  WRITING_CHALLENGES_DATA,
  WritingGoal,
  WritingChallenge
} from '../../types/userPreferences'
import { Target, AlertCircle } from 'lucide-react'

interface GoalsSelectionProps {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

const GoalsSelection: React.FC<GoalsSelectionProps> = ({ onNext, onBack, onSkip }) => {
  const dispatch = useDispatch()
  const responses = useSelector(selectOnboardingResponses)
  
  const [selectedGoals, setSelectedGoals] = useState<WritingGoal[]>(
    responses.writingGoals || []
  )
  const [selectedChallenges, setSelectedChallenges] = useState<WritingChallenge[]>(
    responses.writingChallenges || []
  )

  const handleToggleGoal = (goal: WritingGoal) => {
    setSelectedGoals(prev => {
      if (prev.includes(goal)) {
        return prev.filter(g => g !== goal)
      } else if (prev.length < 3) {
        return [...prev, goal]
      }
      return prev
    })
  }

  const handleToggleChallenge = (challenge: WritingChallenge) => {
    setSelectedChallenges(prev => {
      if (prev.includes(challenge)) {
        return prev.filter(c => c !== challenge)
      } else {
        return [...prev, challenge]
      }
    })
  }

  const handleContinue = () => {
    dispatch(updateResponses({
      writingGoals: selectedGoals,
      writingChallenges: selectedChallenges
    }))
    onNext()
  }

  const canContinue = selectedGoals.length > 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          What are your writing goals?
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
          Understanding your objectives helps us provide better guidance
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <span>Step 3 of 6</span>
          <div className="flex gap-1">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`h-1 w-8 rounded-full ${
                  i < 3 ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        {/* Goals Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              What are your writing goals?
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Select up to 3 that matter most to you
          </p>
          
          <div className="grid gap-3 sm:grid-cols-2">
            {WRITING_GOALS_DATA.map((goal) => (
              <label
                key={goal.value}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedGoals.includes(goal.value)
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                } ${
                  !selectedGoals.includes(goal.value) && selectedGoals.length >= 3
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedGoals.includes(goal.value)}
                  onChange={() => handleToggleGoal(goal.value)}
                  disabled={!selectedGoals.includes(goal.value) && selectedGoals.length >= 3}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    selectedGoals.includes(goal.value)
                      ? 'border-primary-600 bg-primary-600'
                      : 'border-gray-400 dark:border-gray-600'
                  }`}
                >
                  {selectedGoals.includes(goal.value) && (
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
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {goal.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Challenges Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              What challenges do you face?
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Optional - select any that apply
          </p>
          
          <div className="grid gap-3 sm:grid-cols-2">
            {WRITING_CHALLENGES_DATA.map((challenge) => (
              <label
                key={challenge.value}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedChallenges.includes(challenge.value)
                    ? 'border-amber-600 bg-amber-50 dark:bg-amber-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedChallenges.includes(challenge.value)}
                  onChange={() => handleToggleChallenge(challenge.value)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    selectedChallenges.includes(challenge.value)
                      ? 'border-amber-600 bg-amber-600'
                      : 'border-gray-400 dark:border-gray-600'
                  }`}
                >
                  {selectedChallenges.includes(challenge.value) && (
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
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {challenge.label}
                </span>
              </label>
            ))}
          </div>
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

export default GoalsSelection 