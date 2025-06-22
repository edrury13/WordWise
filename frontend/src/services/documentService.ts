import { supabase } from '../config/supabase'

export type DownloadFormat = 'txt' | 'markdown'

interface ParsedDocument {
  title: string
  content: string
  wordCount: number
  characterCount: number
}

export const documentService = {
  async downloadDocument(documentId: string, format: DownloadFormat = 'txt') {
    try {
      // Get the document from Supabase
      const { data: document, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (error || !document) {
        throw new Error('Document not found')
      }

      let content: string
      let filename: string
      let mimeType: string

      switch (format) {
        case 'markdown':
          content = `# ${document.title}\n\n${document.content}\n\n---\n*Document created: ${new Date(document.created_at).toLocaleDateString()}*\n*Last updated: ${new Date(document.updated_at).toLocaleDateString()}*\n*Word count: ${document.word_count}*`
          filename = `${document.title.replace(/[^a-z0-9]/gi, '_')}.md`
          mimeType = 'text/markdown'
          break
        case 'txt':
        default:
          content = document.content
          filename = `${document.title.replace(/[^a-z0-9]/gi, '_')}.txt`
          mimeType = 'text/plain'
          break
      }

      // Create blob and download using a more compatible approach
      const blob = new Blob([content], { type: mimeType })
      
      // Check if we're in a browser environment
      if (typeof window !== 'undefined' && window.document) {
        const url = window.URL.createObjectURL(blob)
        const link = window.document.createElement('a')
        link.style.display = 'none'
        link.href = url
        link.download = filename
        
        // Append to body, click, and remove
        window.document.body.appendChild(link)
        link.click()
        
        // Cleanup
        setTimeout(() => {
          window.document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
        }, 100)
      } else {
        throw new Error('Download not supported in this environment')
      }
    } catch (error) {
      console.error('Error downloading document:', error)
      throw error
    }
  },

  async exportAllDocuments() {
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Get all documents from Supabase
      const { data: documents, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (error || !documents || documents.length === 0) {
        throw new Error('No documents found to export')
      }

      // Create a single text file with all documents
      let allContent = `WordWise Documents Export\n${'='.repeat(25)}\n\n`
      allContent += `Export Date: ${new Date().toLocaleDateString()}\n`
      allContent += `Total Documents: ${documents.length}\n`
      allContent += `Total Words: ${documents.reduce((sum, doc) => sum + doc.word_count, 0)}\n\n`
      allContent += `${'='.repeat(50)}\n\n`

      documents.forEach((doc, index) => {
        allContent += `Document ${index + 1}: ${doc.title}\n`
        allContent += `${'-'.repeat(doc.title.length + 13)}\n\n`
        allContent += `${doc.content}\n\n`
        allContent += `Created: ${new Date(doc.created_at).toLocaleDateString()}\n`
        allContent += `Updated: ${new Date(doc.updated_at).toLocaleDateString()}\n`
        allContent += `Words: ${doc.word_count}\n\n`
        allContent += `${'='.repeat(50)}\n\n`
      })

      // Download as a single text file
      const blob = new Blob([allContent], { type: 'text/plain' })
      
      // Check if we're in a browser environment
      if (typeof window !== 'undefined' && window.document) {
        const url = window.URL.createObjectURL(blob)
        const link = window.document.createElement('a')
        link.style.display = 'none'
        link.href = url
        link.download = `wordwise-export-${new Date().toISOString().split('T')[0]}.txt`
        
        // Append to body, click, and remove
        window.document.body.appendChild(link)
        link.click()
        
        // Cleanup
        setTimeout(() => {
          window.document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
        }, 100)
      } else {
        throw new Error('Export not supported in this environment')
      }
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
      default:
        throw new Error(`Unsupported file type: .${extension}. Only TXT and Markdown files are supported.`)
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
  },

  async copyDocument(documentId: string, customTitle?: string) {
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Get the original document from Supabase
      const { data: originalDoc, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single()

      if (fetchError || !originalDoc) {
        throw new Error('Document not found')
      }

      // Create a copy with a new title
      const now = new Date().toISOString()
      const copyTitle = customTitle || `${originalDoc.title} (Copy)`
      
      const documentData = {
        title: copyTitle,
        content: originalDoc.content,
        user_id: user.id,
        created_at: now,
        updated_at: now,
        word_count: originalDoc.word_count || 0,
        character_count: originalDoc.character_count || 0
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
        message: 'Document copied successfully'
      }
    } catch (error) {
      console.error('Error copying document:', error)
      throw error
    }
  }
} 