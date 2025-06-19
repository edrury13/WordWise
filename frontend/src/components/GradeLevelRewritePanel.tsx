import React, { useState } from 'react'
import { rewriteGradeLevelWithOpenAI } from '../services/languageService'

interface GradeLevelRewritePanelProps {
  text: string
  onRewrite: (rewrittenText: string) => void
  onClose: () => void
}

const GradeLevelRewritePanel: React.FC<GradeLevelRewritePanelProps> = ({ text, onRewrite, onClose }) => {
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('')
  const [rewrittenText, setRewrittenText] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readabilityData, setReadabilityData] = useState<any>(null)

  const gradeLevelOptions = [
    { 
      value: 'elementary', 
      label: 'Elementary School', 
      description: 'Grades 1-5 (Ages 6-11)',
      targetFK: '3-5',
      details: 'Simple words, short sentences, basic concepts'
    },
    { 
      value: 'middle-school', 
      label: 'Middle School', 
      description: 'Grades 6-8 (Ages 11-14)',
      targetFK: '6-8',
      details: 'Clear language, moderate complexity'
    },
    { 
      value: 'high-school', 
      label: 'High School', 
      description: 'Grades 9-12 (Ages 14-18)',
      targetFK: '9-12',
      details: 'Standard academic language'
    },
    { 
      value: 'college', 
      label: 'College', 
      description: 'Grades 13-16 (Ages 18-22)',
      targetFK: '13-16',
      details: 'Sophisticated language and concepts'
    },
    { 
      value: 'graduate', 
      label: 'Graduate/Professional', 
      description: 'Grade 17+ (Ages 22+)',
      targetFK: '17+',
      details: 'Technical terminology, complex analysis'
    }
  ]

  const handleRewrite = async () => {
    if (!selectedGradeLevel || !text.trim()) return

    setLoading(true)
    setError(null)
    setReadabilityData(null)

    try {
      const result = await rewriteGradeLevelWithOpenAI(text, selectedGradeLevel)
      if (result.success) {
        setRewrittenText(result.rewrittenText)
        setReadabilityData({
          original: result.originalReadability,
          new: result.newReadability,
          gradeLevel: result.gradeLevel
        })
      } else {
        setError(result.error || 'Failed to rewrite text')
      }
    } catch (err) {
      console.error('Grade level rewriting error:', err)
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

  const getGradeLevelColor = (fleschKincaid: number) => {
    if (fleschKincaid <= 5) return 'text-green-600 dark:text-green-400'
    if (fleschKincaid <= 8) return 'text-blue-600 dark:text-blue-400'
    if (fleschKincaid <= 12) return 'text-yellow-600 dark:text-yellow-400'
    if (fleschKincaid <= 16) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getGradeLevelLabel = (fleschKincaid: number) => {
    if (fleschKincaid <= 5) return 'Elementary'
    if (fleschKincaid <= 8) return 'Middle School'
    if (fleschKincaid <= 12) return 'High School'
    if (fleschKincaid <= 16) return 'College'
    return 'Graduate+'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <span className="mr-2">🎓</span>
            Adjust Reading Level
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

        {/* Grade Level Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Choose Target Reading Level
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {gradeLevelOptions.map((level) => (
              <label
                key={level.value}
                className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedGradeLevel === level.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <input
                  type="radio"
                  name="gradeLevel"
                  value={level.value}
                  checked={selectedGradeLevel === level.value}
                  onChange={(e) => setSelectedGradeLevel(e.target.value)}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {level.label}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {level.description}
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                    Target FK: {level.targetFK}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {level.details}
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
            disabled={!selectedGradeLevel || loading || !text.trim()}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Rewriting for {selectedGradeLevel?.replace('-', ' ')} level...</span>
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

        {/* Readability Comparison */}
        {readabilityData && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <span className="mr-2">📊</span>
              Readability Analysis
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Before</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Grade Level:</span>
                    <span className={`font-mono ${getGradeLevelColor(readabilityData.original?.fleschKincaid || 0)}`}>
                      {readabilityData.original?.fleschKincaid?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reading Level:</span>
                    <span className="font-medium">
                      {getGradeLevelLabel(readabilityData.original?.fleschKincaid || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reading Ease:</span>
                    <span className="font-mono">
                      {readabilityData.original?.readingEase?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">After</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Grade Level:</span>
                    <span className={`font-mono ${getGradeLevelColor(readabilityData.new?.fleschKincaid || 0)}`}>
                      {readabilityData.new?.fleschKincaid?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reading Level:</span>
                    <span className="font-medium">
                      {getGradeLevelLabel(readabilityData.new?.fleschKincaid || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reading Ease:</span>
                    <span className="font-mono">
                      {readabilityData.new?.readingEase?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {/* Target Achievement Indicator */}
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Target Achievement:</span>
                <div className="flex items-center space-x-2">
                  {(() => {
                    const targetLevel = gradeLevelOptions.find(opt => opt.value === selectedGradeLevel)
                    const achieved = readabilityData.new?.fleschKincaid || 0
                    const targetRange = targetLevel?.targetFK || ''
                    const [min, max] = targetRange.includes('-') 
                      ? targetRange.split('-').map(n => parseFloat(n.replace('+', '')))
                      : [parseFloat(targetRange.replace('+', '')), Infinity]
                    
                    const isInRange = achieved >= min && (max === Infinity || achieved <= max)
                    
                    return (
                      <>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          isInRange 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>
                          {isInRange ? '✅ Target Achieved' : '⚠️ Close to Target'}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">
                          (Target: {targetRange})
                        </span>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rewritten Text */}
        {rewrittenText && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Rewritten Text ({selectedGradeLevel?.replace('-', ' ')} level - {rewrittenText.split(/\s+/).filter(w => w.trim().length > 0).length} words)
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

export default GradeLevelRewritePanel 