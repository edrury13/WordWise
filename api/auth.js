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
    const { method, body, headers } = req
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

    // Handle different auth endpoints
    if (method === 'GET' && req.url === '/api/auth/user') {
      return res.status(200).json({
        success: true,
        user
      })
    }

    if (method === 'POST' && req.url === '/api/auth/logout') {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      })
    }

    return res.status(404).json({
      success: false,
      error: 'Route not found'
    })

  } catch (error) {
    console.error('Auth API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
} 