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

    // Route to appropriate handler based on query parameters
    if (query.action === 'list') {
      return await getVersionHistory(query.documentId, user.id, res)
    }
    
    if (query.action === 'get') {
      return await getVersion(query.documentId, query.versionId, user.id, res)
    }
    
    if (query.action === 'create' && method === 'POST') {
      return await createVersion(query.documentId, body, user.id, res)
    }
    
    if (query.action === 'restore' && method === 'POST') {
      return await restoreVersion(query.documentId, query.versionId, body, user.id, res)
    }
    
    if (query.action === 'compare') {
      return await compareVersions(query.from, query.to, user.id, res)
    }
    
    if (query.action === 'tags') {
      return await getVersionTags(query.documentId, user.id, res)
    }
    
    if (query.action === 'tag' && method === 'POST') {
      return await createVersionTag(query.documentId, query.versionId, body, user.id, res)
    }
    
    if (query.action === 'untag' && method === 'DELETE') {
      return await deleteVersionTag(query.documentId, query.tagId, user.id, res)
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid action'
    })

  } catch (error) {
    console.error('Document versions API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function getVersionHistory(documentId, userId, res) {
  try {
    // Verify user owns the document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .eq('user_id', userId)
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
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })

    if (error) throw error

    return res.status(200).json({
      success: true,
      versions: versions || []
    })
  } catch (error) {
    throw error
  }
}

async function getVersion(documentId, versionId, userId, res) {
  try {
    // Get version with document ownership check
    const { data: version, error } = await supabase
      .from('document_versions')
      .select(`
        *,
        documents!inner(user_id)
      `)
      .eq('id', versionId)
      .eq('document_id', documentId)
      .eq('documents.user_id', userId)
      .single()

    if (error || !version) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      })
    }

    return res.status(200).json({
      success: true,
      version
    })
  } catch (error) {
    throw error
  }
}

async function createVersion(documentId, body, userId, res) {
  try {
    const { commitMessage, isMajorVersion = false, isAutomatic = false } = body

    // Get the document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
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
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    let diffSummary = null
    if (latestVersion) {
      const oldWords = latestVersion.content.split(/\s+/).filter(w => w.length > 0)
      const newWords = document.content.split(/\s+/).filter(w => w.length > 0)
      const oldParagraphs = latestVersion.content.split(/\n\n+/).filter(p => p.trim().length > 0)
      const newParagraphs = document.content.split(/\n\n+/).filter(p => p.trim().length > 0)

      diffSummary = {
        words_added: Math.max(0, newWords.length - oldWords.length),
        words_removed: Math.max(0, oldWords.length - newWords.length),
        paragraphs_changed: Math.abs(newParagraphs.length - oldParagraphs.length)
      }
    }

    // Get next version number
    const { data: versionNumber, error: versionError } = await supabase
      .rpc('get_next_version_number', { 
        doc_id: documentId, 
        is_major: isMajorVersion 
      })

    if (versionError) throw versionError

    // Create the version
    const { data: version, error } = await supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_number: versionNumber,
        title: document.title,
        content: document.content,
        created_by: userId,
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
        await supabase.rpc('cleanup_old_automatic_versions', { doc_id: documentId })
      } catch (cleanupError) {
        console.error('Error cleaning up old automatic versions:', cleanupError)
        // Don't throw - the version was created successfully
      }
    }

    return res.status(201).json({
      success: true,
      version
    })
  } catch (error) {
    throw error
  }
}

async function restoreVersion(documentId, versionId, body, userId, res) {
  try {
    const { message } = body

    // Get the version to restore
    const { data: version, error: versionError } = await supabase
      .from('document_versions')
      .select(`
        *,
        documents!inner(user_id)
      `)
      .eq('id', versionId)
      .eq('document_id', documentId)
      .eq('documents.user_id', userId)
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
      .eq('id', documentId)
      .eq('user_id', userId)

    if (updateError) throw updateError

    // Create a new version marking the restore
    const { data: versionNumber } = await supabase
      .rpc('get_next_version_number', { 
        doc_id: documentId, 
        is_major: true 
      })

    const { data: newVersion, error: newVersionError } = await supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_number: versionNumber,
        title: version.title,
        content: version.content,
        created_by: userId,
        commit_message: message || `Restored from version ${version.version_number}`,
        word_count: version.word_count,
        character_count: version.character_count,
        is_major_version: true
      })
      .select()
      .single()

    if (newVersionError) throw newVersionError

    return res.status(200).json({
      success: true,
      message: 'Version restored successfully',
      version: newVersion
    })
  } catch (error) {
    throw error
  }
}

async function compareVersions(versionFromId, versionToId, userId, res) {
  try {
    if (!versionFromId || !versionToId) {
      return res.status(400).json({
        success: false,
        error: 'Both "from" and "to" version IDs are required'
      })
    }

    // Check cache first
    const { data: cached } = await supabase
      .from('version_comparisons')
      .select('*')
      .or(`version_from.eq.${versionFromId},version_from.eq.${versionToId}`)
      .or(`version_to.eq.${versionFromId},version_to.eq.${versionToId}`)
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
        .eq('id', versionFromId)
        .eq('documents.user_id', userId)
        .single(),
      supabase
        .from('document_versions')
        .select(`
          *,
          documents!inner(user_id)
        `)
        .eq('id', versionToId)
        .eq('documents.user_id', userId)
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
        version_from: versionFromId,
        version_to: versionToId,
        diff_data: diffData
      })
      .select()
      .single()

    if (cacheError) {
      console.error('Error caching comparison:', cacheError)
    }

    return res.status(200).json({
      success: true,
      comparison: comparison || { diff_data: diffData }
    })
  } catch (error) {
    throw error
  }
}

async function getVersionTags(documentId, userId, res) {
  try {
    // Verify user owns the document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .eq('user_id', userId)
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
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return res.status(200).json({
      success: true,
      tags: tags || []
    })
  } catch (error) {
    throw error
  }
}

async function createVersionTag(documentId, versionId, body, userId, res) {
  try {
    const { tagName } = body

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
      .eq('id', versionId)
      .eq('document_id', documentId)
      .eq('documents.user_id', userId)
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
        document_id: documentId,
        version_id: versionId,
        tag_name: tagName.trim(),
        created_by: userId
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

    return res.status(201).json({
      success: true,
      tag
    })
  } catch (error) {
    throw error
  }
}

async function deleteVersionTag(documentId, tagId, userId, res) {
  try {
    // Verify tag belongs to user's document
    const { data: tag, error: tagError } = await supabase
      .from('document_version_tags')
      .select(`
        id,
        documents!inner(user_id)
      `)
      .eq('id', tagId)
      .eq('document_id', documentId)
      .eq('documents.user_id', userId)
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
      .eq('id', tagId)

    if (error) throw error

    return res.status(200).json({
      success: true,
      message: 'Tag deleted successfully'
    })
  } catch (error) {
    throw error
  }
} 