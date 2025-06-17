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
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0" style={{ backgroundColor: '#ab2408' }}>
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left side - Back button moved to far left */}
            <button
              onClick={() => navigateRef.current('/dashboard')}
              className="text-gray-200 hover:text-white mr-6"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            {/* Center - Title */}
            <div className="flex items-center space-x-4 flex-1">
              <input
                type="text"
                value={documentTitle}
                onChange={handleTitleChange}
                className="text-xl font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-white rounded px-2 py-1 text-white placeholder-gray-200"
                placeholder="Document title..."
              />
              
              {isNewDocument && (
                <span className="text-sm text-gray-200 font-medium">
                  New Document
                </span>
              )}
            </div>

            {/* Right side - Status and actions */}
            <div className="flex items-center space-x-4">
              {/* Grammar Status */}
              <div className="flex items-center space-x-2 text-sm text-gray-200">
                {suggestions.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-orange-300 rounded-full"></div>
                    <span>{suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSaveDocument}
                  disabled={!currentDocument || saving}
                  className="px-3 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Editor Area - Full Screen */}
      <div className="flex-1 min-h-0">
        <GrammarTextEditor />
      </div>
    </div>
  )
}

export default EditorPage 