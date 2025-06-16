import React from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../store'

const ReadabilityPanel: React.FC = () => {
  const { readabilityScore } = useSelector((state: RootState) => state.suggestions)

  if (!readabilityScore) {
    return null
  }

  const getReadabilityColor = (level: string): string => {
    switch (level) {
      case 'Very Easy':
      case 'Elementary':
        return 'text-green-600 dark:text-green-400'
      case 'Middle School':
      case 'High School':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'College':
      case 'Graduate':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getScoreColor = (score: number): string => {
    if (score <= 8) return 'text-green-600 dark:text-green-400'
    if (score <= 12) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Readability Analysis
      </h3>
      
      <div className="space-y-3">
        {/* Flesch-Kincaid Grade Level */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Grade Level:</span>
          <div className="text-right">
            <span className={`text-sm font-medium ${getScoreColor(readabilityScore.fleschKincaid)}`}>
              {readabilityScore.fleschKincaid}
            </span>
            <div className={`text-xs ${getReadabilityColor(readabilityScore.readabilityLevel)}`}>
              {readabilityScore.readabilityLevel}
            </div>
          </div>
        </div>

        {/* Average Words per Sentence */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Avg. Words/Sentence:</span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {readabilityScore.averageWordsPerSentence}
          </span>
        </div>

        {/* Average Syllables per Word */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Avg. Syllables/Word:</span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {readabilityScore.averageSyllablesPerWord}
          </span>
        </div>

        {/* Total Sentences */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Total Sentences:</span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {readabilityScore.totalSentences}
          </span>
        </div>

        {/* Passive Voice Percentage */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Passive Voice:</span>
          <span className={`text-sm font-medium ${
            readabilityScore.passiveVoicePercentage > 20 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'
          }`}>
            {readabilityScore.passiveVoicePercentage}%
          </span>
        </div>

        {/* Long Sentences */}
        {readabilityScore.longSentences > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Long Sentences:</span>
            <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
              {readabilityScore.longSentences}
            </span>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Recommendations:
        </h4>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
          {readabilityScore.fleschKincaid > 12 && (
            <li>• Consider using shorter sentences and simpler words</li>
          )}
          {readabilityScore.averageWordsPerSentence > 20 && (
            <li>• Break up long sentences for better readability</li>
          )}
          {readabilityScore.passiveVoicePercentage > 20 && (
            <li>• Reduce passive voice usage for more engaging writing</li>
          )}
          {readabilityScore.longSentences > 0 && (
            <li>• Consider splitting sentences with more than 20 words</li>
          )}
          {readabilityScore.fleschKincaid <= 8 && readabilityScore.passiveVoicePercentage <= 15 && (
            <li className="text-green-600 dark:text-green-400">• Great! Your writing is clear and easy to read</li>
          )}
        </ul>
      </div>
    </div>
  )
}

export default ReadabilityPanel 