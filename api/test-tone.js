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
    return res.status(200).end()
  }

  // Simple test of tone rewriting without authentication
  const testText = "I can't believe this is awesome! Yeah, it's gonna be great."
  const tone = 'professional'
  
  console.log('🧪 Testing tone rewrite with:', { testText, tone })
  
  // Simple professional transformation
  let rewrittenText = testText
  rewrittenText = rewrittenText.replace(/can't/gi, 'cannot')
  rewrittenText = rewrittenText.replace(/awesome/gi, 'excellent')
  rewrittenText = rewrittenText.replace(/yeah/gi, 'yes')
  rewrittenText = rewrittenText.replace(/it's/gi, 'it is')
  rewrittenText = rewrittenText.replace(/gonna/gi, 'going to')
  rewrittenText = rewrittenText.replace(/great/gi, 'excellent')
  
  const hasChanges = rewrittenText !== testText
  
  console.log('🧪 Test result:', {
    original: testText,
    rewritten: rewrittenText,
    hasChanges,
    originalLength: testText.length,
    rewrittenLength: rewrittenText.length
  })
  
  return res.status(200).json({
    success: true,
    test: 'tone-rewrite',
    original: testText,
    rewritten: rewrittenText,
    hasChanges,
    transformations: [
      "can't → cannot",
      "awesome → excellent", 
      "yeah → yes",
      "it's → it is",
      "gonna → going to",
      "great → excellent"
    ]
  })
} 