import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { logoutUser } from '../store/slices/authSlice'
import { toggleDarkMode } from '../store/slices/editorSlice'
import { Moon, Sun, LogOut, Save, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

interface NavigationProps {
  onSave?: () => void
  isSaving?: boolean
  showSaveButton?: boolean
}

const Navigation: React.FC<NavigationProps> = ({ onSave, isSaving, showSaveButton = false }) => {
  const dispatch = useDispatch<AppDispatch>()
  const location = useLocation()
  const { user } = useSelector((state: RootState) => state.auth)
  const { isDarkMode } = useSelector((state: RootState) => state.editor)

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

  // Don't show navigation on login/register pages
  if (location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/') {
    return null
  }

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-12">
          {/* Left side - Brand */}
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-navy rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm academic-serif">W</span>
              </div>
              <span className="text-lg font-bold academic-serif text-navy dark:text-blue-400">WordWise</span>
            </Link>
          </div>

          {/* Center - Save button (only on editor pages) */}
          {showSaveButton && (
            <div className="flex items-center">
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
            </div>
          )}

          {/* Right side - Actions */}
          <div className="flex items-center space-x-4">
            {/* Documents link */}
            <Link
              to="/dashboard"
              className="flex items-center space-x-1 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-navy dark:hover:text-blue-400 transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Documents</span>
            </Link>

            {/* Dark mode toggle */}
            <button
              onClick={handleToggleDarkMode}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-navy dark:hover:text-blue-400 transition-colors"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* User menu */}
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600 dark:text-gray-300 hidden sm:inline">
                {user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navigation 