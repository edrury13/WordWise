import express from 'express'
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth'

const router = express.Router()

// Get user preferences
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    // The user preferences are handled by Supabase directly
    // This route exists for consistency but the frontend uses Supabase client
    res.json({ 
      message: 'Use Supabase client for preferences management',
      userId: req.user?.id 
    })
  } catch (error) {
    console.error('Error fetching preferences:', error)
    res.status(500).json({ error: 'Failed to fetch preferences' })
  }
})

// Update user preferences
router.put('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    // The user preferences are handled by Supabase directly
    res.json({ 
      message: 'Use Supabase client for preferences management',
      userId: req.user?.id 
    })
  } catch (error) {
    console.error('Error updating preferences:', error)
    res.status(500).json({ error: 'Failed to update preferences' })
  }
})

export default router 