import React, { useState, useRef, useEffect } from 'react'
import { Download, FileText, FileDown, FileType, ChevronDown } from 'lucide-react'
import { documentService, DownloadFormat } from '../services/documentService'
import toast from 'react-hot-toast'

interface DownloadMenuProps {
  documentId: string
  documentTitle: string
  buttonClassName?: string
  iconOnly?: boolean
}

const DownloadMenu: React.FC<DownloadMenuProps> = ({ 
  documentId, 
  documentTitle,
  buttonClassName = '',
  iconOnly = false 
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const formats: { value: DownloadFormat; label: string; icon: React.ReactNode; description: string }[] = [
    { 
      value: 'txt', 
      label: 'Plain Text', 
      icon: <FileText className="h-4 w-4" />,
      description: 'Simple text file'
    },
    { 
      value: 'markdown', 
      label: 'Markdown', 
      icon: <FileDown className="h-4 w-4" />,
      description: 'Formatted markdown file'
    },
    { 
      value: 'docx', 
      label: 'Word Document', 
      icon: <FileType className="h-4 w-4" />,
      description: 'Microsoft Word format'
    },
    { 
      value: 'pdf', 
      label: 'PDF', 
      icon: <FileDown className="h-4 w-4" />,
      description: 'Portable Document Format'
    },
  ]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDownload = async (format: DownloadFormat) => {
    setIsDownloading(true)
    setIsOpen(false)
    
    try {
      await documentService.downloadDocument(documentId, format)
      toast.success(`Downloaded "${documentTitle}" as ${format.toUpperCase()}`)
    } catch (error) {
      toast.error('Failed to download document')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isDownloading}
        className={buttonClassName || `p-2 text-navy dark:text-blue-400 hover:text-burgundy dark:hover:text-blue-300 transition-colors ${isDownloading ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Download document"
      >
        {iconOnly ? (
          <Download className={`h-4 w-4 ${isDownloading ? 'animate-pulse' : ''}`} />
        ) : (
          <div className="flex items-center space-x-2">
            <Download className={`h-4 w-4 ${isDownloading ? 'animate-pulse' : ''}`} />
            <span>Download</span>
            <ChevronDown className="h-3 w-3" />
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-3 py-2">
              Download Format
            </h3>
            {formats.map((format) => (
              <button
                key={format.value}
                onClick={() => handleDownload(format.value)}
                className="w-full flex items-start space-x-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <div className="flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400">
                  {format.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {format.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {format.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default DownloadMenu 