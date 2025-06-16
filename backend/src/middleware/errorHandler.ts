import { Request, Response, NextFunction } from 'express'

export interface CustomError extends Error {
  statusCode?: number
  code?: string
}

export const errorHandler = (
  err: CustomError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let error = { ...err }
  error.message = err.message

  console.error('Error:', err)

  // Handle specific error types
  if (err.name === 'CastError') {
    const message = 'Resource not found'
    error = { message, statusCode: 404 } as CustomError
  }

  if (err.name === 'ValidationError') {
    const message = 'Validation error'
    error = { message, statusCode: 400 } as CustomError
  }

  if (err.code === '11000') {
    const message = 'Duplicate field value entered'
    error = { message, statusCode: 400 } as CustomError
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
} 