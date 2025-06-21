import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { supabase } from './config/supabase'
import { setAuth } from './store/slices/authSlice'
import { initializeDarkMode } from './store/slices/editorSlice'
import { loadUserDefaultProfile } from './store/slices/styleProfileSlice'
import { RootState, AppDispatch } from './store'

// Components
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import EmailConfirmationPage from './pages/EmailConfirmationPage'
import Dashboard from './pages/Dashboard'
import EditorPage from './pages/EditorPage'
import OnboardingPage from './pages/OnboardingPage'
import TutorialPage from './pages/TutorialPage'
import LoadingSpinner from './components/LoadingSpinner'
import ProtectedRoute from './components/ProtectedRoute'
import GrammarTestPanel from './components/GrammarTestPanel'
import AuthDebug from './components/AuthDebug'

function App() {
  const dispatch = useDispatch<AppDispatch>()
  const { isAuthenticated, loading: authLoading, user } = useSelector((state: RootState) => state.auth)
  const [initialLoading, setInitialLoading] = React.useState(true)

  useEffect(() => {
    // Initialize dark mode from localStorage
    dispatch(initializeDarkMode())
    
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        dispatch(setAuth({ user: session.user, session }))
        // Load user's default style profile
        dispatch(loadUserDefaultProfile(session.user.id))
      }
      setInitialLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          dispatch(setAuth({ user: session?.user || null, session }))
          
          // Load user's default style profile when signing in
          if (event === 'SIGNED_IN' && session?.user) {
            dispatch(loadUserDefaultProfile(session.user.id))
          }
          
          // Clean up pending confirmation email when user successfully signs in
          if (event === 'SIGNED_IN') {
            localStorage.removeItem('pendingConfirmationEmail')
          }
        } else if (event === 'SIGNED_OUT') {
          dispatch(setAuth({ user: null, session: null }))
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [dispatch])

  // Load user's default profile when user changes (e.g., after completing onboarding)
  useEffect(() => {
    if (user?.id) {
      dispatch(loadUserDefaultProfile(user.id))
    }
  }, [user?.id, dispatch])

  if (initialLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return (
    <div className="App">
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
          } 
        />
        <Route 
          path="/register" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />
          } 
        />
        <Route 
          path="/confirm-email" 
          element={<EmailConfirmationPage />} 
        />

        {/* Protected routes */}
        <Route 
          path="/onboarding" 
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tutorial" 
          element={
            <ProtectedRoute>
              <TutorialPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/editor/:id" 
          element={
            <ProtectedRoute>
              <EditorPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/editor" 
          element={
            <ProtectedRoute>
              <EditorPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/test-grammar" 
          element={
            <ProtectedRoute>
              <GrammarTestPanel />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/debug-auth" 
          element={<AuthDebug />} 
        />

        {/* Landing page for unauthenticated users, dashboard for authenticated */}
        <Route 
          path="/" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />
          } 
        />

        {/* Catch all route */}
        <Route 
          path="*" 
          element={
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                  404 - Page Not Found
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  The page you're looking for doesn't exist.
                </p>
                <button 
                  onClick={() => window.history.back()}
                  className="btn btn-primary"
                >
                  Go Back
                </button>
              </div>
            </div>
          } 
        />
      </Routes>
    </div>
  )
}

export default App 