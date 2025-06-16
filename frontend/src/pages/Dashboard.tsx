import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Edit, Trash2, Calendar, User, LogOut, Moon, Sun } from 'lucide-react'
import { RootState, AppDispatch } from '../store'
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

  if (loading && documents.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                WordWise
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Welcome back, {user?.email}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => dispatch(toggleDarkMode())}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {isDarkMode ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </button>
              
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Documents
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {documents.length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Edit className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Words
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {documents.reduce((total: number, doc: any) => total + doc.word_count, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex items-center">
              <User className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Account Type
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  Free
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Your Documents
              </h2>
              <button
                onClick={() => setShowNewDocModal(true)}
                className="btn btn-primary flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>New Document</span>
              </button>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No documents yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Create your first document to get started with WordWise
              </p>
              <button
                onClick={() => setShowNewDocModal(true)}
                className="btn btn-primary"
              >
                Create Document
              </button>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid gap-4">
                {documents.map((document: any) => (
                  <div
                    key={document.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          {document.title}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                          <span>{document.word_count} words</span>
                          <span>{document.character_count} characters</span>
                          <span className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {formatDate(document.updated_at)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => navigate(`/editor/${document.id}`)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit document"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(document.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
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