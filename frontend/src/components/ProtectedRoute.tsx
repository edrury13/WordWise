import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Navigate, useLocation } from 'react-router-dom'
import { RootState } from '../store'
import LoadingSpinner from './LoadingSpinner'
import { userPreferencesService } from '../services/userPreferencesService'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading, user } = useSelector((state: RootState) => state.auth)
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null)
  const location = useLocation()

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (user && location.pathname !== '/onboarding') {
        try {
          const needs = await userPreferencesService.checkNeedsOnboarding(user.id)
          setNeedsOnboarding(needs)
        } catch (error) {
          console.error('Error checking onboarding status:', error)
          setNeedsOnboarding(false) // Default to not needing onboarding on error
        }
      } else {
        setNeedsOnboarding(false)
      }
    }

    if (isAuthenticated && user) {
      checkOnboardingStatus()
    }
  }, [isAuthenticated, user, location.pathname])

  if (loading || needsOnboarding === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Redirect to onboarding if needed (but not if already on onboarding page)
  if (needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute 