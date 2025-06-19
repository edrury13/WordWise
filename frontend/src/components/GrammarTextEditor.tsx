import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { checkText, ignoreSuggestion, clearSuggestions, acceptAllSuggestions, ignoreAllCurrentSuggestions, clearError } from '../store/slices/suggestionSlice'
import { setContent, setLastSaved, setAutoSave } from '../store/slices/editorSlice'
import { updateDocument, updateCurrentDocumentContent } from '../store/slices/documentSlice'
import { Suggestion } from '../store/slices/suggestionSlice'
import { analyzeSentences } from '../services/languageService'
import SentenceAnalysisPanel from './SentenceAnalysisPanel'
import ToneRewritePanel from './ToneRewritePanel'
import toast from 'react-hot-toast'

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
  const [showToneRewritePanel, setShowToneRewritePanel] = useState(false)
  
  // Undo functionality state
  const [lastAppliedSuggestion, setLastAppliedSuggestion] = useState<{
    originalText: string
    replacement: string
    offset: number
    length: number
    fullContentBefore: string
  } | null>(null)
  
  // Resizable sidebar state - load from localStorage or default to 450px
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('wordwise-sidebar-width')
    return saved ? parseInt(saved, 10) : 450 // Increased to accommodate writing suggestions
  })
  const [isResizing, setIsResizing] = useState(false)
  const resizerRef = useRef<HTMLDivElement>(null)
  
  // Sidebar tab state
  const [activeSidebarTab, setActiveSidebarTab] = useState<'analysis' | 'suggestions'>('analysis')
  
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()
  const autoSaveRef = useRef<NodeJS.Timeout>()
  const currentDocumentIdRef = useRef<string | null>(null)
  const sentenceDebounceRef = useRef<NodeJS.Timeout>()

  // Rate limiting tracking
  const grammarCallTimesRef = useRef<number[]>([])
  const sentenceCallTimesRef = useRef<number[]>([])

  // Helper function to check if we can make an API call based on recent activity
  const canMakeApiCall = useCallback((callTimes: number[], maxCallsPerMinute: number = 15) => {
    const now = Date.now()
    const oneMinuteAgo = now - 60000
    
    // Remove old calls
    const recentCalls = callTimes.filter(time => time > oneMinuteAgo)
    callTimes.length = 0
    callTimes.push(...recentCalls)
    
    return recentCalls.length < maxCallsPerMinute
  }, [])

  // Debounced grammar checking - balanced for responsiveness and rate limiting
  const checkGrammar = useCallback((text: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    debounceRef.current = setTimeout(() => {
      if (text.trim() && text.length > 3) { // Reduced minimum length to catch short first sentences
        // Check rate limiting before making call
        if (canMakeApiCall(grammarCallTimesRef.current, 12)) { // Limit to 12 grammar calls per minute
          grammarCallTimesRef.current.push(Date.now())
        dispatch(checkText({ text }))
          console.log('📝 Grammar check called. Recent calls:', grammarCallTimesRef.current.length)
        } else {
          console.log('⏳ Grammar check skipped due to rate limiting')
          toast.error('⏳ Too many requests - please type more slowly to avoid rate limits')
      }
      }
    }, 2000) // Keep at 2 seconds for responsiveness as requested
  }, [dispatch, canMakeApiCall])

  // Debounced sentence analysis - much longer delay since it's less critical than grammar
  const checkSentenceStructure = useCallback((text: string) => {
    if (sentenceDebounceRef.current) {
      clearTimeout(sentenceDebounceRef.current)
    }
    
    sentenceDebounceRef.current = setTimeout(async () => {
      if (text.trim() && text.length > 25) { // Increased minimum length significantly
        // Check rate limiting before making call
        if (canMakeApiCall(sentenceCallTimesRef.current, 6)) { // Limit to 6 sentence calls per minute
          sentenceCallTimesRef.current.push(Date.now())
        console.log('🔍 Starting sentence analysis for text:', text.substring(0, 100) + '...')
          console.log('📊 Sentence analysis called. Recent calls:', sentenceCallTimesRef.current.length)
        setSentenceAnalysisLoading(true)
        try {
          const result = await analyzeSentences(text)
          console.log('📊 Sentence analysis result:', result)
          
          if (result.success) {
            console.log('✅ Setting sentence analysis data:', result.analysis)
            setSentenceAnalysis(result.analysis)
          } else {
            console.log('❌ Sentence analysis failed:', result.error)
            setSentenceAnalysis(null)
            // Show user-friendly error messages
            if (result.error?.includes('Rate limited')) {
              toast.error('⏳ Please slow down - too many requests. Try again in a moment.')
            } else if (result.error?.includes('Authentication')) {
              toast.error('🔐 Please log in to use sentence analysis.')
            }
          }
        } catch (error) {
          console.error('Sentence analysis error:', error)
          setSentenceAnalysis(null)
          if (error instanceof Error && error.message.includes('Rate limited')) {
            toast.error('⏳ Please slow down - too many requests. Try again in a moment.')
          }
        } finally {
          setSentenceAnalysisLoading(false)
          }
        } else {
          console.log('⏳ Sentence analysis skipped due to rate limiting')
        }
      } else {
        console.log('⏭️ Skipping sentence analysis - text too short:', text.length)
        setSentenceAnalysis(null)
      }
    }, 8000) // Increased to 8 seconds since sentence analysis is less critical than grammar
  }, [canMakeApiCall])

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
          
          // Clean up localStorage backup after successful save
          const backupKey = `wordwise-backup-${currentDocument.id}`
          localStorage.removeItem(backupKey)
          console.log('🗑️ Cleaned up backup after successful auto-save')
          
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
    }, 10000) // Increased auto-save delay to 10 seconds to reduce save API calls
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
        
        // Clean up localStorage backup after successful manual save
        const backupKey = `wordwise-backup-${currentDocument.id}`
        localStorage.removeItem(backupKey)
        console.log('🗑️ Cleaned up backup after successful manual save')
        
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

  // Handle tone rewrite
  const handleToneRewrite = useCallback((rewrittenText: string) => {
    setContentState(rewrittenText)
    
    if (editorRef.current) {
      editorRef.current.value = rewrittenText
      editorRef.current.focus()
    }
    
    // Update Redux state
    dispatch(setContent([{
      type: 'paragraph',
      children: [{ text: rewrittenText }]
    }]))
    
    // Update current document content
    dispatch(updateCurrentDocumentContent(rewrittenText))
    
    // Trigger grammar check, sentence analysis, and auto-save
    checkGrammar(rewrittenText)
    checkSentenceStructure(rewrittenText)
    autoSave(rewrittenText)
  }, [dispatch, checkGrammar, checkSentenceStructure, autoSave])

  // Keyboard shortcuts are handled by handleKeyDownEnhanced below

  // Handle content changes
  const handleContentChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = event.target.value
    setContentState(newContent)
    
    // Clear undo state when user manually edits (typing new content)
    if (lastAppliedSuggestion) {
      setLastAppliedSuggestion(null)
      console.log('🔄 Cleared undo state due to manual content change')
    }
    
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
  }, [dispatch, checkGrammar, checkSentenceStructure, autoSave, lastAppliedSuggestion])

  // Create highlighted text overlay
  const createHighlightedText = useCallback(() => {
    if (!content) {
      setHighlightedContent(content)
      return
    }

    console.log('🎨 === STARTING HIGHLIGHT CREATION ===')
    console.log('📄 Content length:', content.length)
    console.log('📄 Content:', content)
    console.log('📝 Regular suggestions count:', suggestions.length)
    console.log('📝 Sentence analysis available:', !!sentenceAnalysis?.sentences)

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
      console.log('📝 Adding regular grammar suggestions:', suggestions.length)
      suggestions.forEach((suggestion) => {
        console.log('➕ Adding grammar highlight:', {
          id: suggestion.id,
          type: suggestion.type,
          offset: suggestion.offset,
          length: suggestion.length,
          message: suggestion.message.substring(0, 50) + '...'
        })
        allHighlights.push({
          offset: suggestion.offset,
          length: suggestion.length,
          type: suggestion.type,
          id: suggestion.id,
          className: getErrorClassName(suggestion.type)
        })
      })
    }

    // Add sentence-level issues (incomplete sentences) - TEMPORARILY DISABLED TO ISOLATE ISSUE
    if (false && sentenceAnalysis?.sentences) {
      console.log('🔍 Sentence analysis data:', sentenceAnalysis)
      console.log('📝 Sentences found:', sentenceAnalysis.sentences.length)
      console.log('📄 Content length:', content.length)
      console.log('📄 Content preview:', content.substring(0, 100) + '...')
      
      sentenceAnalysis.sentences.forEach((sentence: any, index: number) => {
        console.log(`Sentence ${index + 1}:`, {
          text: sentence.text?.substring(0, 50) + (sentence.text?.length > 50 ? '...' : ''),
          quality: sentence.quality,
          issues: sentence.issues?.length || 0,
          offset: sentence.offset,
          length: sentence.length,
          endPosition: sentence.offset + sentence.length,
          isOutOfBounds: sentence.offset + sentence.length > content.length
        })
        
        // Only highlight for incomplete sentences, ignore individual issues (those are handled by regular grammar checking)
        if (sentence.quality === 'incomplete') {
          console.log(`🚨 Found incomplete sentence ${index + 1}:`, sentence.text)
          
          // Safety check: Skip if sentence data looks suspicious
          if (!sentence.text || sentence.length <= 0 || sentence.offset < 0 || 
              sentence.length > Math.min(content.length * 0.3, 500)) { // Skip if sentence is >30% of content or >500 chars
            console.log(`⚠️ Skipping suspicious sentence data:`, {
              hasText: !!sentence.text,
              length: sentence.length,
              offset: sentence.offset,
              contentLength: content.length,
              percentOfContent: (sentence.length / content.length * 100).toFixed(1) + '%'
            })
            return
          }
          
          // Find the exact sentence in the content using indexOf from the reported offset
          const sentenceTextTrimmed = sentence.text.trim()
          let sentenceInContentIndex = content.indexOf(sentenceTextTrimmed, Math.max(0, sentence.offset - 50))
          
          // If not found near the reported offset, try a broader search
          if (sentenceInContentIndex === -1) {
            sentenceInContentIndex = content.indexOf(sentenceTextTrimmed)
          }
          
          // If still not found, try searching for the first few words
          if (sentenceInContentIndex === -1 && sentenceTextTrimmed.length > 10) {
            const firstWords = sentenceTextTrimmed.substring(0, Math.min(20, sentenceTextTrimmed.length))
            const partialIndex = content.indexOf(firstWords)
            if (partialIndex !== -1) {
              // Use the partial match and try to extend to the full sentence
              const remainingText = content.substring(partialIndex)
              const sentenceEndPattern = /[.!?]\s|$/ 
              const sentenceEndMatch = remainingText.match(sentenceEndPattern)
              if (sentenceEndMatch && sentenceEndMatch.index !== undefined) {
                const endIndex = partialIndex + sentenceEndMatch.index + (sentenceEndMatch[0].length > 1 ? 1 : 0)
                const fullSentence = content.substring(partialIndex, endIndex).trim()
                if (fullSentence.length > 0) {
                  sentenceInContentIndex = partialIndex
                  console.log(`🔍 Using partial match for sentence:`, {
                    originalSentence: sentenceTextTrimmed,
                    foundSentence: fullSentence,
                    offset: partialIndex
                  })
                }
              }
            }
          }
          
          if (sentenceInContentIndex !== -1) {
            const actualSentenceStart = sentenceInContentIndex
            const actualSentenceLength = sentenceTextTrimmed.length
            const actualSentenceEnd = actualSentenceStart + actualSentenceLength
            
            console.log(`🔍 Found exact sentence position:`, {
              originalOffset: sentence.offset,
              actualOffset: actualSentenceStart,
              originalLength: sentence.length,
              actualLength: actualSentenceLength,
              sentenceText: sentenceTextTrimmed,
              contentLength: content.length
            })
            
            // Verify bounds are valid
            if (actualSentenceStart >= 0 && actualSentenceEnd <= content.length) {
              // Check if this sentence already has ANY grammar highlight to avoid duplicates
              // Skip sentence highlighting if there are already individual grammar suggestions in this sentence
              const hasExistingGrammarInSentence = allHighlights.some(h => {
                const hStart = h.offset
                const hEnd = h.offset + h.length
                const sStart = actualSentenceStart
                const sEnd = actualSentenceEnd
                
                // Check if the grammar highlight is anywhere within this sentence
                return (hStart >= sStart && hStart < sEnd) || 
                       (hEnd > sStart && hEnd <= sEnd) ||
                       (hStart <= sStart && hEnd >= sEnd)
              })
              
              console.log(`🔍 Existing grammar check for sentence:`, {
                sentenceStart: actualSentenceStart,
                sentenceEnd: actualSentenceEnd,
                existingHighlights: allHighlights.map(h => ({
                  id: h.id,
                  start: h.offset,
                  end: h.offset + h.length,
                  type: h.type
                })),
                hasExistingGrammar: hasExistingGrammarInSentence
              })
              
              console.log(`Existing highlight check:`, hasExistingGrammarInSentence)
              
              if (!hasExistingGrammarInSentence) {
                // Create a suggestion object for the incomplete sentence
            const incompleteSuggestion: Suggestion = {
              id: `sentence-${index}`,
              type: 'grammar',
                  message: 'This sentence appears to be incomplete and may be missing essential components like helping verbs.',
                  offset: actualSentenceStart,
                  length: actualSentenceLength,
                  replacements: [],
              context: sentence.text,
                  explanation: 'Incomplete sentences are missing essential components like helping verbs or main verbs. Try adding "is", "are", "was", "were", or other helping verbs.',
              category: 'Grammar',
              severity: 'high'
            }
            
            // Add to combined suggestions array for tooltip lookup
            allSuggestions.push(incompleteSuggestion)
            
            allHighlights.push({
                  offset: actualSentenceStart,
                  length: actualSentenceLength,
              type: 'grammar',
              id: `sentence-${index}`,
              className: 'underline decoration-orange-500 decoration-wavy bg-orange-500 bg-opacity-10 dark:bg-orange-400 dark:bg-opacity-20'
            })
            
                console.log(`✅ Added sentence highlight:`, {
                  id: `sentence-${index}`,
                  type: 'grammar',
                  offset: actualSentenceStart,
                  length: actualSentenceLength,
                  text: sentenceTextTrimmed,
                  highlightedContent: content.substring(actualSentenceStart, actualSentenceEnd)
                })
              }
            } else {
              console.log(`⚠️ Calculated sentence bounds are invalid:`, {
                start: actualSentenceStart,
                end: actualSentenceEnd,
                contentLength: content.length
              })
            }
          } else {
            console.log(`⚠️ Could not find sentence in content:`, {
              sentenceText: sentenceTextTrimmed,
              reportedOffset: sentence.offset,
              searchStart: Math.max(0, sentence.offset - 50)
            })
          }
        }
      })
    } else {
      console.log('❌ No sentence analysis data available')
    }

    // Sort highlights by offset (descending) to apply from end to start
    const sortedHighlights = allHighlights.sort((a, b) => b.offset - a.offset)

    console.log('🎨 Total highlights to apply:', sortedHighlights.length)
    console.log('🎨 Highlights summary:', sortedHighlights.map(h => ({
      id: h.id,
      type: h.type,
      offset: h.offset,
      length: h.length,
      endPosition: h.offset + h.length,
      percentOfContent: ((h.length / content.length) * 100).toFixed(1) + '%',
      highlightedText: content.substring(h.offset, h.offset + h.length)
    })))
    
    // SAFETY CHECK: Remove any highlights that seem too large
    const validHighlights = sortedHighlights.filter(h => {
      const isValid = h.length <= 100 && h.offset >= 0 && h.offset + h.length <= content.length
      if (!isValid) {
        console.error('🚨 REMOVING INVALID HIGHLIGHT:', {
          id: h.id,
          offset: h.offset,
          length: h.length,
          contentLength: content.length,
          reason: h.length > 100 ? 'too long' : h.offset < 0 ? 'negative offset' : 'exceeds bounds'
        })
      }
      return isValid
    })
    
    console.log('🔍 Valid highlights after filtering:', validHighlights.length)

          // CLEAR DUPLICATE HIGHLIGHTS - Remove duplicates based on offset and length
      const uniqueHighlights = []
      const seen = new Set()
      
      for (const highlight of validHighlights) {
        const key = `${highlight.offset}-${highlight.length}`
        if (!seen.has(key)) {
          seen.add(key)
          uniqueHighlights.push(highlight)
          console.log(`✅ Keeping unique highlight:`, {
            id: highlight.id,
            offset: highlight.offset,
            length: highlight.length,
            key
          })
        } else {
          console.log(`🗑️ Removing duplicate highlight:`, {
            id: highlight.id,
            offset: highlight.offset,
            length: highlight.length,
            key
          })
        }
      }
      
      console.log(`🔄 Reduced ${validHighlights.length} highlights to ${uniqueHighlights.length} unique highlights`)

      uniqueHighlights.forEach((highlight) => {
      const { offset, length, type, id, className } = highlight
        
        // Validate highlight bounds before applying (double-check)
        if (offset < 0 || offset + length > result.length || length > 500) {
          console.warn(`⚠️ Skipping invalid highlight:`, {
            id,
            offset,
            length,
            resultLength: result.length,
            type,
            reason: offset < 0 ? 'negative offset' : 
                    offset + length > result.length ? 'exceeds content bounds' :
                    length > 500 ? 'too long (>500 chars)' : 'unknown'
          })
          return
        }
        
      const before = result.substring(0, offset)
      const highlightedText = result.substring(offset, offset + length)
      const after = result.substring(offset + length)
      
        // Escape HTML in the highlighted text to prevent corruption
        const escapedText = highlightedText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
        
        console.log(`🎨 Applying highlight:`, {
          id,
          type,
          offset,
          length,
          highlightedText: highlightedText.substring(0, 50) + (highlightedText.length > 50 ? '...' : ''),
          textLength: highlightedText.length,
          beforeLength: before.length,
          afterLength: after.length
        })
        
        // Create the highlight span with escaped content
      const eventHandlers = `data-suggestion-id="${id}" data-offset="${offset}" data-length="${length}" style="pointer-events: auto;" onmouseenter="window.handleSuggestionHover && window.handleSuggestionHover('${id}', event)" onmouseleave="window.handleSuggestionLeave && window.handleSuggestionLeave()" onclick="window.handleSuggestionClick && window.handleSuggestionClick(${offset}, event)"`
      
        const highlightedSpan = `<span class="${className}" ${eventHandlers}>${escapedText}</span>`
      
      result = before + highlightedSpan + after
        
        console.log(`📝 New result length: ${result.length}`)
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
    // Store the current state for undo
    const originalText = content.substring(suggestion.offset, suggestion.offset + suggestion.length)
    setLastAppliedSuggestion({
      originalText,
      replacement,
      offset: suggestion.offset,
      length: replacement.length, // Store the new length for undo calculation
      fullContentBefore: content
    })
    
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
    
    console.log('📝 Applied suggestion - undo data stored:', {
      originalText,
      replacement,
      offset: suggestion.offset
    })
  }, [content, dispatch, checkGrammar, autoSave])

  // Ignore suggestion
  const handleIgnoreSuggestion = useCallback((suggestionId: string) => {
    dispatch(ignoreSuggestion(suggestionId))
    setShowTooltip(null)
  }, [dispatch])

  // Undo last applied suggestion
  const undoLastSuggestion = useCallback(() => {
    if (!lastAppliedSuggestion) {
      toast.error('No suggestion to undo')
      return
    }
    
    console.log('⬅️ Undoing last suggestion:', lastAppliedSuggestion)
    
    // Restore the original content
    const restoredContent = lastAppliedSuggestion.fullContentBefore
    
    setContentState(restoredContent)
    
    if (editorRef.current) {
      editorRef.current.value = restoredContent
      // Position cursor where the original text was
      editorRef.current.focus()
      editorRef.current.setSelectionRange(
        lastAppliedSuggestion.offset, 
        lastAppliedSuggestion.offset + lastAppliedSuggestion.originalText.length
      )
    }
    
    // Update Redux state
    dispatch(setContent([{
      type: 'paragraph',
      children: [{ text: restoredContent }]
    }]))
    
    // Update current document content
    dispatch(updateCurrentDocumentContent(restoredContent))
    
    // Clear the undo state since we've used it
    setLastAppliedSuggestion(null)
    
    // Trigger grammar check and auto-save
    checkGrammar(restoredContent)
    autoSave(restoredContent)
    
    toast.success('✅ Suggestion undone')
  }, [lastAppliedSuggestion, dispatch, checkGrammar, autoSave])

  // Enhanced keyboard shortcuts with undo support
  const handleKeyDownEnhanced = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.ctrlKey && event.key === 's') {
      event.preventDefault()
      manualSave()
    } else if (event.ctrlKey && event.key === 'z') {
      event.preventDefault()
      undoLastSuggestion()
    }
  }, [manualSave, undoLastSuggestion])

  // Accept all suggestions
  const handleAcceptAllSuggestions = useCallback(() => {
    if (suggestions.length === 0) return
    
    // Store state for potential undo of accept all
    setLastAppliedSuggestion({
      originalText: '',
      replacement: '',
      offset: 0,
      length: 0,
      fullContentBefore: content
    })
    
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
    
    console.log('📝 Applied all suggestions - undo available for bulk action')
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

  // Initialize content from current document (only when document actually changes, not on re-mount)
  useEffect(() => {
    const currentDocId = currentDocument?.id
    const previousDocId = currentDocumentIdRef.current
    
    // Only reset content if this is truly a different document, not just a component re-mount
    if (currentDocument && currentDocId !== previousDocId) {
      console.log('📄 Document changed, initializing content:', {
        newDocId: currentDocId,
        previousDocId,
        contentLength: currentDocument.content.length
      })
      
      // Clear old suggestions immediately when switching documents
      dispatch(clearSuggestions())
      
      // Set new content only when document actually changes
      setContentState(currentDocument.content)
      if (editorRef.current) {
        editorRef.current.value = currentDocument.content
      }
      
      // Clear any existing tooltips
      setShowTooltip(null)
      
      // Trigger grammar check and sentence analysis for new content if it has text
      if (currentDocument.content.trim() && currentDocument.content.length > 10) {
        console.log('🔍 Document loaded - triggering grammar check and sentence analysis')
        checkGrammar(currentDocument.content)
        checkSentenceStructure(currentDocument.content)
      }
    } else if (currentDocument && currentDocId === previousDocId && !content) {
      // Only set content if it's empty (initial load case)
      console.log('📄 Same document, but content is empty, initializing:', {
        docId: currentDocId,
        contentLength: currentDocument.content.length
      })
      setContentState(currentDocument.content)
      if (editorRef.current) {
        editorRef.current.value = currentDocument.content
      }
      
      // Also trigger grammar check for initial load case
      if (currentDocument.content.trim() && currentDocument.content.length > 10) {
        console.log('🔍 Initial document load - triggering grammar check and sentence analysis')
        checkGrammar(currentDocument.content)
        checkSentenceStructure(currentDocument.content)
      }
    }
  }, [currentDocument, dispatch, checkGrammar, checkSentenceStructure, content])

  // Track document ID changes to ensure suggestions are cleared when switching documents
  useEffect(() => {
    const currentDocId = currentDocument?.id || null
    const previousDocId = currentDocumentIdRef.current
    
    if (currentDocId !== previousDocId) {
      // Clear suggestions when document changes
      dispatch(clearSuggestions())
      
      // Clear any existing tooltips and undo state
      setShowTooltip(null)
      setLastAppliedSuggestion(null)
      
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

  // Auto-switch to suggestions tab when new suggestions are found (only once)
  const previousSuggestionsCountRef = useRef(0)
  useEffect(() => {
    // Only auto-switch if we went from 0 suggestions to having suggestions
    // This prevents constant switching when user manually selects analysis tab
    if (suggestions.length > 0 && previousSuggestionsCountRef.current === 0 && activeSidebarTab === 'analysis') {
      setActiveSidebarTab('suggestions')
      console.log('🔄 Auto-switched to suggestions tab - found new suggestions')
    }
    previousSuggestionsCountRef.current = suggestions.length
  }, [suggestions.length, activeSidebarTab])

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

  // Monitor Redux error state and show toast notifications
  useEffect(() => {
    if (error && error.includes('Rate limited')) {
      toast.error('⏳ Please slow down - too many requests. Try again in a moment.')
      // Clear the error after showing the toast
      dispatch(clearError())
    }
  }, [error, dispatch])

  // Save content to localStorage as backup to prevent loss on tab switching
  useEffect(() => {
    if (content && currentDocument?.id) {
      const backupKey = `wordwise-backup-${currentDocument.id}`
      const lastSavedContent = currentDocument.content || ''
      
      // Only save to localStorage if content differs from last saved version
      if (content !== lastSavedContent) {
        localStorage.setItem(backupKey, content)
        console.log('💾 Backed up unsaved content to localStorage:', {
          docId: currentDocument.id,
          contentLength: content.length,
          savedLength: lastSavedContent.length
        })
      }
    }
  }, [content, currentDocument])

  // Restore from localStorage backup if available and newer than saved content
  useEffect(() => {
    if (currentDocument?.id) {
      const backupKey = `wordwise-backup-${currentDocument.id}`
      const backup = localStorage.getItem(backupKey)
      const savedContent = currentDocument.content || ''
      
      // Check if backup exists and is different/newer than saved content
      if (backup && backup !== savedContent && backup.length > savedContent.length && !content) {
        console.log('🔄 Restoring unsaved changes from localStorage backup:', {
          docId: currentDocument.id,
          backupLength: backup.length,
          savedLength: savedContent.length
        })
        
        setContentState(backup)
        if (editorRef.current) {
          editorRef.current.value = backup
        }
        
        // Update Redux state with restored content
        dispatch(updateCurrentDocumentContent(backup))
        
        // Trigger grammar check for restored content
        if (backup.trim() && backup.length > 10) {
          console.log('🔍 Restored content - triggering grammar check and sentence analysis')
          checkGrammar(backup)
          checkSentenceStructure(backup)
        }
        
        toast.success('📝 Restored unsaved changes from backup')
      } else if (backup && backup === savedContent) {
        // Clean up backup if it matches saved content
        localStorage.removeItem(backupKey)
        console.log('🗑️ Cleaned up backup - matches saved content')
      }
    }
  }, [currentDocument, content, dispatch, checkGrammar, checkSentenceStructure])

  // Handle page visibility changes to maintain state
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Tab became visible, preserving current content')
        // Don't reset content when tab becomes visible
      } else {
        console.log('👁️ Tab became hidden, content preserved')
        // Save current state when tab becomes hidden
        if (content && currentDocument?.id) {
          const backupKey = `wordwise-backup-${currentDocument.id}`
          localStorage.setItem(backupKey, content)
        }
      }

    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [content, currentDocument?.id])

  // Handle sidebar resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      const container = resizerRef.current?.parentElement
      if (!container) return
      
      const containerRect = container.getBoundingClientRect()
      const newWidth = containerRect.right - e.clientX
      
      // Constrain sidebar width between 250px and 600px
      const constrainedWidth = Math.max(250, Math.min(600, newWidth))
      setSidebarWidth(constrainedWidth)
      
      // Save to localStorage for persistence
      localStorage.setItem('wordwise-sidebar-width', constrainedWidth.toString())
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    if (isResizing) {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizing])

  // Handle resize start
  const handleResizeStart = () => {
    setIsResizing(true)
  }

  const activeSuggestion = combinedSuggestions.find(s => s.id === showTooltip) || suggestions.find(s => s.id === showTooltip)
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length
  const charCount = content.length

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Statistics Bar */}
      <div className="flex items-center justify-between mb-4 mx-4 mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex-shrink-0">
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
          
          {/* Auto-save disabled indicator */}
          {!autoSaveEnabled && !saving && !lastSaveStatus && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-yellow-600 dark:text-yellow-400">Auto-save disabled</span>
            </div>
          )}
          
          {/* Auto-save Toggle */}
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <span className="text-sm text-gray-600 dark:text-gray-400">Auto-save</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={autoSaveEnabled}
                  onChange={(e) => dispatch(setAutoSave(e.target.checked))}
                  className="sr-only"
                />
                <div className={`w-10 h-5 rounded-full transition-colors duration-200 ${
                  autoSaveEnabled 
                    ? 'bg-green-500' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                    autoSaveEnabled 
                      ? 'translate-x-5' 
                      : 'translate-x-0.5'
                  } mt-0.5`}></div>
                </div>
              </div>
            </label>
          </div>
          
          {/* Undo Button */}
          {lastAppliedSuggestion && (
            <button
              onClick={undoLastSuggestion}
              className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900 dark:hover:bg-yellow-800 text-yellow-800 dark:text-yellow-200 text-xs rounded transition-colors flex items-center space-x-1"
              title="Undo last suggestion (Ctrl+Z)"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span>Undo</span>
            </button>
          )}
          
          {/* Tone Rewrite Button */}
          {content.trim().length > 0 && (
            <button
              onClick={() => setShowToneRewritePanel(true)}
              className="px-3 py-1 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200 text-xs rounded transition-colors flex items-center space-x-1"
              title="Rewrite text in different tone"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Rewrite Tone</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area with Sidebar */}
      <div className="flex gap-2 flex-1 min-h-0 mx-4">
      {/* Editor Container */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="relative border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-900 flex-1 flex flex-col">
        {/* Textarea */}
        <textarea
          ref={editorRef}
          value={content}
          onChange={handleContentChange}
              onKeyDown={handleKeyDownEnhanced}
              className="w-full flex-1 p-4 bg-transparent text-gray-900 dark:text-gray-100 resize-none focus:outline-none font-serif text-lg leading-relaxed min-h-0"
          placeholder={`Start writing your document... Grammar checking will begin automatically. ${autoSaveEnabled ? 'Auto-save is enabled.' : 'Auto-save is disabled - press Ctrl+S to save manually.'}`}
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
        </div>

        {/* Resize Handle */}
        <div
          ref={resizerRef}
          className={`w-1 bg-gray-200 dark:bg-gray-600 hover:bg-blue-400 dark:hover:bg-blue-500 cursor-col-resize flex-shrink-0 transition-colors duration-150 ${
            isResizing ? 'bg-blue-400 dark:bg-blue-500' : ''
          }`}
          onMouseDown={handleResizeStart}
          title="Drag to resize sidebar"
        />

        {/* Right Sidebar - Analysis & Suggestions */}
        <div 
          className="flex-shrink-0 flex flex-col bg-gray-50 dark:bg-gray-800 rounded-lg"
          style={{ width: `${sidebarWidth}px` }}
        >
          {/* Sidebar Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-600">
            <button
              onClick={() => setActiveSidebarTab('analysis')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeSidebarTab === 'analysis'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-700'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Analysis</span>
              </div>
            </button>
            <button
              onClick={() => setActiveSidebarTab('suggestions')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                activeSidebarTab === 'suggestions'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-700'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Suggestions</span>
                {suggestions.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {suggestions.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeSidebarTab === 'analysis' ? (
              <div className="h-full overflow-y-auto p-4">
                <SentenceAnalysisPanel 
                  text={content}
                  onSentenceClick={(offset, length) => {
                    if (editorRef.current) {
                      editorRef.current.focus()
                      editorRef.current.setSelectionRange(offset, offset + length)
                    }
                  }}
                  onApplySuggestion={(offset, length, replacement) => {
                    // Store undo state for sentence suggestion
                    const originalText = content.substring(offset, offset + length)
                    setLastAppliedSuggestion({
                      originalText,
                      replacement,
                      offset,
                      length: replacement.length,
                      fullContentBefore: content
                    })
                    
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
                    
                    console.log('📝 Applied sentence suggestion - undo data stored')
                  }}
                />
              </div>
            ) : (
              <div className="h-full overflow-y-auto p-4">
                {/* Writing Suggestions Panel */}
                {suggestions.length > 0 ? (
                  <div className="space-y-4">
                                         {/* Header */}
                     <div className="mb-3">
                       <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                         Writing Suggestions ({suggestions.length})
                       </h3>
                     </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleAcceptAllSuggestions}
                        className="px-3 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-800 dark:text-green-200 text-xs rounded transition-colors flex items-center space-x-1"
                        title="Accept all suggestions"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Accept All</span>
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

                    {/* Suggestions List */}
                    <div className="space-y-3">
                      {suggestions.map((suggestion) => (
                        <div 
                          key={suggestion.id}
                          className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm"
                        >
                          <div className="flex items-start space-x-3">
                            <span className={`text-xs px-2 py-1 rounded flex-shrink-0 font-medium ${
                              suggestion.type === 'grammar' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              suggestion.type === 'spelling' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                              'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }`}>
                              {suggestion.type}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
                                {suggestion.message}
                              </p>
                              {suggestion.replacements && suggestion.replacements.length > 0 && (
                                <div className="space-y-1">
                                  {suggestion.replacements.slice(0, 3).map((replacement, index) => (
                                    <button
                                      key={index}
                                      onClick={() => applySuggestion(suggestion, replacement)}
                                      className="block w-full text-left px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                    >
                                      "{replacement}"
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div className="mt-2 flex items-center space-x-2">
                                <button
                                  onClick={() => handleIgnoreSuggestion(suggestion.id)}
                                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                >
                                  Ignore
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center">
                      <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-gray-500 dark:text-gray-400">No suggestions found</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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





      {/* Tone Rewrite Panel */}
      {showToneRewritePanel && (
        <ToneRewritePanel
          text={content}
          onRewrite={handleToneRewrite}
          onClose={() => setShowToneRewritePanel(false)}
        />
      )}
    </div>
  )
}

export default GrammarTextEditor 