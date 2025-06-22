import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { RootState, AppDispatch } from '../store'
import { fetchDocument, createDocument, updateDocument } from '../store/slices/documentSlice'
import { 
  setLastSaved, 
  setShowVersionHistory,
  setShowVersionComparison,
  setVersionComparisonIds,
  setIsCreatingVersion,
  setVersionError,
  clearVersionError,
  selectShowVersionHistory,
  selectShowVersionComparison,
  selectVersionComparisonIds,
  selectIsCreatingVersion,
  selectVersionError
} from '../store/slices/editorSlice'
import { 
  loadDocumentProfile, 
  associateProfileWithDocument, 
  selectProfiles,
  selectActiveProfile,
  autoDetectProfile 
} from '../store/slices/styleProfileSlice'
import { userPreferencesService } from '../services/userPreferencesService'
import { versionService } from '../services/versionService'
import GrammarTextEditor from '../components/GrammarTextEditor'
import LoadingSpinner from '../components/LoadingSpinner'
import Navigation from '../components/Navigation'
import { VersionHistoryPanel } from '../components/VersionHistoryPanel'
import { VersionComparisonView } from '../components/VersionComparisonView'
import toast from 'react-hot-toast'

const EditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const [searchParams, setSearchParams] = useSearchParams()
  
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
  const profiles = useSelector(selectProfiles)
  const activeProfile = useSelector(selectActiveProfile)
  
  // Version control selectors
  const showVersionHistory = useSelector(selectShowVersionHistory)
  const showVersionComparison = useSelector(selectShowVersionComparison)
  const versionComparisonIds = useSelector(selectVersionComparisonIds)
  const isCreatingVersion = useSelector(selectIsCreatingVersion)
  const versionError = useSelector(selectVersionError)
  
  const [documentTitle, setDocumentTitle] = useState('Untitled Document')
  const [isNewDocument, setIsNewDocument] = useState(!id)
  const [isCreatingDocument, setIsCreatingDocument] = useState(false)
  const [showProfileSelector, setShowProfileSelector] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [userPreferences, setUserPreferences] = useState<any>(null)
  const [hasDetectedProfile, setHasDetectedProfile] = useState(false)
  const [showVersionCommitDialog, setShowVersionCommitDialog] = useState(false)
  const [versionCommitMessage, setVersionCommitMessage] = useState('')
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<number>(Date.now())
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load user preferences
  useEffect(() => {
    if (user) {
      userPreferencesService.getUserPreferences(user.id).then(prefs => {
        setUserPreferences(prefs)
      })
    }
  }, [user])

  // Show version error if any
  useEffect(() => {
    if (versionError) {
      toast.error(versionError)
      dispatch(clearVersionError())
    }
  }, [versionError, dispatch])

  // Check if we need to prompt for style selection
  useEffect(() => {
    if (searchParams.get('promptStyle') === 'true' && currentDocument) {
      setShowProfileSelector(true)
      // Remove the query parameter after showing the prompt
      searchParams.delete('promptStyle')
      setSearchParams(searchParams)
    }
  }, [searchParams, currentDocument, setSearchParams])

  // Handle auto-detection when content changes
  useEffect(() => {
    if (userPreferences?.autoDetectStyle && 
        currentDocument?.content && 
        currentDocument.content.length > 100 && 
        !hasDetectedProfile) {
      // Auto-detect profile based on content
      dispatch(autoDetectProfile(currentDocument.content)).then((action) => {
        if (autoDetectProfile.fulfilled.match(action)) {
          const detectedType = action.payload
          // Find a profile of the detected type
          const matchingProfile = profiles.find(p => p.profileType === detectedType)
          if (matchingProfile && currentDocument.id) {
            dispatch(associateProfileWithDocument({
              documentId: currentDocument.id,
              profileId: matchingProfile.id
            }))
            toast.success(`Auto-detected ${matchingProfile.name} style`)
            setHasDetectedProfile(true)
          }
        }
      })
    }
  }, [currentDocument?.content, userPreferences, hasDetectedProfile, profiles, dispatch, currentDocument?.id])

  useEffect(() => {
    if (!user) {
      return // Don't do anything if no user
    }
    
    if (id && !isCreatingDocument) {
      // Fetch existing document by ID
      dispatchRef.current(fetchDocument(id))
      // Load the document's associated profile
      dispatchRef.current(loadDocumentProfile(id))
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

  // Auto-save version every 5 minutes
  useEffect(() => {
    const createAutoVersion = async () => {
      if (!currentDocument || !documentTitle || isNewDocument) return

      try {
        // Save the document first
        await handleSaveDocument()
        
        // Create automatic version
        await versionService.createVersion({
          documentId: currentDocument.id,
          title: documentTitle,
          content: currentDocument.content,
          isAutomatic: true,
          isMajorVersion: false
        })
        
        setLastAutoSaveTime(Date.now())
        console.log('Auto-save version created at', new Date().toLocaleTimeString())
      } catch (error) {
        console.error('Failed to create auto-save version:', error)
      }
    }

    // Clear any existing interval
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current)
    }

    // Set up new interval (5 minutes = 300000ms)
    if (currentDocument && !isNewDocument) {
      autoSaveIntervalRef.current = setInterval(createAutoVersion, 5 * 60 * 1000)
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
        autoSaveIntervalRef.current = null
      }
    }
  }, [currentDocument, documentTitle, isNewDocument, handleSaveDocument])

  const handleShowVersionHistory = useCallback(() => {
    dispatch(setShowVersionHistory(true))
  }, [dispatch])

  const handleCreateVersion = useCallback(() => {
    setShowVersionCommitDialog(true)
  }, [])

  const handleConfirmCreateVersion = useCallback(async () => {
    if (!currentDocument || !documentTitle) return

    dispatch(setIsCreatingVersion(true))
    
    try {
      await versionService.createVersion({
        documentId: currentDocument.id,
        title: documentTitle,
        content: currentDocument.content,
        commitMessage: versionCommitMessage || undefined,
        isMajorVersion: true
      })
      
      toast.success('Version created successfully')
      setShowVersionCommitDialog(false)
      setVersionCommitMessage('')
      
      // Save the document to ensure it's up to date
      await handleSaveDocument()
    } catch (error) {
      console.error('Failed to create version:', error)
      dispatch(setVersionError('Failed to create version'))
    } finally {
      dispatch(setIsCreatingVersion(false))
    }
  }, [currentDocument, documentTitle, versionCommitMessage, dispatch, handleSaveDocument])

  const handleVersionRestore = useCallback(async (versionId: string) => {
    // Refresh the document after version restore
    if (id) {
      await dispatch(fetchDocument(id))
      toast.success('Version restored successfully')
    }
  }, [id, dispatch])

  const handleVersionCompare = useCallback((versionFromId: string, versionToId: string) => {
    dispatch(setShowVersionHistory(false))
    dispatch(setShowVersionComparison(true))
    dispatch(setVersionComparisonIds({ from: versionFromId, to: versionToId }))
  }, [dispatch])

  const handleVersionView = useCallback((versionId: string) => {
    // For now, just open the version in comparison view with current
    if (currentDocument) {
      // Get the latest version ID (we'll need to fetch this)
      versionService.getVersionHistory(currentDocument.id).then(versions => {
        if (versions.length > 0) {
          const latestVersionId = versions[0].id
          handleVersionCompare(versionId, latestVersionId)
        }
      })
    }
  }, [currentDocument, handleVersionCompare])

  const handleCloseVersionComparison = useCallback(() => {
    dispatch(setShowVersionComparison(false))
    dispatch(setShowVersionHistory(true))
    dispatch(setVersionComparisonIds({ from: null, to: null }))
  }, [dispatch])

  const handleProfileSelection = async () => {
    if (selectedProfileId && currentDocument?.id) {
      await dispatch(associateProfileWithDocument({
        documentId: currentDocument.id,
        profileId: selectedProfileId
      }))
      setShowProfileSelector(false)
      toast.success('Style profile applied to document')
    }
  }

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
      {/* Navigation with save functionality and document info */}
      <Navigation 
        onSave={handleSaveDocument}
        isSaving={saving}
        showSaveButton={true}
        documentTitle={documentTitle}
        onTitleChange={setDocumentTitle}
        wordCount={currentDocument?.word_count || 0}
        isNewDocument={isNewDocument}
        suggestions={suggestions}
        documentId={currentDocument?.id}
        onShowVersionHistory={handleShowVersionHistory}
        onCreateVersion={handleCreateVersion}
        hasUnsavedChanges={false} // TODO: Track unsaved changes
      />

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

      {/* Version History Panel */}
      {showVersionHistory && currentDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Version History</h2>
              <button
                onClick={() => dispatch(setShowVersionHistory(false))}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <VersionHistoryPanel
                documentId={currentDocument.id}
                onVersionRestore={handleVersionRestore}
                onVersionCompare={handleVersionCompare}
                onVersionView={handleVersionView}
              />
            </div>
          </div>
        </div>
      )}

      {/* Version Comparison View */}
      {showVersionComparison && versionComparisonIds.from && versionComparisonIds.to && currentDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Version Comparison</h2>
              <button
                onClick={handleCloseVersionComparison}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <VersionComparisonView
                documentId={currentDocument.id}
                versionFromId={versionComparisonIds.from}
                versionToId={versionComparisonIds.to}
                onClose={handleCloseVersionComparison}
              />
            </div>
          </div>
        </div>
      )}

      {/* Create Version Dialog */}
      {showVersionCommitDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Create New Version
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Save a snapshot of your document at this point. You can always restore to this version later.
            </p>
            <div className="mb-6">
              <label htmlFor="commit-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Version Description (optional)
              </label>
              <textarea
                id="commit-message"
                value={versionCommitMessage}
                onChange={(e) => setVersionCommitMessage(e.target.value)}
                placeholder="Describe what changed in this version..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowVersionCommitDialog(false)
                  setVersionCommitMessage('')
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCreateVersion}
                disabled={isCreatingVersion}
                className="btn btn-primary btn-sm"
              >
                {isCreatingVersion ? 'Creating...' : 'Create Version'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Style Profile Selection Modal */}
      {showProfileSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Select Writing Style
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Choose a writing style for this document:
            </p>
            <div className="space-y-3 mb-6">
              {profiles.filter(p => !p.isCustom).map(profile => (
                <label 
                  key={profile.id}
                  className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <input
                    type="radio"
                    name="profile"
                    value={profile.id}
                    checked={selectedProfileId === profile.id || (!selectedProfileId && profile.id === activeProfile?.id)}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {profile.name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {profile.profileType}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowProfileSelector(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Skip
              </button>
              <button
                onClick={handleProfileSelection}
                disabled={!selectedProfileId}
                className="btn btn-primary btn-sm"
              >
                Apply Style
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EditorPage 