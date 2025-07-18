import React, { useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { logoutUser } from '../store/slices/authSlice'
import { toggleDarkMode } from '../store/slices/editorSlice'
import { Moon, Sun, LogOut, Save, FileText, ChevronDown, User, History, GitBranch, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import DownloadMenu from './DownloadMenu'
import { Settings as SettingsIcon } from 'lucide-react'

interface NavigationProps {
  onSave?: () => void
  onSaveAsCopy?: () => void
  isSaving?: boolean
  showSaveButton?: boolean
  // Editor-specific props
  documentTitle?: string
  onTitleChange?: (title: string) => void
  wordCount?: number
  isNewDocument?: boolean
  suggestions?: any[]
  apiStatus?: {
    grammarChecking: boolean
    readabilityChecking: boolean
    sentenceAnalyzing: boolean
    gradeLevelChecking: boolean
    toneChecking: boolean
  }
  documentId?: string
  // Version control props
  onShowVersionHistory?: () => void
  onCreateVersion?: () => void
  hasUnsavedChanges?: boolean
}

const Navigation: React.FC<NavigationProps> = ({ 
  onSave, 
  onSaveAsCopy,
  isSaving = false, 
  showSaveButton = false,
  documentTitle,
  onTitleChange,
  wordCount = 0,
  isNewDocument = false,
  suggestions = [],
  apiStatus = {
    grammarChecking: false,
    readabilityChecking: false,
    sentenceAnalyzing: false,
    gradeLevelChecking: false,
    toneChecking: false
  },
  documentId,
  onShowVersionHistory,
  onCreateVersion
}) => {
  const dispatch = useDispatch<AppDispatch>()
  const location = useLocation()
  const { user } = useSelector((state: RootState) => state.auth)
  const { isDarkMode } = useSelector((state: RootState) => state.editor)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSaveMenu, setShowSaveMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const saveMenuRef = useRef<HTMLDivElement>(null)

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser())
      window.location.href = '/' // Redirect to landing page
      toast.success('Logged out successfully!')
    } catch (error) {
      toast.error('Failed to logout')
    }
  }

  const handleToggleDarkMode = () => {
    dispatch(toggleDarkMode())
  }

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onTitleChange) {
      onTitleChange(event.target.value)
    }
  }

  // Don't show navigation on login/register pages
  if (location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/') {
    return null
  }

  // Check if we're on an editor page
  const isEditorPage = location.pathname.startsWith('/editor')

  return (
    <nav className={`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm ${isEditorPage ? 'border-b-4 border-navy dark:border-blue-600' : ''}`}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className={`flex justify-between items-center ${isEditorPage ? 'h-20' : 'h-12'}`}>
          {/* Left side - Brand and Document Navigation */}
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-navy rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm academic-serif">W</span>
              </div>
              <span className="text-lg font-bold academic-serif text-navy dark:text-blue-400">WordWise</span>
            </Link>
            
            {/* Documents link - more prominent on editor page */}
            {isEditorPage && (
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <span>/</span>
                <Link
                  to="/dashboard"
                  className="text-navy dark:text-blue-400 hover:text-burgundy dark:hover:text-blue-300 font-medium transition-colors"
                >
                  Documents
                </Link>
              </div>
            )}
          </div>

          {/* Center - Document Title (only on editor page) */}
          {isEditorPage && documentTitle !== undefined && (
            <div className="flex-1 max-w-2xl mx-8">
              <input
                type="text"
                value={documentTitle}
                onChange={handleTitleChange}
                className="w-full text-2xl font-bold academic-serif text-navy dark:text-blue-400 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-navy dark:focus:ring-blue-600 focus:ring-opacity-20 rounded px-3 py-2 placeholder-academic-gray dark:placeholder-gray-400 text-center"
                placeholder="Document Title..."
              />
              
              {isNewDocument && (
                <div className="text-center mt-1">
                  <span className="text-sm text-gold dark:text-yellow-400 academic-sans font-medium bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded">
                    Draft Document
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Right side - Actions and Status */}
          <div className="flex items-center space-x-4">
            {/* Editor-specific status indicators */}
            {isEditorPage && (
              <div className="flex items-center space-x-3 text-sm academic-sans">
                {/* Word count */}
                {wordCount !== undefined && (
                  <div className="text-academic-gray dark:text-gray-300">
                    {wordCount} words
                  </div>
                )}
                
                {/* Writing Analysis Status */}
                {suggestions.length > 0 && (
                  <div className="flex items-center space-x-2 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded-full">
                    <div className="w-2 h-2 bg-gold dark:bg-yellow-400 rounded-full"></div>
                    <span className="text-navy dark:text-blue-400 font-medium">
                      {suggestions.length} analysis point{suggestions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                
                {/* API Status Indicator */}
                {Object.values(apiStatus).some(status => status) && (
                  <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium">
                    <div className="flex items-center space-x-1">
                      {Object.entries(apiStatus).map(([key, isActive]) => 
                        isActive && (
                          <div key={key} className="w-2 h-2 bg-gold dark:bg-yellow-600 rounded-full animate-pulse" />
                        )
                      )}
                    </div>
                    <span className="text-academic-gray dark:text-gray-400">Analyzing...</span>
                  </div>
                )}
              </div>
            )}

            {/* Save button (only on editor pages) */}
            {showSaveButton && (
              <div className="relative" ref={saveMenuRef}>
                {documentId && !isNewDocument ? (
                  // Show dropdown menu for existing documents
                  <>
                    <button
                      onClick={() => setShowSaveMenu(!showSaveMenu)}
                      disabled={isSaving}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        isSaving 
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-navy text-white hover:bg-burgundy dark:bg-blue-600 dark:hover:bg-blue-700'
                      }`}
                    >
                      <Save className="h-4 w-4" />
                      <span>{isSaving ? 'Saving...' : 'Save'}</span>
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    
                    {showSaveMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                        <button
                          onClick={() => {
                            onSave?.()
                            setShowSaveMenu(false)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                        >
                          <Save className="h-4 w-4" />
                          <span>Save</span>
                        </button>
                        <button
                          onClick={() => {
                            onSaveAsCopy?.()
                            setShowSaveMenu(false)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                        >
                          <Copy className="h-4 w-4" />
                          <span>Save as Copy</span>
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  // Simple save button for new documents
                  <button
                    onClick={onSave}
                    disabled={isSaving}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isSaving 
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-navy text-white hover:bg-burgundy dark:bg-blue-600 dark:hover:bg-blue-700'
                    }`}
                  >
                    <Save className="h-4 w-4" />
                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Download button (only on editor pages with saved documents) */}
            {isEditorPage && documentId && !isNewDocument && (
              <DownloadMenu
                documentId={documentId}
                documentTitle={documentTitle || 'Untitled Document'}
                buttonClassName="flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              />
            )}

            {/* Version control buttons (only on editor pages with saved documents) */}
            {isEditorPage && documentId && !isNewDocument && (
              <>
                {/* Create Version button */}
                {onCreateVersion && (
                  <button
                    onClick={onCreateVersion}
                    className="flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="Create a new version"
                  >
                    <GitBranch className="h-4 w-4" />
                    <span className="hidden lg:inline">Create Version</span>
                  </button>
                )}

                {/* Version History button */}
                {onShowVersionHistory && (
                  <button
                    onClick={onShowVersionHistory}
                    className="flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="View version history"
                  >
                    <History className="h-4 w-4" />
                    <span className="hidden lg:inline">Version History</span>
                  </button>
                )}
              </>
            )}

            {/* Documents link (only on non-editor pages) */}
            {!isEditorPage && (
              <Link
                to="/dashboard"
                className="flex items-center space-x-1 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-navy dark:hover:text-blue-400 transition-colors"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Documents</span>
              </Link>
            )}

            {/* Dark mode toggle */}
            <button
              onClick={handleToggleDarkMode}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-navy dark:hover:text-blue-400 transition-colors"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 text-academic-gray dark:text-gray-300 hover:text-navy dark:hover:text-blue-400 transition-colors"
              >
                <div className="w-8 h-8 bg-navy dark:bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
                <ChevronDown className="h-4 w-4" />
              </button>
              
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-semibold text-navy dark:text-blue-400">{user?.email}</p>
                  </div>
                  <Link
                    to="/preferences"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full px-4 py-2 text-left text-sm text-academic-gray dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  >
                    <SettingsIcon className="h-4 w-4" />
                    <span>Preferences</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-academic-gray dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navigation 