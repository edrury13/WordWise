import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { 
  checkText,
  checkTextWithAI,
  recheckText,
  clearSuggestions,
  ignoreSuggestion,
  ignoreAllCurrentSuggestions,
  selectAICheckEnabled,
  toggleAICheck,
  updateSuggestionOffsets,
  applySuggestion,
  acceptAllSuggestions,
  removeSuggestionsInRange,
  replaceSuggestionsInRange
} from '../store/slices/suggestionSlice'
import { setContent, setLastSaved, setAutoSave } from '../store/slices/editorSlice'
import { updateDocument, updateCurrentDocumentContent } from '../store/slices/documentSlice'
import { Suggestion } from '../store/slices/suggestionSlice'
import { /* analyzeSentences, */ clearCacheByType } from '../services/languageService' // analyzeSentences commented out - sentence structure feature disabled
import { smartCorrectionService, SmartCorrection } from '../services/smartCorrectionService'
import { ignoredWordsService } from '../services/ignoredWordsService'
import { IgnoredWordsManager } from './IgnoredWordsManager'
// import SentenceAnalysisPanel from './SentenceAnalysisPanel' // Commented out - sentence structure feature disabled
import ToneRewritePanel from './ToneRewritePanel'
import GradeLevelRewritePanel from './GradeLevelRewritePanel'
import ReadabilityPanel from './ReadabilityPanel'
// import AISuggestionPanel from './AISuggestionPanel' // Commented out - AI Assistant tab removed from sidebar
import SmartCorrectionPanel from './SmartCorrectionPanel'
import { ProfileSelector } from './ProfileSelector'
import { 
  selectShowGradeLevelPanel, 
  setShowGradeLevelPanel,
  selectCanUndo,
  selectCanRedo,
  undoRewrite,
  redoRewrite,
  selectRetryQueue,
  selectPerformanceMetrics,
  clearCache
} from '../store/slices/editorSlice'
import { 
  selectEffectiveProfile,
  loadDocumentProfile
} from '../store/slices/styleProfileSlice'
import toast from 'react-hot-toast'
import { runPartialGrammarCheck } from '../utils/partialGrammarCheck'
import { extractSentenceWithContext } from '../utils/sentenceExtraction'

interface GrammarTextEditorProps {
  isDemo?: boolean
}

