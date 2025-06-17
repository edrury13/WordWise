import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Eye, EyeOff, Mail, Lock, X } from 'lucide-react'
import { supabase } from '../config/supabase'
import { loginUser, loginWithGoogle, clearError } from '../store/slices/authSlice'
import { AppDispatch, RootState } from '../store'
import LoadingSpinner from '../components/LoadingSpinner'

const LoginPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const { loading, error } = useSelector((state: RootState) => state.auth)
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Don't clear error on input change - let it persist until next login attempt
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email || !formData.password) return
    
    try {
      console.log('🔐 Attempting login for:', formData.email)
      const result = await dispatch(loginUser({
        email: formData.email,
        password: formData.password
      }))
      
      console.log('📋 Login result:', result)
      
      if (loginUser.fulfilled.match(result)) {
        console.log('✅ Login successful, navigating to dashboard')
        navigate('/dashboard')
      } else if (loginUser.rejected.match(result)) {
        console.log('❌ Login rejected:', result.payload)
        // Check if it's an email confirmation issue
        if (typeof result.payload === 'string' && 
            (result.payload.includes('email') || 
             result.payload.includes('confirm') || 
             result.payload.includes('verify'))) {
          console.log('📧 Email verification may be required')
        }
      }
    } catch (error) {
      console.error('Login error:', error)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      const result = await dispatch(loginWithGoogle())
      if (loginWithGoogle.fulfilled.match(result)) {
        navigate('/dashboard')
      }
    } catch (error) {
      console.error('Google login error:', error)
    }
  }

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      setResetMessage('Please enter your email address')
      return
    }

    setResetLoading(true)
    setResetMessage('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (error) {
        setResetMessage(`Error: ${error.message}`)
      } else {
        setResetMessage('Password reset email sent! Check your inbox.')
      }
    } catch (error) {
      setResetMessage('Failed to send password reset email')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Academic Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-navy rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-2xl academic-serif">W</span>
            </div>
          </div>
          <h2 className="text-4xl font-bold academic-serif text-navy mb-2">
            WordWise
          </h2>
          <h3 className="text-xl academic-serif text-burgundy mb-4">
            Academic Writing Platform
          </h3>
          <p className="text-sm text-academic-gray academic-sans">
            Access your research library and continue your scholarly work
          </p>
        </div>
        
        <form className="mt-8 space-y-6 bg-white p-8 rounded-lg shadow-lg border border-gray-200" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
              <div className="flex justify-between items-start">
                <div className="text-sm flex-1">
                  {error}
                  {(error.toLowerCase().includes('email') || 
                    error.toLowerCase().includes('confirm') || 
                    error.toLowerCase().includes('verify')) && (
                    <div className="mt-2 text-xs">
                      <p>💡 <strong>Need to verify your email?</strong></p>
                      <p>Check your inbox and click the verification link, then try logging in again.</p>
                    </div>
                  )}
                  {error.toLowerCase().includes('invalid') && (
                    <div className="mt-2 text-xs">
                      <p>💡 <strong>Can't log in?</strong></p>
                      <p>• Double-check your email and password</p>
                      <p>• Make sure you've verified your email address</p>
                      <p>• Try resetting your password if needed</p>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dispatch(clearError())}
                  className="ml-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                  title="Dismiss error"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input pl-10"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="input pl-10 pr-10"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full academic-sans font-semibold"
            >
              {loading ? (
                <LoadingSpinner size="small" />
              ) : (
                'Access Research Library'
              )}
            </button>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="ml-2">Sign in with Google</span>
              </button>
            </div>
          </div>

          <div className="text-center">
            <span className="text-sm text-academic-gray academic-sans">
              New to the academic community?{' '}
              <Link
                to="/register"
                className="font-medium text-navy hover:text-burgundy transition-colors"
              >
                Join WordWise
              </Link>
            </span>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-navy hover:text-burgundy transition-colors academic-sans"
              >
                Reset your password
              </button>
            </div>
          </div>
        </form>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Reset Password
              </h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="input w-full"
                />
              </div>

              {resetMessage && (
                <div className={`mb-4 p-3 rounded text-sm ${
                  resetMessage.includes('Error') 
                    ? 'bg-red-50 text-red-700 border border-red-200' 
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {resetMessage}
                </div>
              )}
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowForgotPassword(false)
                    setResetEmail('')
                    setResetMessage('')
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleForgotPassword}
                  disabled={resetLoading || !resetEmail}
                  className="btn btn-primary"
                >
                  {resetLoading ? <LoadingSpinner size="small" /> : 'Send Reset Email'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LoginPage 