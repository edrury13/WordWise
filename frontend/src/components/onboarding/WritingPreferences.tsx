import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { updateResponses } from '../../store/slices/onboardingSlice'
import { selectOnboardingResponses } from '../../store/slices/onboardingSlice'
import { 
  DOCUMENT_TYPES_DATA,
  DocumentType,
  GrammarSensitivity
} from '../../types/userPreferences'
import { Sliders, FileText, Sparkles } from 'lucide-react'

interface WritingPreferencesProps {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

const WritingPreferences: React.FC<WritingPreferencesProps> = ({ onNext, onBack, onSkip }) => {
  const dispatch = useDispatch()
  const responses = useSelector(selectOnboardingResponses)
  
  const [formalityLevel, setFormalityLevel] = useState(responses.formalityLevel || 5)
  const [selectedDocTypes, setSelectedDocTypes] = useState<DocumentType[]>(
    responses.preferredDocumentTypes || []
  )
  const [grammarSensitivity, setGrammarSensitivity] = useState<GrammarSensitivity>(
    responses.grammarSensitivity || 'balanced'
  )
  const [enableAI, setEnableAI] = useState(responses.enableAiSuggestions ?? true)
  const [enableLearning, setEnableLearning] = useState(responses.enableLearningMode ?? true)
  const [showTips, setShowTips] = useState(responses.showTips ?? true)

  const handleToggleDocType = (docType: DocumentType) => {
    setSelectedDocTypes(prev => {
      if (prev.includes(docType)) {
        return prev.filter(d => d !== docType)
      } else {
        return [...prev, docType]
      }
    })
  }

  const handleContinue = () => {
    dispatch(updateResponses({
      formalityLevel,
      preferredDocumentTypes: selectedDocTypes,
      grammarSensitivity,
      enableAiSuggestions: enableAI,
      enableLearningMode: enableLearning,
      showTips
    }))
    onNext()
  }

  const getFormalityLabel = (level: number) => {
    if (level <= 2) return 'Very Casual'
    if (level <= 4) return 'Casual'
    if (level <= 6) return 'Balanced'
    if (level <= 8) return 'Formal'
    return 'Very Formal'
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Set your writing preferences
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
          Fine-tune how WordWise helps you write
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <span>Step 5 of 6</span>
          <div className="flex gap-1">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`h-1 w-8 rounded-full ${
                  i < 5 ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        {/* Formality Level */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sliders className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Formality Level
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            How formal should your default writing style be?
          </p>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Casual</span>
              <span className="text-sm font-medium text-primary-600">
                {getFormalityLabel(formalityLevel)}
              </span>
              <span className="text-sm text-gray-500">Formal</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={formalityLevel}
              onChange={(e) => setFormalityLevel(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(formalityLevel - 1) * 11.11}%, #E5E7EB ${(formalityLevel - 1) * 11.11}%, #E5E7EB 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
              <span>6</span>
              <span>7</span>
              <span>8</span>
              <span>9</span>
              <span>10</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
              Your emails: Casual | Your essays: Formal
            </p>
          </div>
        </div>

        {/* Document Types */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Preferred Document Types
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            What types of documents do you write most often?
          </p>
          
          <div className="grid grid-cols-3 gap-3">
            {DOCUMENT_TYPES_DATA.map((docType) => (
              <label
                key={docType.value}
                className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                  selectedDocTypes.includes(docType.value)
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDocTypes.includes(docType.value)}
                  onChange={() => handleToggleDocType(docType.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {docType.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Grammar Sensitivity */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Grammar Sensitivity
          </h2>
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all group hover:border-gray-400 dark:hover:border-gray-500"
              style={{
                borderColor: grammarSensitivity === 'strict' ? '#3B82F6' : '',
                backgroundColor: grammarSensitivity === 'strict' ? 'rgba(59, 130, 246, 0.05)' : ''
              }}
            >
              <input
                type="radio"
                name="grammarSensitivity"
                value="strict"
                checked={grammarSensitivity === 'strict'}
                onChange={(e) => setGrammarSensitivity(e.target.value as GrammarSensitivity)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                grammarSensitivity === 'strict' ? 'border-primary-600 bg-primary-600' : 'border-gray-400'
              }`}>
                {grammarSensitivity === 'strict' && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Strict</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Flag everything - Best for final drafts
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all group hover:border-gray-400 dark:hover:border-gray-500"
              style={{
                borderColor: grammarSensitivity === 'balanced' ? '#3B82F6' : '',
                backgroundColor: grammarSensitivity === 'balanced' ? 'rgba(59, 130, 246, 0.05)' : ''
              }}
            >
              <input
                type="radio"
                name="grammarSensitivity"
                value="balanced"
                checked={grammarSensitivity === 'balanced'}
                onChange={(e) => setGrammarSensitivity(e.target.value as GrammarSensitivity)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                grammarSensitivity === 'balanced' ? 'border-primary-600 bg-primary-600' : 'border-gray-400'
              }`}>
                {grammarSensitivity === 'balanced' && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  Balanced <span className="text-xs text-primary-600 font-normal">(Recommended)</span>
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Common issues only - Good for everyday writing
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all group hover:border-gray-400 dark:hover:border-gray-500"
              style={{
                borderColor: grammarSensitivity === 'relaxed' ? '#3B82F6' : '',
                backgroundColor: grammarSensitivity === 'relaxed' ? 'rgba(59, 130, 246, 0.05)' : ''
              }}
            >
              <input
                type="radio"
                name="grammarSensitivity"
                value="relaxed"
                checked={grammarSensitivity === 'relaxed'}
                onChange={(e) => setGrammarSensitivity(e.target.value as GrammarSensitivity)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                grammarSensitivity === 'relaxed' ? 'border-primary-600 bg-primary-600' : 'border-gray-400'
              }`}>
                {grammarSensitivity === 'relaxed' && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Relaxed</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Major errors only - Good for drafts and brainstorming
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* AI Features */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              AI-Powered Suggestions
            </h2>
          </div>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableAI}
                onChange={(e) => setEnableAI(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable smart grammar checking
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Get context-aware suggestions powered by AI
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableLearning}
                onChange={(e) => setEnableLearning(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Learn from my corrections over time
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Personalize suggestions based on your writing patterns
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showTips}
                onChange={(e) => setShowTips(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Show writing tips while I type
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Get helpful hints and best practices
                </p>
              </div>
            </label>
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
              className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-all"
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WritingPreferences 