const GrammarTextEditor: React.FC<GrammarTextEditorProps> = ({ isDemo = false }) => {
  const dispatch = useDispatch<AppDispatch>()
  const { suggestions, loading, readabilityScore } = useSelector((state: RootState) => state.suggestions)
  const { currentDocument, saving } = useSelector((state: RootState) => state.documents)
  const { user } = useSelector((state: RootState) => state.auth)
  const { autoSaveEnabled } = useSelector((state: RootState) => state.editor)
  const aiCheckEnabled = useSelector(selectAICheckEnabled)
  const effectiveProfile = useSelector(selectEffectiveProfile)
  
  const [content, setContentState] = useState('')
  const [highlightedContent, setHighlightedContent] = useState('')
  const [showTooltip, setShowTooltip] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [lastSaveStatus, setLastSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null)
  // sentenceAnalysis state is read elsewhere; setter currently unused (sentence feature disabled)
  const [sentenceAnalysis, _setSentenceAnalysis] = useState<any>(null)
  // const [sentenceAnalysisLoading, setSentenceAnalysisLoading] = useState(false) // Commented out - sentence structure feature disabled
  const [combinedSuggestions, setCombinedSuggestions] = useState<Suggestion[]>([])
  const [showToneRewritePanel, setShowToneRewritePanel] = useState(false)
  const [smartCorrections, setSmartCorrections] = useState<SmartCorrection[]>([])
  const [showIgnoredWordsManager, setShowIgnoredWordsManager] = useState(false)
  
  // Incremental checking state
  const [paragraphCache, setParagraphCache] = useState<Map<number, string>>(new Map())
  const [lastCheckText, setLastCheckText] = useState('')
  
  // Grade level rewrite panel state managed by Redux
  const showGradeLevelRewritePanel = useSelector(selectShowGradeLevelPanel)
  const canUndo = useSelector(selectCanUndo)
  const canRedo = useSelector(selectCanRedo)
  
  // Performance monitoring state
  const retryQueue = useSelector(selectRetryQueue)
  const performanceMetrics = useSelector(selectPerformanceMetrics)
  
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
  
  // Sidebar collapsed state - load from localStorage
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('wordwise-sidebar-collapsed')
    return saved === 'true'
  })
  
  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('wordwise-collapsed-sections')
    return saved ? JSON.parse(saved) : {
      styleProfile: false,
      smartCorrections: false,
      aiAssistant: false,
      criticalSuggestions: false,
      styleSuggestions: false,
      readability: false,
      sentenceAnalysis: false
    }
  })
  
  // Toggle section function
  const toggleSection = useCallback((section: string) => {
    setCollapsedSections(prev => {
      const newState = { ...prev, [section]: !prev[section] }
      localStorage.setItem('wordwise-collapsed-sections', JSON.stringify(newState))
      return newState
    })
  }, [])
  
  // Save sidebar collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('wordwise-sidebar-collapsed', isSidebarCollapsed.toString())
  }, [isSidebarCollapsed])
  
  // Handle sidebar resizing
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])
  
  // Handle mouse move and mouse up for sidebar resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      const newWidth = window.innerWidth - e.clientX - 16 // 16px for margins
      const clampedWidth = Math.max(300, Math.min(800, newWidth))
      setSidebarWidth(clampedWidth)
      
      // Save to localStorage
      localStorage.setItem('wordwise-sidebar-width', clampedWidth.toString())
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
    }
    
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      // Prevent text selection while resizing
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isResizing])
  
  // Load profile for current document
  useEffect(() => {
    if (currentDocument?.id) {
      dispatch(loadDocumentProfile(currentDocument.id))
    }
  }, [currentDocument?.id, dispatch])

  // Load ignored words when component mounts or user changes
  useEffect(() => {
    if (user) {
      ignoredWordsService.loadIgnoredWords().then(words => {
        console.log(`📝 Loaded ${words.length} ignored words for user`)
      }).catch(error => {
        console.error('Failed to load ignored words:', error)
      })
    }
  }, [user])
  
  // Removed sidebar tab state - using unified panel instead
  
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()
  const autoSaveRef = useRef<NodeJS.Timeout>()
  const currentDocumentIdRef = useRef<string | null>(null)
  // const sentenceDebounceRef = useRef<NodeJS.Timeout>() // Commented out - sentence structure feature disabled

  // Rate limiting tracking
  // const sentenceCallTimesRef = useRef<number[]>([]) // Commented out - sentence structure feature disabled

  // Scroll synchronization handler
  const handleScroll = useCallback(() => {
    if (editorRef.current && overlayRef.current) {
      // Sync the scroll position from textarea to overlay
      overlayRef.current.scrollTop = editorRef.current.scrollTop
      overlayRef.current.scrollLeft = editorRef.current.scrollLeft
    }
  }, [])
  
  // Get paragraphs with their positions in the text
  const getParagraphsWithPositions = useCallback((text: string): Array<{ text: string; start: number; end: number; index: number }> => {
    const paragraphs: Array<{ text: string; start: number; end: number; index: number }> = []
    const lines = text.split('\n')
    let currentPos = 0
    let paragraphIndex = 0
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineLength = line.length
      
      // If this line has content or is the last line, include it
      if (line.trim() || i === lines.length - 1) {
        paragraphs.push({
          text: line,
          start: currentPos,
          end: currentPos + lineLength - 1,
          index: paragraphIndex++
        })
      }
      
      // Add 1 for the newline character (except for last line)
      currentPos += lineLength + (i < lines.length - 1 ? 1 : 0)
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

  // Helper function to check if we can make an API call based on recent activity
  // Commented out - only used for sentence structure feature
  /* const canMakeApiCall = useCallback((callTimes: number[], maxCallsPerMinute: number = 15) => {
    const now = Date.now()
    const oneMinuteAgo = now - 60000
    
    // Remove old calls
    const recentCalls = callTimes.filter(time => time > oneMinuteAgo)
    callTimes.length = 0
    callTimes.push(...recentCalls)
    
    return recentCalls.length < maxCallsPerMinute
  }, []) */

  // Immediate grammar check for after applying suggestions - bypasses debouncing
  const checkGrammarImmediate = useCallback((text: string) => {
    // Cancel any pending debounced checks to avoid conflicts
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    // Clear the grammar cache to ensure fresh results
    try {
      clearCacheByType('grammar')
      console.log('🧹 Cleared grammar cache for fresh check')
    } catch (error) {
      console.warn('⚠️ Failed to clear grammar cache:', error)
      // Continue with the check anyway
    }
    
    // Clear paragraph cache for immediate checks to force a full recheck
    setParagraphCache(new Map())
    setLastCheckText(text)
    
    // Update paragraph cache with the new text
    const paragraphs = getParagraphsWithPositions(text)
    const newCache = new Map<number, string>()
    for (const para of paragraphs) {
      newCache.set(para.index, para.text)
    }
    setParagraphCache(newCache)
    
    // Use AI-enhanced checking if enabled
    if (aiCheckEnabled) {
      dispatch(checkTextWithAI({ 
        text,
        documentType: (effectiveProfile && ['social', 'custom'].includes(effectiveProfile.profileType) ? 'general' : effectiveProfile?.profileType || 'general') as any,
        checkType: 'comprehensive',
        styleProfile: effectiveProfile,
        isDemo
        // No changedRanges for immediate check - always do full check
      }))
      console.log('🚀 Triggered immediate full AI-enhanced grammar recheck with profile:', effectiveProfile?.name)
    } else {
      dispatch(recheckText({ text }))
      console.log('🚀 Triggered immediate full grammar recheck')
    }
  }, [dispatch, aiCheckEnabled, effectiveProfile, getParagraphsWithPositions, isDemo])

  // Debounced grammar check for typing
  const checkGrammarDebounced = useCallback((text: string, ranges?: Array<{ start: number; end: number }>) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    debounceRef.current = setTimeout(() => {
      // Don't check if text hasn't changed since last check
      if (text === lastCheckText) {
        console.log('⏭️ Skipping grammar check - text unchanged')
        return
      }
      
      // Determine changed ranges.
      let effectiveRanges = ranges

      if (!effectiveRanges) {
        // Fallback to paragraph diff when explicit ranges not provided.
        const changedParagraphs = findChangedParagraphs(text)
        if (changedParagraphs.length === 0) {
          console.log('⏭️ No paragraphs changed, skipping check')
          return
        }
        effectiveRanges = changedParagraphs.map(p => ({ start: p.start, end: p.end }))
      }

      // Update cache/state for next diff round
      const newCache = new Map<number, string>()
      for (const para of getParagraphsWithPositions(text)) {
        newCache.set(para.index, para.text)
      }
      setParagraphCache(newCache)
      setLastCheckText(text)
      
      // Log paragraph changes for debugging
      if (effectiveRanges.length > 0 && effectiveRanges.length < getParagraphsWithPositions(text).length) {
        console.log('📝 Incremental check: Paragraph changes detected:', {
          total: getParagraphsWithPositions(text).length,
          changed: effectiveRanges.length,
          changedIndices: effectiveRanges.map(r => `${r.start}-${r.end}`),
          changedText: effectiveRanges.map(r => ({
            range: `${r.start}-${r.end}`,
            preview: text.substring(r.start, r.end).substring(0, 50) + (text.substring(r.start, r.end).length > 50 ? '...' : '')
          }))
        })
      }
      
      // Skip if no paragraphs changed
      if (effectiveRanges.length === 0) {
        console.log('⏭️ No paragraphs changed, skipping check')
        return
      }
      
      // Determine if incremental or full check
      const isIncremental = effectiveRanges.length < getParagraphsWithPositions(text).length
      const changedRanges = isIncremental ? effectiveRanges : undefined
      
      // Always use the same thunk so we can pass changedRanges for incremental checks.
      // The enableAI flag tells the thunk whether to include the AI-specific pass.
      dispatch(checkTextWithAI({ 
        text,
        documentType: (effectiveProfile && ['social', 'custom'].includes(effectiveProfile.profileType) ? 'general' : effectiveProfile?.profileType || 'general') as any,
        checkType: 'comprehensive',
        styleProfile: effectiveProfile,
        changedRanges,
        enableAI: aiCheckEnabled,
        isDemo
      }))
      console.log('⏱️ Triggered grammar check on ranges:', effectiveRanges?.map(r=>`${r.start}-${r.end}`).join(','))
    }, 300)
  }, [dispatch, aiCheckEnabled, effectiveProfile, lastCheckText, findChangedParagraphs, getParagraphsWithPositions, isDemo])

  // Debounced sentence analysis - much longer delay since it's less critical than grammar
  // Commented out - sentence structure feature disabled
  /* const checkSentenceStructure = useCallback((text: string) => {
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
  }, [canMakeApiCall]) */

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
          dispatch(setLastSaved(Date.now()))
          
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
        dispatch(setLastSaved(Date.now()))
        
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
    
    // Trigger immediate grammar check after tone rewrite
    checkGrammarImmediate(rewrittenText)
    // checkSentenceStructure(rewrittenText) // Disabled sentence structure check
    autoSave(rewrittenText)
  }, [dispatch, autoSave, checkGrammarImmediate]) // Removed checkSentenceStructure dependency

  // Handle grade level rewrite
  const handleGradeLevelRewrite = useCallback((rewrittenText: string) => {
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
    
    // Trigger immediate grammar check after grade level rewrite
    checkGrammarImmediate(rewrittenText)
    // checkSentenceStructure(rewrittenText) // Disabled sentence structure check
    autoSave(rewrittenText)
  }, [dispatch, autoSave, checkGrammarImmediate]) // Removed checkSentenceStructure dependency

  // Keyboard shortcuts are handled by handleKeyDownEnhanced below

  // Handle content changes
  const handleContentChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = event.target.value
    const oldContent = content
    
    // Holder for fine-grained changed ranges
    let explicitRanges: Array<{ start: number; end: number }> | undefined

    // Calculate the change offset and delta
    if (oldContent !== newContent) {
      // Find where the change occurred using prefix/suffix matching for accuracy
      let commonPrefix = 0;
      while (commonPrefix < oldContent.length && commonPrefix < newContent.length && oldContent[commonPrefix] === newContent[commonPrefix]) {
          commonPrefix++;
      }

      let commonSuffix = 0;
      while (
        commonSuffix < oldContent.length - commonPrefix && 
        commonSuffix < newContent.length - commonPrefix && 
        oldContent[oldContent.length - 1 - commonSuffix] === newContent[newContent.length - 1 - commonSuffix]
      ) {
          commonSuffix++;
      }
      
      const changeOffset = commonPrefix;
      const removedLength = oldContent.length - commonPrefix - commonSuffix;
      const addedLength = newContent.length - commonPrefix - commonSuffix;
      const delta = addedLength - removedLength;
      
      // The end of the change in the *old* content
      const changeEndOld = oldContent.length - commonSuffix;

      // Prepare explicit range for inserted text
      if (addedLength > 0) {
        explicitRanges = [{ start: changeOffset, end: changeOffset + addedLength }]
      }

      // Update suggestion offsets if there are suggestions and content changed
      if (suggestions.length > 0 && (removedLength > 0 || addedLength > 0)) {
        console.log('📝 Text change detected:', {
          changeOffset,
          delta,
          removedLength,
          addedLength,
          changeEndOld,
          oldLength: oldContent.length,
          newLength: newContent.length
        })
        
        dispatch(updateSuggestionOffsets({ changeOffset, delta, changeEndOld }))
      }
    }
    
    setContentState(newContent)
    
    // Clear undo state when user manually edits (typing new content)
    setLastAppliedSuggestion(null)
    
    // Update Redux state for editor
    dispatch(setContent([{
      type: 'paragraph',
      children: [{ text: newContent }]
    }]))
    
    // Update current document content in Redux
    dispatch(updateCurrentDocumentContent(newContent))
    
    // Only run immediate partial check under specific conditions:
    // 1. User is adding text (not deleting)
    // 2. Added text is small (1-3 characters - typical typing)
    // 3. We're at a word boundary or space (completed a word)
    if (explicitRanges && 
        explicitRanges.length === 1 && 
        explicitRanges[0].end - explicitRanges[0].start <= 3 &&
        explicitRanges[0].end - explicitRanges[0].start > 0) {
      
      const insertedText = newContent.substring(explicitRanges[0].start, explicitRanges[0].end)
      const charAfterInsertion = newContent[explicitRanges[0].end] || ''
      
      // Check if we're at a word boundary (space, punctuation, or end of text)
      const isWordBoundary = /[\s.,!?;:]/.test(charAfterInsertion) || 
                            explicitRanges[0].end === newContent.length ||
                            /[\s]/.test(insertedText)
      
      // Only run partial check if we completed a word or typed a space
      if (isWordBoundary) {
        console.log('🔍 Word boundary detected, running partial grammar check')
        
        // Extract the sentence containing the change
        const sentenceInfo = extractSentenceWithContext(newContent, explicitRanges[0].start)
        
        if (sentenceInfo) {
          // Remove suggestions only within the sentence being checked
          dispatch(removeSuggestionsInRange({
            start: sentenceInfo.sentenceStart,
            end: sentenceInfo.sentenceEnd
          }))
          
          // Run partial check on just the sentence
          runPartialGrammarCheck(newContent, explicitRanges[0], aiCheckEnabled)
            .then(partial => {
              // Replace suggestions for the sentence
              dispatch(replaceSuggestionsInRange({
                start: sentenceInfo.sentenceStart,
                end: sentenceInfo.sentenceEnd,
                newSuggestions: partial,
                currentText: newContent
              }))
            })
            .catch(console.error)
        }
      } else {
        console.log('📝 Mid-word typing, deferring grammar check')
      }
    } else {
      // For larger edits or deletions, use the debounced check
      checkGrammarDebounced(newContent, explicitRanges)
    }
    
    autoSave(newContent)
  }, [content, suggestions, dispatch, autoSave, lastAppliedSuggestion, checkGrammarDebounced, aiCheckEnabled])

  // Create highlighted text overlay
  const createHighlightedText = useCallback(() => {
    if (!content) {
      setHighlightedContent(content)
      return
    }
    
    // Ensure scroll sync after content update
    requestAnimationFrame(() => {
      if (editorRef.current && overlayRef.current) {
        // Just sync scroll position - dimensions will be synced by useEffect
        overlayRef.current.scrollTop = editorRef.current.scrollTop
        overlayRef.current.scrollLeft = editorRef.current.scrollLeft
      }
    })

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
        // Validate suggestion bounds before adding
        if (suggestion.offset >= 0 && 
            suggestion.offset + suggestion.length <= content.length &&
            suggestion.length > 0) {
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
        } else {
          console.warn('🚨 Skipping invalid suggestion:', {
            id: suggestion.id,
            type: suggestion.type,
            offset: suggestion.offset,
            length: suggestion.length,
            contentLength: content.length,
            reason: suggestion.offset < 0 ? 'negative offset' : 
                    suggestion.offset + suggestion.length > content.length ? 'exceeds content bounds' :
                    'zero length'
          })
        }
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
      // Escape the ID to prevent any potential XSS
      const escapedId = id.replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
      const eventHandlers = `data-suggestion-id="${escapedId}" data-offset="${offset}" data-length="${length}" style="pointer-events: auto;" onmouseenter="window.handleSuggestionHover && window.handleSuggestionHover('${escapedId}', event)" onmouseleave="window.handleSuggestionLeave && window.handleSuggestionLeave()" onclick="window.handleSuggestionClick && window.handleSuggestionClick(${offset}, event)"`
      
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
  const handleApplySuggestion = useCallback(async (suggestion: Suggestion, replacement: string) => {
    console.log('Applying suggestion:', { suggestion, replacement })
    
    // Store the current state for undo
    const originalText = content.substring(suggestion.offset, suggestion.offset + suggestion.length)
    setLastAppliedSuggestion({
      originalText,
      replacement,
      offset: suggestion.offset,
      length: replacement.length, // Store the new length for undo calculation
      fullContentBefore: content
    })
    
    // Apply the suggestion
    const before = content.substring(0, suggestion.offset)
    const after = content.substring(suggestion.offset + suggestion.length)
    const newContent = before + replacement + after
    
    setContentState(newContent)
    
    if (editorRef.current) {
      editorRef.current.value = newContent
      // Position cursor after the replacement
      const cursorPos = suggestion.offset + replacement.length
      editorRef.current.focus()
      editorRef.current.setSelectionRange(cursorPos, cursorPos)
    }
    
    // Record this correction for smart learning
    smartCorrectionService.recordUserChoice(
      suggestion,
      true, // accepted
      originalText,
      replacement,
      content
    ).catch(console.error)
    
    // Update suggestion list – remove the applied suggestion and shift the remaining offsets
    dispatch(applySuggestion({
      suggestionId: suggestion.id,
      replacement,
      offset: suggestion.offset,
      length: suggestion.length,
    }))

    // Extract the sentence containing the change
    const sentenceInfo = extractSentenceWithContext(newContent, suggestion.offset + replacement.length - 1)
    
    if (sentenceInfo) {
      console.log('📝 Rechecking sentence after accepting suggestion:', {
        sentence: sentenceInfo.sentence,
        range: `${sentenceInfo.sentenceStart}-${sentenceInfo.sentenceEnd}`,
        contextStart: sentenceInfo.contextStart
      })
      
      // Run partial grammar check on the sentence with context
      try {
        const sentenceSuggestions = await runPartialGrammarCheck(
          newContent,
          { 
            start: sentenceInfo.contextStart, 
            end: sentenceInfo.contextStart + sentenceInfo.contextText.length 
          },
          aiCheckEnabled
        )
        
        // Filter suggestions to only those within the actual sentence (not the context)
        const filteredSuggestions = sentenceSuggestions.filter(s => {
          const suggestionStart = s.offset
          const suggestionEnd = s.offset + s.length
          return suggestionStart >= sentenceInfo.sentenceStart && 
                 suggestionEnd <= sentenceInfo.sentenceEnd
        })
        
        console.log('✅ Sentence recheck complete:', {
          totalSuggestions: sentenceSuggestions.length,
          sentenceSuggestions: filteredSuggestions.length,
          suggestions: filteredSuggestions.map(s => ({
            type: s.type,
            message: s.message,
            offset: s.offset
          }))
        })
        
        // Replace suggestions in the sentence range
        dispatch(replaceSuggestionsInRange({
          start: sentenceInfo.sentenceStart,
          end: sentenceInfo.sentenceEnd,
          newSuggestions: filteredSuggestions,
          currentText: newContent
        }))
      } catch (error) {
        console.error('Error rechecking sentence:', error)
      }
    } else {
      console.log('⚠️ Could not extract sentence for rechecking')
    }

    // Update Redux editor content so other parts of the UI receive the new text
    dispatch(setContent([{ 
      type: 'paragraph',
      children: [{ text: newContent }]
    }]))

    // Update current document content
    dispatch(updateCurrentDocumentContent(newContent))

    // Persist change
    autoSave(newContent)
    setShowTooltip(null)
    
    console.log('📝 Applied suggestion - undo data stored:', {
      originalText,
      replacement,
      offset: suggestion.offset
    })
  }, [content, dispatch, autoSave, aiCheckEnabled]) // Added aiCheckEnabled dependency

  // Ignore suggestion
  const handleIgnoreSuggestion = useCallback(async (suggestionId: string) => {
    // Find the suggestion to record the rejection
    const suggestion = suggestions.find(s => s.id === suggestionId)
    if (suggestion) {
      const originalText = content.substring(suggestion.offset, suggestion.offset + suggestion.length)
      
      // Record the rejection for smart corrections
      smartCorrectionService.recordUserChoice(
        suggestion,
        false, // rejected
        originalText,
        originalText, // no change
        content
      ).catch(console.error)
      
      // If this is a spelling suggestion, save it to ignored words
      if (suggestion.type === 'spelling') {
        const isProperNoun = ignoredWordsService.isLikelyProperNoun(originalText, suggestion.context)
        
        // Save to ignored words database
        const result = await ignoredWordsService.addIgnoredWord(originalText, {
          context: suggestion.context,
          documentType: effectiveProfile?.profileType || 'general',
          isProperNoun
        })
        
        if (result) {
          console.log('✅ Added to ignored words:', originalText, { isProperNoun })
          toast.success(`"${originalText}" will no longer be marked as misspelled`)
        }
      }
      
      // Pass the original text when ignoring
      dispatch(ignoreSuggestion({ suggestionId, originalText }))
    } else {
      // Fallback if suggestion not found
      dispatch(ignoreSuggestion({ suggestionId, originalText: undefined }))
    }
    
    setShowTooltip(null)
  }, [dispatch, suggestions, content, effectiveProfile])

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
    
    // Trigger immediate grammar check for restored content
    checkGrammarImmediate(restoredContent)
    autoSave(restoredContent)
    
    toast.success('✅ Suggestion undone')
  }, [lastAppliedSuggestion, dispatch, autoSave, checkGrammarImmediate])

  // Get active suggestion and text metrics
  const activeSuggestion = combinedSuggestions.find(s => s.id === showTooltip) || suggestions.find(s => s.id === showTooltip)
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length
  const charCount = content.length
  
  // Get smart correction data for the active suggestion
  const getSmartCorrectionForSuggestion = (suggestionId: string): SmartCorrection | undefined => {
    return smartCorrections.find(sc => sc.suggestion.id === suggestionId)
  }

  // Manual sync function to force overlay updates
  const syncOverlayWithTextarea = useCallback(() => {
    if (editorRef.current && overlayRef.current) {
      // Get fresh computed styles
      const textareaStyles = window.getComputedStyle(editorRef.current)
      
      // Get the actual scrollbar width from the textarea
      const scrollbarWidth = editorRef.current.offsetWidth - editorRef.current.clientWidth
      
      // Copy all dimensions and styles
      overlayRef.current.style.position = 'absolute'
      overlayRef.current.style.top = '0'
      overlayRef.current.style.left = '0'
      // Use the clientWidth to match the content area (excluding scrollbar)
      overlayRef.current.style.width = `${editorRef.current.clientWidth}px`
      overlayRef.current.style.height = `${editorRef.current.clientHeight}px`
      
      // Copy all padding values exactly
      overlayRef.current.style.padding = textareaStyles.padding
      overlayRef.current.style.paddingLeft = textareaStyles.paddingLeft
      overlayRef.current.style.paddingRight = textareaStyles.paddingRight
      overlayRef.current.style.paddingTop = textareaStyles.paddingTop
      overlayRef.current.style.paddingBottom = textareaStyles.paddingBottom
      
      // Copy text styles exactly - including computed values
      overlayRef.current.style.lineHeight = textareaStyles.lineHeight
      overlayRef.current.style.fontSize = textareaStyles.fontSize
      overlayRef.current.style.fontFamily = textareaStyles.fontFamily
      overlayRef.current.style.fontWeight = textareaStyles.fontWeight
      overlayRef.current.style.fontStyle = textareaStyles.fontStyle
      overlayRef.current.style.fontVariant = textareaStyles.fontVariant
      overlayRef.current.style.letterSpacing = textareaStyles.letterSpacing
      overlayRef.current.style.wordSpacing = textareaStyles.wordSpacing
      overlayRef.current.style.textAlign = textareaStyles.textAlign
      overlayRef.current.style.textIndent = textareaStyles.textIndent
      overlayRef.current.style.textTransform = textareaStyles.textTransform
      overlayRef.current.style.whiteSpace = 'pre-wrap'
      overlayRef.current.style.wordWrap = 'break-word'
      overlayRef.current.style.wordBreak = textareaStyles.wordBreak || 'normal'
      overlayRef.current.style.overflowWrap = textareaStyles.overflowWrap || 'break-word'
      overlayRef.current.style.boxSizing = textareaStyles.boxSizing
      overlayRef.current.style.direction = textareaStyles.direction
      overlayRef.current.style.unicodeBidi = textareaStyles.unicodeBidi
      
      // Copy border styles to ensure proper box model
      overlayRef.current.style.borderWidth = textareaStyles.borderWidth
      overlayRef.current.style.borderStyle = 'solid'
      overlayRef.current.style.borderColor = 'transparent'
      
      // Set overflow to hidden since overlay doesn't need its own scrollbar
      overlayRef.current.style.overflow = 'hidden'
      
      // Sync scroll position
      overlayRef.current.scrollTop = editorRef.current.scrollTop
      overlayRef.current.scrollLeft = editorRef.current.scrollLeft
      
      // Force a reflow to ensure styles are applied
      void overlayRef.current.offsetHeight
      
      // Recreate highlights
      createHighlightedText()
      
      console.log('📐 Overlay synced:', {
        textareaWidth: editorRef.current.offsetWidth,
        textareaClientWidth: editorRef.current.clientWidth,
        scrollbarWidth,
        overlayWidth: overlayRef.current.style.width,
        scrollTop: editorRef.current.scrollTop
      })
    }
  }, [createHighlightedText])

  // Add ResizeObserver for reliable dimension tracking
  useEffect(() => {
    if (!editorRef.current) return

    let resizeTimer: NodeJS.Timeout
    const resizeObserver = new ResizeObserver((entries) => {
      // Debounce resize events
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        for (const entry of entries) {
          if (entry.target === editorRef.current) {
            console.log('📏 Textarea resized, syncing overlay')
            syncOverlayWithTextarea()
          }
        }
      }, 50) // Small debounce to avoid excessive updates
    })

    resizeObserver.observe(editorRef.current)
    
    // Also observe style changes on the textarea
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          console.log('🎨 Textarea style changed, syncing overlay')
          syncOverlayWithTextarea()
        }
      }
    })
    
    mutationObserver.observe(editorRef.current, {
      attributes: true,
      attributeFilter: ['style']
    })

    return () => {
      clearTimeout(resizeTimer)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [syncOverlayWithTextarea])

  // Enhanced setSidebarCollapsed to sync overlay
  const handleSetSidebarCollapsed = useCallback((collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed)
    
    // Use ResizeObserver instead of timeouts
    // The ResizeObserver will automatically handle the sync when dimensions change
    console.log(`📋 Sidebar ${collapsed ? 'collapsed' : 'expanded'}, ResizeObserver will handle sync`)
  }, [])

  // Enhanced keyboard shortcuts with undo support
  const handleKeyDownEnhanced = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.ctrlKey && event.key === 's') {
      event.preventDefault()
      manualSave()
    } else if (event.ctrlKey && event.key === 'z') {
      event.preventDefault()
      // Check if we have rewrite history to undo
      if (canUndo) {
        dispatch(undoRewrite())
        console.log('↶ Keyboard shortcut: Undo rewrite applied')
      } else {
        // Fall back to suggestion undo
        undoLastSuggestion()
      }
    } else if (event.ctrlKey && event.key === 'y') {
      event.preventDefault()
      // Redo rewrite history
      if (canRedo) {
        dispatch(redoRewrite())
        console.log('↷ Keyboard shortcut: Redo rewrite applied')
      }
    } else if (event.ctrlKey && event.key === 'b') {
      event.preventDefault()
      // Toggle sidebar using the enhanced function
      handleSetSidebarCollapsed(!isSidebarCollapsed)
      console.log(`📋 Keyboard shortcut: Sidebar ${isSidebarCollapsed ? 'shown' : 'hidden'}`)
    } else if (event.ctrlKey && event.shiftKey && event.key === 'A') {
      event.preventDefault()
      // Toggle AI checking
      dispatch(toggleAICheck())
      const newState = !aiCheckEnabled
      console.log(`🤖 Keyboard shortcut: AI checking ${newState ? 'enabled' : 'disabled'}`)
      toast(newState ? '🤖 AI checking enabled' : '🤖 AI checking disabled', {
        duration: 2000,
      })
    } else if (event.key === 'Tab') {
      // Handle tab key to insert tab character instead of moving focus
      event.preventDefault()
      
      const textarea = event.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const value = textarea.value
      
      let newValue: string
      let newCursorPos: number
      
      if (event.shiftKey) {
        // Shift+Tab: Remove tab or spaces at the beginning of the current line
        const lineStart = value.lastIndexOf('\n', start - 1) + 1
        const linePrefix = value.substring(lineStart, start)
        
        if (linePrefix.startsWith('\t')) {
          // Remove tab
          newValue = value.substring(0, lineStart) + value.substring(lineStart + 1)
          newCursorPos = Math.max(lineStart, start - 1)
        } else {
          // Check for spaces at the beginning of the line
          const spaceMatch = linePrefix.match(/^ {1,4}/)
          if (spaceMatch) {
            // Remove up to 4 spaces
            const spacesToRemove = spaceMatch[0].length
            newValue = value.substring(0, lineStart) + value.substring(lineStart + spacesToRemove)
            newCursorPos = Math.max(lineStart, start - spacesToRemove)
          } else {
            // Nothing to remove
            newValue = value
            newCursorPos = start
          }
        }
      } else {
        // Regular Tab: Insert tab character at cursor position
        newValue = value.substring(0, start) + '\t' + value.substring(end)
        newCursorPos = start + 1
      }
      
      // Update the content
      setContentState(newValue)
      dispatch(setContent([{
        type: 'paragraph',
        children: [{ text: newValue }]
      }]))
      dispatch(updateCurrentDocumentContent(newValue))
      
      // Set cursor position after the operation
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = newCursorPos
      }, 0)
      
      // Trigger grammar check and auto-save – range is the inserted tab char
      checkGrammarDebounced(newValue, [{ start, end: start + 1 }])
    }
  }, [manualSave, undoLastSuggestion, canUndo, canRedo, dispatch, isSidebarCollapsed, aiCheckEnabled, handleSetSidebarCollapsed, setContentState, checkGrammarDebounced, autoSave])

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
    
    // Update the suggestion store so that the accepted ones are removed without
    // forcing a new grammar pass.
    dispatch(acceptAllSuggestions({ acceptedSuggestions }))
    
    // Persist change without triggering a new grammar check.
    autoSave(newContent)
    setShowTooltip(null)
    
    console.log('📝 Applied all suggestions - undo available for bulk action')
  }, [suggestions, content, dispatch, autoSave]) // Removed checkSentenceStructure dependency

  // Ignore all suggestions
  const handleIgnoreAllSuggestions = useCallback(() => {
    dispatch(ignoreAllCurrentSuggestions())
    setShowTooltip(null)
  }, [dispatch])

  // Set up global hover handlers for suggestion spans
  useEffect(() => {
    // Smart tooltip positioning function
    const calculateTooltipPosition = (targetElement: HTMLElement) => {
      const rect = targetElement.getBoundingClientRect()
      const tooltipHeight = 200 // Approximate tooltip height
      const tooltipWidth = 384 // max-w-sm is approximately 384px
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth
      const buffer = 10 // Buffer from viewport edges
      
      let x = rect.left
      let y = rect.bottom + 5
      
      // Check if tooltip would go off the bottom of the screen
      if (y + tooltipHeight > viewportHeight - buffer) {
        // Position above the element instead
        y = rect.top - tooltipHeight - 5
        
        // If it would still go off the top, position at the top of the viewport
        if (y < buffer) {
          y = buffer
        }
      }
      
      // Check if tooltip would go off the right edge
      if (x + tooltipWidth > viewportWidth - buffer) {
        x = viewportWidth - tooltipWidth - buffer
      }
      
      // Check if tooltip would go off the left edge
      if (x < buffer) {
        x = buffer
      }
      
      return { x, y }
    }

    const hoverHandler = (suggestionId: string, event: MouseEvent) => {
      const target = event.target as HTMLElement
      const position = calculateTooltipPosition(target)
      setTooltipPosition(position)
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
      
      // Clear paragraph cache for new document
      setParagraphCache(new Map())
      setLastCheckText('')
      
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
        if (aiCheckEnabled) {
          console.log('🤖 Using AI-enhanced checking for document load')
          dispatch(checkTextWithAI({ 
            text: currentDocument.content,
            documentType: 'general',
            checkType: 'comprehensive',
            isDemo
          }))
        } else {
          dispatch(checkText({ text: currentDocument.content }))
        }
        // checkSentenceStructure(currentDocument.content) // Disabled sentence structure check
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
        if (aiCheckEnabled) {
          console.log('🤖 Using AI-enhanced checking for initial load')
          dispatch(checkTextWithAI({ 
            text: currentDocument.content,
            documentType: 'general',
            checkType: 'comprehensive',
            isDemo
          }))
        } else {
          dispatch(checkText({ text: currentDocument.content }))
        }
        // checkSentenceStructure(currentDocument.content) // Disabled sentence structure check
      }
    }
  }, [currentDocument, dispatch, content, aiCheckEnabled, isDemo]) // Removed checkSentenceStructure dependency

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

  // Get smart corrections when suggestions change
  useEffect(() => {
    const getSmartCorrections = async () => {
      if (suggestions.length > 0 && content) {
        try {
          const corrections = await smartCorrectionService.getSmartCorrections(
            suggestions,
            content
          )
          setSmartCorrections(corrections)
          console.log('🧠 Smart corrections loaded:', corrections.length)
        } catch (error) {
          console.error('Error getting smart corrections:', error)
          setSmartCorrections([])
        }
      } else {
        setSmartCorrections([])
      }
    }
    
    getSmartCorrections()
  }, [suggestions, content])

  // Initial sync when component mounts or content changes
  useEffect(() => {
    if (editorRef.current && overlayRef.current) {
      // Ensure styles are loaded before initial sync
      requestAnimationFrame(() => {
        syncOverlayWithTextarea()
      })
    }
  }, [content, syncOverlayWithTextarea])

  // Sync scroll position between textarea and overlay when content changes
  useEffect(() => {
    if (content && editorRef.current && overlayRef.current) {
      // Re-sync the overlay dimensions and styles
      syncOverlayWithTextarea()
      
      // Ensure scroll position is synced
      overlayRef.current.scrollTop = editorRef.current.scrollTop
      overlayRef.current.scrollLeft = editorRef.current.scrollLeft
    }
  }, [content, highlightedContent, syncOverlayWithTextarea])

  // Force re-render of highlights when sidebar state changes
  useEffect(() => {
    // The ResizeObserver will automatically handle dimension changes
    // We just need to ensure highlights are recreated after layout stabilizes
    if (content) {
      // Small delay to ensure layout is complete after sidebar animation
      const timer = setTimeout(() => {
        createHighlightedText()
      }, 300) // Match typical CSS transition duration
      
      return () => clearTimeout(timer)
    }
  }, [sidebarWidth, isSidebarCollapsed, content, createHighlightedText])

  // Also handle window resize events
  useEffect(() => {
    // ResizeObserver on the textarea already handles this
    // This effect is no longer needed
    return
  }, [])

  // Add ResizeObserver to detect textarea dimension changes
  useEffect(() => {
    if (!editorRef.current || !overlayRef.current) return

    let resizeTimeout: NodeJS.Timeout

    const resizeObserver = new ResizeObserver((entries) => {
      // Clear any existing timeout
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }

      // Debounce the resize handling to prevent excessive updates during transitions
      resizeTimeout = setTimeout(() => {
        for (const entry of entries) {
          if (entry.target === editorRef.current) {
            // Use syncOverlayWithTextarea which properly handles clientWidth and scrollbar compensation
            syncOverlayWithTextarea()
          }
        }
      }, 50) // 50ms debounce to let CSS transitions settle
    })

    resizeObserver.observe(editorRef.current)

    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      resizeObserver.disconnect()
    }
  }, [syncOverlayWithTextarea])

  // Create a combined array of all suggestions for rendering
  useEffect(() => {
    const allSuggestions = [...suggestions]
    setCombinedSuggestions(allSuggestions)
  }, [suggestions])

  // Calculate priority score for suggestions
  const getPrioritySuggestions = useCallback(() => {
    return [...suggestions].sort((a, b) => {
      // Priority: spelling > grammar > style
      const priorityMap: Record<string, number> = {
        'spelling': 3,
        'grammar': 2,
        'style': 1
      }
      return (priorityMap[b.type] || 0) - (priorityMap[a.type] || 0)
    })
  }, [suggestions])

  // Calculate summary metrics
  const getSummaryMetrics = useCallback(() => {
    const metrics = {
      totalIssues: suggestions.length,
      criticalIssues: suggestions.filter(s => s.type === 'spelling' || s.type === 'grammar').length,
      readabilityScore: currentDocument ? 
        (readabilityScore?.fleschKincaid ? `Grade ${readabilityScore.fleschKincaid.toFixed(1)}` : 'Analyzing...') : 
        'N/A'
      // sentenceQuality removed - sentence structure feature disabled
    }
    return metrics
  }, [suggestions, readabilityScore, currentDocument]) // Removed sentenceAnalysis dependency

  // Add MutationObserver to detect layout changes
  useEffect(() => {
    if (!editorRef.current || !overlayRef.current) return

    let mutationTimeout: NodeJS.Timeout
    const editorContainer = editorRef.current.parentElement

    // Watch for changes to the editor container that might affect layout
    const mutationObserver = new MutationObserver((mutations) => {
      // Clear any existing timeout
      if (mutationTimeout) {
        clearTimeout(mutationTimeout)
      }

      // Check if any mutations affected layout
      const layoutAffectingMutation = mutations.some(mutation => {
        return mutation.type === 'attributes' && 
               (mutation.attributeName === 'style' || 
                mutation.attributeName === 'class')
      })

      if (layoutAffectingMutation) {
        // Debounce to avoid excessive updates
        mutationTimeout = setTimeout(() => {
          if (editorRef.current && overlayRef.current) {
            // Sync styles and recreate highlights
            syncOverlayWithTextarea()
          }
        }, 300) // Wait for animations to complete
      }
    })

    // Observe the editor container and its ancestors for style/class changes
    if (editorContainer) {
      mutationObserver.observe(editorContainer, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        subtree: false
      })
      
      // Also observe the parent flex container
      const flexContainer = editorContainer.parentElement
      if (flexContainer) {
        mutationObserver.observe(flexContainer, {
          attributes: true,
          attributeFilter: ['style', 'class'],
          subtree: false
        })
      }
    }

    return () => {
      if (mutationTimeout) {
        clearTimeout(mutationTimeout)
      }
      mutationObserver.disconnect()
    }
  }, [syncOverlayWithTextarea])

  // Add this effect to explicitly re-sync the overlay when content or suggestions change.
  useEffect(() => {
    console.log('🔄 Dependencies changed, re-syncing overlay highlights.')
    syncOverlayWithTextarea()
  }, [syncOverlayWithTextarea])

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
          {/* Sentence analysis loading indicator - disabled
          {sentenceAnalysisLoading && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
              <span className="text-purple-500">Analyzing sentences...</span>
            </div>
          )}
          */}
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
          
          {/* AI Grammar Toggle */}
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <span className="text-sm text-gray-600 dark:text-gray-400">🤖 AI Grammar</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={aiCheckEnabled}
                  onChange={() => dispatch(toggleAICheck())}
                  className="sr-only"
                />
                <div className={`w-10 h-5 rounded-full transition-colors duration-200 ${
                  aiCheckEnabled 
                    ? 'bg-purple-500' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                    aiCheckEnabled 
                      ? 'translate-x-5' 
                      : 'translate-x-0.5'
                  } mt-0.5`}></div>
                </div>
              </div>
            </label>
          </div>
          
          {/* Undo/Redo Buttons for Rewrite History */}
          {(canUndo || canRedo) && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => dispatch(undoRewrite())}
                disabled={!canUndo}
                className={`px-3 py-1 text-xs rounded transition-colors flex items-center space-x-1 ${
                  canUndo
                    ? 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }`}
                title={canUndo ? "Undo rewrite (Ctrl+Z)" : "No rewrites to undo"}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                <span>Undo</span>
              </button>
              
              <button
                onClick={() => dispatch(redoRewrite())}
                disabled={!canRedo}
                className={`px-3 py-1 text-xs rounded transition-colors flex items-center space-x-1 ${
                  canRedo
                    ? 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }`}
                title={canRedo ? "Redo rewrite (Ctrl+Y)" : "No rewrites to redo"}
              >
                <span>Redo</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6" />
                </svg>
              </button>
            </div>
          )}

          {/* Undo Button for Suggestions */}
          {lastAppliedSuggestion && (
            <button
              onClick={undoLastSuggestion}
              className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900 dark:hover:bg-yellow-800 text-yellow-800 dark:text-yellow-200 text-xs rounded transition-colors flex items-center space-x-1"
              title="Undo last suggestion"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span>Undo Suggestion</span>
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

          {/* Grade Level Rewrite Button */}
          {content.trim().length > 0 && (
            <button
                                  onClick={() => dispatch(setShowGradeLevelPanel(true))}
              className="px-3 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs rounded transition-colors flex items-center space-x-1"
              title="Adjust reading level for different audiences"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>🎓 Adjust Grade Level</span>
            </button>
          )}

          {/* Accept All and Ignore All Suggestions Buttons */}
          {suggestions.length > 0 && (
            <>
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
            </>
          )}

          {/* Ignored Words Manager Button */}
          <button
            onClick={() => setShowIgnoredWordsManager(true)}
            className="px-3 py-1 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200 text-xs rounded transition-colors flex items-center space-x-1"
            title="Manage ignored words"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span>Ignored Words</span>
          </button>

          {/* Performance Management */}
          {(performanceMetrics.requestCount > 0 || retryQueue.length > 0) && (
            <div className="flex items-center space-x-1">
              {/* Clear Cache Button */}
              <button
                onClick={() => {
                  dispatch(clearCache())
                  toast.success('🗑️ Cache cleared to improve performance')
                }}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded transition-colors"
                title={`Clear cache (${performanceMetrics.cacheHits + performanceMetrics.cacheMisses} items)`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              
              {/* Retry Queue Indicator */}
              {retryQueue.length > 0 && (
                <div 
                  className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded flex items-center space-x-1"
                  title={`${retryQueue.length} requests queued for retry`}
                >
                  <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{retryQueue.length}</span>
                </div>
              )}
            </div>
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
          onScroll={handleScroll}
        />
        
        {/* Overlay for highlights */}
        <div
          ref={overlayRef}
          className="grammar-overlay font-serif text-lg leading-relaxed text-transparent z-10 pointer-events-none"
          style={{ 
            fontFamily: 'ui-serif, Georgia, serif',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            wordBreak: 'normal',
            overflowWrap: 'break-word',
            scrollbarWidth: 'none', // Hide scrollbar for Firefox
            msOverflowStyle: 'none', // Hide scrollbar for IE and Edge
            position: 'absolute',
            top: 0,
            left: 0,
            padding: '1rem', // Match the p-4 class from textarea
            color: 'transparent' // Ensure text is transparent except for highlights
          }}
          dangerouslySetInnerHTML={{ __html: highlightedContent }}
        />
          </div>
        </div>

        {/* Resize Handle - only show when sidebar is not collapsed */}
        {!isSidebarCollapsed && (
          <div
            ref={resizerRef}
            className={`w-1 bg-gray-200 dark:bg-gray-600 hover:bg-blue-400 dark:hover:bg-blue-500 cursor-col-resize flex-shrink-0 transition-colors duration-150 ${
              isResizing ? 'bg-blue-400 dark:bg-blue-500' : ''
            }`}
            onMouseDown={handleResizeStart}
            title="Drag to resize sidebar"
          />
        )}

        {/* Right Sidebar - Analysis & Suggestions */}
        {!isSidebarCollapsed && (
          <div 
            className="flex-shrink-0 flex flex-col bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 rounded-lg relative"
            style={{ width: `${sidebarWidth}px` }}
          >
          {/* Persistent Summary Bar */}
          <div className="px-4 py-3 bg-white dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 relative">
            {/* Collapse button */}
            <button
              onClick={() => handleSetSidebarCollapsed(true)}
              className="absolute right-2 top-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
              title="Hide analysis panel (Ctrl+B)"
            >
              <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="space-y-2 text-xs pr-8">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">Issues:</span>
                <div className="flex items-center space-x-1 flex-wrap justify-end">
                  {getSummaryMetrics().criticalIssues > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-full font-medium whitespace-nowrap">
                      {getSummaryMetrics().criticalIssues} critical
                    </span>
                  )}
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-full whitespace-nowrap">
                    {getSummaryMetrics().totalIssues} total
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">Grade:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {getSummaryMetrics().readabilityScore}
                </span>
              </div>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              {/* Style Profile Section */}
              <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => toggleSection('styleProfile')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">✍️</span>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Style Profile
                    </h3>
                  </div>
                  <svg 
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      collapsedSections.styleProfile ? '' : 'rotate-180'
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {!collapsedSections.styleProfile && (
                  <div className="px-4 pb-4">
                    <ProfileSelector 
                      documentId={currentDocument?.id}
                      documentContent={content}
                      compact={false}
                    />
                  </div>
                )}
              </div>

              {/* Smart Corrections Section */}
              <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => toggleSection('smartCorrections')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">🧠</span>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Smart Auto-Correction
                    </h3>
                  </div>
                  <svg 
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      collapsedSections.smartCorrections ? '' : 'rotate-180'
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {!collapsedSections.smartCorrections && (
                  <div className="px-4 pb-4">
                    <SmartCorrectionPanel />
                  </div>
                )}
              </div>

              {/* AI Assistant Section - Removed from sidebar, toggle now in stats bar */}
              {/*
              <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => toggleSection('aiAssistant')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">🤖</span>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      AI Grammar Assistant
                    </h3>
                  </div>
                  <svg 
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      collapsedSections.aiAssistant ? '' : 'rotate-180'
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {!collapsedSections.aiAssistant && (
                  <div className="px-4 pb-4">
                    <AISuggestionPanel 
                      suggestion={activeSuggestion}
                      onApply={(replacement) => {
                        if (activeSuggestion) {
                          handleApplySuggestion(activeSuggestion, replacement)
                        }
                      }}
                    />
                  </div>
                )}
              </div>
              */}

              {/* Critical Suggestions Section (Priority) */}
              {suggestions.filter(s => s.type === 'spelling' || s.type === 'grammar').length > 0 && (
                <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <button
                    onClick={() => toggleSection('criticalSuggestions')}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Critical Issues ({suggestions.filter(s => s.type === 'spelling' || s.type === 'grammar').length})
                      </h3>
                    </div>
                    <svg 
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        collapsedSections.criticalSuggestions ? '' : 'rotate-180'
                      }`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {!collapsedSections.criticalSuggestions && (
                    <div className="px-4 pb-4 space-y-3">
                      {getPrioritySuggestions()
                        .filter(s => s.type === 'spelling' || s.type === 'grammar')
                        .map((suggestion) => (
                          <div 
                            key={suggestion.id}
                            className="p-3 bg-gray-50 dark:bg-gray-600 rounded-lg"
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
                                  <div className="flex flex-wrap gap-1">
                                    {suggestion.replacements.slice(0, 3).map((replacement, index) => (
                                      <button
                                        key={index}
                                        onClick={() => handleApplySuggestion(suggestion, replacement)}
                                        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                      >
                                        "{replacement}"
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-2">
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
                  )}
                </div>
              )}

              {/* Style Suggestions Section */}
              {suggestions.filter(s => s.type === 'style').length > 0 && (
                <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <button
                    onClick={() => toggleSection('styleSuggestions')}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Style Improvements ({suggestions.filter(s => s.type === 'style').length})
                      </h3>
                    </div>
                    <svg 
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        collapsedSections.styleSuggestions ? '' : 'rotate-180'
                      }`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {!collapsedSections.styleSuggestions && (
                    <div className="px-4 pb-4 space-y-3">
                      {suggestions
                        .filter(s => s.type === 'style')
                        .map((suggestion) => (
                          <div 
                            key={suggestion.id}
                            className="p-3 bg-gray-50 dark:bg-gray-600 rounded-lg"
                          >
                            <div className="flex items-start space-x-3">
                              <span className="text-xs px-2 py-1 rounded flex-shrink-0 font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {suggestion.type}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
                                  {suggestion.message}
                                </p>
                                {suggestion.replacements && suggestion.replacements.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {suggestion.replacements.slice(0, 3).map((replacement, index) => (
                                      <button
                                        key={index}
                                        onClick={() => handleApplySuggestion(suggestion, replacement)}
                                        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                      >
                                        "{replacement}"
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-2">
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
                  )}
                </div>
              )}

              {/* Readability Analysis Section */}
              <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => toggleSection('readability')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Readability Analysis
                    </h3>
                  </div>
                  <svg 
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      collapsedSections.readability ? '' : 'rotate-180'
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {!collapsedSections.readability && (
                  <div className="px-4 pb-4">
                    <ReadabilityPanel />
                  </div>
                )}
              </div>

              {/* Sentence Analysis Section */}
              {/*
              <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => toggleSection('sentenceAnalysis')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Sentence Structure
                    </h3>
                  </div>
                  <svg 
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      collapsedSections.sentenceAnalysis ? '' : 'rotate-180'
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {!collapsedSections.sentenceAnalysis && (
                  <div className="px-4 pb-4">
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
                        
                        // Trigger grammar check immediately
                        checkGrammarImmediate(newContent)
                        checkSentenceStructure(newContent)
                        autoSave(newContent)
                        
                        console.log('📝 Applied sentence suggestion - undo data stored')
                      }}
                    />
                  </div>
                )}
              </div>
              */}


            </div>
          </div>
        </div>
        )}
      </div>

      {/* Floating sidebar toggle button when collapsed */}
      {isSidebarCollapsed && (
        <button
          onClick={() => handleSetSidebarCollapsed(false)}
          className="fixed right-4 top-20 z-30 p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-lg transition-all duration-200 flex items-center space-x-1"
          title="Show analysis panel (Ctrl+B)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l-7 7 7 7" />
          </svg>
          <span className="text-sm font-medium">Analysis</span>
          {suggestions.length > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 ml-1">
              {suggestions.length}
            </span>
          )}
        </button>
      )}

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
              {/* Smart Correction Badge */}
              {(() => {
                const smartCorrection = getSmartCorrectionForSuggestion(activeSuggestion.id)
                return smartCorrection && (
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {smartCorrection.learningBased && (
                        <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded-full font-medium flex items-center space-x-1">
                          <span>🧠</span>
                          <span>Learned</span>
                        </span>
                      )}
                      {smartCorrection.quickAccept && (
                        <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-full font-medium flex items-center space-x-1">
                          <span>⚡</span>
                          <span>Quick Accept</span>
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {smartCorrection.confidence}% confidence
                    </span>
                  </div>
                )
              })()}
              
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
              
              {/* Smart Correction Reason */}
              {(() => {
                const smartCorrection = getSmartCorrectionForSuggestion(activeSuggestion.id)
                return smartCorrection && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    💡 {smartCorrection.reason}
                  </p>
                )
              })()}
              
              {/* Suggestions */}
              {activeSuggestion.replacements && activeSuggestion.replacements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Suggestions:
                  </p>
                  <div className="space-y-1">
                    {activeSuggestion.replacements.slice(0, 3).map((replacement, index) => {
                      const smartCorrection = getSmartCorrectionForSuggestion(activeSuggestion.id)
                      const isQuickAccept = smartCorrection?.quickAccept && index === 0
                      
                      return (
                        <button
                          key={index}
                          onClick={() => handleApplySuggestion(activeSuggestion, replacement)}
                          className={`block w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                            isQuickAccept 
                              ? 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 border border-green-300 dark:border-green-700' 
                              : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>"{replacement}"</span>
                            {isQuickAccept && (
                              <span className="text-xs text-green-700 dark:text-green-300">⚡ Quick</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
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

      {/* Grade Level Rewrite Panel */}
      {showGradeLevelRewritePanel && (
        <GradeLevelRewritePanel
          text={content}
          onRewrite={handleGradeLevelRewrite}
                      onClose={() => dispatch(setShowGradeLevelPanel(false))}
        />
      )}

      {/* Ignored Words Manager */}
      <IgnoredWordsManager
        isOpen={showIgnoredWordsManager}
        onClose={() => setShowIgnoredWordsManager(false)}
      />
    </div>
  )
}

export default GrammarTextEditor 