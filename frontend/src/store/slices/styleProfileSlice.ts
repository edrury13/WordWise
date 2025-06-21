import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { RootState } from '..';
import { styleProfileService } from '../../services/styleProfileService';
import { StyleProfile, ProfileType, StyleProfileSettings } from '../../types/styleProfile';

interface StyleProfileState {
  profiles: StyleProfile[];
  activeProfile: StyleProfile | null;
  loading: boolean;
  error: string | null;
  documentProfile: StyleProfile | null; // Profile associated with current document
}

const initialState: StyleProfileState = {
  profiles: [],
  activeProfile: null,
  loading: false,
  error: null,
  documentProfile: null
};

// Async thunks
export const fetchUserProfiles = createAsyncThunk(
  'styleProfiles/fetchUserProfiles',
  async () => {
    let profiles = await styleProfileService.getUserProfiles();
    
    // If no profiles exist, create the default ones
    if (profiles.length === 0) {
      console.log('No profiles found, creating default profiles...');
      await styleProfileService.createDefaultProfiles();
      profiles = await styleProfileService.getUserProfiles();
    }
    
    const activeProfile = await styleProfileService.getActiveProfile();
    return { profiles, activeProfile };
  }
);

export const createStyleProfile = createAsyncThunk(
  'styleProfiles/create',
  async ({ name, profileType, settings }: {
    name: string;
    profileType: ProfileType;
    settings?: Partial<StyleProfileSettings>;
  }) => {
    return await styleProfileService.createProfile(name, profileType, settings);
  }
);

export const updateStyleProfile = createAsyncThunk(
  'styleProfiles/update',
  async ({ profileId, updates }: {
    profileId: string;
    updates: Partial<{
      name: string;
      settings: Partial<StyleProfileSettings>;
    }>;
  }) => {
    return await styleProfileService.updateProfile(profileId, updates);
  }
);

export const deleteStyleProfile = createAsyncThunk(
  'styleProfiles/delete',
  async (profileId: string) => {
    await styleProfileService.deleteProfile(profileId);
    return profileId;
  }
);

export const setActiveProfile = createAsyncThunk(
  'styleProfiles/setActive',
  async (profileId: string | null) => {
    await styleProfileService.setActiveProfile(profileId);
    if (profileId) {
      return await styleProfileService.getProfile(profileId);
    }
    return null;
  }
);

export const loadDocumentProfile = createAsyncThunk(
  'styleProfiles/loadDocumentProfile',
  async (documentId: string) => {
    return await styleProfileService.getDocumentProfile(documentId);
  }
);

export const associateProfileWithDocument = createAsyncThunk(
  'styleProfiles/associateWithDocument',
  async ({ documentId, profileId }: {
    documentId: string;
    profileId: string;
  }) => {
    await styleProfileService.associateProfileWithDocument(documentId, profileId);
    return await styleProfileService.getProfile(profileId);
  }
);

export const removeDocumentProfileAssociation = createAsyncThunk(
  'styleProfiles/removeDocumentAssociation',
  async (documentId: string) => {
    await styleProfileService.removeDocumentProfileAssociation(documentId);
    return null;
  }
);

export const autoDetectProfile = createAsyncThunk(
  'styleProfiles/autoDetect',
  async (content: string) => {
    return await styleProfileService.autoDetectProfile(content);
  }
);

export const createDefaultProfiles = createAsyncThunk(
  'styleProfiles/createDefaults',
  async () => {
    await styleProfileService.createDefaultProfiles();
    return await styleProfileService.getUserProfiles();
  }
);

const styleProfileSlice = createSlice({
  name: 'styleProfiles',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearDocumentProfile: (state) => {
      state.documentProfile = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch user profiles
      .addCase(fetchUserProfiles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserProfiles.fulfilled, (state, action) => {
        state.loading = false;
        state.profiles = action.payload.profiles;
        state.activeProfile = action.payload.activeProfile;
      })
      .addCase(fetchUserProfiles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch profiles';
      })
      
      // Create profile
      .addCase(createStyleProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createStyleProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profiles.push(action.payload);
      })
      .addCase(createStyleProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create profile';
      })
      
      // Update profile
      .addCase(updateStyleProfile.fulfilled, (state, action) => {
        const index = state.profiles.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.profiles[index] = action.payload;
        }
        if (state.activeProfile?.id === action.payload.id) {
          state.activeProfile = action.payload;
        }
        if (state.documentProfile?.id === action.payload.id) {
          state.documentProfile = action.payload;
        }
      })
      
      // Delete profile
      .addCase(deleteStyleProfile.fulfilled, (state, action) => {
        state.profiles = state.profiles.filter(p => p.id !== action.payload);
        if (state.activeProfile?.id === action.payload) {
          state.activeProfile = null;
        }
        if (state.documentProfile?.id === action.payload) {
          state.documentProfile = null;
        }
      })
      
      // Set active profile
      .addCase(setActiveProfile.fulfilled, (state, action) => {
        state.activeProfile = action.payload;
        // Update the active status in profiles list
        state.profiles = state.profiles.map(p => ({
          ...p,
          isActive: p.id === action.payload?.id
        }));
      })
      
      // Load document profile
      .addCase(loadDocumentProfile.fulfilled, (state, action) => {
        state.documentProfile = action.payload;
      })
      
      // Associate profile with document
      .addCase(associateProfileWithDocument.fulfilled, (state, action) => {
        state.documentProfile = action.payload;
      })
      
      // Remove document profile association
      .addCase(removeDocumentProfileAssociation.fulfilled, (state) => {
        state.documentProfile = null;
      })
      
      // Create default profiles
      .addCase(createDefaultProfiles.fulfilled, (state, action) => {
        state.profiles = action.payload;
      });
  }
});

export const { clearError, clearDocumentProfile } = styleProfileSlice.actions;

// Selectors
export const selectProfiles = (state: RootState) => state.styleProfiles.profiles;
export const selectActiveProfile = (state: RootState) => state.styleProfiles.activeProfile;
export const selectDocumentProfile = (state: RootState) => state.styleProfiles.documentProfile;
export const selectStyleProfileLoading = (state: RootState) => state.styleProfiles.loading;
export const selectStyleProfileError = (state: RootState) => state.styleProfiles.error;

// Select the effective profile (document profile takes precedence over active profile)
export const selectEffectiveProfile = (state: RootState) => 
  state.styleProfiles.documentProfile || state.styleProfiles.activeProfile;

export default styleProfileSlice.reducer; 