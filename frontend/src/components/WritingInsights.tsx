import React, { useEffect, useState } from 'react'
import { smartCorrectionService } from '../services/smartCorrectionService'
import { supabase } from '../config/supabase'
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, XCircle } from 'lucide-react'

interface WritingInsightsProps {
  compact?: boolean
}

const WritingInsights: React.FC<WritingInsightsProps> = ({ compact = false }) => {
  const [insights, setInsights] = useState<{
    commonMistakes: Array<{ text: string; count: number }>
    acceptanceRate: number
    improvementAreas: string[]
    ignoredPatterns: Array<{ text: string; type: string; count: number }>
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadInsights = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const data = await smartCorrectionService.getWritingInsights(user.id)
        setInsights(data)
      } catch (error) {
        console.error('Error loading writing insights:', error)
      } finally {
        setLoading(false)
      }
    }

    loadInsights()
  }, [])

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-gray-100 dark:bg-gray-700 rounded-lg"></div>
      </div>
    )
  }

  if (!insights) {
    return null
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'spelling': return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20'
      case 'grammar': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20'
      case 'style': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20'
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700'
    }
  }

  if (compact) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
          <TrendingUp className="h-4 w-4 mr-2" />
          Quick Insights
        </h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-2xl font-bold text-navy dark:text-blue-400">
              {insights.acceptanceRate}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Acceptance Rate
            </div>
          </div>
          
          {insights.ignoredPatterns.length > 0 && (
            <div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {insights.ignoredPatterns.reduce((sum, p) => sum + p.count, 0)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Patterns Ignored
              </div>
            </div>
          )}
        </div>

        {insights.ignoredPatterns.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              Most ignored:
            </div>
            <div className="flex flex-wrap gap-1">
              {insights.ignoredPatterns.slice(0, 3).map((pattern, index) => (
                <span
                  key={index}
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${getTypeColor(pattern.type)}`}
                  title={`Ignored ${pattern.count} times`}
                >
                  "{pattern.text}" ({pattern.count}×)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-navy dark:bg-blue-600 rounded-lg flex items-center justify-center mr-3">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-navy dark:text-blue-400">Writing Insights</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Your personalized writing patterns</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Acceptance Rate</span>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-navy dark:text-blue-400">
            {insights.acceptanceRate}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {insights.acceptanceRate >= 70 ? 'Great job!' : 'Room for improvement'}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Common Mistakes</span>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {insights.commonMistakes.length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Recurring patterns
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Ignored Patterns</span>
            <XCircle className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {insights.ignoredPatterns.reduce((sum, p) => sum + p.count, 0)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Total ignores
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Focus Areas</span>
            <TrendingDown className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {insights.improvementAreas.length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            To work on
          </div>
        </div>
      </div>

      {/* Frequently Ignored Patterns */}
      {insights.ignoredPatterns.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Frequently Ignored Patterns
          </h4>
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
              These patterns are frequently ignored and will appear with lower priority in future suggestions.
            </p>
            <div className="space-y-2">
              {insights.ignoredPatterns.map((pattern, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-white dark:bg-gray-800 rounded p-2"
                >
                  <div className="flex items-center space-x-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getTypeColor(pattern.type)}`}>
                      {pattern.type}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      "{pattern.text}"
                    </span>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Ignored {pattern.count} time{pattern.count > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
              💡 Tip: Consider adding these to a style profile if they're intentional choices.
            </p>
          </div>
        </div>
      )}

      {/* Common Mistakes */}
      {insights.commonMistakes.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Common Corrections Accepted
          </h4>
          <div className="flex flex-wrap gap-2">
            {insights.commonMistakes.map((mistake, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              >
                "{mistake.text}" ({mistake.count}×)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Improvement Areas */}
      {insights.improvementAreas.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Areas for Improvement
          </h4>
          <div className="flex flex-wrap gap-2">
            {insights.improvementAreas.map((area, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default WritingInsights 