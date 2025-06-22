import { supabase } from '../config/supabase'

export interface DocumentVersion {
  id: string
  document_id: string
  version_number: number
  content: string
  title: string
  created_at: string
  created_by: string
  commit_message?: string
  word_count: number
  character_count: number
  is_major_version: boolean
  is_automatic: boolean
  diff_summary?: {
    words_added?: number
    words_removed?: number
    paragraphs_changed?: number
  }
}

export interface VersionTag {
  id: string
  document_id: string
  version_id: string
  tag_name: string
  created_at: string
  created_by: string
}

export interface VersionComparison {
  id: string
  version_from: string
  version_to: string
  diff_data: DiffData
  created_at: string
}

export interface DiffData {
  segments: DiffSegment[]
  statistics: {
    additions: number
    deletions: number
    modifications: number
  }
}

export interface DiffSegment {
  type: 'added' | 'removed' | 'unchanged'
  content: string
  startLine: number
  endLine: number
}

export interface CreateVersionParams {
  documentId: string
  title: string
  content: string
  commitMessage?: string
  isMajorVersion?: boolean
  isAutomatic?: boolean
}

class VersionService {
  // Get version history for a document
  async getVersionHistory(documentId: string): Promise<DocumentVersion[]> {
    const { data, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Get a specific version
  async getVersion(versionId: string): Promise<DocumentVersion | null> {
    const { data, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('id', versionId)
      .single()

    if (error) throw error
    return data
  }

  // Create a new version
  async createVersion(params: CreateVersionParams): Promise<DocumentVersion> {
    const { documentId, title, content, commitMessage, isMajorVersion = false, isAutomatic = false } = params
    
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Calculate word and character counts
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length
    const characterCount = content.length

    // Get the latest version to calculate diff summary
    const latestVersion = await this.getLatestVersion(documentId)
    let diffSummary = null

    if (latestVersion) {
      diffSummary = await this.calculateDiffSummary(latestVersion.content, content)
    }

    // Get next version number
    const { data: versionNumberData, error: versionError } = await supabase
      .rpc('get_next_version_number', { 
        doc_id: documentId, 
        is_major: isMajorVersion 
      })

    if (versionError) throw versionError

    // Create the version
    const { data, error } = await supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_number: versionNumberData,
        title,
        content,
        created_by: user.id,
        commit_message: commitMessage || (isAutomatic ? 'Auto-save' : isMajorVersion ? 'Major update' : 'Minor update'),
        word_count: wordCount,
        character_count: characterCount,
        is_major_version: isMajorVersion,
        is_automatic: isAutomatic,
        diff_summary: diffSummary
      })
      .select()
      .single()

    if (error) throw error

    // If this is an automatic version, clean up old ones
    if (isAutomatic) {
      try {
        await supabase.rpc('cleanup_old_automatic_versions', { doc_id: documentId })
      } catch (cleanupError) {
        console.error('Error cleaning up old automatic versions:', cleanupError)
        // Don't throw - the version was created successfully
      }
    }

    return data
  }

  // Get the latest version of a document
  async getLatestVersion(documentId: string): Promise<DocumentVersion | null> {
    const { data, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  // Restore a specific version
  async restoreVersion(documentId: string, versionId: string, message?: string): Promise<void> {
    const version = await this.getVersion(versionId)
    if (!version) throw new Error('Version not found')

    // Create a new version with the restored content
    await this.createVersion({
      documentId,
      title: version.title,
      content: version.content,
      commitMessage: message || `Restored from version ${version.version_number}`,
      isMajorVersion: true
    })

    // Update the main document
    const { error } = await supabase
      .from('documents')
      .update({
        title: version.title,
        content: version.content,
        word_count: version.word_count,
        character_count: version.character_count,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)

    if (error) throw error
  }

  // Compare two versions
  async compareVersions(versionFromId: string, versionToId: string): Promise<VersionComparison> {
    // Check cache first
    const { data: cached } = await supabase
      .from('version_comparisons')
      .select('*')
      .or(`version_from.eq.${versionFromId},version_from.eq.${versionToId}`)
      .or(`version_to.eq.${versionFromId},version_to.eq.${versionToId}`)
      .single()

    if (cached) return cached

    // Get both versions
    const [versionFrom, versionTo] = await Promise.all([
      this.getVersion(versionFromId),
      this.getVersion(versionToId)
    ])

    if (!versionFrom || !versionTo) {
      throw new Error('One or both versions not found')
    }

    // Calculate diff
    const diffData = await this.calculateDiff(versionFrom.content, versionTo.content)

    // Cache the comparison
    const { data, error } = await supabase
      .from('version_comparisons')
      .insert({
        version_from: versionFromId,
        version_to: versionToId,
        diff_data: diffData
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Tag a version
  async tagVersion(documentId: string, versionId: string, tagName: string): Promise<VersionTag> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('document_version_tags')
      .insert({
        document_id: documentId,
        version_id: versionId,
        tag_name: tagName,
        created_by: user.id
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Get tags for a document
  async getDocumentTags(documentId: string): Promise<VersionTag[]> {
    const { data, error } = await supabase
      .from('document_version_tags')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Remove a tag
  async removeTag(tagId: string): Promise<void> {
    const { error } = await supabase
      .from('document_version_tags')
      .delete()
      .eq('id', tagId)

    if (error) throw error
  }

  // Auto-save version (creates minor versions)
  async autoSaveVersion(documentId: string, title: string, content: string): Promise<void> {
    const latestVersion = await this.getLatestVersion(documentId)
    
    // Only create a version if content has changed significantly
    if (latestVersion && this.hasSignificantChanges(latestVersion.content, content)) {
      await this.createVersion({
        documentId,
        title,
        content,
        commitMessage: 'Auto-saved',
        isMajorVersion: false
      })
    }
  }

  // Helper: Check if changes are significant enough for auto-save
  private hasSignificantChanges(oldContent: string, newContent: string): boolean {
    // Simple check: at least 5% change or 50 characters
    const lengthDiff = Math.abs(oldContent.length - newContent.length)
    const percentChange = lengthDiff / Math.max(oldContent.length, 1)
    
    return lengthDiff > 50 || percentChange > 0.05
  }

  // Helper: Calculate diff between two texts
  private async calculateDiff(oldText: string, newText: string): Promise<DiffData> {
    // Simple line-based diff for now
    const oldLines = oldText.split('\n')
    const newLines = newText.split('\n')
    
    const segments: DiffSegment[] = []
    let additions = 0
    let deletions = 0
    let modifications = 0

    // Simple diff algorithm (can be improved with a proper diff library)
    let i = 0, j = 0
    while (i < oldLines.length || j < newLines.length) {
      if (i >= oldLines.length) {
        // Rest are additions
        segments.push({
          type: 'added',
          content: newLines[j],
          startLine: j + 1,
          endLine: j + 1
        })
        additions++
        j++
      } else if (j >= newLines.length) {
        // Rest are deletions
        segments.push({
          type: 'removed',
          content: oldLines[i],
          startLine: i + 1,
          endLine: i + 1
        })
        deletions++
        i++
      } else if (oldLines[i] === newLines[j]) {
        // Unchanged
        segments.push({
          type: 'unchanged',
          content: oldLines[i],
          startLine: j + 1,
          endLine: j + 1
        })
        i++
        j++
      } else {
        // Changed - for simplicity, treat as remove + add
        segments.push({
          type: 'removed',
          content: oldLines[i],
          startLine: i + 1,
          endLine: i + 1
        })
        segments.push({
          type: 'added',
          content: newLines[j],
          startLine: j + 1,
          endLine: j + 1
        })
        modifications++
        i++
        j++
      }
    }

    return {
      segments,
      statistics: {
        additions,
        deletions,
        modifications
      }
    }
  }

  // Helper: Calculate diff summary for version creation
  private async calculateDiffSummary(oldContent: string, newContent: string) {
    const oldWords = oldContent.split(/\s+/).filter(w => w.length > 0)
    const newWords = newContent.split(/\s+/).filter(w => w.length > 0)
    const oldParagraphs = oldContent.split(/\n\n+/).filter(p => p.trim().length > 0)
    const newParagraphs = newContent.split(/\n\n+/).filter(p => p.trim().length > 0)

    return {
      words_added: Math.max(0, newWords.length - oldWords.length),
      words_removed: Math.max(0, oldWords.length - newWords.length),
      paragraphs_changed: Math.abs(newParagraphs.length - oldParagraphs.length)
    }
  }

  // Get version analytics for a document
  async getVersionAnalytics(documentId: string) {
    const versions = await this.getVersionHistory(documentId)
    
    if (versions.length === 0) return null

    const totalVersions = versions.length
    const majorVersions = versions.filter(v => v.is_major_version).length
    const minorVersions = totalVersions - majorVersions

    // Calculate average time between versions
    const versionDates = versions.map(v => new Date(v.created_at).getTime()).sort()
    let avgTimeBetweenVersions = 0
    if (versionDates.length > 1) {
      const timeDiffs = []
      for (let i = 1; i < versionDates.length; i++) {
        timeDiffs.push(versionDates[i] - versionDates[i - 1])
      }
      avgTimeBetweenVersions = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length
    }

    // Calculate average words per version
    const avgWordsPerVersion = versions.reduce((sum, v) => sum + v.word_count, 0) / totalVersions

    return {
      totalVersions,
      majorVersions,
      minorVersions,
      avgTimeBetweenVersions: Math.round(avgTimeBetweenVersions / (1000 * 60 * 60)), // in hours
      avgWordsPerVersion: Math.round(avgWordsPerVersion),
      oldestVersion: versions[versions.length - 1],
      newestVersion: versions[0]
    }
  }
}

export const versionService = new VersionService() 