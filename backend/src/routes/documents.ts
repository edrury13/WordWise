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