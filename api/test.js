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
    const { method, headers } = req
    
    return res.status(200).json({
      success: true,
      message: 'API is working',
      method,
      timestamp: new Date().toISOString(),
      environment: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasLanguageToolUrl: !!process.env.LANGUAGETOOL_API_URL,
        nodeVersion: process.version,
        platform: process.platform
      },
      headers: {
        hasAuthorization: !!headers.authorization,
        authType: headers.authorization?.split(' ')[0] || 'none'
      }
    })

  } catch (error) {
    console.error('Test API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    })
  }
} 