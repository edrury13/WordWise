import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AppDispatch } from '../store';
import {
  selectProfiles,
  selectEffectiveProfile,
  setActiveProfile,
  fetchUserProfiles,
  autoDetectProfile,
  associateProfileWithDocument,
  removeDocumentProfileAssociation
} from '../store/slices/styleProfileSlice';
import { ProfileType } from '../types/styleProfile';
import toast from 'react-hot-toast';

interface ProfileSelectorProps {
  documentId?: string;
  documentContent?: string;
  compact?: boolean;
}

// Icon components
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const DocumentTextIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

// Enhanced profile icons with better styling
const profileIcons: Record<ProfileType, JSX.Element> = {
  academic: <DocumentTextIcon className="w-5 h-5" />,
  business: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>,
  creative: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>,
  technical: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>,
  email: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>,
  social: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
  </svg>,
  custom: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
};

// Color scheme for profile types
const profileColors: Record<ProfileType, { bg: string; icon: string; border: string; text: string }> = {
  academic: { 
    bg: 'bg-blue-50 dark:bg-blue-900/20', 
    icon: 'bg-blue-100 dark:bg-blue-800/30 text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-700',
    text: 'text-blue-700 dark:text-blue-300'
  },
  business: { 
    bg: 'bg-purple-50 dark:bg-purple-900/20', 
    icon: 'bg-purple-100 dark:bg-purple-800/30 text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-700',
    text: 'text-purple-700 dark:text-purple-300'
  },
  creative: { 
    bg: 'bg-pink-50 dark:bg-pink-900/20', 
    icon: 'bg-pink-100 dark:bg-pink-800/30 text-pink-600 dark:text-pink-400',
    border: 'border-pink-200 dark:border-pink-700',
    text: 'text-pink-700 dark:text-pink-300'
  },
  technical: { 
    bg: 'bg-green-50 dark:bg-green-900/20', 
    icon: 'bg-green-100 dark:bg-green-800/30 text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-700',
    text: 'text-green-700 dark:text-green-300'
  },
  email: { 
    bg: 'bg-orange-50 dark:bg-orange-900/20', 
    icon: 'bg-orange-100 dark:bg-orange-800/30 text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-700',
    text: 'text-orange-700 dark:text-orange-300'
  },
  social: { 
    bg: 'bg-cyan-50 dark:bg-cyan-900/20', 
    icon: 'bg-cyan-100 dark:bg-cyan-800/30 text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-200 dark:border-cyan-700',
    text: 'text-cyan-700 dark:text-cyan-300'
  },
  custom: { 
    bg: 'bg-gray-50 dark:bg-gray-800/20', 
    icon: 'bg-gray-100 dark:bg-gray-700/30 text-gray-600 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-600',
    text: 'text-gray-700 dark:text-gray-300'
  }
};

export const ProfileSelector: React.FC<ProfileSelectorProps> = ({ 
  documentId, 
  documentContent,
  compact = false 
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const profiles = useSelector(selectProfiles);
  const effectiveProfile = useSelector(selectEffectiveProfile);
  const [isOpen, setIsOpen] = useState(false);
  const [showAutoDetect, setShowAutoDetect] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load profiles on mount
    const loadProfiles = async () => {
      setIsLoading(true);
      try {
        await dispatch(fetchUserProfiles()).unwrap();
      } catch (error) {
        console.error('Failed to load profiles:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProfiles();
  }, [dispatch]);

  const handleProfileChange = async (profileId: string | null) => {
    try {
      if (documentId) {
        // Handle document-specific profile changes
        if (profileId) {
          // Associate the profile with the document
          await dispatch(associateProfileWithDocument({ documentId, profileId })).unwrap();
          toast.success('Profile applied to document');
        } else {
          // Remove profile association from the document
          await dispatch(removeDocumentProfileAssociation(documentId)).unwrap();
          toast.success('Profile removed from document');
        }
      } else {
        // Just set it as the active profile (no document context)
        await dispatch(setActiveProfile(profileId)).unwrap();
        toast.success(profileId ? 'Profile activated' : 'Profile deactivated');
      }
      setIsOpen(false);
    } catch (error) {
      console.error('Profile change error:', error);
      toast.error('Failed to change profile');
    }
  };

  const handleAutoDetect = async () => {
    if (!documentContent) {
      toast.error('No content to analyze');
      return;
    }

    try {
      setShowAutoDetect(true);
      const detectedType = await dispatch(autoDetectProfile(documentContent)).unwrap();
      
      // Find the profile of the detected type
      const matchingProfile = profiles.find(p => p.profileType === detectedType);
      
      if (matchingProfile) {
        await handleProfileChange(matchingProfile.id);
        toast.success(`Detected ${detectedType} writing style`);
      } else {
        toast(`Detected ${detectedType} style, but no matching profile found`, {
          icon: '💡',
        });
      }
    } catch (error) {
      toast.error('Failed to auto-detect profile');
    } finally {
      setShowAutoDetect(false);
    }
  };

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:shadow-md"
        >
          {effectiveProfile && (
            <span className={`${profileColors[effectiveProfile.profileType].icon} p-1 rounded flex-shrink-0`}>
              {profileIcons[effectiveProfile.profileType]}
            </span>
          )}
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {effectiveProfile?.name || 'No Profile'}
          </span>
          <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </button>
        
        {isOpen && (
          <div className="absolute z-50 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 animate-fade-in">
            {profiles.map(profile => {
              const colors = profileColors[profile.profileType];
              return (
                <button
                  key={profile.id}
                  onClick={() => handleProfileChange(profile.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 ${
                    effectiveProfile?.id === profile.id ? colors.bg : ''
                  }`}
                >
                  <span className={`${colors.icon} p-1.5 rounded-lg flex-shrink-0`}>
                    {profileIcons[profile.profileType]}
                  </span>
                  <span className="flex-1 text-left min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{profile.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">{profile.profileType}</div>
                  </span>
                  {effectiveProfile?.id === profile.id && (
                    <svg className="w-5 h-5 text-primary-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
            
            <div className="my-2 border-t border-gray-200 dark:border-gray-700"></div>
            
            <button
              onClick={() => handleProfileChange(null)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
            >
              <span className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
              <span className="flex-1 text-left min-w-0">
                <div className="font-medium text-gray-900 dark:text-gray-100 truncate">No Profile</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">Default checking</div>
              </span>
            </button>
            
            {documentContent && (
              <>
                <div className="my-2 border-t border-gray-200 dark:border-gray-700"></div>
                <button
                  onClick={handleAutoDetect}
                  disabled={showAutoDetect}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200 disabled:opacity-50"
                >
                  <span className="p-1.5 rounded-lg bg-primary-100 dark:bg-primary-800/30 text-primary-600 dark:text-primary-400 flex-shrink-0">
                    <SparklesIcon className="w-5 h-5" />
                  </span>
                  <span className="flex-1 text-left text-primary-700 dark:text-primary-300 font-medium truncate">
                    {showAutoDetect ? 'Detecting...' : 'Auto-detect'}
                  </span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full size version for profile management
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5 transition-all duration-300">
      {documentContent && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleAutoDetect}
            disabled={showAutoDetect || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 rounded-md shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SparklesIcon className="w-3.5 h-3.5" />
            {showAutoDetect ? 'Detecting...' : 'Auto-detect'}
          </button>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary-200 border-t-primary-600 mb-3"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Setting up profiles...</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">This only happens once</p>
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-5xl mb-3">📝</div>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">No profiles available</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Please ensure you're logged in</p>
        </div>
      ) : (
      <div className="space-y-2">
        {profiles.map(profile => {
          const colors = profileColors[profile.profileType];
          const isActive = effectiveProfile?.id === profile.id;
          
          return (
            <button
              key={profile.id}
              onClick={() => handleProfileChange(profile.id)}
              className={`group relative w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
                isActive 
                  ? `${colors.bg} ${colors.border} shadow-sm` 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
              }`}
            >
              <div className={`p-2 rounded-lg ${colors.icon} transition-all duration-200 group-hover:scale-105 flex-shrink-0`}>
                {profileIcons[profile.profileType]}
              </div>
              
              <div className="flex-1 text-left">
                <div className={`font-semibold text-sm ${isActive ? colors.text : 'text-gray-900 dark:text-gray-100'}`}>
                  {profile.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {profile.profileType}
                </div>
              </div>
              
              {isActive && (
                <svg className="w-5 h-5 text-primary-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          );
        })}
        
        <button
          onClick={() => handleProfileChange(null)}
          className={`group relative w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
            !effectiveProfile 
              ? 'border-gray-400 dark:border-gray-500 bg-gray-50 dark:bg-gray-700 shadow-sm' 
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
          }`}
        >
          <div className={`p-2 rounded-lg transition-all duration-200 group-hover:scale-105 flex-shrink-0 ${
            !effectiveProfile ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          
          <div className="flex-1 text-left">
            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">No Profile</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Default checking</div>
          </div>
          
          {!effectiveProfile && (
            <svg className="w-5 h-5 text-gray-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>
      )}
      
      {effectiveProfile && (
        <div className="mt-5 p-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Current Settings
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-600">
              <span className="text-gray-500 dark:text-gray-400 block text-xs">Formality</span>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                  <div 
                    className="bg-primary-600 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${(effectiveProfile.settings.tone?.formalityLevel || 5) * 10}%` }}
                  />
                </div>
                <span className="font-semibold text-gray-900 dark:text-gray-100 text-xs">{effectiveProfile.settings.tone?.formalityLevel || 5}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-600">
              <span className="text-gray-500 dark:text-gray-400 block text-xs">Voice</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100 capitalize text-xs block">{effectiveProfile.settings.tone?.voicePreference || 'balanced'}</span>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-600">
              <span className="text-gray-500 dark:text-gray-400 block text-xs">Vocabulary</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100 capitalize text-xs block">{effectiveProfile.settings.vocabulary?.complexityLevel || 'moderate'}</span>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-600">
              <span className="text-gray-500 dark:text-gray-400 block text-xs">Contractions</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100 capitalize text-xs block">{effectiveProfile.settings.grammar?.contractionUsage || 'informal'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 