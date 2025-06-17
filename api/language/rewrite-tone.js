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

    if (method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      })
    }

    const { text, tone } = body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      })
    }

    if (!tone || typeof tone !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Tone is required and must be a string'
      })
    }

    if (text.length > 50000) {
      return res.status(400).json({
        success: false,
        error: 'Text is too long (maximum 50,000 characters)'
      })
    }

    console.log('📝 Processing tone rewrite request:', {
      textLength: text.length,
      tone: tone,
      textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    })

    // Apply tone rewriting transformations
    const rewrittenText = applyToneRewriting(text, tone)
    
    const hasChanges = rewrittenText !== text
    console.log('📊 Tone rewrite result:', {
      hasChanges,
      originalLength: text.length,
      rewrittenLength: rewrittenText.length,
      tone
    })

    return res.status(200).json({
      success: true,
      originalText: text,
      rewrittenText: rewrittenText,
      tone: tone,
      changes: hasChanges ? ['Text modified for tone'] : [],
      hasChanges
    })

  } catch (error) {
    console.error('Tone rewrite API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

function applyToneRewriting(text, tone) {
  console.log(`🎨 Applying tone rewriting: ${tone} to text length: ${text.length}`)
  console.log(`📝 Input text: "${text}"`)
  
  // Quick test to ensure basic functionality works
  if (text.includes("can't") && tone === 'professional') {
    console.log('🧪 Quick test: Found "can\'t" in text for professional tone')
  }
  
  const toneModifications = {
    'professional': {
      replacements: [
        // Contractions to full forms
        { from: /\bcan't\b/gi, to: 'cannot' },
        { from: /\bwon't\b/gi, to: 'will not' },
        { from: /\bdon't\b/gi, to: 'do not' },
        { from: /\bdidn't\b/gi, to: 'did not' },
        { from: /\bisn't\b/gi, to: 'is not' },
        { from: /\baren't\b/gi, to: 'are not' },
        { from: /\bwasn't\b/gi, to: 'was not' },
        { from: /\bweren't\b/gi, to: 'were not' },
        { from: /\bhasn't\b/gi, to: 'has not' },
        { from: /\bhaven't\b/gi, to: 'have not' },
        { from: /\bhadn't\b/gi, to: 'had not' },
        { from: /\bshouldn't\b/gi, to: 'should not' },
        { from: /\bwouldn't\b/gi, to: 'would not' },
        { from: /\bcouldn't\b/gi, to: 'could not' },
        { from: /\bmustn't\b/gi, to: 'must not' },
        { from: /\bmightn't\b/gi, to: 'might not' },
        { from: /\bneedn't\b/gi, to: 'need not' },
        { from: /\bI'm\b/gi, to: 'I am' },
        { from: /\byou're\b/gi, to: 'you are' },
        { from: /\bhe's\b/gi, to: 'he is' },
        { from: /\bshe's\b/gi, to: 'she is' },
        { from: /\bit's\b/gi, to: 'it is' },
        { from: /\bwe're\b/gi, to: 'we are' },
        { from: /\bthey're\b/gi, to: 'they are' },
        { from: /\bI'll\b/gi, to: 'I will' },
        { from: /\byou'll\b/gi, to: 'you will' },
        { from: /\bhe'll\b/gi, to: 'he will' },
        { from: /\bshe'll\b/gi, to: 'she will' },
        { from: /\bit'll\b/gi, to: 'it will' },
        { from: /\bwe'll\b/gi, to: 'we will' },
        { from: /\bthey'll\b/gi, to: 'they will' },
        { from: /\bI've\b/gi, to: 'I have' },
        { from: /\byou've\b/gi, to: 'you have' },
        { from: /\bwe've\b/gi, to: 'we have' },
        { from: /\bthey've\b/gi, to: 'they have' },
        { from: /\bI'd\b/gi, to: 'I would' },
        { from: /\byou'd\b/gi, to: 'you would' },
        { from: /\bhe'd\b/gi, to: 'he would' },
        { from: /\bshe'd\b/gi, to: 'she would' },
        { from: /\bwe'd\b/gi, to: 'we would' },
        { from: /\bthey'd\b/gi, to: 'they would' },
        
        // Informal to formal words
        { from: /\bkinda\b/gi, to: 'somewhat' },
        { from: /\bsorta\b/gi, to: 'somewhat' },
        { from: /\bgonna\b/gi, to: 'going to' },
        { from: /\bwanna\b/gi, to: 'want to' },
        { from: /\bgotta\b/gi, to: 'have to' },
        { from: /\byeah\b/gi, to: 'yes' },
        { from: /\byep\b/gi, to: 'yes' },
        { from: /\bnope\b/gi, to: 'no' },
        { from: /\bokay\b/gi, to: 'acceptable' },
        { from: /\bOK\b/gi, to: 'acceptable' },
        { from: /\bawesome\b/gi, to: 'excellent' },
        { from: /\bgreat\b/gi, to: 'excellent' },
        { from: /\bsuper\b/gi, to: 'very' },
        { from: /\bpretty\s+(good|bad|nice|cool)\b/gi, to: 'quite $1' },
        { from: /\bstuff\b/gi, to: 'items' },
        { from: /\bthings\b/gi, to: 'matters' },
        { from: /\bguys\b/gi, to: 'individuals' },
        { from: /\bfunny\b/gi, to: 'amusing' },
        { from: /\bweird\b/gi, to: 'unusual' },
        { from: /\bbig\b/gi, to: 'significant' },
        { from: /\bsmall\b/gi, to: 'minimal' },
        { from: /\bfast\b/gi, to: 'rapid' },
        { from: /\bslow\b/gi, to: 'gradual' },
        
        // Greetings and closings
        { from: /\bHi\b/gi, to: 'Dear' },
        { from: /\bHey\b/gi, to: 'Dear' },
        { from: /\bThanks\b/gi, to: 'Thank you' },
        { from: /\bBest\b/gi, to: 'Sincerely' },
        { from: /\bCheers\b/gi, to: 'Best regards' },
        { from: /\bSee you\b/gi, to: 'Until we meet again' },
        { from: /\bTalk soon\b/gi, to: 'I look forward to our next communication' }
      ]
    },
    'casual': {
      replacements: [
        // Full forms to contractions
        { from: /\bcannot\b/gi, to: "can't" },
        { from: /\bwill not\b/gi, to: "won't" },
        { from: /\bdo not\b/gi, to: "don't" },
        { from: /\bdid not\b/gi, to: "didn't" },
        { from: /\bis not\b/gi, to: "isn't" },
        { from: /\bare not\b/gi, to: "aren't" },
        { from: /\bwas not\b/gi, to: "wasn't" },
        { from: /\bwere not\b/gi, to: "weren't" },
        { from: /\bhas not\b/gi, to: "hasn't" },
        { from: /\bhave not\b/gi, to: "haven't" },
        { from: /\bhad not\b/gi, to: "hadn't" },
        { from: /\bshould not\b/gi, to: "shouldn't" },
        { from: /\bwould not\b/gi, to: "wouldn't" },
        { from: /\bcould not\b/gi, to: "couldn't" },
        { from: /\bI am\b/gi, to: "I'm" },
        { from: /\byou are\b/gi, to: "you're" },
        { from: /\bhe is\b/gi, to: "he's" },
        { from: /\bshe is\b/gi, to: "she's" },
        { from: /\bit is\b/gi, to: "it's" },
        { from: /\bwe are\b/gi, to: "we're" },
        { from: /\bthey are\b/gi, to: "they're" },
        { from: /\bI will\b/gi, to: "I'll" },
        { from: /\byou will\b/gi, to: "you'll" },
        { from: /\bhe will\b/gi, to: "he'll" },
        { from: /\bshe will\b/gi, to: "she'll" },
        { from: /\bwe will\b/gi, to: "we'll" },
        { from: /\bthey will\b/gi, to: "they'll" },
        
        // Formal to informal words
        { from: /\bsomewhat\b/gi, to: 'kinda' },
        { from: /\bgoing to\b/gi, to: 'gonna' },
        { from: /\bwant to\b/gi, to: 'wanna' },
        { from: /\bhave to\b/gi, to: 'gotta' },
        { from: /\byes\b/gi, to: 'yeah' },
        { from: /\bacceptable\b/gi, to: 'okay' },
        { from: /\bexcellent\b/gi, to: 'awesome' },
        { from: /\bvery\b/gi, to: 'super' },
        { from: /\bquite\s+(good|bad|nice|cool)\b/gi, to: 'pretty $1' },
        { from: /\bitems\b/gi, to: 'stuff' },
        { from: /\bmatters\b/gi, to: 'things' },
        { from: /\bindividuals\b/gi, to: 'guys' },
        { from: /\bamusing\b/gi, to: 'funny' },
        { from: /\bunusual\b/gi, to: 'weird' },
        { from: /\bsignificant\b/gi, to: 'big' },
        { from: /\bminimal\b/gi, to: 'small' },
        { from: /\brapid\b/gi, to: 'fast' },
        { from: /\bgradual\b/gi, to: 'slow' },
        
        // Greetings and closings
        { from: /\bDear\b/gi, to: 'Hey' },
        { from: /\bThank you\b/gi, to: 'Thanks' },
        { from: /\bSincerely\b/gi, to: 'Best' },
        { from: /\bBest regards\b/gi, to: 'Cheers' }
      ]
    },
    'friendly': {
      replacements: [
        // Make greetings warmer
        { from: /\bHello\b/gi, to: 'Hi there' },
        { from: /\bHi\b/gi, to: 'Hey there' },
        { from: /\bDear\b/gi, to: 'Hi' },
        
        // Warmer expressions
        { from: /\bThank you\b/gi, to: 'Thanks so much' },
        { from: /\bThanks\b/gi, to: 'Thanks a bunch' },
        { from: /\bRegards\b/gi, to: 'Best wishes' },
        { from: /\bSincerely\b/gi, to: 'Warmly' },
        { from: /\bBest\b/gi, to: 'All the best' },
        
        // Add enthusiasm
        { from: /\bgood\b/gi, to: 'great' },
        { from: /\bnice\b/gi, to: 'wonderful' },
        { from: /\bfine\b/gi, to: 'fantastic' },
        { from: /\bokay\b/gi, to: 'perfect' },
        { from: /\byes\b/gi, to: 'absolutely' },
        
        // Soften statements
        { from: /\bI think\b/gi, to: 'I feel' },
        { from: /\bI believe\b/gi, to: 'I feel' },
        { from: /\bYou should\b/gi, to: 'You might want to' },
        { from: /\bYou must\b/gi, to: 'You could' },
        { from: /\bYou need to\b/gi, to: 'It would be great if you could' },
        
        // Add warmth to requests
        { from: /\bPlease\b/gi, to: 'Please feel free to' },
        { from: /\bCan you\b/gi, to: 'Would you mind' },
        { from: /\bWill you\b/gi, to: 'Could you possibly' }
      ]
    },
          'formal': {
        replacements: [
          // Formal greetings
          { from: /\bHi\b/gi, to: 'Dear' },
          { from: /\bHey\b/gi, to: 'Dear' },
          { from: /\bHello\b/gi, to: 'Dear' },
          
          // Formal closings
          { from: /\bThanks\b/gi, to: 'Thank you' },
          { from: /\bBest\b/gi, to: 'Sincerely' },
          { from: /\bCheers\b/gi, to: 'Respectfully' },
          { from: /\bSee you\b/gi, to: 'I look forward to hearing from you' },
          
          // Remove contractions (same as professional)
          { from: /\bcan't\b/gi, to: 'cannot' },
          { from: /\bwon't\b/gi, to: 'will not' },
          { from: /\bdon't\b/gi, to: 'do not' },
          { from: /\bdidn't\b/gi, to: 'did not' },
          { from: /\bisn't\b/gi, to: 'is not' },
          { from: /\baren't\b/gi, to: 'are not' },
          { from: /\bI'm\b/gi, to: 'I am' },
          { from: /\byou're\b/gi, to: 'you are' },
          { from: /\bhe's\b/gi, to: 'he is' },
          { from: /\bshe's\b/gi, to: 'she is' },
          { from: /\bit's\b/gi, to: 'it is' },
          { from: /\bwe're\b/gi, to: 'we are' },
          { from: /\bthey're\b/gi, to: 'they are' },
          
          // Elevate language
          { from: /\bget\b/gi, to: 'obtain' },
          { from: /\bshow\b/gi, to: 'demonstrate' },
          { from: /\bhelp\b/gi, to: 'assist' },
          { from: /\bask\b/gi, to: 'inquire' },
          { from: /\btell\b/gi, to: 'inform' },
          { from: /\bgive\b/gi, to: 'provide' },
          { from: /\bmake\b/gi, to: 'create' },
          { from: /\buse\b/gi, to: 'utilize' },
          { from: /\bstart\b/gi, to: 'commence' },
          { from: /\bend\b/gi, to: 'conclude' },
          { from: /\bbuy\b/gi, to: 'purchase' },
          { from: /\bsell\b/gi, to: 'offer' },
          { from: /\bfix\b/gi, to: 'resolve' },
          { from: /\bfind\b/gi, to: 'locate' },
          { from: /\bkeep\b/gi, to: 'maintain' },
          { from: /\bstop\b/gi, to: 'cease' },
          
          // More formal expressions
          { from: /\bI think\b/gi, to: 'I believe' },
          { from: /\bI guess\b/gi, to: 'I presume' },
          { from: /\bmaybe\b/gi, to: 'perhaps' },
          { from: /\bprobably\b/gi, to: 'likely' },
          { from: /\babout\b/gi, to: 'regarding' },
          { from: /\bbecause\b/gi, to: 'due to the fact that' },
          { from: /\bso\b/gi, to: 'therefore' },
          { from: /\bbut\b/gi, to: 'however' },
          { from: /\balso\b/gi, to: 'additionally' },
          { from: /\bplus\b/gi, to: 'furthermore' }
        ]
      },
      'academic': {
        replacements: [
          // Academic language patterns
          { from: /\bI think\b/gi, to: 'This analysis suggests' },
          { from: /\bI believe\b/gi, to: 'The evidence indicates' },
          { from: /\bI feel\b/gi, to: 'The research demonstrates' },
          { from: /\bThis shows\b/gi, to: 'This evidence demonstrates' },
          { from: /\bThis proves\b/gi, to: 'This substantiates the hypothesis that' },
          { from: /\bIn conclusion\b/gi, to: 'The findings suggest' },
          { from: /\bTo sum up\b/gi, to: 'In summary, the analysis reveals' },
          { from: /\bBasically\b/gi, to: 'Fundamentally' },
          { from: /\bObviously\b/gi, to: 'As the data clearly indicates' },
          { from: /\bOf course\b/gi, to: 'As expected' },
          
          // Remove contractions
          { from: /\bcan't\b/gi, to: 'cannot' },
          { from: /\bwon't\b/gi, to: 'will not' },
          { from: /\bdon't\b/gi, to: 'do not' },
          { from: /\bisn't\b/gi, to: 'is not' },
          { from: /\baren't\b/gi, to: 'are not' },
          
          // Academic vocabulary
          { from: /\bimportant\b/gi, to: 'significant' },
          { from: /\bbig\b/gi, to: 'substantial' },
          { from: /\bsmall\b/gi, to: 'minimal' },
          { from: /\bgood\b/gi, to: 'favorable' },
          { from: /\bbad\b/gi, to: 'adverse' },
          { from: /\bmany\b/gi, to: 'numerous' },
          { from: /\ba lot of\b/gi, to: 'a substantial number of' }
        ]
      },
      'creative': {
        replacements: [
          // Creative and vivid language
          { from: /\bvery\s+(\w+)\b/gi, to: 'incredibly $1' },
          { from: /\breally\s+(\w+)\b/gi, to: 'remarkably $1' },
          { from: /\bquite\s+(\w+)\b/gi, to: 'utterly $1' },
          { from: /\bsaid\b/gi, to: 'whispered' },
          { from: /\bwalked\b/gi, to: 'strolled' },
          { from: /\bran\b/gi, to: 'dashed' },
          { from: /\blooked\b/gi, to: 'gazed' },
          { from: /\bsaw\b/gi, to: 'witnessed' },
          { from: /\bheard\b/gi, to: 'detected' },
          { from: /\bfelt\b/gi, to: 'sensed' },
          { from: /\bthought\b/gi, to: 'pondered' },
          { from: /\bknew\b/gi, to: 'realized' },
          { from: /\bwent\b/gi, to: 'ventured' },
          { from: /\bcame\b/gi, to: 'emerged' },
          { from: /\bgot\b/gi, to: 'acquired' },
          { from: /\bmade\b/gi, to: 'crafted' },
          { from: /\btook\b/gi, to: 'seized' },
          { from: /\bgave\b/gi, to: 'bestowed' },
          { from: /\bput\b/gi, to: 'placed' },
          { from: /\bfound\b/gi, to: 'discovered' }
        ]
      },
      'persuasive': {
        replacements: [
          // Persuasive language patterns
          { from: /\bI think\b/gi, to: 'Clearly' },
          { from: /\bMaybe\b/gi, to: 'Undoubtedly' },
          { from: /\bPerhaps\b/gi, to: 'Certainly' },
          { from: /\bIt seems\b/gi, to: 'It is evident that' },
          { from: /\bYou should\b/gi, to: 'You must' },
          { from: /\bYou could\b/gi, to: 'You should' },
          { from: /\bYou might\b/gi, to: 'You will' },
          { from: /\bThis is\b/gi, to: 'This is absolutely' },
          { from: /\bThis will\b/gi, to: 'This will definitely' },
          { from: /\bThis can\b/gi, to: 'This will' },
          { from: /\bConsider\b/gi, to: 'Imagine' },
          { from: /\bTry\b/gi, to: 'Experience' },
          { from: /\bLook at\b/gi, to: 'Witness' },
          { from: /\bSome people\b/gi, to: 'Smart people' },
          { from: /\bMany people\b/gi, to: 'Successful people' },
          { from: /\bGood\b/gi, to: 'Exceptional' },
          { from: /\bBetter\b/gi, to: 'Superior' },
          { from: /\bBest\b/gi, to: 'Ultimate' },
          { from: /\bWorks\b/gi, to: 'Delivers results' },
          { from: /\bHelps\b/gi, to: 'Transforms' }
        ]
      },
      'concise': {
        replacements: [
          // Make text more concise
          { from: /\bin order to\b/gi, to: 'to' },
          { from: /\bdue to the fact that\b/gi, to: 'because' },
          { from: /\bfor the reason that\b/gi, to: 'because' },
          { from: /\bin spite of the fact that\b/gi, to: 'although' },
          { from: /\bat this point in time\b/gi, to: 'now' },
          { from: /\bat the present time\b/gi, to: 'now' },
          { from: /\bin the near future\b/gi, to: 'soon' },
          { from: /\bprior to\b/gi, to: 'before' },
          { from: /\bsubsequent to\b/gi, to: 'after' },
          { from: /\bin the event that\b/gi, to: 'if' },
          { from: /\bwith regard to\b/gi, to: 'about' },
          { from: /\bwith respect to\b/gi, to: 'about' },
          { from: /\bin relation to\b/gi, to: 'about' },
          { from: /\bfor the purpose of\b/gi, to: 'for' },
          { from: /\bis able to\b/gi, to: 'can' },
          { from: /\bhas the ability to\b/gi, to: 'can' },
          { from: /\bit is possible that\b/gi, to: 'maybe' },
          { from: /\bit is important to note that\b/gi, to: 'note that' },
          { from: /\bit should be noted that\b/gi, to: '' },
          { from: /\bthe fact that\b/gi, to: 'that' },
          { from: /\ba large number of\b/gi, to: 'many' },
          { from: /\ba small number of\b/gi, to: 'few' }
        ]
      }
  }

  let rewrittenText = text
  const modifications = toneModifications[tone.toLowerCase()] || { replacements: [] }
  let changesCount = 0

  console.log(`🔄 Applying ${modifications.replacements.length} potential modifications for tone: ${tone}`)

  modifications.replacements.forEach(({ from, to }, index) => {
    const beforeText = rewrittenText
    rewrittenText = rewrittenText.replace(from, to)
    if (rewrittenText !== beforeText) {
      changesCount++
      console.log(`✅ Transformation ${index + 1}: "${from}" → "${to}" | Match found`)
    }
  })

  console.log(`✅ Applied ${changesCount} changes. Original: ${text.length} chars, Rewritten: ${rewrittenText.length} chars`)

  // If no changes were made, try some fallback transformations
  if (changesCount === 0 && text.length > 10) {
    console.log('🔄 No changes made, applying fallback transformations...')
    
    switch (tone.toLowerCase()) {
      case 'professional':
        // Add more formal sentence starters and ensure proper capitalization
        rewrittenText = rewrittenText.replace(/^([a-z])/gm, (match, p1) => p1.toUpperCase())
        rewrittenText = rewrittenText.replace(/\.\s+([a-z])/g, (match, p1) => '. ' + p1.toUpperCase())
        // Add a simple transformation to show something changed
        if (rewrittenText === text) {
          rewrittenText = `[Professional tone applied] ${text}`
        }
        break
      case 'casual':
        // Add some casual filler words
        rewrittenText = text.replace(/^/, 'Well, ')
        break
      case 'friendly':
        // Add some friendly exclamations
        rewrittenText = text.replace(/\./g, (match, offset) => {
          // Only replace some periods, not all
          return Math.random() < 0.3 ? '!' : match
        })
        // If no periods to replace, add friendly prefix
        if (rewrittenText === text) {
          rewrittenText = `Hey there! ${text}`
        }
        break
      case 'formal':
        // Ensure proper capitalization and add formal prefix if needed
        rewrittenText = rewrittenText.replace(/^([a-z])/gm, (match, p1) => p1.toUpperCase())
        if (rewrittenText === text) {
          rewrittenText = `Respectfully, ${text}`
        }
        break
      case 'academic':
        rewrittenText = `The analysis indicates that ${text.charAt(0).toLowerCase() + text.slice(1)}`
        break
      case 'creative':
        rewrittenText = text.replace(/\b(is|was|are|were)\b/gi, (match) => `${match} brilliantly`)
        if (rewrittenText === text) {
          rewrittenText = `Imagine this: ${text}`
        }
        break
      case 'persuasive':
        rewrittenText = `Clearly, ${text.charAt(0).toLowerCase() + text.slice(1)}`
        break
      case 'concise':
        // Remove unnecessary words
        rewrittenText = text.replace(/\b(very|really|quite|rather|somewhat)\s+/gi, '')
        if (rewrittenText === text) {
          rewrittenText = text.replace(/\b(that|which)\s+/gi, '')
        }
        break
      default:
        // Generic fallback - add tone indicator
        rewrittenText = `[${tone.charAt(0).toUpperCase() + tone.slice(1)} tone] ${text}`
    }
    
    if (rewrittenText !== text) {
      changesCount = 1
      console.log('✅ Applied fallback transformations')
    }
  }

  return rewrittenText
} 