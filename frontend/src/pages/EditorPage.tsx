import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useParams, useNavigate } from 'react-router-dom'
import { RootState, AppDispatch } from '../store'
import { fetchDocument, createDocument, updateDocument } from '../store/slices/documentSlice'
import { setLastSaved } from '../store/slices/editorSlice'
import GrammarTextEditor from '../components/GrammarTextEditor'
import LoadingSpinner from '../components/LoadingSpinner'

const EditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  
  // Use refs to prevent infinite loops in useEffect
  const dispatchRef = useRef(dispatch)
  const navigateRef = useRef(navigate)
  
  // Update refs when functions change
  useEffect(() => {
    dispatchRef.current = dispatch
    navigateRef.current = navigate
  }, [dispatch, navigate])
  
  const { currentDocument, loading, error, saving } = useSelector((state: RootState) => state.documents)
  const { user } = useSelector((state: RootState) => state.auth)
  const { suggestions } = useSelector((state: RootState) => state.suggestions)
  
  const [documentTitle, setDocumentTitle] = useState('Untitled Document')
  const [isNewDocument, setIsNewDocument] = useState(!id)
  const [isCreatingDocument, setIsCreatingDocument] = useState(false)

  useEffect(() => {
    if (!user) {
      return // Don't do anything if no user
    }
    
    if (id && !isCreatingDocument) {
      // Fetch existing document by ID
      dispatchRef.current(fetchDocument(id))
    } else if (!id && !isCreatingDocument) {
      // Create new document only if no ID in URL and not currently creating
      setIsCreatingDocument(true)
      
      dispatchRef.current(createDocument({
        title: 'Untitled Document',
        content: '',
        userId: user.id
      })).then((action) => {
        if (action.type === 'documents/createDocument/fulfilled') {
          const newDoc = action.payload as any
          setIsCreatingDocument(false)
          // Use navigate to properly update React Router state
          navigateRef.current(`/editor/${newDoc.id}`, { replace: true })
        } else {
          setIsCreatingDocument(false)
        }
      }).catch(() => {
        setIsCreatingDocument(false)
      })
    }
  }, [id, user, isCreatingDocument]) // Only depend on id, user, and isCreatingDocument

  useEffect(() => {
    if (currentDocument) {
      setDocumentTitle(currentDocument.title)
      setIsNewDocument(false)
    }
  }, [currentDocument])

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDocumentTitle(event.target.value)
    // TODO: Debounced title update
  }

    const handleSaveDocument = useCallback(() => {
    if (currentDocument && user) {
      dispatchRef.current(updateDocument({
        id: currentDocument.id,
        content: currentDocument.content,
        title: documentTitle
      })).then((action: any) => {
        if (action.type === 'documents/updateDocument/fulfilled') {
          dispatchRef.current(setLastSaved(new Date()))
        }
       }).catch((error: any) => {
         console.error('Failed to save document:', error)
       })
    }
  }, [currentDocument, user, documentTitle])

  if (loading || isCreatingDocument) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            {isCreatingDocument ? 'Creating new document...' : 'Loading document...'}
          </p>
        </div>
      </div>
    )
  }

  // If no user, redirect to login
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Document</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => navigateRef.current('/dashboard')}
            className="btn btn-primary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-cream">
      {/* Academic Header */}
      <div className="bg-white border-b-4 border-navy shadow-sm flex-shrink-0">
        <div className="w-full px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Left side - Back button and branding */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigateRef.current('/dashboard')}
                className="text-navy hover:text-burgundy transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-navy rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg academic-serif">W</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold academic-serif text-navy">Academic Editor</h1>
                  <p className="text-xs text-academic-gray academic-sans">Research Writing Environment</p>
                </div>
              </div>
            </div>
            
            {/* Center - Document Title */}
            <div className="flex-1 max-w-2xl mx-8">
              <input
                type="text"
                value={documentTitle}
                onChange={handleTitleChange}
                className="w-full text-xl font-bold academic-serif text-navy bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-navy focus:ring-opacity-20 rounded px-3 py-2 placeholder-academic-gray text-center"
                placeholder="Research Paper Title..."
              />
              
              {isNewDocument && (
                <div className="text-center mt-1">
                  <span className="text-sm text-gold academic-sans font-medium bg-yellow-50 px-2 py-1 rounded">
                    Draft Document
                  </span>
                </div>
              )}
            </div>

            {/* Right side - Academic Status and actions */}
            <div className="flex items-center space-x-6">
              {/* Writing Analysis Status */}
              <div className="flex items-center space-x-3 text-sm academic-sans">
                {suggestions.length > 0 && (
                  <div className="flex items-center space-x-2 bg-yellow-50 px-3 py-1 rounded-full">
                    <div className="w-2 h-2 bg-gold rounded-full"></div>
                    <span className="text-navy font-medium">
                      {suggestions.length} analysis point{suggestions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                
                {currentDocument && (
                  <div className="text-academic-gray">
                    {currentDocument.word_count || 0} words
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleSaveDocument}
                  disabled={!currentDocument || saving}
                  className="px-4 py-2 bg-navy text-white hover:bg-burgundy rounded-lg text-sm font-medium academic-sans disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {saving ? 'Saving...' : 'Save Document'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Academic Editor Layout - Full Width */}
      <div className="flex-1 min-h-0 p-6">
        <div className="h-full mx-auto" style={{ maxWidth: 'calc(100vw - 3rem)' }}>
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 h-full overflow-hidden">
            {/* Academic Paper Layout */}
            <div className="h-full p-8 academic-sans">
              <GrammarTextEditor />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditorPage 