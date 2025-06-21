import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { 
  checkText, 
  checkTextWithAI, 
  ignoreSuggestion, 
  clearSuggestions, 
  selectAICheckEnabled,
  selectStreamingStatus,
  startStreaming,
  addStreamingSuggestion,
  completeStreaming,
  streamingError
} from '../store/slices/suggestionSlice'
import { setContent, setLastSaved } from '../store/slices/editorSlice'
import { updateDocument } from '../store/slices/documentSlice'
import { Suggestion } from '../store/slices/suggestionSlice'
import { checkGrammarWithAIStream } from '../services/aiGrammarService'

interface TextEditorProps {
  documentId?: string
  initialContent?: string
  onContentChange?: (content: string) => void
  readOnly?: boolean
  className?: string
}

const TextEditor: React.FC<TextEditorProps> = ({
  documentId,
  initialContent = '',
  onContentChange,
  readOnly = false,
  className = ''
}) => {
  const dispatch = useDispatch<AppDispatch>()
  const { suggestions, loading } = useSelector((state: RootState) => state.suggestions)
  const { user } = useSelector((state: RootState) => state.auth)
  const { autoSaveEnabled } = useSelector((state: RootState) => state.editor)
  const aiCheckEnabled = useSelector(selectAICheckEnabled)
  const streamingStatus = useSelector(selectStreamingStatus)
  
  const [content, setContentState] = useState(initialContent || '')
  const [, setSelectionRange] = useState<{ start: number; end: number } | null>(null)
  const [showSuggestionTooltip, setShowSuggestionTooltip] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [lastTriggerType, setLastTriggerType] = useState<string>('')
  const [paragraphCache, setParagraphCache] = useState<Map<number, string>>(new Map())
  const [incrementalStatus, setIncrementalStatus] = useState<{ active: boolean; paragraphs: number }>({ active: false, paragraphs: 0 })
  const [streamingEnabled, setStreamingEnabled] = useState(true) // Default to streaming mode
  const [typingSpeed, setTypingSpeed] = useState<{ wpm: number; lastUpdate: number }>({ wpm: 0, lastUpdate: 0 })
  const [editHistory, setEditHistory] = useState<Array<{ type: 'add' | 'delete' | 'replace'; size: number; timestamp: number }>>([])
  const [smartDebounceConfig, setSmartDebounceConfig] = useState({
    baseDelay: 2000,
    minDelay: 300,
    maxDelay: 5000,
    adaptiveEnabled: true
  })
  const [showDebounceMenu, setShowDebounceMenu] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [persistedContent, setPersistedContent] = useState<string>('')
  
  const editorRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()
  const lastCheckRef = useRef<string>('')
  const autoSaveRef = useRef<NodeJS.Timeout>()
  const lastAICheckTextRef = useRef<string>('')
  const pauseDetectionRef = useRef<NodeJS.Timeout>()
  const streamAbortRef = useRef<(() => void) | null>(null)
  const lastTypingTimeRef = useRef<number>(Date.now())
  const wordCountRef = useRef<number>(0)
  const isMountedRef = useRef<boolean>(true)
  
  // Create a unique key for localStorage based on document ID
  const localStorageKey = `wordwise_editor_content_${documentId || 'default'}`

  // Normalize text to ensure consistent line break handling
  const normalizeText = useCallback((text: string): string => {
    // Ensure consistent line break representation
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  }, [])

  // Calculate typing speed
  const updateTypingSpeed = useCallback(() => {
    const now = Date.now()
    const timeDiff = now - lastTypingTimeRef.current
    
    if (timeDiff > 100) { // Only update if at least 100ms has passed
      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length
      const wordDiff = wordCount - wordCountRef.current
      
      if (wordDiff > 0 && timeDiff < 10000) { // Within 10 seconds
        const wpm = Math.round((wordDiff / (timeDiff / 1000)) * 60)
        setTypingSpeed({ wpm: Math.min(wpm, 200), lastUpdate: now }) // Cap at 200 WPM
      }
      
      wordCountRef.current = wordCount
      lastTypingTimeRef.current = now
    }
  }, [content])

  // Analyze edit patterns
  const analyzeEditPattern = useCallback((oldContent: string, newContent: string) => {
    const now = Date.now()
    const lenDiff = newContent.length - oldContent.length
    
    let editType: 'add' | 'delete' | 'replace' = 'add'
    if (lenDiff < 0) editType = 'delete'
    else if (lenDiff === 0 && oldContent !== newContent) editType = 'replace'
    
    const newHistory = [...editHistory, {
      type: editType,
      size: Math.abs(lenDiff),
      timestamp: now
    }].slice(-20) // Keep last 20 edits
    
    setEditHistory(newHistory)
    
    // Analyze recent edit patterns
    const recentEdits = newHistory.filter(e => now - e.timestamp < 5000) // Last 5 seconds
    const deletions = recentEdits.filter(e => e.type === 'delete').length
    const additions = recentEdits.filter(e => e.type === 'add').length
    const replacements = recentEdits.filter(e => e.type === 'replace').length
    
    return {
      isHeavyEditing: deletions > 3 || replacements > 2,
      isContinuousTyping: additions > 5 && deletions < 2,
      isMinorCorrection: recentEdits.length < 3 && Math.abs(lenDiff) < 5
    }
  }, [editHistory])

  // Calculate smart debounce delay
  const calculateSmartDelay = useCallback((
    trigger: string,
    editPattern: { isHeavyEditing: boolean; isContinuousTyping: boolean; isMinorCorrection: boolean }
  ): number => {
    if (!smartDebounceConfig.adaptiveEnabled) {
      return smartDebounceConfig.baseDelay
    }

    let delay = smartDebounceConfig.baseDelay
    
    // Adjust based on trigger type
    switch (trigger) {
      case 'sentence':
      case 'paragraph':
        delay = 100 // Immediate for natural breaks
        break
      case 'blur':
        delay = 0 // Instant when leaving editor
        break
      case 'pause':
        delay = 500 // Quick check on pause
        break
    }
    
    // Adjust based on typing speed
    if (typingSpeed.wpm > 80) {
      // Fast typer - increase delay
      delay = Math.min(delay * 1.5, smartDebounceConfig.maxDelay)
    } else if (typingSpeed.wpm < 30 && typingSpeed.wpm > 0) {
      // Slow typer - decrease delay
      delay = Math.max(delay * 0.7, smartDebounceConfig.minDelay)
    }
    
    // Adjust based on edit pattern
    if (editPattern.isHeavyEditing) {
      // User is making lots of changes - wait longer
      delay = Math.min(delay * 2, smartDebounceConfig.maxDelay)
    } else if (editPattern.isMinorCorrection) {
      // Small correction - check sooner
      delay = Math.max(delay * 0.5, smartDebounceConfig.minDelay)
    } else if (editPattern.isContinuousTyping) {
      // Flowing writing - moderate delay
      delay = Math.min(delay * 1.2, smartDebounceConfig.maxDelay)
    }
    
    // Adjust based on document size
    const docLength = content.length
    if (docLength > 5000) {
      // Large document - increase delay
      delay = Math.min(delay * 1.3, smartDebounceConfig.maxDelay)
    } else if (docLength < 500) {
      // Small document - decrease delay
      delay = Math.max(delay * 0.8, smartDebounceConfig.minDelay)
    }
    
    // Adjust based on AI load (if many suggestions exist)
    if (suggestions.length > 20) {
      delay = Math.min(delay * 1.5, smartDebounceConfig.maxDelay)
    }
    
    return Math.round(delay)
  }, [smartDebounceConfig, typingSpeed, content.length, suggestions.length])

  // Get paragraphs with their positions
  const getParagraphsWithPositions = useCallback((text: string): Array<{ text: string; start: number; end: number; index: number }> => {
    const paragraphs: Array<{ text: string; start: number; end: number; index: number }> = []
    const lines = text.split('\n')
    let position = 0
    let paragraphText = ''
    let paragraphStart = 0
    let index = 0
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      if (line.trim() === '') {
        // Empty line - end current paragraph if any
        if (paragraphText) {
          paragraphs.push({ 
            text: paragraphText, 
            start: paragraphStart, 
            end: position - 1,
            index: index++
          })
          paragraphText = ''
        }
        position += line.length + 1 // +1 for newline
      } else {
        // Non-empty line
        if (!paragraphText) {
          paragraphStart = position
        }
        paragraphText += (paragraphText ? '\n' : '') + line
        position += line.length + 1
      }
    }
    
    // Don't forget last paragraph
    if (paragraphText) {
      paragraphs.push({ 
        text: paragraphText, 
        start: paragraphStart, 
        end: position - 1,
        index: index++
      })
    }
    
    return paragraphs
  }, [])

  // Find changed paragraphs by comparing with cache
  const findChangedParagraphs = useCallback((text: string): Array<{ text: string; start: number; end: number; index: number }> => {
    const paragraphs = getParagraphsWithPositions(text)
    const changed: Array<{ text: string; start: number; end: number; index: number }> = []
    
    for (const para of paragraphs) {
      const cached = paragraphCache.get(para.index)
      if (cached !== para.text) {
        changed.push(para)
      }
    }
    
    // Also check if paragraphs were deleted (cache has more than current)
    if (paragraphCache.size > paragraphs.length) {
      // Force full check if paragraphs were deleted
      return paragraphs
    }
    
    return changed
  }, [paragraphCache, getParagraphsWithPositions])

  // Intelligent grammar checking triggers
  const checkGrammar = useCallback(
    (text: string, trigger: 'typing' | 'sentence' | 'paragraph' | 'pause' | 'blur' = 'typing', editPattern?: any) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      
      // Normalize text before checking
      const normalizedText = normalizeText(text)
      
      // Don't check if text hasn't changed or is too short
      if (!normalizedText || !normalizedText.trim() || normalizedText === lastCheckRef.current || normalizedText.length <= 3) {
        console.log('Skipping grammar check:', {
          hasText: !!normalizedText,
          trimmedLength: normalizedText?.trim()?.length || 0,
          isSameAsLast: normalizedText === lastCheckRef.current
        })
        return
      }
      
      // Calculate smart delay
      const pattern = editPattern || { isHeavyEditing: false, isContinuousTyping: false, isMinorCorrection: false }
      const delay = calculateSmartDelay(trigger, pattern)
      
      // Create detailed trigger info
      const triggerInfo = {
        type: trigger,
        delay,
        wpm: typingSpeed.wpm,
        pattern: pattern.isHeavyEditing ? 'heavy' : pattern.isContinuousTyping ? 'flowing' : pattern.isMinorCorrection ? 'minor' : 'normal',
        docSize: normalizedText.length
      }
      
      console.log(`Smart debounce: trigger=${trigger}, delay=${delay}ms, wpm=${typingSpeed.wpm}, pattern=${triggerInfo.pattern}`)
      setLastTriggerType(`${trigger} (${delay}ms, ${typingSpeed.wpm}wpm)`)
      
      debounceRef.current = setTimeout(() => {
        if (normalizedText.trim() && normalizedText !== lastCheckRef.current && normalizedText.length > 3) {
          lastCheckRef.current = normalizedText
          
          console.log(`Grammar check executing: trigger=${trigger}`)
          
          // Cancel any pending pause detection since we're checking now
          if (pauseDetectionRef.current) {
            clearTimeout(pauseDetectionRef.current)
          }
          
          // Get changed paragraphs for incremental checking
          const changedParagraphs = findChangedParagraphs(normalizedText)
          
                      // Update paragraph cache
          const newCache = new Map<number, string>()
          const allParagraphs = getParagraphsWithPositions(normalizedText)
          for (const para of allParagraphs) {
            newCache.set(para.index, para.text)
          }
          setParagraphCache(newCache)
          
          // Log paragraph changes for debugging
          if (changedParagraphs.length > 0 && changedParagraphs.length < allParagraphs.length) {
            console.log('📝 Paragraph changes detected:', {
              total: allParagraphs.length,
              changed: changedParagraphs.length,
              changedIndices: changedParagraphs.map(p => p.index),
              changedText: changedParagraphs.map(p => ({
                index: p.index,
                preview: p.text.substring(0, 50) + (p.text.length > 50 ? '...' : '')
              }))
            })
          }
          
          // Use AI check if enabled, otherwise use regular check
          if (aiCheckEnabled) {
            if (changedParagraphs.length === 0) {
              console.log('No paragraphs changed, skipping check')
              return
            }
            
            // Abort any existing stream
            if (streamAbortRef.current) {
              streamAbortRef.current()
              streamAbortRef.current = null
            }
            
            // Determine if incremental or full check
            const isIncremental = changedParagraphs.length < allParagraphs.length
            const changedRanges = isIncremental ? changedParagraphs.map(p => ({ start: p.start, end: p.end })) : undefined
            
            if (streamingEnabled) {
              // Use streaming mode
              console.log(`Starting streaming ${isIncremental ? 'incremental' : 'full'} check`)
              dispatch(clearSuggestions()) // Clear existing suggestions for streaming
              dispatch(startStreaming({ message: 'Analyzing text...' }))
              
              checkGrammarWithAIStream({
                text: normalizedText,
                documentType: 'general',
                checkType: 'comprehensive',
                changedRanges
              }, {
                onStart: () => {
                  console.log('Streaming started')
                },
                onSuggestion: (suggestion, count) => {
                  dispatch(addStreamingSuggestion({ suggestion, count }))
                },
                onComplete: (stats, metadata) => {
                  dispatch(completeStreaming({ stats, metadata }))
                  console.log('Streaming complete:', stats)
                },
                onError: (error) => {
                  dispatch(streamingError(error))
                  console.error('Streaming error:', error)
                }
              }).then(abort => {
                streamAbortRef.current = abort
              })
              
              if (isIncremental) {
                setIncrementalStatus({ active: true, paragraphs: changedParagraphs.length })
                setTimeout(() => setIncrementalStatus({ active: false, paragraphs: 0 }), 3000)
              }
            } else {
              // Use non-streaming mode
              if (changedParagraphs.length === allParagraphs.length) {
                console.log('Full document check')
                lastAICheckTextRef.current = normalizedText
                dispatch(checkTextWithAI({ 
                  text: normalizedText,
                  enableAI: true,
                  documentType: 'general',
                  checkType: 'comprehensive'
                }))
              } else {
                console.log(`Incremental check: ${changedParagraphs.length} changed paragraphs out of ${allParagraphs.length}`)
                setIncrementalStatus({ active: true, paragraphs: changedParagraphs.length })
                lastAICheckTextRef.current = normalizedText
                dispatch(checkTextWithAI({ 
                  text: normalizedText,
                  enableAI: true,
                  documentType: 'general',
                  checkType: 'comprehensive',
                  changedRanges
                }))
                setTimeout(() => setIncrementalStatus({ active: false, paragraphs: 0 }), 3000)
              }
            }
          } else {
            dispatch(checkText({ text: normalizedText }))
          }
        }
      }, delay)
    },
    [dispatch, aiCheckEnabled, normalizeText, findChangedParagraphs, getParagraphsWithPositions, streamingEnabled, calculateSmartDelay, typingSpeed]
  )

  // Auto-save functionality
  const autoSave = useCallback(
    (text: string) => {
      if (!autoSaveEnabled || !documentId || !user) return
      
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current)
      }
      
      autoSaveRef.current = setTimeout(() => {
        dispatch(updateDocument({ 
          id: documentId, 
          content: text 
        })).then(() => {
          dispatch(setLastSaved(Date.now()))
        })
      }, 3000) // Auto-save after 3 seconds of no typing
    },
    [autoSaveEnabled, documentId, user, dispatch]
  )

  // Handle content changes
  const handleContentChange = useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      const rawContent = event.currentTarget.innerText || event.currentTarget.textContent || ''
      const newContent = normalizeText(rawContent)
      
      // Only update if content actually changed
      if (newContent !== content) {
        // Update typing speed
        updateTypingSpeed()
        
        // Analyze edit pattern
        const editPattern = analyzeEditPattern(content, newContent)
        
        // Detect what triggered this change
        let trigger: 'typing' | 'sentence' | 'paragraph' | 'pause' = 'typing'
        
        // Check if user just completed a sentence
        const lastChar = newContent[newContent.length - 1]
        const secondLastChar = newContent[newContent.length - 2]
        const lastTwoChars = newContent.slice(-2)
        
        // Check for sentence endings: ". ", "! ", "? " or just ".", "!", "?"
        if ((lastChar === ' ' && ['.', '!', '?'].includes(secondLastChar)) ||
            ['. ', '! ', '? '].includes(lastTwoChars) ||
            (newContent.length > content.length && ['.', '!', '?'].includes(lastChar))) {
          trigger = 'sentence'
          console.log('Sentence completion detected')
        } 
        // Check if user just created a paragraph (Enter key creates \n)
        else if (newContent.length > content.length && 
                 (newContent.includes('\n\n') || 
                  (lastChar === '\n' && secondLastChar === '\n'))) {
          trigger = 'paragraph'
          console.log('Paragraph break detected')
        }
        
        setContentState(newContent)
        
        // Update Redux store
        dispatch(setContent([{
          type: 'paragraph',
          children: [{ text: newContent }]
        }]))
        
        // Call external handler
        onContentChange?.(newContent)
        
        // Clear existing pause detection timer
        if (pauseDetectionRef.current) {
          clearTimeout(pauseDetectionRef.current)
        }
        
        // If we detected sentence/paragraph completion, check immediately
        if (trigger === 'sentence' || trigger === 'paragraph') {
          checkGrammar(newContent, trigger, editPattern)
        } else {
          // Otherwise, use smart debouncing
          checkGrammar(newContent, 'typing', editPattern)
          
          // Set up adaptive pause detection based on typing speed
          const pauseDelay = typingSpeed.wpm > 60 ? 4000 : 3000 // Faster typers get longer pause detection
          pauseDetectionRef.current = setTimeout(() => {
            console.log('Pause in typing detected')
            checkGrammar(newContent, 'pause', editPattern)
          }, pauseDelay)
        }
        
        autoSave(newContent)
      }
    },
    [content, onContentChange, checkGrammar, autoSave, dispatch, normalizeText, updateTypingSpeed, analyzeEditPattern, typingSpeed]
  )

  // Handle text selection for cursor position
  const handleSelectionChange = useCallback(() => {
    if (!editorRef.current) return
    
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      // const textContent = editorRef.current.textContent || ''
      
      let start = 0
      let end = 0
      
      try {
        const tempRange = document.createRange()
        tempRange.selectNodeContents(editorRef.current)
        tempRange.setEnd(range.startContainer, range.startOffset)
        start = tempRange.toString().length
        
        tempRange.setEnd(range.endContainer, range.endOffset)
        end = tempRange.toString().length
      } catch (error) {
        console.warn('Error calculating selection range:', error)
      }
      
      setSelectionRange({ start, end })
    }
  }, [])

  // Render text with highlighting
  const renderHighlightedText = useCallback(() => {
    if (!content) return ''
    
    if (suggestions.length === 0) {
      // Even with no suggestions, we need to escape HTML
      const div = document.createElement('div')
      div.textContent = content
      return div.innerHTML
    }

    // Create segments for highlighting
    const segments: Array<{
      start: number
      end: number
      text: string
      suggestion?: Suggestion
    }> = []
    
    // Add all text segments and suggestions
    let lastEnd = 0
    const sortedSuggestions = [...suggestions].sort((a, b) => a.offset - b.offset)
    
    // Filter out suggestions that are out of bounds
    const validSuggestions = sortedSuggestions.filter(suggestion => {
      // Check if suggestion is within content bounds
      if (suggestion.offset < 0 || suggestion.offset + suggestion.length > content.length) {
        return false
      }
      
      return true
    })
    
    // Filter out overlapping suggestions
    const nonOverlappingSuggestions: Suggestion[] = []
    const seenOffsets = new Set<string>()
    
    validSuggestions.forEach(suggestion => {
      const offsetKey = `${suggestion.offset}-${suggestion.length}`
      const lastSuggestion = nonOverlappingSuggestions[nonOverlappingSuggestions.length - 1]
      
      // Skip if we already have a suggestion at this exact position
      if (seenOffsets.has(offsetKey)) {
        console.log('Skipping duplicate suggestion at same offset:', {
          id: suggestion.id,
          offset: suggestion.offset,
          type: suggestion.type
        })
        return
      }
      
      // Skip if it overlaps with the previous suggestion
      if (!lastSuggestion || suggestion.offset >= lastSuggestion.offset + lastSuggestion.length) {
        nonOverlappingSuggestions.push(suggestion)
        seenOffsets.add(offsetKey)
      }
    })
    
          nonOverlappingSuggestions.forEach((suggestion, index) => {
        // Add text before this suggestion
        if (suggestion.offset > lastEnd) {
          segments.push({
            start: lastEnd,
            end: suggestion.offset,
            text: content.substring(lastEnd, suggestion.offset)
          })
        }
        
        // Add the suggestion segment
        const suggestionText = content.substring(suggestion.offset, suggestion.offset + suggestion.length)
        
        // Debug: Check for newlines around suggestions
        const textBefore = content.substring(Math.max(0, suggestion.offset - 20), suggestion.offset)
        const textAfter = content.substring(suggestion.offset + suggestion.length, Math.min(content.length, suggestion.offset + suggestion.length + 20))
        const newlinesBefore = (textBefore.match(/\n/g) || []).length
        const newlinesInText = (suggestionText.match(/\n/g) || []).length
        
        if (index < 3 || newlinesBefore > 0 || newlinesInText > 0) {
          console.log(`Suggestion ${index}:`, {
            id: suggestion.id,
            type: suggestion.type,
            offset: suggestion.offset,
            length: suggestion.length,
            text: JSON.stringify(suggestionText),
            newlinesBefore,
            newlinesInText,
            textBefore: JSON.stringify(textBefore),
            textAfter: JSON.stringify(textAfter)
          })
        }
        
        segments.push({
          start: suggestion.offset,
          end: suggestion.offset + suggestion.length,
          text: suggestionText,
          suggestion
        })
        
        lastEnd = suggestion.offset + suggestion.length
      })
    
    // Add any remaining text
    if (lastEnd < content.length) {
      segments.push({
        start: lastEnd,
        end: content.length,
        text: content.substring(lastEnd)
      })
    }
    
    // Helper to escape HTML
    const escapeHtml = (text: string): string => {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    }
    
    // Build HTML
    return segments.map(segment => {
      const escapedText = escapeHtml(segment.text)
      
      if (segment.suggestion) {
        const highlightClass = getHighlightClass(segment.suggestion.type)
        return `<span 
          class="${highlightClass}" 
          data-suggestion-id="${segment.suggestion.id}"
          onMouseEnter="handleSuggestionHover('${segment.suggestion.id}', event)"
          onMouseLeave="handleSuggestionLeave()"
        >${escapedText}</span>`
      }
      return escapedText
    }).join('')
  }, [content, suggestions])

  // Get CSS class for different error types
  const getHighlightClass = (type: Suggestion['type']): string => {
    switch (type) {
      case 'grammar':
        return 'grammar-error'
      case 'spelling':
        return 'spelling-error'
      case 'style':
      case 'clarity':
      case 'engagement':
      case 'delivery':
        return 'style-suggestion'
      default:
        return 'suggestion-highlight'
    }
  }

  // Handle suggestion hover
  const handleSuggestionHover = useCallback((suggestionId: string, event: MouseEvent) => {
    const suggestion = suggestions.find(s => s.id === suggestionId)
    if (suggestion) {
      // Smart tooltip positioning function
      const calculateTooltipPosition = (mouseEvent: MouseEvent) => {
        const tooltipHeight = 200 // Approximate tooltip height
        const tooltipWidth = 384 // max-w-sm is approximately 384px
        const viewportHeight = window.innerHeight
        const viewportWidth = window.innerWidth
        const buffer = 10 // Buffer from viewport edges
        
        let left = mouseEvent.clientX + 10
        let top = mouseEvent.clientY - 10
        
        // Check if tooltip would go off the bottom of the screen
        if (top + tooltipHeight > viewportHeight - buffer) {
          // Position above the cursor instead
          top = mouseEvent.clientY - tooltipHeight - 10
          
          // If it would still go off the top, position at the top of the viewport
          if (top < buffer) {
            top = buffer
          }
        }
        
        // Check if tooltip would go off the right edge
        if (left + tooltipWidth > viewportWidth - buffer) {
          left = viewportWidth - tooltipWidth - buffer
        }
        
        // Check if tooltip would go off the left edge
        if (left < buffer) {
          left = buffer
        }
        
        return { top, left }
      }

      setShowSuggestionTooltip(suggestionId)
      const position = calculateTooltipPosition(event)
      setTooltipPosition(position)
    }
  }, [suggestions])

  // Handle suggestion leave
  const handleSuggestionLeave = useCallback(() => {
    setShowSuggestionTooltip(null)
  }, [])

  // Apply suggestion
  const handleApplySuggestion = useCallback((suggestion: Suggestion, replacement: string) => {
    const newContent = 
      content.substring(0, suggestion.offset) + 
      replacement + 
      content.substring(suggestion.offset + suggestion.length)
    
    setContentState(newContent)
    
    // Update editor content
    if (editorRef.current) {
      editorRef.current.innerText = newContent
    }
    
    // Clear all existing suggestions to ensure no stale highlights remain, then trigger fresh grammar check immediately
    dispatch(clearSuggestions())
    
    // Use AI check if enabled, otherwise use regular check
    if (aiCheckEnabled) {
      lastAICheckTextRef.current = newContent
      dispatch(checkTextWithAI({ 
        text: newContent,
        enableAI: true,
        documentType: 'general',
        checkType: 'comprehensive'
      }))
    } else {
      dispatch(checkText({ text: newContent }))
    }
    
    dispatch(setContent([
      {
        type: 'paragraph',
        children: [{ text: newContent }],
      },
    ]))
    
    onContentChange?.(newContent)
    checkGrammar(newContent, 'blur', { isHeavyEditing: false, isContinuousTyping: false, isMinorCorrection: true })
    setShowSuggestionTooltip(null)
  }, [content, dispatch, onContentChange, checkGrammar])

  // Ignore suggestion
  const handleIgnoreSuggestion = useCallback((suggestionId: string) => {
    dispatch(ignoreSuggestion(suggestionId))
    setShowSuggestionTooltip(null)
  }, [dispatch])

  // Handle editor blur (when user clicks away)
  const handleEditorBlur = useCallback(() => {
    console.log('Editor blur - checking grammar immediately')
    if (content && content.trim().length > 3) {
      checkGrammar(content, 'blur', { isHeavyEditing: false, isContinuousTyping: false, isMinorCorrection: false })
    }
  }, [content, checkGrammar])

  // Initialize content only once
  useEffect(() => {
    // Only initialize if we haven't already and we have initial content
    if (!hasInitialized && initialContent !== undefined) {
      console.log('Initializing editor content:', initialContent ? initialContent.substring(0, 50) + '...' : 'empty')
      setContentState(initialContent || '')
      if (editorRef.current) {
        editorRef.current.innerText = initialContent || ''
      }
      setHasInitialized(true)
      
      // Trigger initial grammar check when content is loaded
      if (initialContent && initialContent.trim().length > 3) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          checkGrammar(initialContent, 'blur', { isHeavyEditing: false, isContinuousTyping: false, isMinorCorrection: false })
        }, 100)
      }
    }
  }, []) // Empty dependency array - only run once on mount
  
  // Handle changes to initialContent after mount (e.g., loading a different document)
  useEffect(() => {
    // Only update if this is a significant change (e.g., loading a different document)
    // and not just a re-render
    if (hasInitialized && initialContent && initialContent.length > 0 && 
        Math.abs(initialContent.length - content.length) > 50) {
      console.log('Detected document change, updating content')
      setContentState(initialContent)
      if (editorRef.current) {
        editorRef.current.innerText = initialContent
      }
      // Reset caches for new document
      setParagraphCache(new Map())
      setEditHistory([])
    }
  }, [initialContent, hasInitialized])

  // Update editor content when suggestions change (not on every keystroke)
  useEffect(() => {
    if (!editorRef.current) return
    
    // Set initial content if editor is empty
    if (!editorRef.current.textContent && content) {
      editorRef.current.innerText = content
      return
    }
    
    // Get the current text from the editor to ensure consistency
    const rawText = editorRef.current.innerText || editorRef.current.textContent || ''
    const currentText = normalizeText(rawText)
    
    // Only update if we have the same content (to avoid offset mismatches)
    if (currentText !== content) {
      console.warn('Editor content mismatch:', {
        editorLength: currentText.length,
        stateLength: content.length,
        editorPreview: currentText.substring(0, 50),
        statePreview: content.substring(0, 50)
      })
      return
    }
    
    // Save cursor position
    const selection = window.getSelection()
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
    let cursorOffset = 0
    
    if (range && editorRef.current.contains(range.startContainer)) {
      const preCaretRange = document.createRange()
      preCaretRange.selectNodeContents(editorRef.current)
      preCaretRange.setEnd(range.startContainer, range.startOffset)
      cursorOffset = preCaretRange.toString().length
    }
    
    // Only update innerHTML if suggestions have changed and we have valid content
    const newHtml = renderHighlightedText()
    if (newHtml && editorRef.current.innerHTML !== newHtml) {
      // Double check we're not clearing content
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = newHtml
      const newTextContent = tempDiv.textContent || ''
      
      if (newTextContent.trim().length > 0 || content.trim().length === 0) {
        editorRef.current.innerHTML = newHtml
      } else {
        console.warn('Preventing innerHTML update that would clear content')
      }
      
      // Restore cursor position
      if (cursorOffset > 0 && selection) {
        const walker = document.createTreeWalker(
          editorRef.current,
          NodeFilter.SHOW_TEXT
        )
        
        let node
        let currentOffset = 0
        
        while (node = walker.nextNode()) {
          const nodeLength = node.textContent?.length || 0
          if (currentOffset + nodeLength >= cursorOffset) {
            const newRange = document.createRange()
            newRange.setStart(node, Math.min(cursorOffset - currentOffset, nodeLength))
            newRange.collapse(true)
            selection.removeAllRanges()
            selection.addRange(newRange)
            break
          }
          currentOffset += nodeLength
        }
      }
    }
  }, [suggestions, renderHighlightedText, content, normalizeText])

  // Monitor for AI suggestions and validate them
  useEffect(() => {
    // Debug: Check what suggestions we have
    if (suggestions.length > 0) {
      console.log('Suggestion sources:', {
        total: suggestions.length,
        bySource: suggestions.reduce((acc, s) => {
          acc[s.source || 'undefined'] = (acc[s.source || 'undefined'] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      })
      
      // Debug: Check content structure
      console.log('Content structure:', {
        length: content.length,
        lines: content.split('\n').length,
        hasNewlines: content.includes('\n'),
        sample: JSON.stringify(content.substring(0, 100))
      })
    }
  }, [suggestions, content])

  // Add global event listeners
  useEffect(() => {
    isMountedRef.current = true;
    
    // Make hover functions globally available
    (window as any).handleSuggestionHover = handleSuggestionHover;
    (window as any).handleSuggestionLeave = handleSuggestionLeave;
    
    document.addEventListener('selectionchange', handleSelectionChange)
    
    // Click outside handler for debounce menu
    const handleClickOutside = (event: MouseEvent) => {
      if (showDebounceMenu && !(event.target as Element).closest('.debounce-menu-container')) {
        setShowDebounceMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    
    // Handle visibility change to preserve content
    const handleVisibilityChange = () => {
      if (!editorRef.current) return
      
      if (document.hidden) {
        // Tab is being hidden, save current editor content
        const currentContent = normalizeText(editorRef.current.innerText || editorRef.current.textContent || '')
        console.log('Tab losing focus, preserving content length:', currentContent.length)
        
        // Save to multiple places for redundancy
        setPersistedContent(currentContent)
        setContentState(currentContent)
        
        // Save to localStorage as backup
        try {
          localStorage.setItem(localStorageKey, currentContent)
          localStorage.setItem(`${localStorageKey}_timestamp`, Date.now().toString())
        } catch (e) {
          console.error('Failed to save to localStorage:', e)
        }
        
        // Also update Redux store
        dispatch(setContent([{
          type: 'paragraph',
          children: [{ text: currentContent }]
        }]))
      } else {
        // Tab is becoming visible
        setTimeout(() => {
          if (!isMountedRef.current || !editorRef.current) return
          
          const editorContent = normalizeText(editorRef.current.innerText || editorRef.current.textContent || '')
          console.log('Tab gaining focus, editor:', editorContent.length, 'persisted:', persistedContent.length, 'state:', content.length)
          
          // Try to get content from localStorage first
          let localStorageContent = ''
          try {
            const saved = localStorage.getItem(localStorageKey)
            const timestamp = localStorage.getItem(`${localStorageKey}_timestamp`)
            
            // Only use localStorage if it's recent (within 5 minutes)
            if (saved && timestamp) {
              const age = Date.now() - parseInt(timestamp)
              if (age < 5 * 60 * 1000) {
                localStorageContent = saved
                console.log('Found recent content in localStorage, age:', Math.round(age / 1000), 'seconds')
              }
            }
          } catch (e) {
            console.error('Failed to read from localStorage:', e)
          }
          
          // Prioritize: localStorage > persisted > state content
          const contentToRestore = localStorageContent || persistedContent || content
          
          // If editor is empty but we have content saved, restore it
          if ((!editorContent || editorContent.trim().length === 0) && contentToRestore && contentToRestore.trim().length > 0) {
            console.log('Restoring content from:', localStorageContent ? 'localStorage' : persistedContent ? 'persisted' : 'state')
            editorRef.current.innerText = contentToRestore
            setContentState(contentToRestore)
            // Clear persisted content after restoration
            setPersistedContent('')
            // Trigger a re-render of highlights
            const newHtml = renderHighlightedText()
            if (newHtml && editorRef.current.innerHTML !== newHtml) {
              editorRef.current.innerHTML = newHtml
            }
          }
          
          // Clear localStorage after successful restoration
          try {
            localStorage.removeItem(localStorageKey)
            localStorage.removeItem(`${localStorageKey}_timestamp`)
          } catch (e) {
            // Ignore errors
          }
        }, 150) // Slightly longer delay to ensure DOM is ready
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      isMountedRef.current = false
      
      // Save content before unmount
      if (editorRef.current) {
        const currentContent = normalizeText(editorRef.current.innerText || editorRef.current.textContent || '')
        if (currentContent && currentContent.trim()) {
          try {
            localStorage.setItem(localStorageKey, currentContent)
            localStorage.setItem(`${localStorageKey}_timestamp`, Date.now().toString())
            console.log('Saved content to localStorage on unmount')
          } catch (e) {
            console.error('Failed to save on unmount:', e)
          }
        }
      }
      
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
      if (pauseDetectionRef.current) clearTimeout(pauseDetectionRef.current)
      // Abort any active stream
      if (streamAbortRef.current) {
        streamAbortRef.current()
        streamAbortRef.current = null
      }
    }
  }, [handleSelectionChange, handleSuggestionHover, handleSuggestionLeave, showDebounceMenu, content, persistedContent, normalizeText, dispatch, renderHighlightedText, localStorageKey])

  const activeSuggestion = suggestions.find(s => s.id === showSuggestionTooltip)

  return (
    <div className={`relative ${className}`}>
      {/* Editor Container */}
      <div className="relative border border-gray-300 dark:border-gray-600 rounded-lg min-h-[400px] bg-white dark:bg-gray-800">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {loading && <span className="text-blue-500">Checking...</span>}
              {suggestions.length > 0 && !loading && (
                <span className="text-orange-500">
                  {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
                </span>
              )}
              {suggestions.length === 0 && !loading && content.length > 0 && (
                <span className="text-green-500">No issues found</span>
              )}
            </div>
            {/* Smart debounce status */}
            {lastTriggerType && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400 italic">
                  {lastTriggerType}
                </span>
                {typingSpeed.wpm > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    {typingSpeed.wpm} WPM
                  </span>
                )}
              </div>
            )}
            {/* Incremental check indicator */}
            {incrementalStatus.active && (
              <span className="text-xs text-green-600 dark:text-green-400 flex items-center animate-pulse">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 1.414L10.586 9.5H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                </svg>
                Incremental: {incrementalStatus.paragraphs} paragraph{incrementalStatus.paragraphs !== 1 ? 's' : ''}
              </span>
            )}
            {/* Streaming status */}
            {streamingStatus.isStreaming && (
              <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center">
                <svg className="w-3 h-3 mr-1 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 00-2 2v6a2 2 0 002 2h2a1 1 0 100 2H6a4 4 0 01-4-4V5a4 4 0 014-4h3a1 1 0 000-2H6z" clipRule="evenodd"/>
                </svg>
                {streamingStatus.message}
              </span>
            )}
          </div>
          
                      <div className="flex items-center space-x-4">
              {/* Smart debounce configuration */}
              {aiCheckEnabled && (
                <div className="relative debounce-menu-container">
                  <button
                    onClick={() => setShowDebounceMenu(!showDebounceMenu)}
                    className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                    title="Configure smart debouncing"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    <span>Smart Debounce</span>
                  </button>
                  
                  {/* Debounce configuration dropdown */}
                  {showDebounceMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Smart Debounce Settings</h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-gray-600 dark:text-gray-400">Adaptive Mode</label>
                          <button
                            onClick={() => setSmartDebounceConfig(prev => ({ ...prev, adaptiveEnabled: !prev.adaptiveEnabled }))}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              smartDebounceConfig.adaptiveEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          >
                            <span
                              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                smartDebounceConfig.adaptiveEnabled ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-xs text-gray-600 dark:text-gray-400">Base Delay: {smartDebounceConfig.baseDelay}ms</label>
                          <input
                            type="range"
                            min="500"
                            max="5000"
                            step="100"
                            value={smartDebounceConfig.baseDelay}
                            onChange={(e) => setSmartDebounceConfig(prev => ({ ...prev, baseDelay: parseInt(e.target.value) }))}
                            className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        
                        {smartDebounceConfig.adaptiveEnabled && (
                          <>
                            <div className="text-xs text-gray-500 dark:text-gray-400 border-t pt-2">
                              <p>Current Factors:</p>
                              <ul className="mt-1 space-y-1">
                                <li>• Typing Speed: {typingSpeed.wpm} WPM</li>
                                <li>• Doc Size: {content.length} chars</li>
                                <li>• Suggestions: {suggestions.length}</li>
                              </ul>
                            </div>
                          </>
                        )}
                      </div>
                      
                      <button
                        onClick={() => setShowDebounceMenu(false)}
                        className="mt-3 w-full text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-1 px-2 rounded"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* Streaming toggle (only show when AI is enabled) */}
              {aiCheckEnabled && (
                <div className="flex items-center space-x-2">
                  <label className="text-xs text-gray-600 dark:text-gray-400">Streaming:</label>
                  <button
                    onClick={() => setStreamingEnabled(!streamingEnabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      streamingEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    title={streamingEnabled ? 'Streaming enabled - suggestions appear as found' : 'Streaming disabled - wait for all suggestions'}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        streamingEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{content.split(/\s+/).filter(w => w.length > 0).length} words</span>
                <span>|</span>
                <span>{content.length} characters</span>
              </div>
            </div>
        </div>

        {/* Editor Area */}
        <div 
          ref={editorRef}
          contentEditable={!readOnly}
          suppressContentEditableWarning={true}
          className="p-4 min-h-[350px] focus:outline-none text-gray-900 dark:text-gray-100 leading-relaxed text-base"
          style={{ 
            fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
            lineHeight: '1.8',
            whiteSpace: 'pre-wrap'
          }}
          onInput={handleContentChange}
          onBlur={handleEditorBlur}
        >{/* Content will be set by useEffect */}</div>
      </div>

      {/* Suggestion Tooltip */}
      {activeSuggestion && showSuggestionTooltip && (
        <div 
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 max-w-sm"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-xs px-2 py-1 rounded ${
                activeSuggestion.type === 'grammar' ? 'bg-red-100 text-red-800' :
                activeSuggestion.type === 'spelling' ? 'bg-orange-100 text-orange-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {activeSuggestion.type.toUpperCase()}
              </span>
              <button
                onClick={() => handleIgnoreSuggestion(activeSuggestion.id)}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                Ignore
              </button>
            </div>
            
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {activeSuggestion.message}
            </p>
            
            {activeSuggestion.replacements && activeSuggestion.replacements.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Suggestions:</p>
                {activeSuggestion.replacements.slice(0, 3).map((replacement, index) => (
                  <button
                    key={index}
                    onClick={() => handleApplySuggestion(activeSuggestion, replacement)}
                    className="block w-full text-left px-2 py-1 text-sm bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                  >
                    {replacement}
                  </button>
                ))}
              </div>
            )}
            
            {activeSuggestion.explanation && (
              <p className="text-xs text-gray-500 dark:text-gray-400 border-t pt-2">
                {activeSuggestion.explanation}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-50 dark:bg-gray-900 dark:bg-opacity-50 flex items-center justify-center rounded-lg">
          <div className="flex flex-col items-center space-y-3">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {streamingStatus.isStreaming 
                  ? streamingStatus.message || 'Analyzing text...'
                  : 'Checking grammar...'}
              </span>
            </div>
            {streamingStatus.isStreaming && streamingStatus.suggestionsReceived > 0 && (
              <div className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-blue-700 dark:text-blue-300">
                  Found {streamingStatus.suggestionsReceived} issue{streamingStatus.suggestionsReceived !== 1 ? 's' : ''} so far...
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TextEditor 