import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import Navigation from '../components/Navigation'
import LoadingSpinner from '../components/LoadingSpinner'
import { userPreferencesService } from '../services/userPreferencesService'
import { styleProfileService } from '../services/styleProfileService'
import { 
  UserPreferences,
  EDUCATION_LEVELS,
  FIELDS_OF_STUDY,
  WRITING_PURPOSES_DATA,
  WRITING_GOALS_DATA,
  WRITING_CHALLENGES_DATA,
  DOCUMENT_TYPES_DATA
} from '../types/userPreferences'
import { StyleProfile } from '../types/styleProfile'
import toast from 'react-hot-toast'
import { 
  User, 
  BookOpen, 
  Target, 
  Palette, 
  Settings, 
  Bell, 
  Eye,
  Save,
  ChevronLeft
} from 'lucide-react'

const PreferencesPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useSelector((state: RootState) => state.auth)
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [styleProfiles, setStyleProfiles] = useState<StyleProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('background')

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    loadPreferences()
  }, [user, navigate])

  const loadPreferences = async () => {
    if (!user) return

    try {
      setLoading(true)
      const [prefs, profiles] = await Promise.all([
        userPreferencesService.getUserPreferences(user.id),
        styleProfileService.getUserProfiles()
      ])
      
      setPreferences(prefs)
      setStyleProfiles(profiles)
    } catch (error) {
      console.error('Error loading preferences:', error)
      toast.error('Failed to load preferences')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user || !preferences) return

    try {
      setSaving(true)
      await userPreferencesService.updatePreferences(user.id, preferences)
      toast.success('Preferences saved successfully!')
    } catch (error) {
      console.error('Error saving preferences:', error)
      toast.error('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    if (preferences) {
      setPreferences({
        ...preferences,
        [key]: value
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (!preferences) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">No preferences found</p>
      </div>
    )
  }

  const tabs = [
    { id: 'background', label: 'Background', icon: User },
    { id: 'writing', label: 'Writing Purpose', icon: BookOpen },
    { id: 'goals', label: 'Goals & Challenges', icon: Target },
    { id: 'style', label: 'Style Preferences', icon: Palette },
    { id: 'features', label: 'Features', icon: Settings },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'accessibility', label: 'Accessibility', icon: Eye },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Preferences
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Customize WordWise to match your writing needs
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              {/* Background Tab */}
              {activeTab === 'background' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Background Information
                  </h2>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Education Level
                    </label>
                    <select
                      value={preferences.educationLevel || ''}
                      onChange={(e) => updatePreference('educationLevel', e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="">Select education level</option>
                      {EDUCATION_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Field of Study
                    </label>
                    <select
                      value={preferences.fieldOfStudy || ''}
                      onChange={(e) => updatePreference('fieldOfStudy', e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="">Select field of study</option>
                      {FIELDS_OF_STUDY.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Primary Language
                    </label>
                    <input
                      type="text"
                      value={preferences.primaryLanguage || ''}
                      onChange={(e) => updatePreference('primaryLanguage', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="e.g., English"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Native Language (if different)
                    </label>
                    <input
                      type="text"
                      value={preferences.nativeLanguage || ''}
                      onChange={(e) => updatePreference('nativeLanguage', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="e.g., Spanish"
                    />
                  </div>
                </div>
              )}

              {/* Writing Purpose Tab */}
              {activeTab === 'writing' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Writing Purposes
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Select all that apply to help us tailor suggestions
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {WRITING_PURPOSES_DATA.map((purpose) => (
                      <label
                        key={purpose.value}
                        className="flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={preferences.writingPurposes.includes(purpose.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updatePreference('writingPurposes', [...preferences.writingPurposes, purpose.value])
                            } else {
                              updatePreference('writingPurposes', preferences.writingPurposes.filter(p => p !== purpose.value))
                            }
                          }}
                          className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-2xl">{purpose.icon}</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {purpose.label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {purpose.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Goals & Challenges Tab */}
              {activeTab === 'goals' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      Writing Goals
                    </h2>
                    <div className="space-y-2">
                      {WRITING_GOALS_DATA.map((goal) => (
                        <label
                          key={goal.value}
                          className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={preferences.writingGoals.includes(goal.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                updatePreference('writingGoals', [...preferences.writingGoals, goal.value])
                              } else {
                                updatePreference('writingGoals', preferences.writingGoals.filter(g => g !== goal.value))
                              }
                            }}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span className="text-gray-700 dark:text-gray-300">{goal.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      Writing Challenges
                    </h2>
                    <div className="space-y-2">
                      {WRITING_CHALLENGES_DATA.map((challenge) => (
                        <label
                          key={challenge.value}
                          className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={preferences.writingChallenges.includes(challenge.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                updatePreference('writingChallenges', [...preferences.writingChallenges, challenge.value])
                              } else {
                                updatePreference('writingChallenges', preferences.writingChallenges.filter(c => c !== challenge.value))
                              }
                            }}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span className="text-gray-700 dark:text-gray-300">{challenge.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Style Preferences Tab - Updated */}
              {activeTab === 'style' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Style Preferences
                  </h2>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Default Style Profile
                    </label>
                    <select
                      value={preferences.defaultStyleProfileId || ''}
                      onChange={(e) => updatePreference('defaultStyleProfileId', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="">No default profile</option>
                      {styleProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preferences.autoDetectStyle}
                        onChange={(e) => updatePreference('autoDetectStyle', e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          Auto-detect writing style
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Automatically detect and suggest appropriate style profiles based on your document content
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preferences.alwaysAskStyle}
                        onChange={(e) => updatePreference('alwaysAskStyle', e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          Always ask which style to use
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Prompt for style profile selection when creating new documents
                        </p>
                      </div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Formality Level
                    </label>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Casual</span>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={preferences.formalityLevel}
                        onChange={(e) => updatePreference('formalityLevel', parseInt(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Formal</span>
                      <span className="ml-4 font-medium text-gray-900 dark:text-gray-100">
                        {preferences.formalityLevel}/10
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Grammar Sensitivity
                    </label>
                    <select
                      value={preferences.grammarSensitivity}
                      onChange={(e) => updatePreference('grammarSensitivity', e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="strict">Strict - Flag all grammar issues</option>
                      <option value="balanced">Balanced - Focus on important issues</option>
                      <option value="relaxed">Relaxed - Only major errors</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Preferred Document Types
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {DOCUMENT_TYPES_DATA.map((docType) => (
                        <label
                          key={docType.value}
                          className="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={preferences.preferredDocumentTypes.includes(docType.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                updatePreference('preferredDocumentTypes', [...preferences.preferredDocumentTypes, docType.value])
                              } else {
                                updatePreference('preferredDocumentTypes', preferences.preferredDocumentTypes.filter(d => d !== docType.value))
                              }
                            }}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{docType.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Features Tab */}
              {activeTab === 'features' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Features & Settings
                  </h2>
                  
                  <div className="space-y-4">
                    <label className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preferences.enableAiSuggestions}
                        onChange={(e) => updatePreference('enableAiSuggestions', e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          Enable AI-powered suggestions
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Get advanced writing suggestions powered by artificial intelligence
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preferences.enableLearningMode}
                        onChange={(e) => updatePreference('enableLearningMode', e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          Enable learning mode
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Learn from your corrections and adapt suggestions to your writing style
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preferences.showTips}
                        onChange={(e) => updatePreference('showTips', e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          Show writing tips
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Display helpful tips and explanations for writing improvements
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preferences.enableAutoSave}
                        onChange={(e) => updatePreference('enableAutoSave', e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          Enable auto-save
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Automatically save your documents as you type
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Email Notifications
                  </h2>
                  
                  <div className="space-y-4">
                    <label className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preferences.dailyWritingReminders}
                        onChange={(e) => updatePreference('dailyWritingReminders', e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          Daily writing reminders
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Get daily reminders to maintain your writing habit
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preferences.weeklyProgressReports}
                        onChange={(e) => updatePreference('weeklyProgressReports', e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          Weekly progress reports
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Receive weekly summaries of your writing activity and improvements
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preferences.grammarTips}
                        onChange={(e) => updatePreference('grammarTips', e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          Grammar tips
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Receive educational tips about grammar and writing
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preferences.featureAnnouncements}
                        onChange={(e) => updatePreference('featureAnnouncements', e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          Feature announcements
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Stay updated about new features and improvements
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Accessibility Tab */}
              {activeTab === 'accessibility' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Accessibility Options
                  </h2>
                  
                  <div className="space-y-4">
                    <label className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preferences.largerTextSize}
                        onChange={(e) => updatePreference('largerTextSize', e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          Larger text size
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Increase text size for better readability
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preferences.highContrastMode}
                        onChange={(e) => updatePreference('highContrastMode', e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          High contrast mode
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Increase color contrast for better visibility
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preferences.screenReaderOptimized}
                        onChange={(e) => updatePreference('screenReaderOptimized', e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          Screen reader optimization
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Optimize interface for screen reader users
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preferences.reducedAnimations}
                        onChange={(e) => updatePreference('reducedAnimations', e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          Reduced animations
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Minimize animations and transitions
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preferences.keyboardNavHints}
                        onChange={(e) => updatePreference('keyboardNavHints', e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          Keyboard navigation hints
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Show keyboard shortcuts and navigation hints
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PreferencesPage
