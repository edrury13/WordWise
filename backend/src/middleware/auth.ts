import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

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

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email?: string
    [key: string]: any
  }
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: 'No authorization header provided'
      })
      return
    }

    const token = authHeader.split('Bearer ')[1]

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'No token provided'
      })
      return
    }

    // Verify the JWT token using Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      })
      return
    }

    req.user = {
      id: user.id,
      email: user.email,
      ...user.user_metadata
    }

    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    })
  }
} 