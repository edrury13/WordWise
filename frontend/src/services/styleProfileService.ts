import { supabase } from '../config/supabase';
import { 
  StyleProfile, 
  ProfileType, 
  StyleProfileSettings, 
  defaultProfileSettings,
  ProfileUsageAnalytics
} from '../types/styleProfile';

class StyleProfileService {
  private profileCache: Map<string, StyleProfile> = new Map();
  private activeProfileId: string | null = null;
  private documentAssociations: Map<string, string> = new Map(); // documentId -> profileId

  /**
   * Get all profiles for the current user
   */
  async getUserProfiles(): Promise<StyleProfile[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('User not authenticated, returning empty profiles');
        return [];
      }

      const { data, error } = await supabase
        .from('user_style_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;

      const profiles = data.map(this.mapDbToProfile);
      
      // Update cache
      profiles.forEach(profile => {
        this.profileCache.set(profile.id, profile);
      });

      return profiles;
    } catch (error) {
      console.error('Error fetching user profiles:', error);
      // Return empty array instead of throwing to handle gracefully
      return [];
    }
  }

  /**
   * Get a specific profile by ID
   */
  async getProfile(profileId: string): Promise<StyleProfile | null> {
    // Check cache first
    if (this.profileCache.has(profileId)) {
      return this.profileCache.get(profileId)!;
    }

    try {
      const { data, error } = await supabase
        .from('user_style_profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error) throw error;
      if (!data) return null;

      const profile = this.mapDbToProfile(data);
      this.profileCache.set(profile.id, profile);
      
      return profile;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }

  /**
   * Create a new profile
   */
  async createProfile(
    name: string,
    profileType: ProfileType,
    settings?: Partial<StyleProfileSettings>
  ): Promise<StyleProfile> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Merge with defaults
      const baseSettings = defaultProfileSettings[profileType] || {};
      const mergedSettings = this.mergeSettings(baseSettings, settings || {});

      const { data, error } = await supabase
        .from('user_style_profiles')
        .insert({
          user_id: user.id,
          name,
          profile_type: profileType,
          is_custom: profileType === 'custom',
          settings: mergedSettings
        })
        .select()
        .single();

      if (error) throw error;

      const profile = this.mapDbToProfile(data);
      this.profileCache.set(profile.id, profile);
      
      return profile;
    } catch (error) {
      console.error('Error creating profile:', error);
      throw error;
    }
  }

  /**
   * Update an existing profile
   */
  async updateProfile(
    profileId: string,
    updates: Partial<{
      name: string;
      settings: Partial<StyleProfileSettings>;
    }>
  ): Promise<StyleProfile> {
    try {
      const existingProfile = await this.getProfile(profileId);
      if (!existingProfile) throw new Error('Profile not found');

      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.settings) {
        updateData.settings = this.mergeSettings(
          existingProfile.settings,
          updates.settings
        );
      }

      const { data, error } = await supabase
        .from('user_style_profiles')
        .update(updateData)
        .eq('id', profileId)
        .select()
        .single();

      if (error) throw error;

      const profile = this.mapDbToProfile(data);
      this.profileCache.set(profile.id, profile);
      
      return profile;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  /**
   * Delete a profile
   */
  async deleteProfile(profileId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_style_profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;

      this.profileCache.delete(profileId);
      if (this.activeProfileId === profileId) {
        this.activeProfileId = null;
      }
    } catch (error) {
      console.error('Error deleting profile:', error);
      throw error;
    }
  }

  /**
   * Set the active profile
   */
  async setActiveProfile(profileId: string | null): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Deactivate all profiles
      await supabase
        .from('user_style_profiles')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // Activate the selected profile
      if (profileId) {
        const { error } = await supabase
          .from('user_style_profiles')
          .update({ is_active: true })
          .eq('id', profileId);

        if (error) throw error;

        // Update analytics
        await this.updateProfileUsage(profileId);
      }

      this.activeProfileId = profileId;
    } catch (error) {
      console.error('Error setting active profile:', error);
      throw error;
    }
  }

  /**
   * Get the currently active profile
   */
  async getActiveProfile(): Promise<StyleProfile | null> {
    if (this.activeProfileId) {
      return this.getProfile(this.activeProfileId);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_style_profiles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error || !data) return null;

      const profile = this.mapDbToProfile(data);
      this.activeProfileId = profile.id;
      this.profileCache.set(profile.id, profile);
      
      return profile;
    } catch (error) {
      console.error('Error fetching active profile:', error);
      return null;
    }
  }

  /**
   * Associate a profile with a document
   */
  async associateProfileWithDocument(
    documentId: string,
    profileId: string
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // First, try to update existing association
      const { data: existing } = await supabase
        .from('document_profile_associations')
        .select('id')
        .eq('document_id', documentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update existing association
        const { error } = await supabase
          .from('document_profile_associations')
          .update({ profile_id: profileId })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new association
        const { error } = await supabase
          .from('document_profile_associations')
          .insert({
            document_id: documentId,
            profile_id: profileId,
            user_id: user.id
          });

        if (error) throw error;
      }

      this.documentAssociations.set(documentId, profileId);
    } catch (error) {
      console.error('Error associating profile with document:', error);
      throw error;
    }
  }

  /**
   * Get the profile associated with a document
   */
  async getDocumentProfile(documentId: string): Promise<StyleProfile | null> {
    // Check cache first
    if (this.documentAssociations.has(documentId)) {
      const profileId = this.documentAssociations.get(documentId)!;
      return this.getProfile(profileId);
    }

    try {
      const { data, error } = await supabase
        .from('document_profile_associations')
        .select('profile_id')
        .eq('document_id', documentId)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle no results

      if (error) {
        console.error('Error fetching document profile:', error);
        return null;
      }
      
      if (!data) return null; // No association exists, which is fine

      this.documentAssociations.set(documentId, data.profile_id);
      return this.getProfile(data.profile_id);
    } catch (error) {
      console.error('Error fetching document profile:', error);
      return null;
    }
  }

  /**
   * Remove profile association from a document
   */
  async removeDocumentProfileAssociation(documentId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('document_profile_associations')
        .delete()
        .eq('document_id', documentId)
        .eq('user_id', user.id);

      if (error) throw error;

      this.documentAssociations.delete(documentId);
    } catch (error) {
      console.error('Error removing document profile association:', error);
      throw error;
    }
  }

  /**
   * Create default profiles for a new user
   */
  async createDefaultProfiles(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('Cannot create default profiles: User not authenticated');
        return;
      }

      const defaultProfiles: Array<{ name: string; type: ProfileType }> = [
        { name: 'Academic Writing', type: 'academic' },
        { name: 'Business Professional', type: 'business' },
        { name: 'Creative Writing', type: 'creative' },
        { name: 'Technical Documentation', type: 'technical' },
        { name: 'Email Communication', type: 'email' },
        { name: 'Social Media', type: 'social' }
      ];

      console.log('Creating default profiles for user...');
      
      for (const { name, type } of defaultProfiles) {
        try {
          await this.createProfile(name, type);
          console.log(`✓ Created ${name} profile`);
        } catch (error: any) {
          // Check if it's a unique constraint error (profile already exists)
          if (error?.code === '23505' || error?.message?.includes('duplicate')) {
            console.log(`Profile ${name} already exists, skipping`);
          } else {
            console.error(`Error creating default profile ${name}:`, error);
          }
        }
      }
      
      console.log('Default profiles created successfully');
    } catch (error) {
      console.error('Error in createDefaultProfiles:', error);
    }
  }

  /**
   * Update profile usage analytics
   */
  private async updateProfileUsage(profileId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profile_usage_analytics')
        .upsert({
          user_id: user.id,
          profile_id: profileId,
          last_used_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,profile_id'
        });

      if (error) console.error('Error updating profile usage:', error);
    } catch (error) {
      console.error('Error updating profile usage:', error);
    }
  }

  /**
   * Get profile usage analytics
   */
  async getProfileAnalytics(profileId: string): Promise<ProfileUsageAnalytics | null> {
    try {
      const { data, error } = await supabase
        .from('profile_usage_analytics')
        .select('*')
        .eq('profile_id', profileId)
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        profileId: data.profile_id,
        documentCount: data.document_count,
        suggestionAcceptanceRate: data.suggestion_acceptance_rate,
        lastUsedAt: data.last_used_at,
        createdAt: data.created_at
      };
    } catch (error) {
      console.error('Error fetching profile analytics:', error);
      return null;
    }
  }

  /**
   * Map database record to StyleProfile
   */
  private mapDbToProfile(data: any): StyleProfile {
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      isCustom: data.is_custom,
      isActive: data.is_active,
      profileType: data.profile_type,
      settings: data.settings,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  /**
   * Deep merge settings objects
   */
  private mergeSettings(
    base: any,
    updates: any
  ): StyleProfileSettings {
    const merged = { ...base };

    for (const key in updates) {
      if (updates[key] !== undefined) {
        if (typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
          merged[key] = this.mergeSettings(merged[key] || {}, updates[key]);
        } else {
          merged[key] = updates[key];
        }
      }
    }

    // Ensure all required fields are present
    return {
      tone: merged.tone || {},
      grammar: merged.grammar || {},
      vocabulary: merged.vocabulary || {},
      structure: merged.structure || {},
      style: merged.style || {},
      specificSettings: merged.specificSettings || {},
      ruleWeights: merged.ruleWeights || [],
      conditionalRules: merged.conditionalRules || [],
      customPrompt: merged.customPrompt
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.profileCache.clear();
    this.documentAssociations.clear();
    this.activeProfileId = null;
  }

  /**
   * Auto-detect appropriate profile based on content
   */
  async autoDetectProfile(content: string): Promise<ProfileType> {
    const lowercaseContent = content.toLowerCase();
    
    // Email detection
    if (lowercaseContent.includes('dear') && 
        (lowercaseContent.includes('sincerely') || 
         lowercaseContent.includes('regards') ||
         lowercaseContent.includes('best,'))) {
      return 'email';
    }
    
    // Academic detection
    if (lowercaseContent.includes('abstract') && 
        lowercaseContent.includes('conclusion') ||
        lowercaseContent.includes('references') ||
        lowercaseContent.includes('hypothesis')) {
      return 'academic';
    }
    
    // Technical detection
    if (lowercaseContent.includes('function') ||
        lowercaseContent.includes('implementation') ||
        lowercaseContent.includes('algorithm') ||
        lowercaseContent.includes('documentation')) {
      return 'technical';
    }
    
    // Business detection
    if (lowercaseContent.includes('meeting') ||
        lowercaseContent.includes('proposal') ||
        lowercaseContent.includes('quarterly') ||
        lowercaseContent.includes('stakeholder')) {
      return 'business';
    }
    
    // Creative detection
    if (lowercaseContent.includes('chapter') ||
        lowercaseContent.includes('character') ||
        lowercaseContent.includes('scene') ||
        content.includes('"') && content.includes('"')) {
      return 'creative';
    }
    
    // Social media detection (short content)
    if (content.length < 500 && 
        (content.includes('#') || content.includes('@'))) {
      return 'social';
    }
    
    return 'business'; // Default fallback
  }
}

// Export singleton instance
export const styleProfileService = new StyleProfileService(); 