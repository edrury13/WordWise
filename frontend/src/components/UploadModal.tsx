import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { X, Upload, FileText, FileCheck, AlertCircle } from 'lucide-react'
import { documentService } from '../services/documentService'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../store'
import { fetchDocuments } from '../store/slices/documentSlice'
import toast from 'react-hot-toast'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
}

interface FileWithPreview {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  customTitle?: string
}

const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, userId }) => {
  const dispatch = useDispatch<AppDispatch>()
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      status: 'pending' as const
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md', '.markdown']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true
  })

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const updateFileTitle = (id: string, title: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, customTitle: title } : f
    ))
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setIsUploading(true)
    const pendingFiles = files.filter(f => f.status === 'pending')

    if (pendingFiles.length === 1) {
      // Single file upload
      const fileToUpload = pendingFiles[0]
      setFiles(prev => prev.map(f => 
        f.id === fileToUpload.id ? { ...f, status: 'uploading' } : f
      ))

      try {
        await documentService.uploadDocument(fileToUpload.file, fileToUpload.customTitle)
        setFiles(prev => prev.map(f => 
          f.id === fileToUpload.id ? { ...f, status: 'success' } : f
        ))
        toast.success('Document uploaded successfully')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed'
        setFiles(prev => prev.map(f => 
          f.id === fileToUpload.id ? { ...f, status: 'error', error: errorMessage } : f
        ))
        toast.error(errorMessage)
      }
    } else {
      // Multiple files upload
      setFiles(prev => prev.map(f => 
        f.status === 'pending' ? { ...f, status: 'uploading' } : f
      ))

      try {
        const filesToUpload = pendingFiles.map(f => f.file)
        const result = await documentService.uploadMultipleDocuments(filesToUpload)
        
        // Update file statuses based on results
        setFiles(prev => prev.map(f => {
          if (f.status !== 'uploading') return f
          
          const resultEntry = result.results?.find((r: any) => r.filename === f.file.name)
          const errorEntry = result.errors?.find((e: any) => e.filename === f.file.name)
          
          if (resultEntry) {
            return { ...f, status: 'success' }
          } else if (errorEntry) {
            return { ...f, status: 'error', error: errorEntry.error }
          } else {
            return f
          }
        }))

        if (result.results?.length > 0) {
          toast.success(`Uploaded ${result.results.length} documents successfully`)
        }
        if (result.errors && result.errors.length > 0) {
          toast.error(`Failed to upload ${result.errors.length} documents`)
        }
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.status === 'uploading' ? { ...f, status: 'error', error: 'Upload failed' } : f
        ))
        toast.error('Failed to upload documents')
      }
    }

    setIsUploading(false)
    
    // Refresh documents list
    dispatch(fetchDocuments(userId))
    
    // Close modal if all uploads were successful
    const allSuccess = files.every(f => f.status === 'success')
    if (allSuccess) {
      setTimeout(() => {
        onClose()
        setFiles([])
      }, 1500)
    }
  }

  const getFileIcon = (status: FileWithPreview['status']) => {
    switch (status) {
      case 'success':
        return <FileCheck className="h-5 w-5 text-green-600" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />
      default:
        return <FileText className="h-5 w-5 text-gray-600" />
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold academic-serif text-navy dark:text-blue-400">
              Upload Documents
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-navy bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20' 
                : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            {isDragActive ? (
              <p className="text-lg text-navy dark:text-blue-400">Drop files here...</p>
            ) : (
              <>
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-2">
                  Drag & drop files here, or click to browse
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Supported formats: TXT, Markdown (.md) - max 10MB each
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  Note: DOCX and PDF files must be converted to text format before uploading
                </p>
              </>
            )}
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">
                Files to upload ({files.length})
              </h3>
              {files.map((fileItem) => (
                <div
                  key={fileItem.id}
                  className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  {getFileIcon(fileItem.status)}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={fileItem.customTitle || fileItem.file.name}
                      onChange={(e) => updateFileTitle(fileItem.id, e.target.value)}
                      disabled={fileItem.status !== 'pending'}
                      className="w-full bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-navy dark:focus:border-blue-400 outline-none text-sm"
                      placeholder="Document title"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
                      {fileItem.status === 'uploading' && ' - Uploading...'}
                      {fileItem.status === 'success' && ' - Uploaded'}
                      {fileItem.status === 'error' && ` - ${fileItem.error}`}
                    </p>
                  </div>
                  {fileItem.status === 'pending' && (
                    <button
                      onClick={() => removeFile(fileItem.id)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={files.filter(f => f.status === 'pending').length === 0 || isUploading}
              className="px-4 py-2 bg-navy text-white hover:bg-burgundy dark:bg-blue-600 dark:hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading...' : 'Upload Documents'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UploadModal 