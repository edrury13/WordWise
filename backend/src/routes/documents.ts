import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { AuthenticatedRequest } from '../middleware/auth'
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx'
import PDFDocument from 'pdfkit'
import archiver from 'archiver'
import { Readable } from 'stream'
import { upload, uploadMultiple } from '../middleware/upload'
import { FileParser } from '../utils/fileParser'
import AdmZip from 'adm-zip'

const router = express.Router()

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('🚨 Missing Supabase environment variables!')
  console.error('Please create a .env file in the backend directory using env.template')
  console.error('Required variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Get all documents for a user
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      throw error
    }

    res.status(200).json({
      success: true,
      documents: data
    })
  } catch (error) {
    console.error('Error fetching documents:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents'
    })
  }
})

// Get a specific document
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id) // Ensure user owns the document
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        })
      }
      throw error
    }

    res.status(200).json({
      success: true,
      document: data
    })
  } catch (error) {
    console.error('Error fetching document:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch document'
    })
  }
})

// Create a new document
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { title, content } = req.body

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required'
      })
    }

    const now = new Date().toISOString()
    const documentData = {
      title,
      content,
      user_id: req.user.id,
      created_at: now,
      updated_at: now,
      word_count: content.split(/\s+/).filter((word: string) => word.length > 0).length,
      character_count: content.length
    }

    const { data, error } = await supabase
      .from('documents')
      .insert([documentData])
      .select()
      .single()

    if (error) {
      throw error
    }

    res.status(201).json({
      success: true,
      document: data
    })
  } catch (error) {
    console.error('Error creating document:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create document'
    })
  }
})

// Update a document
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { title, content } = req.body

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (title !== undefined) updateData.title = title
    if (content !== undefined) {
      updateData.content = content
      updateData.word_count = content.split(/\s+/).filter((word: string) => word.length > 0).length
      updateData.character_count = content.length
    }

    const { data, error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id) // Ensure user owns the document
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        })
      }
      throw error
    }

    res.status(200).json({
      success: true,
      document: data
    })
  } catch (error) {
    console.error('Error updating document:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update document'
    })
  }
})

// Delete a document
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id) // Ensure user owns the document

    if (error) {
      throw error
    }

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting document:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete document'
    })
  }
})

// Download document as text file
router.get('/:id/download/txt', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('Content-Disposition', `attachment; filename="${data.title.replace(/[^a-z0-9]/gi, '_')}.txt"`)
    
    res.send(data.content)
  } catch (error) {
    console.error('Error downloading document as text:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to download document'
    })
  }
})

// Download document as markdown file
router.get('/:id/download/markdown', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }

    // Add markdown formatting
    const markdownContent = `# ${data.title}\n\n${data.content}\n\n---\n*Document created: ${new Date(data.created_at).toLocaleDateString()}*\n*Last updated: ${new Date(data.updated_at).toLocaleDateString()}*\n*Word count: ${data.word_count}*`

    res.setHeader('Content-Type', 'text/markdown')
    res.setHeader('Content-Disposition', `attachment; filename="${data.title.replace(/[^a-z0-9]/gi, '_')}.md"`)
    
    res.send(markdownContent)
  } catch (error) {
    console.error('Error downloading document as markdown:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to download document'
    })
  }
})

// Download document as DOCX file
router.get('/:id/download/docx', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }

    // Create a new document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: data.title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 400,
            },
          }),
          ...data.content.split('\n').map((line: string) => 
            new Paragraph({
              children: [new TextRun(line)],
              spacing: {
                after: 200,
              },
            })
          ),
          new Paragraph({
            children: [
              new TextRun({
                text: `Document created: ${new Date(data.created_at).toLocaleDateString()} | `,
                italics: true,
                size: 20,
              }),
              new TextRun({
                text: `Last updated: ${new Date(data.updated_at).toLocaleDateString()} | `,
                italics: true,
                size: 20,
              }),
              new TextRun({
                text: `Word count: ${data.word_count}`,
                italics: true,
                size: 20,
              }),
            ],
            spacing: {
              before: 400,
            },
          }),
        ],
      }],
    })

    // Generate DOCX file
    const buffer = await Packer.toBuffer(doc)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${data.title.replace(/[^a-z0-9]/gi, '_')}.docx"`)
    
    res.send(buffer)
  } catch (error) {
    console.error('Error downloading document as DOCX:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to download document'
    })
  }
})

