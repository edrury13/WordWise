import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Edit, Trash2, Calendar, ArrowUpDown, ArrowUp, ArrowDown, Keyboard, Command, Download, Upload, Search, Grid, List, Table, Clock, X, Sparkles } from 'lucide-react'
import { AppDispatch, RootState } from '../store'
import { fetchDocuments, deleteDocument, createDocument } from '../store/slices/documentSlice'
import { selectActiveProfile, associateProfileWithDocument } from '../store/slices/styleProfileSlice'
import LoadingSpinner from '../components/LoadingSpinner'
import Navigation from '../components/Navigation'
import DownloadMenu from '../components/DownloadMenu'
import UploadModal from '../components/UploadModal'
import { documentService } from '../services/documentService'
import { userPreferencesService } from '../services/userPreferencesService'
import toast from 'react-hot-toast'
import WritingInsights from '../components/WritingInsights'

type ViewMode = 'list' | 'grid' | 'table'

const Dashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const { user } = useSelector((state: RootState) => state.auth)
  const { documents, loading, error } = useSelector((state: RootState) => state.documents)
  const activeProfile = useSelector(selectActiveProfile)
  
  const [showNewDocModal, setShowNewDocModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'updated'>('updated')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [showOnboardingReminder, setShowOnboardingReminder] = useState(false)
  const [userPreferences, setUserPreferences] = useState<any>(null)

  useEffect(() => {
    if (user) {
      dispatch(fetchDocuments(user.id))
      // Check if user has completed onboarding
      checkOnboardingStatus()
    }
  }, [dispatch, user])

  useEffect(() => {
    if (error) {
      toast.error(error)
    }
  }, [error])

  const checkOnboardingStatus = async () => {
    if (user) {
      try {
        const prefs = await userPreferencesService.getUserPreferences(user.id)
        setUserPreferences(prefs)
        // Show reminder if user skipped onboarding
        if (prefs && prefs.onboardingSkipped && !prefs.onboardingCompleted) {
          setShowOnboardingReminder(true)
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
      }
    }
  }

  const handleCreateDocument = async () => {
    if (!newDocTitle.trim() || !user) return

    try {
      const result = await dispatch(createDocument({
        title: newDocTitle,
        content: '',
        userId: user.id
      }))

      if (createDocument.fulfilled.match(result)) {
        const newDocument = result.payload
        
        // Handle style profile association based on user preferences
        if (userPreferences) {
          // If auto-detect is enabled, we'll let the editor handle it when content is added
          // If always-ask is enabled, we'll navigate to editor which will prompt
          // Otherwise, use the active profile (which should be the default from preferences)
          if (!userPreferences.autoDetectStyle && !userPreferences.alwaysAskStyle && activeProfile && newDocument.id) {
            await dispatch(associateProfileWithDocument({
              documentId: newDocument.id,
              profileId: activeProfile.id
            }))
          }
        } else if (activeProfile && newDocument.id) {
          // Fallback: If no preferences loaded, use active profile
          await dispatch(associateProfileWithDocument({
            documentId: newDocument.id,
            profileId: activeProfile.id
          }))
        }
        
        setShowNewDocModal(false)
        setNewDocTitle('')
        toast.success('Document created successfully!')
        
        // Navigate with a flag if we need to prompt for style
        if (userPreferences?.alwaysAskStyle) {
          navigate(`/editor/${newDocument.id}?promptStyle=true`)
        } else {
          navigate(`/editor/${newDocument.id}`)
        }
      }
    } catch (error) {
      toast.error('Failed to create document')
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await dispatch(deleteDocument(documentId))
        toast.success('Document deleted successfully!')
      } catch (error) {
        toast.error('Failed to delete document')
      }
    }
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    // If less than 24 hours ago, show relative time
    if (diffInHours < 24) {
      if (diffInHours < 1) {
        const minutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
        return minutes <= 1 ? 'Just now' : `${minutes} minutes ago`
      }
      const hours = Math.floor(diffInHours)
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`
    }
    
    // If less than 7 days ago, show day and time
    if (diffInHours < 168) {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    // Otherwise show full date
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleSort = (field: 'name' | 'created' | 'updated') => {
    if (sortBy === field) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new field and default to desc for dates, asc for name
      setSortBy(field)
      setSortOrder(field === 'name' ? 'asc' : 'desc')
    }
  }

  const getFilteredAndSortedDocuments = () => {
    if (!documents || documents.length === 0) return []
    
    // Filter documents based on search query
    let filtered = documents
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = documents.filter((doc: any) =>
        doc.title.toLowerCase().includes(query) ||
        (doc.content && doc.content.toLowerCase().includes(query))
      )
    }
    
    // Sort filtered documents
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'name':
          comparison = a.title.toLowerCase().localeCompare(b.title.toLowerCase())
          break
        case 'created':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'updated':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
          break
        default:
          return 0
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
    
    return sorted
  }

  const getSortIcon = (field: 'name' | 'created' | 'updated') => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-3 w-3" />
    }
    return sortOrder === 'asc' ? 
      <ArrowUp className="h-3 w-3" /> : 
      <ArrowDown className="h-3 w-3" />
  }

  const getDocumentPreview = (content: string) => {
    if (!content) return 'No content yet...'
    return content.substring(0, 120) + (content.length > 120 ? '...' : '')
  }

  const getDocumentType = (content: string, wordCount: number) => {
    if (!content || wordCount < 100) return 'Draft'
    if (wordCount < 500) return 'Short Form'
    if (wordCount < 2000) return 'Article'
    if (wordCount < 5000) return 'Long Form'
    return 'Research Paper'
  }

  const getReadingTime = (wordCount: number) => {
    const wordsPerMinute = 200
    const minutes = Math.ceil(wordCount / wordsPerMinute)
    return minutes < 1 ? '< 1 min read' : `${minutes} min read`
  }

  if (loading && documents.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-900">
      <Navigation />
      
      {/* Onboarding Reminder */}
      {showOnboardingReminder && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-lg shadow-md border border-primary-200 dark:border-primary-800 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Complete Your Personalization
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Take 2 minutes to personalize WordWise for your writing needs. Get tailored suggestions, 
                    default style profiles, and features customized just for you.
                  </p>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => navigate('/onboarding')}
                      className="btn btn-primary btn-sm flex items-center space-x-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Start Personalization</span>
                    </button>
                    <button
                      onClick={() => setShowOnboardingReminder(false)}
                      className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Remind me later
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowOnboardingReminder(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content - Academic Layout */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Research Overview */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold academic-serif text-navy dark:text-blue-400 mb-6">Research Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-navy dark:border-blue-600">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-navy dark:bg-blue-600 rounded-lg flex items-center justify-center">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-academic-gray dark:text-gray-300 academic-sans">
                    Research Documents
                  </p>
                  <p className="text-2xl font-bold academic-serif text-navy dark:text-blue-400">
                    {documents.length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-burgundy dark:border-red-600">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-burgundy dark:bg-red-600 rounded-lg flex items-center justify-center">
                  <Edit className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-academic-gray dark:text-gray-300 academic-sans">
                    Total Words Written
                  </p>
                  <p className="text-2xl font-bold academic-serif text-navy dark:text-blue-400">
                    {documents.reduce((total: number, doc: any) => total + doc.word_count, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-gold dark:border-yellow-600">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gold dark:bg-yellow-600 rounded-lg flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-academic-gray dark:text-gray-300 academic-sans">
                    Active Projects
                  </p>
                  <p className="text-2xl font-bold academic-serif text-navy dark:text-blue-400">
                    {documents.filter((doc: any) => {
                      const lastUpdated = new Date(doc.updated_at)
                      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      return lastUpdated > weekAgo
                    }).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Writing Insights - Compact View */}
        <div className="mb-8">
          <WritingInsights compact />
        </div>

        {/* Document Library Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
                <div>
                  <h2 className="text-2xl font-bold academic-serif text-navy dark:text-blue-400">
                    Document Library
                  </h2>
                  <p className="text-academic-gray dark:text-gray-300 academic-sans mt-1">
                    Manage your research papers and academic writing projects
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="btn btn-secondary flex items-center justify-center space-x-2 academic-sans font-semibold"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload</span>
                  </button>
                  
                  <button
                    onClick={() => setShowNewDocModal(true)}
                    className="btn btn-primary flex items-center justify-center space-x-2 academic-sans font-semibold"
                  >
                    <Plus className="h-4 w-4" />
                    <span>New Document</span>
                  </button>
                </div>
              </div>

              {/* Search and Controls Bar */}
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy dark:focus:ring-blue-600 dark:bg-gray-700 dark:text-gray-100 academic-sans"
                  />
                  {searchQuery && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">
                      {getFilteredAndSortedDocuments().length} result{getFilteredAndSortedDocuments().length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-4">
                  {/* View Mode Toggles */}
                  <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                      title="List View"
                    >
                      <List className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                      title="Grid View"
                    >
                      <Grid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                      title="Table View"
                    >
                      <Table className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Sort Controls */}
                  {documents.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Sort:</span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleSort('name')}
                          className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-md transition-colors ${
                            sortBy === 'name'
                              ? 'bg-navy text-white dark:bg-blue-600'
                              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <span>Name</span>
                          {getSortIcon('name')}
                        </button>
                        
                        <button
                          onClick={() => handleSort('updated')}
                          className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-md transition-colors ${
                            sortBy === 'updated'
                              ? 'bg-navy text-white dark:bg-blue-600'
                              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <span>Updated</span>
                          {getSortIcon('updated')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Additional Actions */}
                  {documents.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={async () => {
                          try {
                            await documentService.exportAllDocuments()
                            toast.success('All documents exported successfully!')
                          } catch (error) {
                            toast.error('Failed to export documents')
                          }
                        }}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-navy dark:hover:text-blue-400 transition-colors"
                        title="Export All Documents"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-navy dark:hover:text-blue-400 transition-colors"
                        title="Keyboard Shortcuts"
                      >
                        <Keyboard className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {getFilteredAndSortedDocuments().length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-20 h-20 bg-cream dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileText className="h-10 w-10 text-navy dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold academic-serif text-navy dark:text-blue-400 mb-3">
                {searchQuery ? 'No documents found' : 'Your Research Library Awaits'}
              </h3>
              <p className="text-academic-gray dark:text-gray-300 academic-sans mb-8 max-w-md mx-auto leading-relaxed">
                {searchQuery ? `No documents match "${searchQuery}". Try adjusting your search terms.` : 'Begin your academic writing journey by creating your first research document. Our advanced analysis tools will help refine your scholarly work.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowNewDocModal(true)}
                  className="btn btn-primary flex items-center justify-center mx-auto academic-sans font-semibold"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Document
                </button>
              )}
            </div>
          ) : (
            <div className="p-6">
              {/* List View */}
              {viewMode === 'list' && (
                <div className="space-y-4">
                  {getFilteredAndSortedDocuments().map((document: any) => (
                    <div
                      key={document.id}
                      className="document-card p-6"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-start space-x-4 mb-4">
                            <div className="w-12 h-12 bg-navy dark:bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h3 className="text-lg font-semibold academic-serif text-navy dark:text-blue-400">
                                  {document.title}
                                </h3>
                                <span className={`px-2 py-1 text-xs rounded-full text-white font-medium ${
                                  getDocumentType(document.content, document.word_count) === 'Draft' ? 'bg-red-500' :
                                  getDocumentType(document.content, document.word_count) === 'Short Form' ? 'bg-yellow-500' :
                                  getDocumentType(document.content, document.word_count) === 'Article' ? 'bg-blue-500' :
                                  'bg-green-500'
                                }`}>
                                  {getDocumentType(document.content, document.word_count)}
                                </span>
                              </div>
                              
                              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 leading-relaxed">
                                {getDocumentPreview(document.content)}
                              </p>
                              
                              <div className="flex items-center space-x-6 text-sm text-academic-gray dark:text-gray-400 academic-sans">
                                <span className="flex items-center">
                                  <Edit className="h-3 w-3 mr-1" />
                                  {document.word_count.toLocaleString()} words
                                </span>
                                <span className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {getReadingTime(document.word_count)}
                                </span>
                                <span className="flex items-center">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {formatDateTime(document.updated_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => navigate(`/editor/${document.id}`)}
                            className="p-2 text-navy dark:text-blue-400 hover:text-burgundy dark:hover:text-blue-300 transition-colors"
                            title="Edit document"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <DownloadMenu
                            documentId={document.id}
                            documentTitle={document.title}
                            iconOnly={true}
                          />
                          <button
                            onClick={() => handleDeleteDocument(document.id)}
                            className="p-2 text-academic-gray dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Delete document"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Grid View */}
              {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getFilteredAndSortedDocuments().map((document: any) => (
                    <div
                      key={document.id}
                      className="document-card p-6 cursor-pointer"
                      onClick={() => navigate(`/editor/${document.id}`)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-navy dark:bg-blue-600 rounded-lg flex items-center justify-center">
                          <FileText className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex items-center space-x-1">
                          <DownloadMenu
                            documentId={document.id}
                            documentTitle={document.title}
                            iconOnly={true}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteDocument(document.id)
                            }}
                            className="p-1 text-academic-gray dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Delete document"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-lg font-semibold academic-serif text-navy dark:text-blue-400 line-clamp-1">
                            {document.title}
                          </h3>
                        </div>
                        <span className={`inline-block px-2 py-1 text-xs rounded-full text-white font-medium mb-3 ${
                          getDocumentType(document.content, document.word_count) === 'Draft' ? 'bg-red-500' :
                          getDocumentType(document.content, document.word_count) === 'Short Form' ? 'bg-yellow-500' :
                          getDocumentType(document.content, document.word_count) === 'Article' ? 'bg-blue-500' :
                          'bg-green-500'
                        }`}>
                          {getDocumentType(document.content, document.word_count)}
                        </span>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed line-clamp-3">
                          {getDocumentPreview(document.content)}
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-academic-gray dark:text-gray-400">
                          <span className="flex items-center">
                            <Edit className="h-3 w-3 mr-1" />
                            {document.word_count.toLocaleString()} words
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {getReadingTime(document.word_count)}
                          </span>
                        </div>
                        
                        <div className="text-xs text-academic-gray dark:text-gray-400">
                          Updated {formatDateTime(document.updated_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Table View */}
              {viewMode === 'table' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-4 font-semibold text-academic-gray dark:text-gray-300">Document</th>
                        <th className="text-left py-3 px-4 font-semibold text-academic-gray dark:text-gray-300">Type</th>
                        <th className="text-left py-3 px-4 font-semibold text-academic-gray dark:text-gray-300">Words</th>
                        <th className="text-left py-3 px-4 font-semibold text-academic-gray dark:text-gray-300">Updated</th>
                        <th className="text-left py-3 px-4 font-semibold text-academic-gray dark:text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredAndSortedDocuments().map((document: any) => (
                        <tr 
                          key={document.id} 
                          className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-navy dark:bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <FileText className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-navy dark:text-blue-400">
                                  {document.title}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">
                                  {getDocumentPreview(document.content)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-1 text-xs rounded-full text-white font-medium ${
                              getDocumentType(document.content, document.word_count) === 'Draft' ? 'bg-red-500' :
                              getDocumentType(document.content, document.word_count) === 'Short Form' ? 'bg-yellow-500' :
                              getDocumentType(document.content, document.word_count) === 'Article' ? 'bg-blue-500' :
                              'bg-green-500'
                            }`}>
                              {getDocumentType(document.content, document.word_count)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">
                            {document.word_count.toLocaleString()}
                          </td>
                          <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">
                            {formatDateTime(document.updated_at)}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => navigate(`/editor/${document.id}`)}
                                className="p-1 text-navy dark:text-blue-400 hover:text-burgundy dark:hover:text-blue-300 transition-colors"
                                title="Edit document"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <DownloadMenu
                                documentId={document.id}
                                documentTitle={document.title}
                                iconOnly={true}
                              />
                              <button
                                onClick={() => handleDeleteDocument(document.id)}
                                className="p-1 text-academic-gray dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                title="Delete document"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Keyboard Shortcuts Section */}
        {showKeyboardShortcuts && (
          <div className="mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-navy dark:bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                    <Keyboard className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold academic-serif text-navy dark:text-blue-400">Editor Shortcuts</h3>
                    <p className="text-sm text-academic-gray dark:text-gray-300 academic-sans">Boost your productivity with these keyboard shortcuts</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowKeyboardShortcuts(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Document Management */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-navy dark:text-blue-400 academic-sans text-sm uppercase tracking-wide border-b border-gray-200 dark:border-gray-600 pb-1">
                    Document Management
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Save Document</span>
                      <div className="flex items-center space-x-1">
                        <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">Ctrl</kbd>
                        <span className="text-xs text-gray-400 dark:text-gray-500">+</span>
                        <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">S</kbd>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">New Document</span>
                      <div className="flex items-center space-x-1">
                        <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">Ctrl</kbd>
                        <span className="text-xs text-gray-400 dark:text-gray-500">+</span>
                        <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">N</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Text Editing */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-navy dark:text-blue-400 academic-sans text-sm uppercase tracking-wide border-b border-gray-200 dark:border-gray-600 pb-1">
                    Text Editing
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Undo</span>
                      <div className="flex items-center space-x-1">
                        <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">Ctrl</kbd>
                        <span className="text-xs text-gray-400 dark:text-gray-500">+</span>
                        <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">Z</kbd>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Find & Replace</span>
                      <div className="flex items-center space-x-1">
                        <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">Ctrl</kbd>
                        <span className="text-xs text-gray-400 dark:text-gray-500">+</span>
                        <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">H</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grammar & Analysis */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-navy dark:text-blue-400 academic-sans text-sm uppercase tracking-wide border-b border-gray-200 dark:border-gray-600 pb-1">
                    Grammar & Analysis
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Recheck Grammar</span>
                      <div className="flex items-center space-x-1">
                        <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">F7</kbd>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Accept Suggestion</span>
                      <div className="flex items-center space-x-1">
                        <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">Tab</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pro Tip */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 dark:bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Command className="h-3 w-3 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-300 academic-sans text-sm mb-1">Pro Tip</h4>
                    <p className="text-sm text-blue-800 dark:text-blue-200 academic-sans leading-relaxed">
                      Use <kbd className="px-1.5 py-0.5 text-xs bg-white dark:bg-blue-800 border border-blue-300 dark:border-blue-600 rounded mx-1 text-blue-800 dark:text-blue-200">Ctrl + /</kbd> 
                      in the editor to see all available shortcuts, or hover over buttons to see their keyboard shortcuts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* New Document Modal */}
      {showNewDocModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold academic-serif text-navy dark:text-blue-400 mb-4">
              Create New Document
            </h3>
            <input
              type="text"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="Document Title"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy dark:focus:ring-blue-600 dark:bg-gray-700 dark:text-gray-100"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateDocument()}
              autoFocus
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowNewDocModal(false)
                  setNewDocTitle('')
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDocument}
                disabled={!newDocTitle.trim()}
                className="px-4 py-2 bg-navy text-white hover:bg-burgundy dark:bg-blue-600 dark:hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        userId={user?.id || ''}
      />
    </div>
  )
}

export default Dashboard 