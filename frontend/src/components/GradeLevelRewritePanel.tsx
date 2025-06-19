import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { analyzeReadability } from '../services/languageService'
import { 
  performGradeLevelRewriteOptimized,
  performGradeLevelRewriteDebounced,
  applyGradeLevelRewrite,
  setShowGradeLevelPanel,
  setTargetGradeLevel,
  selectIsRewriting,
  selectLastRewriteResult,
  selectRewriteError,
  selectTargetGradeLevel,
  selectCanUndo,
  selectCanRedo,
  undoRewrite,
  redoRewrite,
  selectRewriteHistoryStats,
  selectPerformanceMetrics,
  selectCacheStats,
  selectIsRateLimited
} from '../store/slices/editorSlice'
import type { AppDispatch, RootState } from '../store'
import type { ReadabilityScore } from '../store/slices/suggestionSlice'

interface GradeLevelRewritePanelProps {
  text: string
  onRewrite: (rewrittenText: string) => void
  onClose: () => void
}

const GradeLevelRewritePanel: React.FC<GradeLevelRewritePanelProps> = ({ text, onRewrite, onClose }) => {
  const dispatch = useDispatch<AppDispatch>()
  
  // Redux state
  const isRewriting = useSelector(selectIsRewriting)
  const lastRewriteResult = useSelector(selectLastRewriteResult)
  const rewriteError = useSelector(selectRewriteError)
  const targetGradeLevel = useSelector(selectTargetGradeLevel)
  const canUndo = useSelector(selectCanUndo)
  const canRedo = useSelector(selectCanRedo)
  const historyStats = useSelector(selectRewriteHistoryStats)
  const currentContent = useSelector((state: RootState) => state.editor.content)
  
  // Performance optimization state
  const performanceMetrics = useSelector(selectPerformanceMetrics)
  const cacheStats = useSelector(selectCacheStats)
  const isRateLimited = useSelector(selectIsRateLimited)

  // Local state for UI
  const [currentReadability, setCurrentReadability] = useState<any>(null)
  const [estimatedReadability, setEstimatedReadability] = useState<ReadabilityScore | null>(null)
  const [showTooltip, setShowTooltip] = useState<string | null>(null)

  // Sync local state with Redux state
  const selectedGradeLevel = targetGradeLevel || 'elementary'
  const rewrittenText = lastRewriteResult?.rewrittenText || ''
  const loading = isRewriting
  const error = rewriteError
  
  // Create readabilityData from lastRewriteResult
  const readabilityData = lastRewriteResult ? {
    original: lastRewriteResult.originalReadability,
    new: lastRewriteResult.newReadability,
    gradeLevel: lastRewriteResult.gradeLevel
  } : null

  const gradeLevelOptions = [
    { 
      value: 'elementary', 
      label: 'Elementary School', 
      description: 'Grades 1-5 (Ages 6-11)',
      targetFK: '3-5',
      targetReadingEase: '80-90',
      details: 'Simple words, short sentences, basic concepts',
      tooltip: 'Perfect for young children. Uses the most common 1000 English words, keeps sentences under 12 words, and explains concepts in simple terms with familiar examples.',
      examples: 'The cat sits on the mat. Dogs like to play. We go to school every day.',
      characteristics: [
        'Simple vocabulary (1000 most common words)',
        'Short sentences (5-12 words)',
        'Concrete concepts and examples',
        'Active voice only',
        'No technical terms'
      ]
    },
    { 
      value: 'middle-school', 
      label: 'Middle School', 
      description: 'Grades 6-8 (Ages 11-14)',
      targetFK: '6-8',
      targetReadingEase: '70-80',
      details: 'Clear language, moderate complexity',
      tooltip: 'Suitable for pre-teens. Uses clear vocabulary from the first 3000 common words, includes some academic terms with context clues, and connects ideas to teen experiences.',
      examples: 'Students often struggle with homework because they have many activities. However, good time management can help solve this problem.',
      characteristics: [
        'Clear vocabulary (3000 common words)',
        'Moderate sentences (10-18 words)',
        'Some academic vocabulary with context',
        'Simple cause-and-effect relationships',
        'Relatable examples'
      ]
    },
    { 
      value: 'high-school', 
      label: 'High School', 
      description: 'Grades 9-12 (Ages 14-18)',
      targetFK: '9-12',
      targetReadingEase: '60-70',
      details: 'Standard academic language',
      tooltip: 'Designed for teenagers. Uses standard academic vocabulary, includes domain-specific terms with explanations, and incorporates analytical thinking across subjects.',
      examples: 'The implementation of new policies requires careful analysis of multiple factors. Furthermore, stakeholders must consider the long-term implications of these decisions.',
      characteristics: [
        'Academic vocabulary',
        'Complex sentences (15-25 words)',
        'Analytical language',
        'Domain-specific terminology',
        'Cross-disciplinary connections'
      ]
    },
    { 
      value: 'college', 
      label: 'College', 
      description: 'Grades 13-16 (Ages 18-22)',
      targetFK: '13-16',
      targetReadingEase: '50-60',
      details: 'Sophisticated language and concepts',
      tooltip: 'Appropriate for college students and adults. Uses advanced academic vocabulary, technical terminology, sophisticated sentence structures, and abstract concepts with nuanced analysis.',
      examples: 'The operationalization of theoretical frameworks necessitates comprehensive analysis of interdependent variables, requiring systematic evaluation of methodological assumptions.',
      characteristics: [
        'Advanced academic vocabulary',
        'Complex sentence structures (20-35 words)',
        'Abstract concepts',
        'Technical terminology',
        'Critical thinking and synthesis'
      ]
    },
    { 
      value: 'graduate', 
      label: 'Graduate/Professional', 
      description: 'Grade 17+ (Ages 22+)',
      targetFK: '17+',
      targetReadingEase: '30-50',
      details: 'Technical terminology, complex analysis',
      tooltip: 'For graduate students and professionals. Uses highly specialized terminology, complex theoretical frameworks, sophisticated analytical methodologies, and expert-level discourse patterns.',
      examples: 'The epistemological underpinnings of this paradigmatic shift necessitate a multifaceted reconceptualization of interdisciplinary methodological approaches, vis-à-vis the hermeneutical implications.',
      characteristics: [
        'Highly specialized vocabulary',
        'Very complex sentences (25-45 words)',
        'Theoretical frameworks',
        'Professional jargon',
        'Meta-analytical commentary'
      ]
    }
  ]

  // Calculate current readability when component mounts or text changes
  useEffect(() => {
    const calculateCurrentReadability = async () => {
      if (text && text.trim()) {
        try {
          const readability = await analyzeReadability(text)
          setCurrentReadability(readability)
        } catch (error) {
          console.error('Failed to calculate current readability:', error)
        }
      }
    }

    calculateCurrentReadability()
  }, [text])

  // Calculate estimated readability when target grade level changes
  useEffect(() => {
    if (selectedGradeLevel && text) {
      // This is a simplified estimation - in a real implementation, 
      // you might want to call a lighter API or use more sophisticated estimation
      const targetLevel = gradeLevelOptions.find(opt => opt.value === selectedGradeLevel)
      if (targetLevel) {
        const [minFK, maxFK] = targetLevel.targetFK.includes('-') 
          ? targetLevel.targetFK.split('-').map(n => parseFloat(n.replace('+', '')))
          : [parseFloat(targetLevel.targetFK.replace('+', '')), parseFloat(targetLevel.targetFK.replace('+', '')) + 3]
        
        const [minEase, maxEase] = targetLevel.targetReadingEase.split('-').map(n => parseFloat(n))
        
        const estimatedFK = (minFK + (maxFK || minFK + 3)) / 2
        const estimatedEase = (minEase + maxEase) / 2
        
        setEstimatedReadability({
          fleschKincaid: estimatedFK,
          fleschReadingEase: estimatedEase,
          readabilityLevel: getGradeLevelLabel(estimatedFK),
          averageWordsPerSentence: estimatedFK < 6 ? 8 : estimatedFK < 9 ? 14 : estimatedFK < 13 ? 20 : estimatedFK < 17 ? 25 : 30,
          averageSyllablesPerWord: estimatedFK < 6 ? 1.3 : estimatedFK < 9 ? 1.5 : estimatedFK < 13 ? 1.7 : estimatedFK < 17 ? 1.9 : 2.1,
          totalSentences: 0,
          passiveVoicePercentage: 0,
          longSentences: 0
        })
      }
      
      // Trigger debounced preview for real-time feedback (low priority)
      if (text.length > 50 && text.length < 2000) { // Only for reasonable text lengths
        dispatch(performGradeLevelRewriteDebounced({
          text,
          gradeLevel: selectedGradeLevel,
          currentContent,
          debounceMs: 2000 // 2 second delay for preview
        }))
      }
    } else {
      setEstimatedReadability(null)
    }
  }, [selectedGradeLevel, text, dispatch, currentContent])

  const handleRewrite = async () => {
    if (!selectedGradeLevel || !text.trim()) return

    // Store target grade level and trigger rewrite
    dispatch(setTargetGradeLevel(selectedGradeLevel))
    
    try {
      await dispatch(performGradeLevelRewriteOptimized({
        text,
        gradeLevel: selectedGradeLevel,
        currentContent,
        priority: 'high' // User-initiated requests get high priority
      })).unwrap()
    } catch (err) {
      console.error('Grade level rewriting error:', err)
    }
  }

  const handleApplyRewrite = () => {
    if (rewrittenText && lastRewriteResult) {
      // Apply the rewrite using Redux action (adds to history automatically)
      dispatch(applyGradeLevelRewrite({
        rewrittenText,
        originalContent: currentContent,
        rewriteResult: lastRewriteResult
      }))
      
      // Notify parent component
      onRewrite(rewrittenText)
      
      // Close panel
      dispatch(setShowGradeLevelPanel(false))
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

  const getReadingEaseColor = (readingEase: number) => {
    if (readingEase >= 80) return 'text-green-600 dark:text-green-400'
    if (readingEase >= 70) return 'text-blue-600 dark:text-blue-400'
    if (readingEase >= 60) return 'text-yellow-600 dark:text-yellow-400'
    if (readingEase >= 50) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getReadingEaseLabel = (readingEase: number) => {
    if (readingEase >= 90) return 'Very Easy'
    if (readingEase >= 80) return 'Easy'
    if (readingEase >= 70) return 'Fairly Easy'
    if (readingEase >= 60) return 'Standard'
    if (readingEase >= 50) return 'Fairly Difficult'
    if (readingEase >= 30) return 'Difficult'
    return 'Very Difficult'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-6xl max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center mr-4">
            <span className="mr-2">🎓</span>
            Adjust Reading Level
          </h2>
            
            {/* Undo/Redo History Controls */}
            {(canUndo || canRedo || historyStats.totalItems > 0) && (
              <div className="flex items-center space-x-2 text-sm">
                <button
                  onClick={() => dispatch(undoRewrite())}
                  disabled={!canUndo}
                  className={`px-3 py-1 rounded-md flex items-center space-x-1 transition-colors ${
                    canUndo 
                      ? 'bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300' 
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                  }`}
                  title={canUndo ? `Undo: ${historyStats.lastAction}` : 'No changes to undo'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 10l6-6m-6 6l6 6" />
                  </svg>
                  <span>Undo</span>
                </button>
                
                <button
                  onClick={() => dispatch(redoRewrite())}
                  disabled={!canRedo}
                  className={`px-3 py-1 rounded-md flex items-center space-x-1 transition-colors ${
                    canRedo 
                      ? 'bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300' 
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                  }`}
                  title="Redo previous change"
                >
                  <span>Redo</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H3m18 0l-6-6m6 6l-6 6" />
                  </svg>
                </button>
                
                <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
                  {historyStats.currentIndex + 1}/{historyStats.totalItems}
                </div>
              </div>
            )}
            
            {/* Performance Indicators */}
            {(performanceMetrics.requestCount > 0 || cacheStats.size > 0) && (
              <div className="flex items-center space-x-3 text-xs">
                {/* Cache Performance */}
                {cacheStats.size > 0 && (
                  <div 
                    className="flex items-center space-x-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded"
                    title={`Cache: ${cacheStats.totalHits} hits, ${cacheStats.totalMisses} misses, ${cacheStats.hitRate}% hit rate`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Cache: {cacheStats.hitRate}%</span>
                  </div>
                )}
                
                {/* Rate Limit Status */}
                {isRateLimited && (
                  <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>Rate Limited</span>
                  </div>
                )}
                
                {/* Response Time */}
                {performanceMetrics.averageResponseTime > 0 && (
                  <div 
                    className="flex items-center space-x-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                    title={`Average response time: ${performanceMetrics.averageResponseTime.toFixed(0)}ms`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{performanceMetrics.averageResponseTime.toFixed(0)}ms</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current Text Analysis */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
            <span className="mr-2">📊</span>
            Current Text Analysis
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Original Text Preview */}
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                Original Text ({text.split(/\s+/).filter(w => w.trim().length > 0).length} words)
              </h4>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg max-h-32 overflow-y-auto border">
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              {text.substring(0, 300)}{text.length > 300 ? '...' : ''}
            </p>
              </div>
            </div>
            
            {/* Current Readability Stats */}
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Current Reading Level</h4>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                {currentReadability ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Grade Level:</span>
                      <span className={`font-bold text-lg ${getGradeLevelColor(currentReadability.fleschKincaid)}`}>
                        {currentReadability.fleschKincaid.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Reading Level:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {currentReadability.readabilityLevel}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Reading Ease:</span>
                      <span className={`font-medium ${getReadingEaseColor(currentReadability.fleschReadingEase)}`}>
                        {currentReadability.fleschReadingEase.toFixed(1)} ({getReadingEaseLabel(currentReadability.fleschReadingEase)})
                      </span>
                    </div>
                    <div className="pt-2 border-t border-blue-200 dark:border-blue-700 text-xs text-gray-500 dark:text-gray-400">
                      Avg. {currentReadability.averageWordsPerSentence} words/sentence, {currentReadability.averageSyllablesPerWord} syllables/word
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    Analyzing current text...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Grade Level Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
            <span className="mr-2">🎯</span>
            Choose Target Reading Level
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {gradeLevelOptions.map((level) => (
              <div
                key={level.value}
                className="relative"
                onMouseEnter={() => setShowTooltip(level.value)}
                onMouseLeave={() => setShowTooltip(null)}
              >
                <label
                  className={`flex items-start p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedGradeLevel === level.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <input
                  type="radio"
                  name="gradeLevel"
                  value={level.value}
                  checked={selectedGradeLevel === level.value}
                    onChange={(e) => dispatch(setTargetGradeLevel(e.target.value))}
                    className="mt-1 mr-3 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white mb-1">
                    {level.label}
                  </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {level.description}
                  </div>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-mono bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                        FK: {level.targetFK}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400 font-mono bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                        Ease: {level.targetReadingEase}
                      </div>
                  </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                    {level.details}
                  </div>
                </div>
              </label>
                
                {/* Tooltip */}
                {showTooltip === level.value && (
                  <div className="absolute z-10 left-0 top-full mt-2 w-80 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                    <div className="font-semibold text-gray-900 dark:text-white mb-2">{level.label}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">{level.tooltip}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mb-2 font-medium">Example:</div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 italic mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      "{level.examples}"
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 font-medium mb-1">Key Characteristics:</div>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      {level.characteristics.map((char, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-blue-500 mr-1">•</span>
                          {char}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Target Preview */}
        {selectedGradeLevel && estimatedReadability && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <span className="mr-2">🔮</span>
              Target Preview
            </h3>
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {estimatedReadability.fleschKincaid.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Target Grade Level</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {estimatedReadability.fleschReadingEase.toFixed(0)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Target Reading Ease</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                    {estimatedReadability.readabilityLevel}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Reading Level</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rewrite Button */}
        <div className="mb-6">
          <button
            onClick={handleRewrite}
            disabled={!selectedGradeLevel || loading || !text.trim()}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 px-6 py-3 text-lg"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Rewriting for {selectedGradeLevel?.replace('-', ' ')} level...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Rewrite Text</span>
              </>
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

        {/* Enhanced Readability Comparison */}
        {readabilityData && (
          <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-bold text-xl text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="mr-2">📊</span>
              Readability Transformation Analysis
            </h4>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                    {readabilityData.original?.fleschKincaid?.toFixed(1) || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Original Grade Level</div>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {getGradeLevelLabel(readabilityData.original?.fleschKincaid || 0)}
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl mb-2">➡️</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Transformed to</div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                    {readabilityData.new?.fleschKincaid?.toFixed(1) || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">New Grade Level</div>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {getGradeLevelLabel(readabilityData.new?.fleschKincaid || 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
                <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                  <span className="mr-2">📄</span>
                  Before Rewrite
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Grade Level:</span>
                    <span className={`font-bold ${getGradeLevelColor(readabilityData.original?.fleschKincaid || 0)}`}>
                      {readabilityData.original?.fleschKincaid?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Reading Level:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {readabilityData.original?.level || getGradeLevelLabel(readabilityData.original?.fleschKincaid || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Reading Ease:</span>
                    <span className={`font-medium ${getReadingEaseColor(readabilityData.original?.readingEase || 0)}`}>
                      {readabilityData.original?.readingEase?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Ease Level:</span>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {getReadingEaseLabel(readabilityData.original?.readingEase || 0)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
                <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                  <span className="mr-2">✨</span>
                  After Rewrite
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Grade Level:</span>
                    <span className={`font-bold ${getGradeLevelColor(readabilityData.new?.fleschKincaid || 0)}`}>
                      {readabilityData.new?.fleschKincaid?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Reading Level:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {readabilityData.new?.level || getGradeLevelLabel(readabilityData.new?.fleschKincaid || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Reading Ease:</span>
                    <span className={`font-medium ${getReadingEaseColor(readabilityData.new?.readingEase || 0)}`}>
                      {readabilityData.new?.readingEase?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Ease Level:</span>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {getReadingEaseLabel(readabilityData.new?.readingEase || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Target Achievement Analysis */}
            <div className="mt-6 pt-4 border-t border-blue-200 dark:border-blue-700">
              <div className="flex items-center justify-between mb-3">
                <h6 className="font-semibold text-gray-700 dark:text-gray-300">Target Achievement Analysis</h6>
                  {(() => {
                    const targetLevel = gradeLevelOptions.find(opt => opt.value === selectedGradeLevel)
                    const achieved = readabilityData.new?.fleschKincaid || 0
                    const targetRange = targetLevel?.targetFK || ''
                    const [min, max] = targetRange.includes('-') 
                      ? targetRange.split('-').map(n => parseFloat(n.replace('+', '')))
                      : [parseFloat(targetRange.replace('+', '')), Infinity]
                    
                    const isInRange = achieved >= min && (max === Infinity || achieved <= max)
                  const deviation = isInRange ? 0 : Math.min(Math.abs(achieved - min), max === Infinity ? Math.abs(achieved - min) : Math.abs(achieved - max))
                    
                    return (
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          isInRange 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : deviation < 1 
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                        }`}>
                        {isInRange ? '🎯 Perfect Match' : deviation < 1 ? '🔸 Very Close' : '🔶 Near Target'}
                        </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Target: {targetRange}
                        </span>
                    </div>
                    )
                  })()}
                </div>
              
              {/* Achievement Progress Bar */}
              <div className="mb-3">
                {(() => {
                  const targetLevel = gradeLevelOptions.find(opt => opt.value === selectedGradeLevel)
                  const achieved = readabilityData.new?.fleschKincaid || 0
                  const original = readabilityData.original?.fleschKincaid || 0
                  const targetRange = targetLevel?.targetFK || ''
                  const [min, max] = targetRange.includes('-') 
                    ? targetRange.split('-').map(n => parseFloat(n.replace('+', '')))
                    : [parseFloat(targetRange.replace('+', '')), parseFloat(targetRange.replace('+', '')) + 3]
                  
                  const targetMid = (min + (max || min + 3)) / 2
                  const improvement = Math.abs(achieved - targetMid) < Math.abs(original - targetMid)
                  
                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Grade Level Progress</span>
                        <span>{improvement ? 'Improved' : 'Needs Adjustment'}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            improvement ? 'bg-green-500 dark:bg-green-400' : 'bg-yellow-500 dark:bg-yellow-400'
                          }`}
                          style={{ 
                            width: `${Math.min(100, Math.max(0, 100 - (Math.abs(achieved - targetMid) / targetMid) * 100))}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Rewritten Text Display */}
        {rewrittenText && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <span className="mr-2">✨</span>
              Rewritten Text
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                ({selectedGradeLevel?.replace('-', ' ')} level - {rewrittenText.split(/\s+/).filter(w => w.trim().length > 0).length} words)
              </span>
            </h3>
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800 p-6 rounded-lg">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm">
                  {readabilityData && (
                    <>
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-600 dark:text-gray-400">Grade Level:</span>
                        <span className={`font-bold ${getGradeLevelColor(readabilityData.new?.fleschKincaid || 0)}`}>
                          {readabilityData.new?.fleschKincaid?.toFixed(1) || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-600 dark:text-gray-400">Reading Ease:</span>
                        <span className={`font-medium ${getReadingEaseColor(readabilityData.new?.readingEase || 0)}`}>
                          {readabilityData.new?.readingEase?.toFixed(1) || 'N/A'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(rewrittenText)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center space-x-1 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy</span>
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {rewrittenText}
              </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          {rewrittenText && (
            <button
              onClick={handleApplyRewrite}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              <span>✅</span>
              <span>Apply Rewrite</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default GradeLevelRewritePanel 