// Download document as PDF
router.get('/:id/download/pdf', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }

    // Create a new PDF document
    const pdf = new PDFDocument({
      size: 'A4',
      margins: {
        top: 72,
        bottom: 72,
        left: 72,
        right: 72
      }
    })

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${data.title.replace(/[^a-z0-9]/gi, '_')}.pdf"`)

    // Pipe the PDF to the response
    pdf.pipe(res)

    // Add content to PDF
    pdf.fontSize(24)
       .font('Helvetica-Bold')
       .text(data.title, { align: 'center' })
       .moveDown(2)

    pdf.fontSize(12)
       .font('Helvetica')
       .text(data.content, {
         align: 'justify',
         lineGap: 5
       })

    // Add footer with metadata
    pdf.moveDown(2)
       .fontSize(10)
       .fillColor('#666666')
       .text(`Document created: ${new Date(data.created_at).toLocaleDateString()}`, { align: 'left' })
       .text(`Last updated: ${new Date(data.updated_at).toLocaleDateString()}`, { align: 'left' })
       .text(`Word count: ${data.word_count}`, { align: 'left' })

    // Finalize the PDF
    pdf.end()
  } catch (error) {
    console.error('Error downloading document as PDF:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to download document'
    })
  }
})

// Export all documents as ZIP
router.get('/export-all', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      throw error
    }

    if (!documents || documents.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No documents found to export'
      })
    }

    // Set response headers for ZIP download
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="wordwise-documents-${new Date().toISOString().split('T')[0]}.zip"`)

    // Create archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    })

    // Handle archive errors
    archive.on('error', (err) => {
      throw err
    })

    // Pipe archive data to response
    archive.pipe(res)

    // Add each document as a text file
    documents.forEach((doc) => {
      const filename = `${doc.title.replace(/[^a-z0-9]/gi, '_')}.txt`
      const content = `${doc.title}\n${'='.repeat(doc.title.length)}\n\n${doc.content}\n\n---\nDocument created: ${new Date(doc.created_at).toLocaleDateString()}\nLast updated: ${new Date(doc.updated_at).toLocaleDateString()}\nWord count: ${doc.word_count}`
      
      archive.append(content, { name: filename })
    })

    // Add manifest file with metadata
    const manifest = {
      exportDate: new Date().toISOString(),
      documentCount: documents.length,
      totalWords: documents.reduce((sum, doc) => sum + doc.word_count, 0),
      documents: documents.map(doc => ({
        title: doc.title,
        wordCount: doc.word_count,
        created: doc.created_at,
        updated: doc.updated_at
      }))
    }

    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })

    // Finalize the archive
    await archive.finalize()
  } catch (error) {
    console.error('Error exporting all documents:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to export documents'
    })
  }
})

// Version Control Endpoints

// Get version history for a document
router.get('/:id/versions', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    // Verify user owns the document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (docError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }

    // Get versions
    const { data: versions, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', req.params.id)
      .order('version_number', { ascending: false })

    if (error) throw error

    res.status(200).json({
      success: true,
      versions: versions || []
    })
  } catch (error) {
    console.error('Error fetching versions:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch version history'
    })
  }
})

// Get a specific version
router.get('/:id/versions/:versionId', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    // Get version with document ownership check
    const { data: version, error } = await supabase
      .from('document_versions')
      .select(`
        *,
        documents!inner(user_id)
      `)
      .eq('id', req.params.versionId)
      .eq('document_id', req.params.id)
      .eq('documents.user_id', req.user.id)
      .single()

    if (error || !version) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      })
    }

    res.status(200).json({
      success: true,
      version
    })
  } catch (error) {
    console.error('Error fetching version:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch version'
    })
  }
})

// Create a new version
router.post('/:id/versions', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { commitMessage, isMajorVersion = false, isAutomatic = false } = req.body

    // Get the document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (docError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }

    // Get the latest version to calculate diff summary
    const { data: latestVersion } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', req.params.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    let diffSummary = null
    if (latestVersion) {
      const oldWords = latestVersion.content.split(/\s+/).filter((w: string) => w.length > 0)
      const newWords = document.content.split(/\s+/).filter((w: string) => w.length > 0)
      const oldParagraphs = latestVersion.content.split(/\n\n+/).filter((p: string) => p.trim().length > 0)
      const newParagraphs = document.content.split(/\n\n+/).filter((p: string) => p.trim().length > 0)

      diffSummary = {
        words_added: Math.max(0, newWords.length - oldWords.length),
        words_removed: Math.max(0, oldWords.length - newWords.length),
        paragraphs_changed: Math.abs(newParagraphs.length - oldParagraphs.length)
      }
    }

    // Get next version number
    const { data: versionNumber, error: versionError } = await supabase
      .rpc('get_next_version_number', { 
        doc_id: req.params.id, 
        is_major: isMajorVersion 
      })

    if (versionError) throw versionError

    // Create the version
    const { data: version, error } = await supabase
      .from('document_versions')
      .insert({
        document_id: req.params.id,
        version_number: versionNumber,
        title: document.title,
        content: document.content,
        created_by: req.user.id,
        commit_message: commitMessage || (isAutomatic ? 'Auto-save' : isMajorVersion ? 'Major update' : 'Minor update'),
        word_count: document.word_count,
        character_count: document.character_count,
        is_major_version: isMajorVersion,
        is_automatic: isAutomatic,
        diff_summary: diffSummary
      })
      .select()
      .single()

    if (error) throw error

    // If automatic version, clean up old ones
    if (isAutomatic) {
      try {
        await supabase.rpc('cleanup_old_automatic_versions', { doc_id: req.params.id })
      } catch (cleanupError) {
        console.error('Error cleaning up old automatic versions:', cleanupError)
        // Don't throw - the version was created successfully
      }
    }

    res.status(201).json({
      success: true,
      version
    })
  } catch (error) {
    console.error('Error creating version:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create version'
    })
  }
})

// Restore a version
router.post('/:id/versions/:versionId/restore', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { message } = req.body

    // Get the version to restore
    const { data: version, error: versionError } = await supabase
      .from('document_versions')
      .select(`
        *,
        documents!inner(user_id)
      `)
      .eq('id', req.params.versionId)
      .eq('document_id', req.params.id)
      .eq('documents.user_id', req.user.id)
      .single()

    if (versionError || !version) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      })
    }

    // Update the document
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        title: version.title,
        content: version.content,
        word_count: version.word_count,
        character_count: version.character_count,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)

    if (updateError) throw updateError

    // Create a new version marking the restore
    const { data: versionNumber } = await supabase
      .rpc('get_next_version_number', { 
        doc_id: req.params.id, 
        is_major: true 
      })

    const { data: newVersion, error: newVersionError } = await supabase
      .from('document_versions')
      .insert({
        document_id: req.params.id,
        version_number: versionNumber,
        title: version.title,
        content: version.content,
        created_by: req.user.id,
        commit_message: message || `Restored from version ${version.version_number}`,
        word_count: version.word_count,
        character_count: version.character_count,
        is_major_version: true
      })
      .select()
      .single()

    if (newVersionError) throw newVersionError

    res.status(200).json({
      success: true,
      message: 'Version restored successfully',
      version: newVersion
    })
  } catch (error) {
    console.error('Error restoring version:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to restore version'
    })
  }
})

// Compare two versions
router.get('/:id/versions/compare', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { from, to } = req.query

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: 'Both "from" and "to" version IDs are required'
      })
    }

    // Check cache first
    const { data: cached } = await supabase
      .from('version_comparisons')
      .select('*')
      .or(`version_from.eq.${from},version_from.eq.${to}`)
      .or(`version_to.eq.${from},version_to.eq.${to}`)
      .single()

    if (cached) {
      return res.status(200).json({
        success: true,
        comparison: cached
      })
    }

    // Get both versions with ownership check
    const [fromResult, toResult] = await Promise.all([
      supabase
        .from('document_versions')
        .select(`
          *,
          documents!inner(user_id)
        `)
        .eq('id', from)
        .eq('documents.user_id', req.user.id)
        .single(),
      supabase
        .from('document_versions')
        .select(`
          *,
          documents!inner(user_id)
        `)
        .eq('id', to)
        .eq('documents.user_id', req.user.id)
        .single()
    ])

    if (fromResult.error || toResult.error || !fromResult.data || !toResult.data) {
      return res.status(404).json({
        success: false,
        error: 'One or both versions not found'
      })
    }

    // Calculate diff (simple line-based diff)
    const oldLines = fromResult.data.content.split('\n')
    const newLines = toResult.data.content.split('\n')
    
    const segments = []
    let additions = 0
    let deletions = 0
    let modifications = 0

    // Simple diff algorithm
    let i = 0, j = 0
    while (i < oldLines.length || j < newLines.length) {
      if (i >= oldLines.length) {
        segments.push({
          type: 'added',
          content: newLines[j],
          startLine: j + 1,
          endLine: j + 1
        })
        additions++
        j++
      } else if (j >= newLines.length) {
        segments.push({
          type: 'removed',
          content: oldLines[i],
          startLine: i + 1,
          endLine: i + 1
        })
        deletions++
        i++
      } else if (oldLines[i] === newLines[j]) {
        segments.push({
          type: 'unchanged',
          content: oldLines[i],
          startLine: j + 1,
          endLine: j + 1
        })
        i++
        j++
      } else {
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

    const diffData = {
      segments,
      statistics: {
        additions,
        deletions,
        modifications
      }
    }

    // Cache the comparison
    const { data: comparison, error: cacheError } = await supabase
      .from('version_comparisons')
      .insert({
        version_from: from as string,
        version_to: to as string,
        diff_data: diffData
      })
      .select()
      .single()

    if (cacheError) {
      console.error('Error caching comparison:', cacheError)
    }

    res.status(200).json({
      success: true,
      comparison: comparison || { diff_data: diffData }
    })
  } catch (error) {
    console.error('Error comparing versions:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to compare versions'
    })
  }
})

// Get version tags for a document
router.get('/:id/version-tags', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    // Verify user owns the document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (docError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }

    // Get tags
    const { data: tags, error } = await supabase
      .from('document_version_tags')
      .select('*')
      .eq('document_id', req.params.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.status(200).json({
      success: true,
      tags: tags || []
    })
  } catch (error) {
    console.error('Error fetching version tags:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch version tags'
    })
  }
})

// Create a version tag
router.post('/:id/versions/:versionId/tag', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const { tagName } = req.body

    if (!tagName || !tagName.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Tag name is required'
      })
    }

    // Verify version belongs to user's document
    const { data: version, error: versionError } = await supabase
      .from('document_versions')
      .select(`
        id,
        documents!inner(user_id)
      `)
      .eq('id', req.params.versionId)
      .eq('document_id', req.params.id)
      .eq('documents.user_id', req.user.id)
      .single()

    if (versionError || !version) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      })
    }

    // Create tag
    const { data: tag, error } = await supabase
      .from('document_version_tags')
      .insert({
        document_id: req.params.id,
        version_id: req.params.versionId,
        tag_name: tagName.trim(),
        created_by: req.user.id
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({
          success: false,
          error: 'A tag with this name already exists for this document'
        })
      }
      throw error
    }

    res.status(201).json({
      success: true,
      tag
    })
  } catch (error) {
    console.error('Error creating version tag:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create version tag'
    })
  }
})

// Delete a version tag
router.delete('/:id/version-tags/:tagId', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    // Verify tag belongs to user's document
    const { data: tag, error: tagError } = await supabase
      .from('document_version_tags')
      .select(`
        id,
        documents!inner(user_id)
      `)
      .eq('id', req.params.tagId)
      .eq('document_id', req.params.id)
      .eq('documents.user_id', req.user.id)
      .single()

    if (tagError || !tag) {
      return res.status(404).json({
        success: false,
        error: 'Tag not found'
      })
    }

    // Delete tag
    const { error } = await supabase
      .from('document_version_tags')
      .delete()
      .eq('id', req.params.tagId)

    if (error) throw error

    res.status(200).json({
      success: true,
      message: 'Tag deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting version tag:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete version tag'
    })
  }
})

// Upload a single document
router.post('/upload', upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      })
    }

    // Parse the uploaded file
    const parsedDoc = await FileParser.parseFile(req.file.buffer, req.file.originalname)
    
    // Check if title override was provided
    const title = req.body.title || parsedDoc.title

    // Create document in database
    const now = new Date().toISOString()
    const documentData = {
      title,
      content: parsedDoc.content,
      user_id: req.user.id,
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

    if (error) {
      throw error
    }

    res.status(201).json({
      success: true,
      document: data,
      message: 'Document uploaded successfully'
    })
  } catch (error) {
    console.error('Error uploading document:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload document'
    res.status(500).json({
      success: false,
      error: errorMessage
    })
  }
})

// Bulk upload documents
router.post('/upload-bulk', uploadMultiple.array('files', 10), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      })
    }

    const results: any[] = []
    const errors: any[] = []

    // Process each file
    for (const file of req.files) {
      try {
        // Check if it's a ZIP file
        if (file.originalname.toLowerCase().endsWith('.zip')) {
          // Extract and process ZIP contents
          const zip = new AdmZip(file.buffer)
          const zipEntries = zip.getEntries()

          for (const entry of zipEntries) {
            if (entry.isDirectory) continue
            
            const fileName = entry.entryName
            const fileBuffer = entry.getData()
            
            try {
              const parsedDoc = await FileParser.parseFile(fileBuffer, fileName)
              
              const now = new Date().toISOString()
              const documentData = {
                title: parsedDoc.title,
                content: parsedDoc.content,
                user_id: req.user.id,
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
              
              results.push({
                filename: fileName,
                documentId: data.id,
                title: data.title
              })
            } catch (err) {
              errors.push({
                filename: fileName,
                error: err instanceof Error ? err.message : 'Unknown error'
              })
            }
          }
        } else {
          // Process regular file
          const parsedDoc = await FileParser.parseFile(file.buffer, file.originalname)
          
          const now = new Date().toISOString()
          const documentData = {
            title: parsedDoc.title,
            content: parsedDoc.content,
            user_id: req.user.id,
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
          
          results.push({
            filename: file.originalname,
            documentId: data.id,
            title: data.title
          })
        }
      } catch (err) {
        errors.push({
          filename: file.originalname,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    res.status(200).json({
      success: true,
      message: `Uploaded ${results.length} documents successfully`,
      results,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Error in bulk upload:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to process bulk upload'
    })
  }
})

export default router 