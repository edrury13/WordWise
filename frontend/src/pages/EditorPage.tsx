import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useParams, useNavigate } from 'react-router-dom'
import { RootState, AppDispatch } from '../store'
import { fetchDocument, createDocument, updateDocument } from '../store/slices/documentSlice'
import { setLastSaved } from '../store/slices/editorSlice'
import GrammarTextEditor from '../components/GrammarTextEditor'
import LoadingSpinner from '../components/LoadingSpinner'
import Breadcrumb from '../components/Breadcrumb'
import Navigation from '../components/Navigation'

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
  const { suggestions, apiStatus } = useSelector((state: RootState) => state.suggestions)
  
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
          dispatchRef.current(setLastSaved(Date.now()))
        }
       }).catch((error: any) => {
         console.error('Failed to save document:', error)
       })
    }
  }, [currentDocument, user, documentTitle])



  if (loading || isCreatingDocument) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-gray-900">
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
      <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-gray-900">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Error Loading Document</h2>
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
    <div className="h-screen flex flex-col bg-cream dark:bg-gray-900">
      {/* Navigation with save functionality */}
      <Navigation 
        onSave={handleSaveDocument}
        isSaving={saving}
        showSaveButton={true}
      />
      {/* Academic Header */}
      <div className="bg-white dark:bg-gray-800 border-b-4 border-navy dark:border-blue-600 shadow-sm flex-shrink-0">
        <div className="w-full px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Left side - Breadcrumb navigation */}
            <div className="flex items-center space-x-4">
              <Breadcrumb 
                items={[
                  {
                    label: currentDocument?.title || documentTitle || 'Untitled Document',
                    current: true
                  }
                ]}
              />
            </div>
            
            {/* Center - Document Title */}
            <div className="flex-1 max-w-2xl mx-8">
              <input
                type="text"
                value={documentTitle}
                onChange={handleTitleChange}
                className="w-full text-xl font-bold academic-serif text-navy dark:text-blue-400 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-navy dark:focus:ring-blue-600 focus:ring-opacity-20 rounded px-3 py-2 placeholder-academic-gray dark:placeholder-gray-400 text-center"
                placeholder="Research Paper Title..."
              />
              
              {isNewDocument && (
                <div className="text-center mt-1">
                  <span className="text-sm text-gold dark:text-yellow-400 academic-sans font-medium bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded">
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
                  <div className="flex items-center space-x-2 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded-full">
                    <div className="w-2 h-2 bg-gold dark:bg-yellow-400 rounded-full"></div>
                    <span className="text-navy dark:text-blue-400 font-medium">
                      {suggestions.length} analysis point{suggestions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                
                {/* API Status Indicator */}
                {apiStatus && (
                  <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${
                    apiStatus === 'api' 
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : apiStatus === 'mixed'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                      : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      apiStatus === 'api' 
                        ? 'bg-green-500 dark:bg-green-400'
                        : apiStatus === 'mixed'
                        ? 'bg-blue-500 dark:bg-blue-400'
                        : 'bg-orange-500 dark:bg-orange-400'
                    }`}></div>
                    <span>
                      {apiStatus === 'api' 
                        ? 'Advanced AI'
                        : apiStatus === 'mixed'
                        ? 'AI + Local'
                        : 'Local Analysis'
                      }
                    </span>
                  </div>
                )}
                
                {currentDocument && (
                  <div className="text-academic-gray dark:text-gray-300">
                    {currentDocument.word_count || 0} words
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleSaveDocument}
                  disabled={!currentDocument || saving}
                  className="px-4 py-2 bg-navy dark:bg-blue-600 text-white hover:bg-burgundy dark:hover:bg-blue-700 rounded-lg text-sm font-medium academic-sans disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 h-full overflow-hidden">
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