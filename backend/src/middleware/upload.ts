import multer from 'multer'
import path from 'path'

// Configure multer for memory storage (files will be stored in memory as Buffer)
const storage = multer.memoryStorage()

// File filter to accept only specific file types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.txt', '.md', '.markdown', '.docx', '.pdf']
  const fileExtension = path.extname(file.originalname).toLowerCase()
  
  if (allowedExtensions.includes(fileExtension)) {
    cb(null, true)
  } else {
    cb(new Error(`File type not supported. Allowed types: ${allowedExtensions.join(', ')}`))
  }
}

// Create the multer upload instance
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only allow 1 file per request
  }
})

// Middleware for handling multiple files (for bulk import)
export const uploadMultiple = multer({
  storage: storage,
  fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // For bulk upload, also accept ZIP files
    const allowedExtensions = ['.txt', '.md', '.markdown', '.docx', '.pdf', '.zip']
    const fileExtension = path.extname(file.originalname).toLowerCase()
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true)
    } else {
      cb(new Error(`File type not supported. Allowed types: ${allowedExtensions.join(', ')}`))
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for bulk uploads
    files: 10 // Allow up to 10 files
  }
}) 