import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import { smartCorrectionService } from '../services/smartCorrectionService'

interface WritingInsights {
  commonMistakes: Array<{ text: string; count: number }>
  acceptanceRate: number
  improvementAreas: string[]
}

const SmartCorrectionPanel: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user)
  const [insights, setInsights] = useState<WritingInsights | null>(null)
  const [loading, setLoading] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    const loadInsights = async () => {
      if (!user?.id) return
      
      setLoading(true)
      try {
        const userInsights = await smartCorrectionService.getWritingInsights(user.id)
        setInsights(userInsights)
      } catch (error) {
        console.error('Error loading writing insights:', error)
      } finally {
        setLoading(false)
      }
    }

    loadInsights()
  }, [user?.id])

  if (!user) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Sign in to enable smart corrections that learn from your writing style.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Smart Corrections Status */}
      <div className="bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🧠</span>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              Smart Auto-Correction
            </h4>
          </div>
          <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-full">
            Active
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Learning from your writing patterns to provide personalized suggestions.
        </p>
      </div>

      {/* Quick Stats */}
      {insights && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Acceptance Rate</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {insights.acceptanceRate}%
            </p>
          </div>
          <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Patterns Learned</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {insights.commonMistakes.length}
            </p>
          </div>
        </div>
      )}

      {/* Show/Hide Details Button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center justify-center space-x-1"
      >
        <span>{showDetails ? 'Hide' : 'Show'} Writing Insights</span>
        <svg 
          className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Detailed Insights */}
      {showDetails && insights && (
        <div className="space-y-4">
          {/* Common Corrections */}
          {insights.commonMistakes.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Your Common Corrections
              </h5>
              <div className="space-y-2">
                {insights.commonMistakes.map((mistake, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between bg-gray-50 dark:bg-gray-600 rounded px-3 py-2"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      "{mistake.text}"
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {mistake.count}x
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improvement Areas */}
          {insights.improvementAreas.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Focus Areas
              </h5>
              <div className="flex flex-wrap gap-2">
                {insights.improvementAreas.map((area, index) => (
                  <span 
                    key={index}
                    className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded-full"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Clear Cache Button */}
          <button
            onClick={() => {
              smartCorrectionService.clearCache()
              setInsights(null)
              setShowDetails(false)
            }}
            className="w-full text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 py-2"
          >
            Clear Learning Data
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>How it works:</strong> Smart corrections learn from your accepted and rejected suggestions to provide more accurate, personalized recommendations over time.
        </p>
      </div>
    </div>
  )
}

export default SmartCorrectionPanel 