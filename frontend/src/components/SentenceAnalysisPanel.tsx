import React, { useState, useEffect } from 'react'
import { analyzeSentences } from '../services/languageService'

interface SentenceIssue {
  type: string
  message: string
  ruleId: string
  category: string
  severity: string
  offset: number
  length: number
  replacements: string[]
}

interface SentenceAnalysis {
  sentenceIndex: number
  text: string
  offset: number
  length: number
  quality: 'good' | 'fair' | 'poor' | 'incomplete' | 'unknown'
  wordCount: number
  issues: SentenceIssue[]
  issueCount: number
  grammarIssueCount: number
  structureIssueCount: number
  error?: string
}

interface SentenceAnalysisData {
  totalSentences: number
  overallQuality: string
  qualityDistribution: {
    good: number
    fair: number
    poor: number
    incomplete: number
  }
  totalIssues: number
  totalGrammarIssues: number
  totalStructureIssues: number
  fleschKincaidScore: number
  readabilityLevel: string
  sentences: SentenceAnalysis[]
}

interface SentenceAnalysisPanelProps {
  text: string
  onSentenceClick?: (offset: number, length: number) => void
  onApplySuggestion?: (offset: number, length: number, replacement: string) => void
}

const SentenceAnalysisPanel: React.FC<SentenceAnalysisPanelProps> = ({ text, onSentenceClick, onApplySuggestion }) => {
  const [analysis, setAnalysis] = useState<SentenceAnalysisData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSentence, setExpandedSentence] = useState<number | null>(null)

  useEffect(() => {
    if (text && text.trim().length > 10) {
      analyzeSentenceStructure()
    } else {
      setAnalysis(null)
    }
  }, [text])

  const analyzeSentenceStructure = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await analyzeSentences(text)
      if (result.success) {
        setAnalysis(result.analysis)
      } else {
        setError(result.error || 'Analysis failed')
      }
    } catch (err) {
      console.error('Sentence analysis error:', err)
      if (err instanceof Error) {
        if (err.message.includes('No authentication token')) {
          setAnalysis(null)
          return
        } else if (err.message.includes('401')) {
          setError('Please log in to use sentence analysis')
        } else if (err.message.includes('500')) {
          setError('Server error during sentence analysis')
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to analyze sentences')
      }
    } finally {
      setLoading(false)
    }
  }

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'good': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20'
      case 'fair': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20'
      case 'poor': return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20'
      case 'incomplete': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20'
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20'
    }
  }

  const getOverallQualityColor = (quality: string) => {
    switch (quality) {
      case 'good': return 'text-green-700 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-900/10 dark:border-green-800'
      case 'fair': return 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:text-yellow-300 dark:bg-yellow-900/10 dark:border-yellow-800'
      case 'needs_revision': return 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-900/10 dark:border-orange-800'
      case 'needs_major_revision': return 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/10 dark:border-red-800'
      default: return 'text-gray-700 bg-gray-50 border-gray-200 dark:text-gray-300 dark:bg-gray-900/10 dark:border-gray-800'
    }
  }

  const handleSentenceClick = (sentence: SentenceAnalysis) => {
    if (onSentenceClick) {
      onSentenceClick(sentence.offset, sentence.length)
    }
    setExpandedSentence(expandedSentence === sentence.sentenceIndex ? null : sentence.sentenceIndex)
  }

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Analyzing sentence structure...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Write some text to see sentence-level analysis...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Overall Analysis Summary */}
      <div className={`p-4 rounded-lg border ${getOverallQualityColor(analysis.overallQuality)}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Sentence Analysis</h3>
          <span className="text-xs px-2 py-1 rounded font-medium bg-white dark:bg-gray-800 border">
            {analysis.totalSentences} sentence{analysis.totalSentences !== 1 ? 's' : ''}
          </span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="text-center">
            <div className="font-medium text-green-600 dark:text-green-400">{analysis.qualityDistribution.good}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Good</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-yellow-600 dark:text-yellow-400">{analysis.qualityDistribution.fair}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Fair</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-orange-600 dark:text-orange-400">{analysis.qualityDistribution.poor}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Poor</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-red-600 dark:text-red-400">{analysis.qualityDistribution.incomplete}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Incomplete</div>
          </div>
        </div>

        {analysis.totalIssues > 0 && (
          <div className="mt-3 pt-3 border-t border-current border-opacity-20">
            <div className="flex items-center justify-between text-sm">
              <span>Total Issues: {analysis.totalIssues}</span>
              <div className="flex space-x-3">
                <span>Grammar: {analysis.totalGrammarIssues}</span>
                <span>Structure: {analysis.totalStructureIssues}</span>
              </div>
            </div>
          </div>
        )}

        {/* Flesch-Kincaid Readability Score */}
        <div className="mt-3 pt-3 border-t border-current border-opacity-20">
          <div className="flex items-center justify-between text-sm">
            <span>Flesch-Kincaid Grade Level: <span className="font-medium">{analysis.fleschKincaidScore}</span></span>
            <span className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-800 border">
              {analysis.readabilityLevel}
            </span>
          </div>
        </div>
      </div>

      {/* Individual Sentences */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {analysis.sentences.map((sentence) => (
          <div
            key={sentence.sentenceIndex}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              sentence.quality === 'good' 
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/20'
                : sentence.quality === 'fair'
                ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/20'
                : sentence.quality === 'poor'
                ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/20'
                : sentence.quality === 'incomplete'
                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/20'
                : 'bg-gray-50 dark:bg-gray-900/10 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-900/20'
            }`}
            onClick={() => handleSentenceClick(sentence)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Sentence {sentence.sentenceIndex + 1}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${getQualityColor(sentence.quality)}`}>
                    {sentence.quality}
                  </span>
                  {sentence.issueCount > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {sentence.issueCount} issue{sentence.issueCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                  {sentence.text}
                </p>
              </div>
              
              <div className="flex items-center space-x-2 ml-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {sentence.wordCount} words
                </span>
                <svg 
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedSentence === sentence.sentenceIndex ? 'rotate-180' : ''
                  }`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Expanded Issues */}
            {expandedSentence === sentence.sentenceIndex && sentence.issues.length > 0 && (
              <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                <div className="space-y-2">
                  {sentence.issues.map((issue, index) => (
                    <div key={index} className="text-xs bg-white dark:bg-gray-800 p-2 rounded border">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`px-2 py-0.5 rounded font-medium ${
                          issue.type === 'grammar' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          issue.type === 'spelling' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }`}>
                          {issue.type}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">{issue.category}</span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 mb-1">{issue.message}</p>
                      {issue.replacements.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {issue.replacements.slice(0, 3).map((replacement, repIndex) => (
                            <button 
                              key={repIndex}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (onApplySuggestion) {
                                  onApplySuggestion(issue.offset, issue.length, replacement)
                                }
                              }}
                              className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors cursor-pointer border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600"
                              title={`Click to apply: ${replacement}`}
                            >
                              <span className="flex items-center space-x-1">
                                <span>"{replacement}"</span>
                                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default SentenceAnalysisPanel 