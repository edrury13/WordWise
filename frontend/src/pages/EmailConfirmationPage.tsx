import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, CheckCircle, RefreshCw } from 'lucide-react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'

interface EmailConfirmationPageProps {
  email?: string
}

const EmailConfirmationPage: React.FC<EmailConfirmationPageProps> = ({ email }) => {
  const [isResending, setIsResending] = useState(false)
  const [resendCount, setResendCount] = useState(0)
  
  // Get email from URL params or localStorage if not passed as prop
  const userEmail = email || new URLSearchParams(window.location.search).get('email') || localStorage.getItem('pendingConfirmationEmail')

  const handleResendConfirmation = async () => {
    if (!userEmail) {
      toast.error('Email address not found. Please try registering again.')
      return
    }

    if (resendCount >= 3) {
      toast.error('Maximum resend attempts reached. Please try again later.')
      return
    }

    setIsResending(true)
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail
      })

      if (error) throw error

      setResendCount(prev => prev + 1)
      toast.success('Confirmation email sent! Please check your inbox.')
    } catch (error) {
      console.error('Resend error:', error)
      toast.error('Failed to resend confirmation email. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900 mb-6">
            <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
            Check Your Email
          </h2>
          
          {userEmail ? (
            <>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                We've sent a confirmation link to:
              </p>
              
              <p className="text-lg font-medium text-blue-600 dark:text-blue-400 mb-6">
                {userEmail}
              </p>
            </>
          ) : (
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Please check your email for a confirmation link.
            </p>
          )}
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                  What's next?
                </p>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Check your email inbox (and spam folder)</li>
                  <li>• Click the confirmation link in the email</li>
                  <li>• You'll be redirected to sign in</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Resend Email Button - only show if we have an email */}
          {userEmail && (
            <button
              onClick={handleResendConfirmation}
              disabled={isResending || resendCount >= 3}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isResending ? (
                <>
                  <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="-ml-1 mr-2 h-4 w-4" />
                  {resendCount > 0 ? `Resend Email (${3 - resendCount} left)` : 'Resend Confirmation Email'}
                </>
              )}
            </button>
          )}

          {resendCount >= 3 && (
            <p className="text-center text-sm text-red-600 dark:text-red-400">
              Maximum resend attempts reached. Please try again in a few minutes.
            </p>
          )}

          {/* Navigation Links */}
          <div className="text-center space-y-2">
            <Link
              to="/login"
              className="block text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
            >
              ← Back to Sign In
            </Link>
            
            {!userEmail && (
              <Link
                to="/register"
                className="block text-sm text-gray-600 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                Need to register? Create an account
              </Link>
            )}
          </div>

          {/* Help Text */}
          <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Didn't receive the email? Check your spam folder or try resending.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Need help? <a href="mailto:support@wordwise.com" className="text-blue-600 dark:text-blue-400 hover:underline">Contact Support</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailConfirmationPage 