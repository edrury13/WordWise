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

const profileIcons: Record<ProfileType, JSX.Element> = {
  academic: <DocumentTextIcon className="w-4 h-4" />,
  business: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>,
  creative: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>,
  technical: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>,
  email: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>,
  social: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
  </svg>,
  custom: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
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
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          {effectiveProfile && profileIcons[effectiveProfile.profileType]}
          <span className="font-medium">
            {effectiveProfile?.name || 'No Profile'}
          </span>
          <ChevronDownIcon className="w-4 h-4" />
        </button>
        
        {isOpen && (
          <div className="absolute z-10 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
            {profiles.map(profile => (
              <button
                key={profile.id}
                onClick={() => handleProfileChange(profile.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  effectiveProfile?.id === profile.id ? 'bg-blue-50 text-blue-700' : ''
                }`}
              >
                {profileIcons[profile.profileType]}
                <span className="flex-1 text-left">{profile.name}</span>
                {effectiveProfile?.id === profile.id && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
            
            <div className="border-t my-1"></div>
            
            <button
              onClick={() => handleProfileChange(null)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="flex-1 text-left">No Profile</span>
            </button>
            
            {documentContent && (
              <>
                <div className="border-t my-1"></div>
                <button
                  onClick={handleAutoDetect}
                  disabled={showAutoDetect}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <SparklesIcon className="w-4 h-4" />
                  <span className="flex-1 text-left">
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Active Style Profile</h3>
        {documentContent && (
          <button
            onClick={handleAutoDetect}
            disabled={showAutoDetect || isLoading}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50"
          >
            <SparklesIcon className="w-4 h-4" />
            {showAutoDetect ? 'Detecting...' : 'Auto-detect'}
          </button>
        )}
      </div>
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-sm text-gray-600">Setting up your writing profiles...</p>
          <p className="text-xs text-gray-500 mt-2">This only happens once</p>
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-600">No profiles available</p>
          <p className="text-xs text-gray-500 mt-2">Please ensure you're logged in</p>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-3">
        {profiles.map(profile => (
          <button
            key={profile.id}
            onClick={() => handleProfileChange(profile.id)}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
              effectiveProfile?.id === profile.id 
                ? 'border-blue-500 bg-blue-50 shadow-sm' 
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className={`p-2 rounded-lg ${
              effectiveProfile?.id === profile.id ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              {profileIcons[profile.profileType]}
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-sm">{profile.name}</div>
              <div className="text-xs text-gray-500 capitalize">{profile.profileType}</div>
            </div>
            {effectiveProfile?.id === profile.id && (
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        ))}
        
        <button
          onClick={() => handleProfileChange(null)}
          className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
            !effectiveProfile 
              ? 'border-gray-500 bg-gray-50 shadow-sm' 
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className={`p-2 rounded-lg ${!effectiveProfile ? 'bg-gray-200' : 'bg-gray-100'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <div className="font-medium text-sm">No Profile</div>
            <div className="text-xs text-gray-500">Default checking</div>
          </div>
          {!effectiveProfile && (
            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>
      )}
      
      {effectiveProfile && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-2">Current Settings:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Formality:</span>{' '}
              <span className="font-medium">{effectiveProfile.settings.tone?.formalityLevel || 5}/10</span>
            </div>
            <div>
              <span className="text-gray-500">Voice:</span>{' '}
              <span className="font-medium capitalize">{effectiveProfile.settings.tone?.voicePreference || 'balanced'}</span>
            </div>
            <div>
              <span className="text-gray-500">Vocabulary:</span>{' '}
              <span className="font-medium capitalize">{effectiveProfile.settings.vocabulary?.complexityLevel || 'moderate'}</span>
            </div>
            <div>
              <span className="text-gray-500">Contractions:</span>{' '}
              <span className="font-medium capitalize">{effectiveProfile.settings.grammar?.contractionUsage || 'informal'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 