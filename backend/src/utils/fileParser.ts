import mammoth from 'mammoth'
import path from 'path'

// Using require for pdf-parse to avoid TypeScript issues
const pdf = require('pdf-parse') as (dataBuffer: Buffer, options?: any) => Promise<{
  numpages: number
  numrender: number
  info: {
    Title?: string
    Author?: string
    Subject?: string
    Keywords?: string
  }
  metadata: any
  text: string
  version: string
}>

export interface ParsedDocument {
  title: string
  content: string
  wordCount: number
  characterCount: number
}

export class FileParser {
  /**
   * Parse a file buffer based on its extension
   */
  static async parseFile(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const extension = path.extname(filename).toLowerCase()
    
    switch (extension) {
      case '.txt':
        return this.parseTextFile(buffer, filename)
      case '.md':
      case '.markdown':
        return this.parseMarkdownFile(buffer, filename)
      case '.docx':
        return this.parseDocxFile(buffer, filename)
      case '.pdf':
        return this.parsePdfFile(buffer, filename)
      default:
        throw new Error(`Unsupported file type: ${extension}`)
    }
  }

  /**
   * Parse plain text file
   */
  private static parseTextFile(buffer: Buffer, filename: string): ParsedDocument {
    const content = buffer.toString('utf-8')
    const title = this.extractTitleFromFilename(filename)
    
    return {
      title,
      content: content.trim(),
      wordCount: this.countWords(content),
      characterCount: content.length
    }
  }

  /**
   * Parse markdown file
   */
  private static parseMarkdownFile(buffer: Buffer, filename: string): ParsedDocument {
    const content = buffer.toString('utf-8')
    
    // Try to extract title from first heading
    const headingMatch = content.match(/^#\s+(.+)$/m)
    const title = headingMatch ? headingMatch[1].trim() : this.extractTitleFromFilename(filename)
    
    return {
      title,
      content: content.trim(),
      wordCount: this.countWords(content),
      characterCount: content.length
    }
  }

  /**
   * Parse DOCX file
   */
  private static async parseDocxFile(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    try {
      const result = await mammoth.extractRawText({ buffer })
      const content = result.value
      const title = this.extractTitleFromFilename(filename)
      
      return {
        title,
        content: content.trim(),
        wordCount: this.countWords(content),
        characterCount: content.length
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to parse DOCX file: ${errorMessage}`)
    }
  }

  /**
   * Parse PDF file
   */
  private static async parsePdfFile(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    try {
      const data = await pdf(buffer)
      const content = data.text
      
      // Try to extract title from metadata or use filename
      const title = data.info?.Title || this.extractTitleFromFilename(filename)
      
      return {
        title,
        content: content.trim(),
        wordCount: this.countWords(content),
        characterCount: content.length
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to parse PDF file: ${errorMessage}`)
    }
  }

  /**
   * Extract a clean title from filename
   */
  private static extractTitleFromFilename(filename: string): string {
    // Remove extension and clean up the filename
    const nameWithoutExt = path.basename(filename, path.extname(filename))
    // Replace underscores and hyphens with spaces, then capitalize words
    return nameWithoutExt
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase())
      .trim()
  }

  /**
   * Count words in text
   */
  private static countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length
  }
} 