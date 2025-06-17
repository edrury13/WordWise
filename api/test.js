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

  console.log('Simple test API called:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  })

  return res.status(200).json({
    success: true,
    message: 'Simple API test successful!',
    timestamp: new Date().toISOString(),
    method: req.method,
    environment: process.env.NODE_ENV || 'unknown'
  })
} 