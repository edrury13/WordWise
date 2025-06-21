import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { RootState, AppDispatch } from '../store'
import { fetchDocument, createDocument, updateDocument } from '../store/slices/documentSlice'
import { setLastSaved } from '../store/slices/editorSlice'
import { 
  loadDocumentProfile, 
  associateProfileWithDocument, 
  selectProfiles,
  selectActiveProfile,
  autoDetectProfile 
} from '../store/slices/styleProfileSlice'
import { userPreferencesService } from '../services/userPreferencesService'
import GrammarTextEditor from '../components/GrammarTextEditor'
import LoadingSpinner from '../components/LoadingSpinner'
import Navigation from '../components/Navigation'
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
  
  const [documentTitle, setDocumentTitle] = useState('Untitled Document')
  const [isNewDocument, setIsNewDocument] = useState(!id)
  const [isCreatingDocument, setIsCreatingDocument] = useState(false)
  const [showProfileSelector, setShowProfileSelector] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [userPreferences, setUserPreferences] = useState<any>(null)
  const [hasDetectedProfile, setHasDetectedProfile] = useState(false)

  // Load user preferences
  useEffect(() => {
    if (user) {
      userPreferencesService.getUserPreferences(user.id).then(prefs => {
        setUserPreferences(prefs)
      })
    }
  }, [user])

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