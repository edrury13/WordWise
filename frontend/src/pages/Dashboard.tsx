import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Edit, Trash2, Calendar, LogOut, Moon, Sun, ArrowUpDown, ArrowUp, ArrowDown, Keyboard, Command } from 'lucide-react'
import { AppDispatch } from '../store'
import { fetchDocuments, deleteDocument, createDocument } from '../store/slices/documentSlice'
import { logoutUser } from '../store/slices/authSlice'
import { toggleDarkMode } from '../store/slices/editorSlice'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

const Dashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const { user } = useSelector((state: any) => state.auth)
  const { documents, loading, error } = useSelector((state: any) => state.documents)
  const { isDarkMode } = useSelector((state: any) => state.editor)
  
  const [showNewDocModal, setShowNewDocModal] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'updated'>('updated')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    if (user) {
      dispatch(fetchDocuments(user.id))
    }
  }, [dispatch, user])

  useEffect(() => {
    if (error) {
      toast.error(error)
    }
  }, [error])

  const handleCreateDocument = async () => {
    if (!newDocTitle.trim() || !user) return

    try {
      const result = await dispatch(createDocument({
        title: newDocTitle,
        content: '',
        userId: user.id
      }))

      if (createDocument.fulfilled.match(result)) {
        setShowNewDocModal(false)
        setNewDocTitle('')
        toast.success('Document created successfully!')
        navigate(`/editor/${result.payload.id}`)
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

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser())
      navigate('/login')
      toast.success('Logged out successfully!')
    } catch (error) {
      toast.error('Failed to logout')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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

  const getSortedDocuments = () => {
    if (!documents || documents.length === 0) return []
    
    const sorted = [...documents].sort((a, b) => {
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

  if (loading && documents.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-900">
      {/* Academic Header */}
      <header className="bg-white dark:bg-gray-800 border-b-4 border-navy dark:border-blue-600 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-navy rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl academic-serif">W</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold academic-serif text-navy dark:text-blue-400">
                  Research Dashboard
                </h1>
                <p className="text-academic-gray dark:text-gray-300 academic-sans">
                  {user?.email} • Academic Writing Environment
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <button
                onClick={() => dispatch(toggleDarkMode())}
                className="p-2 text-navy dark:text-blue-400 hover:text-burgundy dark:hover:text-blue-300 transition-colors"
              >
                {isDarkMode ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </button>
              
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-navy dark:text-blue-400 hover:text-burgundy dark:hover:text-blue-300 transition-colors academic-sans font-medium"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

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

        {/* Document Library Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-700">
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
                {/* Sort Controls */}
                {documents.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleSort('name')}
                        className={`flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors ${
                          sortBy === 'name'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                      >
                        <span>Name</span>
                        {getSortIcon('name')}
                      </button>
                      
                      <button
                        onClick={() => handleSort('created')}
                        className={`flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors ${
                          sortBy === 'created'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                      >
                        <span>Created</span>
                        {getSortIcon('created')}
                      </button>
                      
                      <button
                        onClick={() => handleSort('updated')}
                        className={`flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors ${
                          sortBy === 'updated'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                      >
                        <span>Updated</span>
                        {getSortIcon('updated')}
                      </button>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={() => setShowNewDocModal(true)}
                  className="btn btn-primary flex items-center justify-center space-x-2 academic-sans font-semibold"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Research Document</span>
                </button>
              </div>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-20 h-20 bg-cream dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileText className="h-10 w-10 text-navy dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold academic-serif text-navy dark:text-blue-400 mb-3">
                Your Research Library Awaits
              </h3>
              <p className="text-academic-gray dark:text-gray-300 academic-sans mb-8 max-w-md mx-auto leading-relaxed">
                Begin your academic writing journey by creating your first research document. 
                Our advanced analysis tools will help refine your scholarly work.
              </p>
              <button
                onClick={() => setShowNewDocModal(true)}
                className="btn btn-primary flex items-center justify-center mx-auto academic-sans font-semibold"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Document
              </button>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid gap-4">
                {getSortedDocuments().map((document: any) => (
                  <div
                    key={document.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg hover:border-navy dark:hover:border-blue-600 transition-all duration-200"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-start space-x-3 mb-3">
                          <div className="w-10 h-10 bg-navy dark:bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold academic-serif text-navy dark:text-blue-400 mb-1">
                              {document.title}
                            </h3>
                            <div className="flex items-center space-x-4 text-sm text-academic-gray dark:text-gray-300 academic-sans">
                              <span className="flex items-center">
                                <Edit className="h-3 w-3 mr-1" />
                                {document.word_count} words
                              </span>
                              <span>{document.character_count} characters</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-xs text-academic-gray dark:text-gray-400 academic-sans mt-2">
                              <span className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                Created: {formatDate(document.created_at)}
                              </span>
                              <span className="flex items-center">
                                <Edit className="h-3 w-3 mr-1" />
                                Modified: {formatDateTime(document.updated_at)}
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
            </div>
          )}
        </div>

        {/* Keyboard Shortcuts Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold academic-serif text-navy dark:text-blue-400 mb-6">Keyboard Shortcuts</h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-navy dark:bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                <Keyboard className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold academic-serif text-navy dark:text-blue-400">Editor Shortcuts</h3>
                <p className="text-sm text-academic-gray dark:text-gray-300 academic-sans">Boost your productivity with these keyboard shortcuts</p>
              </div>
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
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Print Document</span>
                    <div className="flex items-center space-x-1">
                      <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">Ctrl</kbd>
                      <span className="text-xs text-gray-400 dark:text-gray-500">+</span>
                      <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">P</kbd>
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
                    <span className="text-sm text-gray-700 dark:text-gray-300">Redo</span>
                    <div className="flex items-center space-x-1">
                      <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">Ctrl</kbd>
                      <span className="text-xs text-gray-400 dark:text-gray-500">+</span>
                      <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">Y</kbd>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Select All</span>
                    <div className="flex items-center space-x-1">
                      <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">Ctrl</kbd>
                      <span className="text-xs text-gray-400 dark:text-gray-500">+</span>
                      <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">A</kbd>
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
                    <span className="text-sm text-gray-700 dark:text-gray-300">Toggle Analysis Panel</span>
                    <div className="flex items-center space-x-1">
                      <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">Ctrl</kbd>
                      <span className="text-xs text-gray-400 dark:text-gray-500">+</span>
                      <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">;</kbd>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Accept Suggestion</span>
                    <div className="flex items-center space-x-1">
                      <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">Tab</kbd>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Ignore Suggestion</span>
                    <div className="flex items-center space-x-1">
                      <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">Esc</kbd>
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
      </main>

      {/* New Document Modal */}
      {showNewDocModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Create New Document
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Document Title
              </label>
              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="Enter document title..."
                className="input w-full"
                autoFocus
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowNewDocModal(false)
                  setNewDocTitle('')
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDocument}
                disabled={!newDocTitle.trim()}
                className="btn btn-primary"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard 