import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { AuthenticatedRequest } from '../middleware/auth'

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

export default router 