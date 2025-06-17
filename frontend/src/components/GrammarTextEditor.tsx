import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { checkText, setActiveSuggestion, ignoreSuggestion, clearSuggestions, acceptAllSuggestions, ignoreAllCurrentSuggestions } from '../store/slices/suggestionSlice'
import { setContent, setLastSaved } from '../store/slices/editorSlice'
import { updateDocument, updateCurrentDocumentContent } from '../store/slices/documentSlice'
import { Suggestion } from '../store/slices/suggestionSlice'
import { analyzeSentences } from '../services/languageService'
import SentenceAnalysisPanel from './SentenceAnalysisPanel'

const GrammarTextEditor: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { suggestions, loading, error } = useSelector((state: RootState) => state.suggestions)
  const { currentDocument, saving } = useSelector((state: RootState) => state.documents)
  const { user } = useSelector((state: RootState) => state.auth)
  const { autoSaveEnabled } = useSelector((state: RootState) => state.editor)
  
  const [content, setContentState] = useState('')
  const [highlightedContent, setHighlightedContent] = useState('')
  const [showTooltip, setShowTooltip] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [lastSaveStatus, setLastSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null)
  const [sentenceAnalysis, setSentenceAnalysis] = useState<any>(null)
  const [sentenceAnalysisLoading, setSentenceAnalysisLoading] = useState(false)
  const [combinedSuggestions, setCombinedSuggestions] = useState<Suggestion[]>([])
  
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()
  const autoSaveRef = useRef<NodeJS.Timeout>()
  const currentDocumentIdRef = useRef<string | null>(null)
  const sentenceDebounceRef = useRef<NodeJS.Timeout>()

  // Debounced grammar checking
  const checkGrammar = useCallback((text: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    debounceRef.current = setTimeout(() => {
      if (text.trim() && text.length > 3) {
        dispatch(checkText({ text }))
      }
    }, 1000)
  }, [dispatch])

  // Debounced sentence analysis
  const checkSentenceStructure = useCallback((text: string) => {
    if (sentenceDebounceRef.current) {
      clearTimeout(sentenceDebounceRef.current)
    }
    
    sentenceDebounceRef.current = setTimeout(async () => {
      if (text.trim() && text.length > 10) {
        setSentenceAnalysisLoading(true)
        try {
          const result = await analyzeSentences(text)
          if (result.success) {
            setSentenceAnalysis(result.analysis)
          } else {
            setSentenceAnalysis(null)
          }
        } catch (error) {
          console.error('Sentence analysis error:', error)
          setSentenceAnalysis(null)
        } finally {
          setSentenceAnalysisLoading(false)
        }
      } else {
        setSentenceAnalysis(null)
      }
    }, 3000) // Increased from 1500ms to 3000ms to reduce API calls
  }, [])

  // Auto-save functionality
  const autoSave = useCallback((text: string) => {
    if (!autoSaveEnabled || !currentDocument || !user) return
    
    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current)
    }
    
    autoSaveRef.current = setTimeout(() => {
      setLastSaveStatus('saving')
      dispatch(updateDocument({ 
        id: currentDocument.id, 
        content: text 
      })).then((action) => {
        if (action.type === 'documents/updateDocument/fulfilled') {
          setLastSaveStatus('saved')
          dispatch(setLastSaved(new Date()))
          // Clear status after 3 seconds
          setTimeout(() => setLastSaveStatus(null), 3000)
        } else {
          setLastSaveStatus('error')
          setTimeout(() => setLastSaveStatus(null), 5000)
        }
      }).catch(() => {
        setLastSaveStatus('error')
        setTimeout(() => setLastSaveStatus(null), 5000)
      })
    }, 3000) // Auto-save after 3 seconds of no typing
  }, [autoSaveEnabled, currentDocument, user, dispatch])

  // Manual save function
  const manualSave = useCallback(() => {
    if (!currentDocument || !user) return
    
    setLastSaveStatus('saving')
    dispatch(updateDocument({ 
      id: currentDocument.id, 
      content: content 
    })).then((action) => {
      if (action.type === 'documents/updateDocument/fulfilled') {
        setLastSaveStatus('saved')
        dispatch(setLastSaved(new Date()))
        setTimeout(() => setLastSaveStatus(null), 3000)
      } else {
        setLastSaveStatus('error')
        setTimeout(() => setLastSaveStatus(null), 5000)
      }
    }).catch(() => {
      setLastSaveStatus('error')
      setTimeout(() => setLastSaveStatus(null), 5000)
    })
  }, [currentDocument, user, content, dispatch])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.ctrlKey && event.key === 's') {
      event.preventDefault()
      manualSave()
    }
  }, [manualSave])

  // Handle content changes
  const handleContentChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = event.target.value
    setContentState(newContent)
    
    // Update Redux state for editor
    dispatch(setContent([{
      type: 'paragraph',
      children: [{ text: newContent }]
    }]))
    
    // Update current document content in Redux
    dispatch(updateCurrentDocumentContent(newContent))
    
    // Trigger grammar check, sentence analysis, and auto-save
    checkGrammar(newContent)
    checkSentenceStructure(newContent)
    autoSave(newContent)
  }, [dispatch, checkGrammar, checkSentenceStructure, autoSave])

  // Create highlighted text overlay
  const createHighlightedText = useCallback(() => {
    if (!content) {
      setHighlightedContent(content)
      return
    }

    let result = content
    const allHighlights: Array<{
      offset: number
      length: number
      type: string
      id: string
      className: string
    }> = []
    
    // Create a combined suggestions array for tooltip lookup
    const allSuggestions = [...suggestions]

    // Add regular grammar suggestions
    if (suggestions.length > 0) {
      suggestions.forEach((suggestion) => {
        allHighlights.push({
          offset: suggestion.offset,
          length: suggestion.length,
          type: suggestion.type,
          id: suggestion.id,
          className: getErrorClassName(suggestion.type)
        })
      })
    }

    // Add sentence-level issues (incomplete sentences)
    if (sentenceAnalysis?.sentences) {
      sentenceAnalysis.sentences.forEach((sentence: any, index: number) => {
        if (sentence.quality === 'incomplete' && sentence.issues?.length > 0) {
          // Check if this sentence already has a grammar highlight to avoid duplicates
          const hasExistingHighlight = allHighlights.some(h => 
            h.offset >= sentence.offset && 
            h.offset < sentence.offset + sentence.length
          )
          
          if (!hasExistingHighlight) {
            // Create a fake suggestion object for the incomplete sentence
            const incompleteSuggestion: Suggestion = {
              id: `sentence-${index}`,
              type: 'grammar',
              message: sentence.issues[0]?.message || 'This sentence appears to be incomplete.',
              offset: sentence.offset,
              length: sentence.length,
              replacements: sentence.issues[0]?.replacements || [],
              context: sentence.text,
              explanation: 'Incomplete sentences are missing essential components like helping verbs or main verbs.',
              category: 'Grammar',
              severity: 'high'
            }
            
            // Add to combined suggestions array for tooltip lookup
            allSuggestions.push(incompleteSuggestion)
            
            allHighlights.push({
              offset: sentence.offset,
              length: sentence.length,
              type: 'grammar',
              id: `sentence-${index}`,
              className: 'underline decoration-orange-500 decoration-wavy bg-orange-500 bg-opacity-10 dark:bg-orange-400 dark:bg-opacity-20'
            })
          }
        }
      })
    }

    // Sort highlights by offset (descending) to apply from end to start
    const sortedHighlights = allHighlights.sort((a, b) => b.offset - a.offset)

    sortedHighlights.forEach((highlight) => {
      const { offset, length, type, id, className } = highlight
      const before = result.substring(0, offset)
      const highlightedText = result.substring(offset, offset + length)
      const after = result.substring(offset + length)
      
      // All highlights now use the same event handlers since we changed incomplete to 'grammar' type
      const eventHandlers = `data-suggestion-id="${id}" data-offset="${offset}" data-length="${length}" style="pointer-events: auto;" onmouseenter="window.handleSuggestionHover && window.handleSuggestionHover('${id}', event)" onmouseleave="window.handleSuggestionLeave && window.handleSuggestionLeave()" onclick="window.handleSuggestionClick && window.handleSuggestionClick(${offset}, event)"`
      
      const highlightedSpan = `<span class="${className}" ${eventHandlers}>${highlightedText}</span>`
      
      result = before + highlightedSpan + after
    })

    setHighlightedContent(result)
    
    // Store the combined suggestions for tooltip lookup
    setCombinedSuggestions(allSuggestions)
  }, [content, suggestions, sentenceAnalysis])

  // Get CSS class for error types
  const getErrorClassName = (type: Suggestion['type']): string => {
    switch (type) {
      case 'grammar':
        return 'underline decoration-red-500 decoration-wavy bg-red-500 bg-opacity-10 dark:bg-red-400 dark:bg-opacity-20'
      case 'spelling':
        return 'underline decoration-orange-500 decoration-wavy bg-orange-500 bg-opacity-10 dark:bg-orange-400 dark:bg-opacity-20'
      case 'style':
      case 'clarity':
      case 'engagement':
      case 'delivery':
        return 'underline decoration-blue-500 decoration-dotted bg-blue-500 bg-opacity-10 dark:bg-blue-400 dark:bg-opacity-20'
      default:
        return 'bg-yellow-500 bg-opacity-10 dark:bg-yellow-400 dark:bg-opacity-20'
    }
  }

  // Apply suggestion
  const applySuggestion = useCallback((suggestion: Suggestion, replacement: string) => {
    const newContent = 
      content.substring(0, suggestion.offset) + 
      replacement + 
      content.substring(suggestion.offset + suggestion.length)
    
    setContentState(newContent)
    
    if (editorRef.current) {
      editorRef.current.value = newContent
    }
    
    // Update Redux state
    dispatch(setContent([{
      type: 'paragraph',
      children: [{ text: newContent }]
    }]))
    
    // Update current document content
    dispatch(updateCurrentDocumentContent(newContent))
    
    // Trigger grammar check and auto-save
    checkGrammar(newContent)
    autoSave(newContent)
    setShowTooltip(null)
  }, [content, dispatch, checkGrammar, autoSave])

  // Ignore suggestion
  const handleIgnoreSuggestion = useCallback((suggestionId: string) => {
    dispatch(ignoreSuggestion(suggestionId))
    setShowTooltip(null)
  }, [dispatch])

  // Accept all suggestions
  const handleAcceptAllSuggestions = useCallback(() => {
    if (suggestions.length === 0) return
    
    // Apply all suggestions to the content, starting from the end to preserve offsets
    let newContent = content
    const sortedSuggestions = [...suggestions].sort((a, b) => b.offset - a.offset)
    const acceptedSuggestions: Array<{ id: string, replacement: string }> = []
    
    sortedSuggestions.forEach(suggestion => {
      if (suggestion.replacements && suggestion.replacements.length > 0) {
        const replacement = suggestion.replacements[0] // Use first replacement
        const before = newContent.substring(0, suggestion.offset)
        const after = newContent.substring(suggestion.offset + suggestion.length)
        
        newContent = before + replacement + after
        acceptedSuggestions.push({ id: suggestion.id, replacement })
      }
    })
    
    // Update content
    setContentState(newContent)
    if (editorRef.current) {
      editorRef.current.value = newContent
    }
    
    // Update Redux state
    dispatch(setContent([{
      type: 'paragraph',
      children: [{ text: newContent }]
    }]))
    
    // Update current document content
    dispatch(updateCurrentDocumentContent(newContent))
    
    // Remove accepted suggestions from store
    dispatch(acceptAllSuggestions({ acceptedSuggestions }))
    
    // Trigger grammar check and auto-save for the new content
    checkGrammar(newContent)
    autoSave(newContent)
    setShowTooltip(null)
  }, [suggestions, content, dispatch, checkGrammar, autoSave])

  // Ignore all suggestions
  const handleIgnoreAllSuggestions = useCallback(() => {
    dispatch(ignoreAllCurrentSuggestions())
    setShowTooltip(null)
  }, [dispatch])

  // Set up global hover handlers for suggestion spans
  useEffect(() => {
    const hoverHandler = (suggestionId: string, event: MouseEvent) => {
      const target = event.target as HTMLElement
      const rect = target.getBoundingClientRect()
      setTooltipPosition({ x: rect.left, y: rect.bottom + 5 })
      setShowTooltip(suggestionId)
    }
    
    const leaveHandler = () => {
      // Add a delay before hiding to allow moving to tooltip
      setTimeout(() => {
        // Only hide if not hovering over tooltip
        if (!document.querySelector('.suggestion-tooltip:hover')) {
          setShowTooltip(null)
        }
      }, 150)
    }

    // Handle clicks on highlighted text to position cursor
    const clickHandler = (offset: number, event: MouseEvent) => {
      if (editorRef.current) {
        const target = event.target as HTMLElement
        const rect = target.getBoundingClientRect()
        const clickX = event.clientX - rect.left
        
        // Get the text content of the clicked span
        const spanText = target.textContent || ''
        
        // Create a temporary element to measure character positions
        const measurer = document.createElement('span')
        measurer.style.visibility = 'hidden'
        measurer.style.position = 'absolute'
        measurer.style.whiteSpace = 'pre'
        measurer.style.font = getComputedStyle(target).font
        measurer.style.fontSize = getComputedStyle(target).fontSize
        measurer.style.fontFamily = getComputedStyle(target).fontFamily
        document.body.appendChild(measurer)
        
        // Find the character position by measuring text width
        let characterPosition = 0
        for (let i = 0; i <= spanText.length; i++) {
          measurer.textContent = spanText.substring(0, i)
          const width = measurer.getBoundingClientRect().width
          
          if (width >= clickX) {
            // If we're closer to the previous character, use that position
            if (i > 0) {
              measurer.textContent = spanText.substring(0, i - 1)
              const prevWidth = measurer.getBoundingClientRect().width
              const midPoint = (prevWidth + width) / 2
              characterPosition = clickX < midPoint ? i - 1 : i
            } else {
              characterPosition = i
            }
            break
          }
          characterPosition = i
        }
        
        // Clean up the temporary element
        document.body.removeChild(measurer)
        
        // Calculate the final cursor position
        const finalPosition = offset + characterPosition
        
        // Focus the textarea and set cursor position
        editorRef.current.focus()
        editorRef.current.setSelectionRange(finalPosition, finalPosition)
        
        // Prevent event bubbling to avoid interfering with tooltip
        event.stopPropagation()
      }
    }

    // Handle clicks outside tooltip to close it (but don't interfere with text editing)
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const isTooltip = target.closest('.suggestion-tooltip')
      const isSuggestionSpan = target.closest('[data-suggestion-id]')
      
      // Only close tooltip if clicking outside both tooltip and suggestion spans
      if (!isTooltip && !isSuggestionSpan && showTooltip) {
        setShowTooltip(null)
      }
    }
    
    // Make handlers available globally for inline event handlers
    ;(window as any).handleSuggestionHover = hoverHandler
    ;(window as any).handleSuggestionLeave = leaveHandler
    ;(window as any).handleSuggestionClick = clickHandler
    
    // Add global click listener
    document.addEventListener('click', handleGlobalClick)
    
    return () => {
      // Cleanup
      delete (window as any).handleSuggestionHover
      delete (window as any).handleSuggestionLeave
      delete (window as any).handleSuggestionClick
      document.removeEventListener('click', handleGlobalClick)
    }
  }, [showTooltip])

  // Initialize content from current document
  useEffect(() => {
    if (currentDocument && currentDocument.content !== content) {
      // Clear old suggestions immediately when switching documents
      dispatch(clearSuggestions())
      
      // Set new content
      setContentState(currentDocument.content)
      if (editorRef.current) {
        editorRef.current.value = currentDocument.content
      }
      
      // Clear any existing tooltips
      setShowTooltip(null)
      
      // Trigger grammar check for new content if it has text
      if (currentDocument.content.trim() && currentDocument.content.length > 3) {
        checkGrammar(currentDocument.content)
      }
    }
  }, [currentDocument, content, dispatch, checkGrammar])

  // Track document ID changes to ensure suggestions are cleared when switching documents
  useEffect(() => {
    const currentDocId = currentDocument?.id || null
    const previousDocId = currentDocumentIdRef.current
    
    if (currentDocId !== previousDocId) {
      // Clear suggestions when document changes
      dispatch(clearSuggestions())
      
      // Clear any existing tooltips
      setShowTooltip(null)
      
      // Update the ref to track current document
      currentDocumentIdRef.current = currentDocId
      
      // If no document is selected, also clear the content
      if (!currentDocument) {
        setContentState('')
        if (editorRef.current) {
          editorRef.current.value = ''
        }
      }
    }
  }, [currentDocument?.id, dispatch, currentDocument])

  // Update highlighted content when suggestions change
  useEffect(() => {
    createHighlightedText()
  }, [createHighlightedText, suggestions, sentenceAnalysis])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current)
      }
      if (sentenceDebounceRef.current) {
        clearTimeout(sentenceDebounceRef.current)
      }
    }
  }, [])

  const activeSuggestion = combinedSuggestions.find(s => s.id === showTooltip) || suggestions.find(s => s.id === showTooltip)
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length
  const charCount = content.length

  return (
    <div className="relative w-full">
      {/* Statistics Bar */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
          {loading && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className="text-blue-500">Checking...</span>
            </div>
          )}
          {sentenceAnalysisLoading && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
              <span className="text-purple-500">Analyzing sentences...</span>
            </div>
          )}
          {/* Save Status */}
          {(saving || lastSaveStatus) && (
            <div className="flex items-center space-x-2">
              {(saving || lastSaveStatus === 'saving') && (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-500"></div>
                  <span className="text-green-600">Saving...</span>
                </>
              )}
              {lastSaveStatus === 'saved' && (
                <>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-green-600">Saved</span>
                </>
              )}
              {lastSaveStatus === 'error' && (
                <>
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-red-600">Save failed</span>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2 text-sm">
          {(suggestions.length > 0 || (sentenceAnalysis?.qualityDistribution?.incomplete > 0)) && (
            <>
              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">
                {suggestions.length + (sentenceAnalysis?.qualityDistribution?.incomplete || 0)} issue{(suggestions.length + (sentenceAnalysis?.qualityDistribution?.incomplete || 0)) !== 1 ? 's' : ''}
              </span>
              
              {/* Bulk Action Buttons */}
              <div className="flex items-center space-x-2 ml-3">
                <button
                  onClick={handleAcceptAllSuggestions}
                  className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-800 text-xs rounded transition-colors flex items-center space-x-1"
                  title="Accept all suggestions"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Accept All</span>
                </button>
                
                <button
                  onClick={handleIgnoreAllSuggestions}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded transition-colors flex items-center space-x-1"
                  title="Ignore all suggestions"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Ignore All</span>
                </button>
              </div>
            </>
          )}
          {sentenceAnalysis?.qualityDistribution?.incomplete > 0 && (
            <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
              {sentenceAnalysis.qualityDistribution.incomplete} incomplete sentence{sentenceAnalysis.qualityDistribution.incomplete !== 1 ? 's' : ''}
            </span>
          )}
          {suggestions.length === 0 && (!sentenceAnalysis?.qualityDistribution?.incomplete || sentenceAnalysis.qualityDistribution.incomplete === 0) && content.length > 0 && !loading && !sentenceAnalysisLoading && (
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
              No issues found
            </span>
          )}
        </div>
      </div>

      {/* Editor Container */}
      <div className="relative border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
        {/* Textarea */}
        <textarea
          ref={editorRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          className="w-full h-96 p-4 bg-transparent text-gray-900 dark:text-gray-100 resize-none focus:outline-none font-serif text-lg leading-relaxed"
          placeholder="Start writing your document... Grammar checking will begin automatically. Press Ctrl+S to save manually."
          style={{ fontFamily: 'ui-serif, Georgia, serif' }}
        />
        
        {/* Overlay for highlights */}
        <div
          ref={overlayRef}
          className="grammar-overlay absolute inset-0 p-4 font-serif text-lg leading-relaxed text-transparent z-10"
          style={{ 
            fontFamily: 'ui-serif, Georgia, serif',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}
          dangerouslySetInnerHTML={{ __html: highlightedContent }}
        />
      </div>

      {/* Suggestion Tooltip */}
      {activeSuggestion && showTooltip && (
        <>
          {/* Backdrop - removed to keep text editable */}
          
          {/* Tooltip */}
          <div 
            className="suggestion-tooltip fixed z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-4 max-w-sm"
            style={{
              left: tooltipPosition.x,
              top: tooltipPosition.y
            }}
            onMouseEnter={() => {
              // Keep tooltip open when hovering over it
            }}
            onMouseLeave={() => {
              // Hide tooltip when leaving it
              setTimeout(() => setShowTooltip(null), 100)
            }}
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className={`text-xs px-2 py-1 rounded font-medium ${
                  activeSuggestion.type === 'grammar' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                  activeSuggestion.type === 'spelling' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                }`}>
                  {activeSuggestion.type.toUpperCase()}
                </span>
                <button
                  onClick={() => handleIgnoreSuggestion(activeSuggestion.id)}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-sm"
                >
                  Ignore
                </button>
              </div>
              
              {/* Message */}
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {activeSuggestion.message}
              </p>
              
              {/* Suggestions */}
              {activeSuggestion.replacements && activeSuggestion.replacements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Suggestions:
                  </p>
                  <div className="space-y-1">
                    {activeSuggestion.replacements.slice(0, 3).map((replacement, index) => (
                      <button
                        key={index}
                        onClick={() => applySuggestion(activeSuggestion, replacement)}
                        className="block w-full text-left px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                      >
                        "{replacement}"
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Explanation */}
              {activeSuggestion.explanation && activeSuggestion.explanation !== activeSuggestion.message && (
                <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {activeSuggestion.explanation}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Suggestions Panel */}
      {suggestions.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Writing Suggestions ({suggestions.length})
            </h3>
            
            {/* Bulk Actions in Panel */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAcceptAllSuggestions}
                className="px-3 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-800 dark:text-green-200 text-xs rounded transition-colors flex items-center space-x-1"
                title="Accept all suggestions"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Accept All ({suggestions.length})</span>
              </button>
              
              <button
                onClick={handleIgnoreAllSuggestions}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded transition-colors flex items-center space-x-1"
                title="Ignore all suggestions"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Ignore All</span>
              </button>
            </div>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {suggestions.slice(0, 5).map((suggestion) => (
              <div 
                key={suggestion.id}
                className="flex items-start space-x-3 p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
              >
                <span className={`text-xs px-2 py-1 rounded flex-shrink-0 ${
                  suggestion.type === 'grammar' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                  suggestion.type === 'spelling' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                }`}>
                  {suggestion.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {suggestion.message}
                  </p>
                  {suggestion.replacements && suggestion.replacements.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {suggestion.replacements.slice(0, 2).map((replacement, index) => (
                        <button
                          key={index}
                          onClick={() => applySuggestion(suggestion, replacement)}
                          className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                        >
                          {replacement}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sentence Analysis Panel */}
      <SentenceAnalysisPanel 
        text={content}
        onSentenceClick={(offset, length) => {
          if (editorRef.current) {
            editorRef.current.focus()
            editorRef.current.setSelectionRange(offset, offset + length)
          }
        }}
        onApplySuggestion={(offset, length, replacement) => {
          // Apply the suggestion to the text
          const newContent = 
            content.substring(0, offset) + 
            replacement + 
            content.substring(offset + length)
          
          setContentState(newContent)
          
          if (editorRef.current) {
            editorRef.current.value = newContent
            // Position cursor after the replacement
            const newCursorPosition = offset + replacement.length
            editorRef.current.focus()
            editorRef.current.setSelectionRange(newCursorPosition, newCursorPosition)
          }
          
          // Update Redux state
          dispatch(setContent([{
            type: 'paragraph',
            children: [{ text: newContent }]
          }]))
          
          // Update current document content
          dispatch(updateCurrentDocumentContent(newContent))
          
          // Trigger grammar check and auto-save
          checkGrammar(newContent)
          autoSave(newContent)
        }}
      />
    </div>
  )
}

export default GrammarTextEditor 