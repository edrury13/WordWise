import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { updateResponses } from '../../store/slices/onboardingSlice'
import { selectOnboardingResponses } from '../../store/slices/onboardingSlice'
import { PlayCircle, FileText, Rocket, Upload, Mail, CheckCircle } from 'lucide-react'

interface TutorialSetupProps {
  onComplete: () => void
  onBack: () => void
}

const TutorialSetup: React.FC<TutorialSetupProps> = ({ onComplete, onBack }) => {
  const dispatch = useDispatch()
  const responses = useSelector(selectOnboardingResponses)
  
  const [selectedOption, setSelectedOption] = useState<string>('interactive')
  const [showTips, setShowTips] = useState(responses.showTips ?? true)
  const [weeklyInsights, setWeeklyInsights] = useState(
    responses.weeklyProgressReports || false
  )
  const [grammarTips, setGrammarTips] = useState(
    responses.grammarTips || false
  )

  const handleComplete = () => {
    dispatch(updateResponses({
      showTips,
      weeklyProgressReports: weeklyInsights,
      grammarTips,
      tutorialOption: selectedOption as any // Type assertion needed since selectedOption is string
    }))
    onComplete()
  }

  const tutorialOptions = [
    {
      id: 'interactive',
      icon: PlayCircle,
      title: '🎯 Interactive Tutorial',
      description: 'Walk through key features with a sample document',
      duration: '5 min',
      recommended: true
    },
    {
      id: 'templates',
      icon: FileText,
      title: '📝 Start with Templates',
      description: 'Choose from academic, business, or creative templates',
      duration: 'Quick start'
    },
    {
      id: 'jump_in',
      icon: Rocket,
      title: '🚀 Jump Right In',
      description: 'Create your first document now',
      duration: 'Immediate'
    },
    {
      id: 'import',
      icon: Upload,
      title: '📄 Import Existing Document',
      description: 'Upload a document to see WordWise in action',
      duration: 'Quick start'
    }
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Almost done! How would you like to get started?
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
          Choose how to begin your WordWise journey
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <span>Step 6 of 6</span>
          <div className="flex gap-1">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-1 w-8 rounded-full bg-primary-600"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        {/* Tutorial Options */}
        <div className="grid gap-4 mb-8">
          {tutorialOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                onClick={() => setSelectedOption(option.id)}
                className={`relative p-6 rounded-lg border-2 text-left transition-all duration-200 ${
                  selectedOption === option.id
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                {option.recommended && (
                  <div className="absolute -top-2 -right-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-600 text-white">
                      Recommended
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${
                    selectedOption === option.id
                      ? 'bg-primary-100 dark:bg-primary-800/30'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <Icon className={`w-6 h-6 ${
                      selectedOption === option.id
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {option.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {option.description}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 inline-block">
                      {option.duration}
                    </span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedOption === option.id
                        ? 'border-primary-600 bg-primary-600'
                        : 'border-gray-400 dark:border-gray-600'
                    }`}
                  >
                    {selectedOption === option.id && (
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

        {/* Additional Preferences */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Stay Connected
            </h2>
          </div>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showTips}
                onChange={(e) => setShowTips(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Show tips while I write
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Get contextual help as you work
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={weeklyInsights}
                onChange={(e) => setWeeklyInsights(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email me weekly writing insights
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Track your progress and improvement
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={grammarTips}
                onChange={(e) => setGrammarTips(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Grammar tip of the week
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Learn one new writing rule each week
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Success Message */}
        <div className="mt-8 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-green-800 dark:text-green-200 mb-1">
                Personalization Complete!
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                WordWise is now customized for your writing needs. You can always adjust these settings later in your profile.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-10">
          <button
            onClick={onBack}
            className="px-6 py-3 text-gray-700 dark:text-gray-300 font-medium hover:text-gray-900 dark:hover:text-gray-100"
          >
            ← Back
          </button>
          <button
            onClick={handleComplete}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all flex items-center gap-2"
          >
            Get Started
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default TutorialSetup 