import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { checkText, ignoreSuggestion } from '../store/slices/suggestionSlice'
import { setContent, setLastSaved } from '../store/slices/editorSlice'
import { updateDocument } from '../store/slices/documentSlice'
import { Suggestion } from '../store/slices/suggestionSlice'

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
  
  const [content, setContentState] = useState(initialContent)
  const [, setSelectionRange] = useState<{ start: number; end: number } | null>(null)
  const [showSuggestionTooltip, setShowSuggestionTooltip] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  
  const editorRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()
  const lastCheckRef = useRef<string>('')
  const autoSaveRef = useRef<NodeJS.Timeout>()

  // Debounced grammar checking
  const checkGrammar = useCallback(
    (text: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      
      debounceRef.current = setTimeout(() => {
        if (text.trim() && text !== lastCheckRef.current && text.length > 3) {
          lastCheckRef.current = text
          dispatch(checkText({ text }))
        }
      }, 1000) // Check grammar after 1 second of no typing
    },
    [dispatch]
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
      const newContent = event.currentTarget.textContent || ''
      setContentState(newContent)
      
      // Update Redux store
      dispatch(setContent([{
        type: 'paragraph',
        children: [{ text: newContent }]
      }]))
      
      // Call external handler
      onContentChange?.(newContent)
      
      // Trigger grammar check and auto-save
      checkGrammar(newContent)
      autoSave(newContent)
    },
    [onContentChange, checkGrammar, autoSave, dispatch]
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
    if (!content || suggestions.length === 0) {
      return content
    }

    let highlightedText = content
    const sortedSuggestions = [...suggestions].sort((a, b) => b.offset - a.offset)

    sortedSuggestions.forEach((suggestion) => {
      const { offset, length, type, id } = suggestion
      const errorText = content.substring(offset, offset + length)
      const highlightClass = getHighlightClass(type)
      
      const highlightedSpan = `<span 
        class="${highlightClass}" 
        data-suggestion-id="${id}"
        data-error-text="${errorText}"
        onMouseEnter="handleSuggestionHover('${id}', event)"
        onMouseLeave="handleSuggestionLeave()"
      >${errorText}</span>`
      
      highlightedText = 
        highlightedText.substring(0, offset) + 
        highlightedSpan + 
        highlightedText.substring(offset + length)
    })

    return highlightedText
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
      setShowSuggestionTooltip(suggestionId)
      setTooltipPosition({
        top: event.clientY - 10,
        left: event.clientX + 10
      })
    }
  }, [suggestions])

  // Handle suggestion leave
  const handleSuggestionLeave = useCallback(() => {
    setShowSuggestionTooltip(null)
  }, [])

  // Apply suggestion
  const applySuggestion = useCallback((suggestion: Suggestion, replacement: string) => {
    const newContent = 
      content.substring(0, suggestion.offset) + 
      replacement + 
      content.substring(suggestion.offset + suggestion.length)
    
    setContentState(newContent)
    
    // Update editor content
    if (editorRef.current) {
      editorRef.current.textContent = newContent
    }
    
    // Update Redux and trigger new check
    dispatch(setContent([{
      type: 'paragraph',
      children: [{ text: newContent }]
    }]))
    
    onContentChange?.(newContent)
    checkGrammar(newContent)
    setShowSuggestionTooltip(null)
  }, [content, dispatch, onContentChange, checkGrammar])

  // Ignore suggestion
  const handleIgnoreSuggestion = useCallback((suggestionId: string) => {
    dispatch(ignoreSuggestion(suggestionId))
    setShowSuggestionTooltip(null)
  }, [dispatch])

  // Initialize content
  useEffect(() => {
    if (initialContent && initialContent !== content) {
      setContentState(initialContent)
      if (editorRef.current) {
        editorRef.current.textContent = initialContent
      }
    }
  }, [initialContent])

  // Add global event listeners
  useEffect(() => {
    // Make hover functions globally available
    (window as any).handleSuggestionHover = handleSuggestionHover
    ;(window as any).handleSuggestionLeave = handleSuggestionLeave
    
    document.addEventListener('selectionchange', handleSelectionChange)
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    }
  }, [handleSelectionChange, handleSuggestionHover, handleSuggestionLeave])

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
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{content.split(/\s+/).filter(w => w.length > 0).length} words</span>
            <span>|</span>
            <span>{content.length} characters</span>
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
            lineHeight: '1.8'
          }}
          onInput={handleContentChange}
          dangerouslySetInnerHTML={{ __html: renderHighlightedText() }}
        />
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
                    onClick={() => applySuggestion(activeSuggestion, replacement)}
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
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Checking grammar...</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default TextEditor 