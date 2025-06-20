import { supabase } from '../config/supabase'

export type DownloadFormat = 'txt' | 'markdown' | 'docx' | 'pdf'

interface ParsedDocument {
  title: string
  content: string
  wordCount: number
  characterCount: number
}

export const documentService = {
  async downloadDocument(documentId: string, format: DownloadFormat = 'txt') {
    try {
      // Get the current user's session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('User not authenticated')
      }

      // Use the backend API URL
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
      const response = await fetch(`${apiUrl}/documents/${documentId}/download/${format}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to download document')
      }

      // Get filename from content-disposition header
      const contentDisposition = response.headers.get('content-disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch ? filenameMatch[1] : `document.${format}`

      // Convert response to blob
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      
      // Cleanup
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading document:', error)
      throw error
    }
  },

  async exportAllDocuments() {
    try {
      // Get the current user's session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('User not authenticated')
      }

      // Use the backend API URL
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
      const response = await fetch(`${apiUrl}/documents/export-all`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to export documents')
      }

      // Get filename from content-disposition header
      const contentDisposition = response.headers.get('content-disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch ? filenameMatch[1] : 'wordwise-documents.zip'

      // Convert response to blob
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      
      // Cleanup
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error exporting documents:', error)
      throw error
    }
  },

  async parseFile(file: File): Promise<ParsedDocument> {
    const extension = file.name.split('.').pop()?.toLowerCase()
    
    switch (extension) {
      case 'txt':
      case 'md':
      case 'markdown':
        return this.parseTextFile(file)
      case 'docx':
        throw new Error('DOCX files are not supported yet. Please convert to TXT or Markdown.')
      case 'pdf':
        throw new Error('PDF files are not supported yet. Please convert to TXT or Markdown.')
      default:
        throw new Error(`Unsupported file type: .${extension}`)
    }
  },

  async parseTextFile(file: File): Promise<ParsedDocument> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const content = e.target?.result as string
        const title = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
        const wordCount = content.split(/\s+/).filter(word => word.length > 0).length
        
        resolve({
          title,
          content: content.trim(),
          wordCount,
          characterCount: content.length
        })
      }
      
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  },

  async uploadDocument(file: File, customTitle?: string) {
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Parse the file client-side
      const parsedDoc = await this.parseFile(file)
      const title = customTitle || parsedDoc.title

      // Create document directly in Supabase
      const now = new Date().toISOString()
      const documentData = {
        title,
        content: parsedDoc.content,
        user_id: user.id,
        created_at: now,
        updated_at: now,
        word_count: parsedDoc.wordCount,
        character_count: parsedDoc.characterCount
      }

      const { data, error } = await supabase
        .from('documents')
        .insert([documentData])
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        document: data,
        message: 'Document uploaded successfully'
      }
    } catch (error) {
      console.error('Error uploading document:', error)
      throw error
    }
  },

  async uploadMultipleDocuments(files: File[]) {
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      const results: any[] = []
      const errors: any[] = []

      // Process each file
      for (const file of files) {
        try {
          const result = await this.uploadDocument(file)
          results.push({
            filename: file.name,
            documentId: result.document.id,
            title: result.document.title
          })
        } catch (err) {
          errors.push({
            filename: file.name,
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      }

      return {
        success: true,
        message: `Uploaded ${results.length} documents successfully`,
        results,
        errors: errors.length > 0 ? errors : undefined
      }
    } catch (error) {
      console.error('Error uploading multiple documents:', error)
      throw error
    }
  }
} 