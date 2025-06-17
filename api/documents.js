import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    const { method, body, headers, query } = req
    const authHeader = headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      })
    }

    // Handle different document operations
    if (method === 'GET') {
      // Get all documents for user or specific document
      if (query.id) {
        return await getDocument(query.id, user.id, res)
      } else {
        return await getDocuments(user.id, res)
      }
    }

    if (method === 'POST') {
      // Create new document
      return await createDocument(body, user.id, res)
    }

    if (method === 'PUT' || method === 'PATCH') {
      // Update document
      return await updateDocument(query.id, body, user.id, res)
    }

    if (method === 'DELETE') {
      // Delete document
      return await deleteDocument(query.id, user.id, res)
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })

  } catch (error) {
    console.error('Documents API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function getDocuments(userId, res) {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error

    return res.status(200).json({
      success: true,
      documents: data
    })
  } catch (error) {
    throw error
  }
}

async function getDocument(documentId, userId, res) {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single()

    if (error) throw error

    return res.status(200).json({
      success: true,
      document: data
    })
  } catch (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }
    throw error
  }
}

async function createDocument(body, userId, res) {
  try {
    const { title, content = '' } = body

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      })
    }

    const now = new Date().toISOString()
    const documentData = {
      title,
      content,
      user_id: userId,
      created_at: now,
      updated_at: now,
      word_count: content.split(/\s+/).filter(word => word.length > 0).length,
      character_count: content.length,
    }

    const { data, error } = await supabase
      .from('documents')
      .insert([documentData])
      .select()
      .single()

    if (error) throw error

    return res.status(201).json({
      success: true,
      document: data
    })
  } catch (error) {
    throw error
  }
}

async function updateDocument(documentId, body, userId, res) {
  try {
    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      })
    }

    const { title, content } = body
    const updateData = {
      updated_at: new Date().toISOString(),
    }
    
    if (title !== undefined) updateData.title = title
    if (content !== undefined) {
      updateData.content = content
      updateData.word_count = content.split(/\s+/).filter(word => word.length > 0).length
      updateData.character_count = content.length
    }

    const { data, error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    return res.status(200).json({
      success: true,
      document: data
    })
  } catch (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      })
    }
    throw error
  }
}

async function deleteDocument(documentId, userId, res) {
  try {
    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      })
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', userId)

    if (error) throw error

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    })
  } catch (error) {
    throw error
  }
} 