import React, { useState, useEffect } from 'react'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { versionService, DocumentVersion, VersionComparison, DiffSegment } from '../services/versionService'
import LoadingSpinner from './LoadingSpinner'

interface VersionComparisonViewProps {
  documentId: string
  versionFromId: string
  versionToId: string
  onClose: () => void
}

export const VersionComparisonView: React.FC<VersionComparisonViewProps> = ({
  documentId,
  versionFromId,
  versionToId,
  onClose
}) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [versionFrom, setVersionFrom] = useState<DocumentVersion | null>(null)
  const [versionTo, setVersionTo] = useState<DocumentVersion | null>(null)
  const [comparison, setComparison] = useState<VersionComparison | null>(null)
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split')
  const [showUnchanged, setShowUnchanged] = useState(true)

  useEffect(() => {
    loadComparison()
  }, [versionFromId, versionToId])

  const loadComparison = async () => {
    try {
      setLoading(true)
      setError(null)

      const [fromVersion, toVersion, comparisonData] = await Promise.all([
        versionService.getVersion(versionFromId),
        versionService.getVersion(versionToId),
        versionService.compareVersions(versionFromId, versionToId)
      ])

      setVersionFrom(fromVersion)
      setVersionTo(toVersion)
      setComparison(comparisonData)
    } catch (err) {
      console.error('Error loading comparison:', err)
      setError('Failed to load version comparison')
    } finally {
      setLoading(false)
    }
  }

  const renderDiffLine = (segment: DiffSegment, index: number) => {
    if (!showUnchanged && segment.type === 'unchanged') {
      return null
    }

    const bgColor = segment.type === 'added' ? 'bg-green-50' : 
                    segment.type === 'removed' ? 'bg-red-50' : 
                    'bg-white'
    
    const borderColor = segment.type === 'added' ? 'border-green-300' : 
                       segment.type === 'removed' ? 'border-red-300' : 
                       'border-gray-200'
    
    const textColor = segment.type === 'added' ? 'text-green-700' : 
                     segment.type === 'removed' ? 'text-red-700' : 
                     'text-gray-700'

    return (
      <div
        key={index}
        className={`px-4 py-2 ${bgColor} border-l-4 ${borderColor} ${textColor}`}
      >
        <div className="flex items-start gap-3">
          <span className="text-xs text-gray-500 font-mono">
            {segment.startLine}
          </span>
          <pre className="flex-1 whitespace-pre-wrap font-sans text-sm">
            {segment.content || <span className="text-gray-400">(empty line)</span>}
          </pre>
        </div>
      </div>
    )
  }

  const renderSplitView = () => {
    if (!comparison || !versionFrom || !versionTo) return null

    const leftSegments: (DiffSegment | null)[] = []
    const rightSegments: (DiffSegment | null)[] = []

    comparison.diff_data.segments.forEach((segment) => {
      if (segment.type === 'removed') {
        leftSegments.push(segment)
        rightSegments.push(null)
      } else if (segment.type === 'added') {
        leftSegments.push(null)
        rightSegments.push(segment)
      } else {
        leftSegments.push(segment)
        rightSegments.push(segment)
      }
    })

    return (
      <div className="grid grid-cols-2 gap-4">
        {/* Left Side - Older Version */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-100 p-3 border-b">
            <h4 className="font-semibold">Version {versionFrom.version_number}</h4>
            <p className="text-sm text-gray-600">{versionFrom.commit_message}</p>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {leftSegments.map((segment, index) => 
              segment ? renderDiffLine(segment, index) : (
                <div key={index} className="px-4 py-2 bg-gray-50">
                  <div className="h-6"></div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Right Side - Newer Version */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-100 p-3 border-b">
            <h4 className="font-semibold">Version {versionTo.version_number}</h4>
            <p className="text-sm text-gray-600">{versionTo.commit_message}</p>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {rightSegments.map((segment, index) => 
              segment ? renderDiffLine(segment, index) : (
                <div key={index} className="px-4 py-2 bg-gray-50">
                  <div className="h-6"></div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderUnifiedView = () => {
    if (!comparison || !versionFrom || !versionTo) return null

    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 p-3 border-b">
          <h4 className="font-semibold">
            Version {versionFrom.version_number} → Version {versionTo.version_number}
          </h4>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {comparison.diff_data.segments.map((segment, index) => 
            renderDiffLine(segment, index)
          )}
        </div>
      </div>
    )
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
      <div className="p-4">
        <div className="text-red-600 text-center mb-4">{error}</div>
        <button
          onClick={onClose}
          className="mx-auto flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Version History
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Version History
        </button>

        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 rounded text-sm ${
                viewMode === 'split' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={`px-3 py-1 rounded text-sm ${
                viewMode === 'unified' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Unified View
            </button>
          </div>

          {/* Show/Hide Unchanged Toggle */}
          <button
            onClick={() => setShowUnchanged(!showUnchanged)}
            className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
          >
            {showUnchanged ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showUnchanged ? 'Hide' : 'Show'} Unchanged
          </button>
        </div>
      </div>

      {/* Statistics */}
      {comparison && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4 text-sm text-center">
            <div>
              <div className="text-2xl font-semibold text-green-600">
                +{comparison.diff_data.statistics.additions}
              </div>
              <div className="text-gray-600">Lines Added</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-red-600">
                -{comparison.diff_data.statistics.deletions}
              </div>
              <div className="text-gray-600">Lines Removed</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-blue-600">
                ~{comparison.diff_data.statistics.modifications}
              </div>
              <div className="text-gray-600">Lines Modified</div>
            </div>
          </div>
        </div>
      )}

      {/* Diff View */}
      {viewMode === 'split' ? renderSplitView() : renderUnifiedView()}
    </div>
  )
} 