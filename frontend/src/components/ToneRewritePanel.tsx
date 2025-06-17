import React, { useState } from 'react'
import { rewriteTone } from '../services/languageService'

interface ToneRewritePanelProps {
  text: string
  onRewrite: (rewrittenText: string) => void
  onClose: () => void
}

const ToneRewritePanel: React.FC<ToneRewritePanelProps> = ({ text, onRewrite, onClose }) => {
  const [selectedTone, setSelectedTone] = useState<string>('')
  const [rewrittenText, setRewrittenText] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toneOptions = [
    { value: 'professional', label: 'Professional', description: 'Formal, business-appropriate language' },
    { value: 'casual', label: 'Casual', description: 'Relaxed, conversational tone' },
    { value: 'formal', label: 'Formal', description: 'Academic, sophisticated language' },
    { value: 'friendly', label: 'Friendly', description: 'Warm, approachable tone' },
    { value: 'academic', label: 'Academic', description: 'Scholarly, research-oriented' },
    { value: 'creative', label: 'Creative', description: 'Vivid, imaginative language' },
    { value: 'persuasive', label: 'Persuasive', description: 'Compelling, convincing tone' },
    { value: 'concise', label: 'Concise', description: 'Brief, to-the-point writing' }
  ]

  const handleRewrite = async () => {
    if (!selectedTone || !text.trim()) return

    setLoading(true)
    setError(null)

    try {
      const result = await rewriteTone(text, selectedTone)
      if (result.success) {
        setRewrittenText(result.rewrittenText)
      } else {
        setError(result.error || 'Failed to rewrite text')
      }
    } catch (err) {
      console.error('Tone rewriting error:', err)
      setError(err instanceof Error ? err.message : 'Failed to rewrite text')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyRewrite = () => {
    if (rewrittenText) {
      onRewrite(rewrittenText)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Rewrite in Different Tone
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Original Text Preview */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Original Text ({text.split(/\s+/).filter(w => w.trim().length > 0).length} words)
          </h3>
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg max-h-32 overflow-y-auto">
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              {text.substring(0, 300)}{text.length > 300 ? '...' : ''}
            </p>
          </div>
        </div>

        {/* Tone Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Choose a Tone
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {toneOptions.map((tone) => (
              <label
                key={tone.value}
                className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedTone === tone.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <input
                  type="radio"
                  name="tone"
                  value={tone.value}
                  checked={selectedTone === tone.value}
                  onChange={(e) => setSelectedTone(e.target.value)}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {tone.label}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {tone.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Rewrite Button */}
        <div className="mb-6">
          <button
            onClick={handleRewrite}
            disabled={!selectedTone || loading || !text.trim()}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Rewriting...</span>
              </div>
            ) : (
              'Rewrite Text'
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
          </div>
        )}

        {/* Rewritten Text */}
        {rewrittenText && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Rewritten Text ({selectedTone} tone - {rewrittenText.split(/\s+/).filter(w => w.trim().length > 0).length} words)
            </h3>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg max-h-64 overflow-y-auto">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {rewrittenText}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          {rewrittenText && (
            <button
              onClick={handleApplyRewrite}
              className="btn btn-primary"
            >
              Apply Rewrite
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ToneRewritePanel 