import React from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { toggleAICheck, selectAIStats, selectAICheckEnabled, checkTextWithAI } from '../store/slices/suggestionSlice'
import { AIGrammarFeatures } from '../services/aiGrammarService'

interface AISuggestionPanelProps {
  suggestion?: any
  onApply?: (replacement: string) => void
}

const AISuggestionPanel: React.FC<AISuggestionPanelProps> = ({ suggestion, onApply }) => {
  const dispatch = useDispatch<AppDispatch>()
  const aiCheckEnabled = useSelector(selectAICheckEnabled)
  const aiStats = useSelector(selectAIStats)
  const { loading } = useSelector((state: RootState) => state.suggestions)

  const { content } = useSelector((state: RootState) => state.editor)
  
  const handleToggleAI = () => {
    dispatch(toggleAICheck())
    
    // If we're enabling AI and there's content, trigger an AI check
    if (!aiCheckEnabled && content && content.length > 0) {
      const textContent = content.map((node: any) => {
        if (node.children && Array.isArray(node.children)) {
          return node.children.map((child: any) => child.text || '').join('')
        }
        return ''
      }).join('\n')
      
      if (textContent.trim().length > 3) {
        setTimeout(() => {
          dispatch(checkTextWithAI({
            text: textContent,
            enableAI: true,
            documentType: 'general',
            checkType: 'comprehensive'
          }))
        }, 100) // Small delay to ensure state is updated
      }
    }
  }

  // Debug test function
  const testAICheck = () => {
    const testText = "Me want to goes to the store. The cat are sleeping on the couch. This are a incomplete sentence."
    console.log('🧪 Testing AI with known errors:', testText)
    dispatch(checkTextWithAI({
      text: testText,
      documentType: 'general',
      checkType: 'comprehensive'
    }))
  }

  // If showing a specific AI suggestion
  if (suggestion && AIGrammarFeatures.isAISuggestion(suggestion)) {
    return (
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🤖</span>
            <span className="text-sm font-semibold text-purple-700">AI-Powered Suggestion</span>
            <span className="text-sm text-purple-600">
              {AIGrammarFeatures.getSeverityIcon(suggestion.severity)}
            </span>
          </div>
          {suggestion.confidence && (
            <div className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
              {suggestion.confidence}% confident
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-800">{suggestion.message}</p>
            {suggestion.explanation && suggestion.explanation !== suggestion.message && (
              <p className="text-xs text-gray-600 mt-1">{suggestion.explanation}</p>
            )}
          </div>

          {suggestion.replacements && suggestion.replacements.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Suggested corrections:</p>
              {suggestion.isInformational || suggestion.offset < 0 ? (
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded text-xs text-purple-700 dark:text-purple-300">
                  <div className="flex items-center space-x-1 mb-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">Informational Only</span>
                  </div>
                  <p className="mb-2">Location in text could not be determined. Suggested corrections:</p>
                  <div className="space-y-1">
                    {suggestion.replacements.map((replacement: string, index: number) => (
                      <div key={index} className="px-2 py-1 bg-white dark:bg-gray-800 rounded">
                        "{replacement}"
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {suggestion.replacements.map((replacement: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => onApply?.(replacement)}
                      className="px-3 py-1 text-sm bg-white border border-purple-300 rounded-md hover:bg-purple-100 hover:border-purple-400 transition-colors"
                    >
                      {replacement}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-purple-100">
            <span className="text-xs text-gray-500">
              Category: {suggestion.category}
            </span>
            <span className="text-xs text-purple-600 font-medium">
              {AIGrammarFeatures.getConfidenceDescription(suggestion.confidence || 0)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // General AI stats panel
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
          <span>🤖</span>
          <span>AI Grammar Assistant</span>
        </h3>
        <button
          onClick={handleToggleAI}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            aiCheckEnabled ? 'bg-purple-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              aiCheckEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {aiCheckEnabled ? (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="ml-3 text-sm text-gray-600">AI is analyzing your text...</span>
            </div>
          ) : aiStats ? (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 mb-2">AI Analysis Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Issues:</span>
                    <span className="font-semibold text-gray-800">{aiStats.totalIssues}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Grammar:</span>
                    <span className="font-semibold text-gray-800">{aiStats.grammarIssues}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Spelling:</span>
                    <span className="font-semibold text-gray-800">{aiStats.spellingIssues}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Style:</span>
                    <span className="font-semibold text-gray-800">{aiStats.styleIssues}</span>
                  </div>
                </div>
                {aiStats.averageConfidence > 0 && (
                  <div className="mt-2 pt-2 border-t border-purple-100">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Avg. Confidence:</span>
                      <span className="font-semibold text-purple-700">
                        {aiStats.averageConfidence}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-blue-800 mb-1">AI Features</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Context-aware grammar checking</li>
                  <li>• Advanced style suggestions</li>
                  <li>• Clarity and conciseness improvements</li>
                  <li>• Tone consistency analysis</li>
                </ul>
              </div>

              <div className="text-xs text-gray-500 text-center">
                Powered by GPT-4 • Updates every few seconds
              </div>
              
              {/* Debug button - remove in production */}
              <button
                onClick={testAICheck}
                className="mt-2 w-full px-3 py-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 rounded transition-colors"
              >
                🧪 Test AI with sample errors
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-600 text-center py-4">
              <p className="mb-2">Start typing to see AI-powered suggestions</p>
              {/* Debug button - remove in production */}
              <button
                onClick={testAICheck}
                className="mt-2 px-3 py-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 rounded transition-colors"
              >
                🧪 Test AI with sample errors
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-gray-600 text-center py-4">
          <p className="mb-2">AI grammar checking is disabled</p>
          <p className="text-xs text-gray-500">
            Enable it for advanced grammar and style suggestions
          </p>
        </div>
      )}
    </div>
  )
}

export default AISuggestionPanel 