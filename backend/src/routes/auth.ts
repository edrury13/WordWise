import express from 'express'
import { createClient } from '@supabase/supabase-js'

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

// Verify Supabase token endpoint
router.post('/verify', async (req, res) => {
  try {
    const { accessToken } = req.body

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Access token is required'
      })
    }

    // Verify the access token using Supabase
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      })
    }
    
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_confirmed_at ? true : false,
        name: user.user_metadata?.name || user.user_metadata?.full_name,
        picture: user.user_metadata?.picture || user.user_metadata?.avatar_url
      }
    })
  } catch (error) {
    console.error('Token verification error:', error)
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    })
  }
})

// Get user profile endpoint
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'No authorization header provided'
      })
    }

    const token = authHeader.split('Bearer ')[1]
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      })
    }
    
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_confirmed_at ? true : false,
        displayName: user.user_metadata?.name || user.user_metadata?.full_name,
        photoURL: user.user_metadata?.picture || user.user_metadata?.avatar_url,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at
      }
    })
  } catch (error) {
    console.error('Profile fetch error:', error)
    res.status(401).json({
      success: false,
      error: 'Unable to fetch user profile'
    })
  }
})

// Delete user account endpoint
router.delete('/account', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'No authorization header provided'
      })
    }

    const token = authHeader.split('Bearer ')[1]
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      })
    }
    
    // Delete user from Supabase Auth (requires service role key)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
    
    if (deleteError) {
      throw deleteError
    }
    
    res.status(200).json({
      success: true,
      message: 'User account deleted successfully'
    })
  } catch (error) {
    console.error('Account deletion error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete user account'
    })
  }
})

export default router 