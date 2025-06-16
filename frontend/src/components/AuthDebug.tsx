import React, { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'
import { useSelector } from 'react-redux'
import { RootState } from '../store'

const AuthDebug: React.FC = () => {
  const [session, setSession] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [testEmail, setTestEmail] = useState('')
  const [testPassword, setTestPassword] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  
  const authState = useSelector((state: RootState) => state.auth)

  useEffect(() => {
    // Get current session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: { user } } = await supabase.auth.getUser()
      setSession(session)
      setUser(user)
    }
    getSession()
  }, [])

  const testLogin = async () => {
    if (!testEmail || !testPassword) return
    
    setLoading(true)
    setTestResult(null)
    
    try {
      console.log('🧪 Testing direct Supabase login...')
      const { data, error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword
      })
      
      console.log('📊 Supabase login test result:', { data, error })
      setTestResult({ data, error })
    } catch (err) {
      console.error('🚨 Login test error:', err)
      setTestResult({ error: err })
    } finally {
      setLoading(false)
    }
  }

  const testRegistration = async () => {
    if (!testEmail || !testPassword) return
    
    setLoading(true)
    setTestResult(null)
    
    try {
      console.log('🧪 Testing direct Supabase registration...')
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword
      })
      
      console.log('📊 Supabase registration test result:', { data, error })
      setTestResult({ data, error })
    } catch (err) {
      console.error('🚨 Registration test error:', err)
      setTestResult({ error: err })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-lg max-w-4xl">
      <h3 className="text-lg font-bold mb-4">🔧 Authentication Debug Panel</h3>
      
      {/* Current State */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-700 p-4 rounded">
          <h4 className="font-semibold mb-2">Redux Auth State</h4>
          <pre className="text-xs overflow-auto">
            {JSON.stringify({
              isAuthenticated: authState.isAuthenticated,
              loading: authState.loading,
              error: authState.error,
              user: authState.user ? {
                id: authState.user.id,
                email: authState.user.email
              } : null
            }, null, 2)}
          </pre>
        </div>
        
        <div className="bg-white dark:bg-gray-700 p-4 rounded">
          <h4 className="font-semibold mb-2">Supabase Session</h4>
          <pre className="text-xs overflow-auto">
            {JSON.stringify({
              hasSession: !!session,
              hasUser: !!user,
              user: user ? {
                id: user.id,
                email: user.email,
                email_confirmed_at: user.email_confirmed_at,
                last_sign_in_at: user.last_sign_in_at
              } : null
            }, null, 2)}
          </pre>
        </div>
      </div>

      {/* Test Controls */}
      <div className="bg-white dark:bg-gray-700 p-4 rounded mb-4">
        <h4 className="font-semibold mb-3">🧪 Test Authentication</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="email"
              placeholder="Test email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="input"
            />
            <input
              type="password"
              placeholder="Test password"
              value={testPassword}
              onChange={(e) => setTestPassword(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex space-x-3">
            <button
              onClick={testLogin}
              disabled={loading || !testEmail || !testPassword}
              className="btn btn-primary"
            >
              {loading ? 'Testing...' : 'Test Login'}
            </button>
            <button
              onClick={testRegistration}
              disabled={loading || !testEmail || !testPassword}
              className="btn btn-secondary"
            >
              {loading ? 'Testing...' : 'Test Registration'}
            </button>
          </div>
        </div>
      </div>

      {/* Test Results */}
      {testResult && (
        <div className="bg-white dark:bg-gray-700 p-4 rounded">
          <h4 className="font-semibold mb-2">📊 Test Results</h4>
          <pre className="text-xs overflow-auto bg-gray-100 dark:bg-gray-600 p-3 rounded">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Environment Check */}
      <div className="bg-white dark:bg-gray-700 p-4 rounded mt-4">
        <h4 className="font-semibold mb-2">🌍 Environment Check</h4>
        <div className="text-sm space-y-1">
          <p>Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</p>
          <p>Supabase Anon Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</p>
          <p>API Base URL: {import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}</p>
        </div>
      </div>
    </div>
  )
}

export default AuthDebug 