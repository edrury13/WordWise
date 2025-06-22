import React, { useState, useEffect } from 'react'
import { Clock, Tag, RotateCcw, Eye, GitCompare } from 'lucide-react'
import { versionService, DocumentVersion, VersionTag } from '../services/versionService'
import LoadingSpinner from './LoadingSpinner'

interface VersionHistoryPanelProps {
  documentId: string
  onVersionRestore?: (versionId: string) => void
  onVersionCompare?: (versionFromId: string, versionToId: string) => void
  onVersionView?: (versionId: string) => void
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  documentId,
  onVersionRestore,
  onVersionCompare,
  onVersionView
}) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [tags, setTags] = useState<VersionTag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [showTagDialog, setShowTagDialog] = useState<string | null>(null)
  const [tagName, setTagName] = useState('')
  const [analytics, setAnalytics] = useState<any>(null)

  useEffect(() => {
    loadVersionHistory()
  }, [documentId])

  const loadVersionHistory = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [versionsData, tagsData, analyticsData] = await Promise.all([
        versionService.getVersionHistory(documentId),
        versionService.getDocumentTags(documentId),
        versionService.getVersionAnalytics(documentId)
      ])
      
      setVersions(versionsData)
      setTags(tagsData)
      setAnalytics(analyticsData)
    } catch (err) {
      console.error('Error loading version history:', err)
      setError('Failed to load version history')
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (versionId: string) => {
    if (!confirm('Are you sure you want to restore this version? This will create a new version with the restored content.')) {
      return
    }

    try {
      await versionService.restoreVersion(documentId, versionId)
      await loadVersionHistory()
      onVersionRestore?.(versionId)
    } catch (err) {
      console.error('Error restoring version:', err)
      alert('Failed to restore version')
    }
  }

  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      onVersionCompare?.(selectedVersions[0], selectedVersions[1])
    }
  }

  const handleTagVersion = async (versionId: string) => {
    if (!tagName.trim()) return

    try {
      await versionService.tagVersion(documentId, versionId, tagName.trim())
      await loadVersionHistory()
      setShowTagDialog(null)
      setTagName('')
    } catch (err) {
      console.error('Error tagging version:', err)
      alert('Failed to tag version')
    }
  }



  const toggleVersionSelection = (versionId: string) => {
    setSelectedVersions(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId)
      }
      if (prev.length >= 2) {
        return [prev[1], versionId]
      }
      return [...prev, versionId]
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getTagForVersion = (versionId: string) => {
    return tags.find(tag => tag.version_id === versionId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 text-center">
        {error}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Analytics Summary */}
      {analytics && (
        <div className="p-4 border-b bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Total Versions</div>
              <div className="font-semibold">{analytics.totalVersions}</div>
            </div>
            <div>
              <div className="text-gray-500">Major/Minor</div>
              <div className="font-semibold">{analytics.majorVersions}/{analytics.minorVersions}</div>
            </div>
            <div>
              <div className="text-gray-500">Avg. Time Between</div>
              <div className="font-semibold">{analytics.avgTimeBetweenVersions}h</div>
            </div>
            <div>
              <div className="text-gray-500">Avg. Words</div>
              <div className="font-semibold">{analytics.avgWordsPerVersion}</div>
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Version History
        </h3>
        
        {selectedVersions.length === 2 && (
          <button
            onClick={handleCompare}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            <GitCompare className="w-4 h-4" />
            Compare Selected
          </button>
        )}
      </div>

      {/* Version List */}
      <div className="divide-y max-h-[600px] overflow-y-auto">
        {versions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No version history available
          </div>
        ) : (
          versions.map((version, index) => {
            const tag = getTagForVersion(version.id)
            const isSelected = selectedVersions.includes(version.id)
            const isCurrent = index === 0
            
            return (
              <div
                key={version.id}
                className={`p-4 hover:bg-gray-50 transition-colors ${
                  isSelected ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Selection Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleVersionSelection(version.id)}
                    className="mt-1"
                    disabled={isCurrent}
                  />
                  
                  {/* Version Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">
                        Version {version.version_number}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          Current
                        </span>
                      )}
                      {version.is_automatic && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          Auto-save
                        </span>
                      )}
                      {version.is_major_version && !version.is_automatic && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                          Major
                        </span>
                      )}
                      {tag && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {tag.tag_name}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-1">
                      {version.commit_message}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{formatDate(version.created_at)}</span>
                      <span>{version.word_count} words</span>
                      {version.diff_summary && (
                        <>
                          {version.diff_summary.words_added && version.diff_summary.words_added > 0 && (
                            <span className="text-green-600">
                              +{version.diff_summary.words_added} added
                            </span>
                          )}
                          {version.diff_summary.words_removed && version.diff_summary.words_removed > 0 && (
                            <span className="text-red-600">
                              -{version.diff_summary.words_removed} removed
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onVersionView?.(version.id)}
                      className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                      title="View version"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    
                    {!isCurrent && (
                      <button
                        onClick={() => handleRestore(version.id)}
                        className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                        title="Restore version"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => setShowTagDialog(version.id)}
                      className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                      title="Tag version"
                    >
                      <Tag className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Tag Dialog */}
                {showTagDialog === version.id && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tagName}
                        onChange={(e) => setTagName(e.target.value)}
                        placeholder="Enter tag name..."
                        className="flex-1 px-3 py-1 border rounded-md text-sm"
                        onKeyPress={(e) => e.key === 'Enter' && handleTagVersion(version.id)}
                      />
                      <button
                        onClick={() => handleTagVersion(version.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                      >
                        Add Tag
                      </button>
                      <button
                        onClick={() => {
                          setShowTagDialog(null)
                          setTagName('')
                        }}
                        className="px-3 py-1 text-gray-600 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
} 