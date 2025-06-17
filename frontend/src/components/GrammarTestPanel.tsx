import React, { useState } from 'react'
import { testLanguageAPI, checkGrammarAndSpelling } from '../services/languageService'

const GrammarTestPanel: React.FC = () => {
  const [testResult, setTestResult] = useState<any>(null)
  const [customText, setCustomText] = useState('')
  const [customResult, setCustomResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runAPITest = async () => {
    setLoading(true)
    try {
      const result = await testLanguageAPI()
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  const testCustomText = async () => {
    if (!customText.trim()) return
    
    setLoading(true)
    try {
      const result = await checkGrammarAndSpelling(customText)
      const suggestions = result.suggestions
      setCustomResult({
        success: true,
        text: customText,
        suggestions,
        apiStatus: result.apiStatus,
        stats: {
          total: suggestions.length,
          grammar: suggestions.filter(s => s.type === 'grammar').length,
          spelling: suggestions.filter(s => s.type === 'spelling').length,
          style: suggestions.filter(s => s.type === 'style').length,
        }
      })
    } catch (error) {
      setCustomResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  const sampleTexts = [
    "I has many errors in this sentence.",
    "She don't like when they goes there.",
    "The cat are running to the tree.",
    "Me and him is going to the store.",
    "There cat is very beautifull.",
  ]

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Grammar Checking Test Panel
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Use this panel to test and debug the grammar checking functionality.
        </p>

        {/* API Test Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            1. Test LanguageTool API Connection
          </h3>
          <button
            onClick={runAPITest}
            disabled={loading}
            className="btn btn-primary mb-4"
          >
            {loading ? 'Testing...' : 'Test API'}
          </button>

          {testResult && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                API Test Result:
              </h4>
              <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-auto">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Sample Text Tests */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            2. Test Sample Texts
          </h3>
          <div className="space-y-2 mb-4">
            {sampleTexts.map((text, index) => (
              <button
                key={index}
                onClick={() => setCustomText(text)}
                className="block w-full text-left p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded border text-sm"
              >
                "{text}"
              </button>
            ))}
          </div>
        </div>

        {/* Custom Text Test */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            3. Test Custom Text
          </h3>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Enter text with grammar or spelling errors to test..."
            className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={testCustomText}
            disabled={loading || !customText.trim()}
            className="btn btn-primary mt-3"
          >
            {loading ? 'Checking...' : 'Check Grammar'}
          </button>

          {customResult && (
            <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Grammar Check Result:
              </h4>
              
              {customResult.success && (
                <div className="space-y-3">
                  {/* API Status Indicator */}
                  {customResult.apiStatus && (
                    <div className="mb-4">
                      <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${
                        customResult.apiStatus === 'api' 
                          ? 'bg-green-50 text-green-700'
                          : customResult.apiStatus === 'mixed'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-orange-50 text-orange-700'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          customResult.apiStatus === 'api' 
                            ? 'bg-green-500'
                            : customResult.apiStatus === 'mixed'
                            ? 'bg-blue-500'
                            : 'bg-orange-500'
                        }`}></div>
                        <span>
                          {customResult.apiStatus === 'api' 
                            ? 'Advanced AI (LanguageTool)'
                            : customResult.apiStatus === 'mixed'
                            ? 'AI + Local Rules'
                            : 'Local Analysis Only'
                          }
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded">
                      <div className="font-medium">Total Issues</div>
                      <div className="text-xl">{customResult.stats.total}</div>
                    </div>
                    <div className="bg-red-100 dark:bg-red-900 p-2 rounded">
                      <div className="font-medium">Grammar</div>
                      <div className="text-xl">{customResult.stats.grammar}</div>
                    </div>
                    <div className="bg-orange-100 dark:bg-orange-900 p-2 rounded">
                      <div className="font-medium">Spelling</div>
                      <div className="text-xl">{customResult.stats.spelling}</div>
                    </div>
                    <div className="bg-green-100 dark:bg-green-900 p-2 rounded">
                      <div className="font-medium">Style</div>
                      <div className="text-xl">{customResult.stats.style}</div>
                    </div>
                  </div>

                  {customResult.suggestions.length > 0 && (
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                        Suggestions:
                      </h5>
                      <div className="space-y-2">
                        {customResult.suggestions.map((suggestion: any, index: number) => (
                          <div
                            key={index}
                            className="border border-gray-200 dark:border-gray-600 rounded p-3"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-xs px-2 py-1 rounded font-medium ${
                                suggestion.type === 'grammar' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                suggestion.type === 'spelling' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              }`}>
                                {suggestion.type.toUpperCase()}
                              </span>
                              <span className="text-xs text-gray-500">
                                Position: {suggestion.offset}-{suggestion.offset + suggestion.length}
                              </span>
                            </div>
                            <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                              {suggestion.message}
                            </div>
                            {suggestion.replacements && suggestion.replacements.length > 0 && (
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                Suggestions: {suggestion.replacements.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!customResult.success && (
                <div className="text-red-600 dark:text-red-400">
                  Error: {customResult.error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Debug Info */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            💡 Debug Tips
          </h4>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
            <li>• Check the browser console for detailed logs</li>
            <li>• Ensure the backend server is running on port 5000</li>
            <li>• Verify Supabase authentication is working</li>
            <li>• If API test fails, the system will use client-side grammar checking</li>
            <li>• LanguageTool API might have rate limits on the free tier</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default GrammarTestPanel 