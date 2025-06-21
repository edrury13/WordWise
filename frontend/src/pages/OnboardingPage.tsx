import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../store'
import { 
  selectCurrentStep,
  selectOnboardingResponses,
  selectOnboardingLoading,
  nextStep,
  previousStep,
  skipOnboarding as skipOnboardingAction,
  completeOnboarding,
  loadOnboardingProgress,
  saveOnboardingProgress
} from '../store/slices/onboardingSlice'
import PurposeSelection from '../components/onboarding/PurposeSelection'
import BackgroundSelection from '../components/onboarding/BackgroundSelection'
import GoalsSelection from '../components/onboarding/GoalsSelection'
import StyleProfileSelection from '../components/onboarding/StyleProfileSelection'
import WritingPreferences from '../components/onboarding/WritingPreferences'
import TutorialSetup from '../components/onboarding/TutorialSetup'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

const OnboardingPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const { user } = useSelector((state: RootState) => state.auth)
  const currentStep = useSelector(selectCurrentStep)
  const responses = useSelector(selectOnboardingResponses)
  const isLoading = useSelector(selectOnboardingLoading)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    // Load existing onboarding progress
    dispatch(loadOnboardingProgress(user.id))
  }, [dispatch, user, navigate])

  const handleNext = async () => {
    if (user) {
      // Save progress after each step
      await dispatch(saveOnboardingProgress({
        userId: user.id,
        preferences: {
          ...responses,
          onboardingCurrentStep: currentStep + 1
        }
      }))
      dispatch(nextStep())
    }
  }

  const handleBack = () => {
    dispatch(previousStep())
  }

  const handleSkip = async () => {
    if (user) {
      try {
        await dispatch(skipOnboardingAction(user.id))
        toast.success('Onboarding skipped. You can set up preferences later in settings.')
        navigate('/dashboard')
      } catch (error) {
        toast.error('Failed to skip onboarding')
      }
    }
  }

  const handleComplete = async () => {
    if (user) {
      try {
        await dispatch(completeOnboarding({
          userId: user.id,
          preferences: responses
        }))
        
        toast.success('Welcome to WordWise! Your preferences have been saved.')
        
        // Navigate based on tutorial selection
        const tutorialOption = responses.tutorialOption || 'jump_in'
        switch (tutorialOption) {
          case 'interactive':
            navigate('/tutorial')
            break
          case 'templates':
            navigate('/dashboard?show=templates')
            break
          case 'import':
            navigate('/dashboard?show=import')
            break
          default:
            navigate('/dashboard')
        }
      } catch (error) {
        toast.error('Failed to complete onboarding')
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <PurposeSelection 
            onNext={handleNext}
            onSkip={handleSkip}
          />
        )
      case 2:
        return (
          <BackgroundSelection
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
          />
        )
      case 3:
        return (
          <GoalsSelection
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
          />
        )
      case 4:
        return (
          <StyleProfileSelection
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
          />
        )
      case 5:
        return (
          <WritingPreferences
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
          />
        )
      case 6:
        return (
          <TutorialSetup
            onComplete={handleComplete}
            onBack={handleBack}
            onSkip={handleSkip}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
        <div 
          className="h-full bg-primary-600 transition-all duration-300"
          style={{ width: `${(currentStep / 6) * 100}%` }}
        />
      </div>
      
      <div className="pt-4">
        {renderStep()}
      </div>
    </div>
  )
}

export default OnboardingPage 