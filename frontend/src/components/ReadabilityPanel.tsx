import React from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../store'

const ReadabilityPanel: React.FC = () => {
  const { readabilityScore } = useSelector((state: RootState) => state.suggestions)

  // Debug logging for Vercel
  console.log('📊 ReadabilityPanel render:', { 
    hasScore: !!readabilityScore, 
    score: readabilityScore,
    isProd: import.meta.env.PROD,
    fleschKincaid: readabilityScore?.fleschKincaid,
    fleschReadingEase: readabilityScore?.fleschReadingEase,
    FK_type: typeof readabilityScore?.fleschKincaid,
    FRE_type: typeof readabilityScore?.fleschReadingEase
  })

  if (!readabilityScore) {
    // Show a placeholder instead of hiding completely
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Readability Analysis
        </h3>
        <div className="text-center text-gray-500 dark:text-gray-400 py-4">
          <p className="text-sm">No readability data available</p>
          <p className="text-xs mt-1">Type some text to see analysis</p>
        </div>
      </div>
    )
  }

  const getReadingEaseColor = (score: number): string => {
    if (isNaN(score) || score === null || score === undefined) {
      console.log('📊 getReadingEaseColor: Invalid score:', score)
      return 'text-gray-600 dark:text-gray-400'
    }
    if (score >= 70) return 'text-green-600 dark:text-green-400'
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
    if (score >= 50) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getReadingEaseLevel = (score: number): string => {
    if (score >= 90) return 'Very Easy'
    if (score >= 80) return 'Easy'
    if (score >= 70) return 'Fairly Easy'
    if (score >= 60) return 'Standard'
    if (score >= 50) return 'Fairly Difficult'
    if (score >= 30) return 'Difficult'
    return 'Very Difficult'
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
          <span className={`text-sm font-medium text-black bg-yellow-200 px-2 py-1`} style={{color: 'black !important', backgroundColor: 'yellow'}}>
            {(() => {
              console.log('📊 Rendering FK score:', readabilityScore.fleschKincaid, typeof readabilityScore.fleschKincaid)
              const value = readabilityScore.fleschKincaid
              return value !== null && value !== undefined && !isNaN(value) ? value : 'N/A'
            })()}
          </span>
        </div>

        {/* Flesch Reading Ease */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Reading Ease:</span>
          <div className="text-right">
            <span className={`text-sm font-medium text-black bg-yellow-200 px-2 py-1`} style={{color: 'black !important', backgroundColor: 'yellow'}}>
              {(() => {
                console.log('📊 Rendering FRE score:', readabilityScore.fleschReadingEase, typeof readabilityScore.fleschReadingEase)
                const value = readabilityScore.fleschReadingEase
                return value !== null && value !== undefined && !isNaN(value) ? value : 'N/A'
              })()}
            </span>
            <div className={`text-xs ${getReadingEaseColor(readabilityScore.fleschReadingEase)}`}>
              {getReadingEaseLevel(readabilityScore.fleschReadingEase)}
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
          {readabilityScore.fleschReadingEase < 50 && (
            <li>• Text is fairly difficult - consider simplifying vocabulary and sentence structure</li>
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
          {readabilityScore.fleschKincaid <= 8 && readabilityScore.fleschReadingEase >= 70 && readabilityScore.passiveVoicePercentage <= 15 && (
            <li className="text-green-600 dark:text-green-400">• Excellent! Your writing is clear and easy to read</li>
          )}
        </ul>
      </div>
    </div>
  )
}

export default ReadabilityPanel 