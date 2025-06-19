import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'
import { Editor } from 'slate'
import { rewriteGradeLevelWithOpenAI } from '../../services/languageService'

// Grade Level Rewrite interfaces
export interface GradeLevelRewriteResult {
  id: string
  originalText: string
  rewrittenText: string
  gradeLevel: string
  timestamp: Date
  originalReadability: {
    fleschKincaid: number
    readingEase: number
    level: string
  }
  newReadability: {
    fleschKincaid: number
    readingEase: number
    level: string
  }
  hasChanges: boolean
  method: string
}

// Performance optimization interfaces
export interface RewriteCache {
  key: string
  result: GradeLevelRewriteResult
  timestamp: number
  accessCount: number
  lastAccessed: number
}

export interface PerformanceMetrics {
  requestCount: number
  cacheHits: number
  cacheMisses: number
  averageResponseTime: number
  lastRequestTime: number
  rateLimitHits: number
  totalTokensUsed: number
}

export interface RewriteHistoryItem {
  id: string
  type: 'grade-level' | 'tone' | 'manual'
  originalContent: any[]
  newContent: any[]
  timestamp: Date
  gradeLevel?: string
  tone?: string
  description: string
  readabilityBefore?: {
    fleschKincaid: number
    readingEase: number
    level: string
  }
  readabilityAfter?: {
    fleschKincaid: number
    readingEase: number
    level: string
  }
}

// Performance optimization interfaces
export interface RewriteCache {
  key: string
  result: GradeLevelRewriteResult
  timestamp: number
  accessCount: number
  lastAccessed: number
}

export interface PerformanceMetrics {
  requestCount: number
  cacheHits: number
  cacheMisses: number
  averageResponseTime: number
  lastRequestTime: number
  rateLimitHits: number
  totalTokensUsed: number
}

interface GradeLevelRewriteState {
  isRewriting: boolean
  currentGradeLevel: string | null
  lastRewriteResult: GradeLevelRewriteResult | null
  rewriteError: string | null
  showGradeLevelPanel: boolean
  targetGradeLevel: string | null
  previewText: string | null
  // Performance optimization state
  requestQueue: Array<{
    id: string
    text: string
    gradeLevel: string
    timestamp: number
    priority: 'high' | 'normal' | 'low'
  }>
  cache: RewriteCache[]
  maxCacheSize: number
  cacheExpiryTime: number // in milliseconds
  debounceTimer: number | null
  lastRequestTime: number
  rateLimitWindow: number[]
  maxRequestsPerMinute: number
  performanceMetrics: PerformanceMetrics
  isRateLimited: boolean
  retryQueue: Array<{
    id: string
    text: string
    gradeLevel: string
    retryCount: number
    nextRetryTime: number
  }>
}

interface EditorState {
  editorInstance: Editor | null
  content: any[]
  isDarkMode: boolean
  wordCount: number
  characterCount: number
  isFullscreen: boolean
  showStats: boolean
  autoSaveEnabled: boolean
  lastSaved: Date | null
  // Grade Level Rewrite State
  gradeLevelRewrite: GradeLevelRewriteState
  // Rewrite History for Undo functionality
  rewriteHistory: RewriteHistoryItem[]
  maxHistoryItems: number
  currentHistoryIndex: number
}

// Get initial dark mode from localStorage or system preference
const getInitialDarkMode = (): boolean => {
  if (typeof window === 'undefined') return false
  
  const stored = localStorage.getItem('darkMode')
  if (stored !== null) {
    return JSON.parse(stored)
  }
  
  // Check system preference if no stored preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

const initialState: EditorState = {
  editorInstance: null,
  content: [
    {
      type: 'paragraph',
      children: [{ text: 'Start writing your document...' }],
    },
  ],
  isDarkMode: getInitialDarkMode(),
  wordCount: 0,
  characterCount: 0,
  isFullscreen: false,
  showStats: true,
  autoSaveEnabled: false,
  lastSaved: null,
  // Grade Level Rewrite State with Performance Optimization
  gradeLevelRewrite: {
    isRewriting: false,
    currentGradeLevel: null,
    lastRewriteResult: null,
    rewriteError: null,
    showGradeLevelPanel: false,
    targetGradeLevel: null,
    previewText: null,
    // Performance optimization defaults
    requestQueue: [],
    cache: [],
    maxCacheSize: 50, // Store up to 50 cached results
    cacheExpiryTime: 30 * 60 * 1000, // 30 minutes
    debounceTimer: null,
    lastRequestTime: 0,
    rateLimitWindow: [],
    maxRequestsPerMinute: 10, // Conservative rate limit
    performanceMetrics: {
      requestCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      lastRequestTime: 0,
      rateLimitHits: 0,
      totalTokensUsed: 0
    },
    isRateLimited: false,
    retryQueue: []
  },
  // Rewrite History
  rewriteHistory: [],
  maxHistoryItems: 20, // Keep last 20 operations for undo
  currentHistoryIndex: -1,
}

// Utility functions for performance optimization
const generateCacheKey = (text: string, gradeLevel: string): string => {
  // Create a hash-like key from text and grade level
  const textHash = text.slice(0, 100) + text.slice(-50) + text.length
  return `${gradeLevel}:${btoa(textHash).slice(0, 20)}`
}

const isRateLimited = (rateLimitWindow: number[], maxRequests: number): boolean => {
  const now = Date.now()
  const oneMinuteAgo = now - 60000
  const recentRequests = rateLimitWindow.filter(time => time > oneMinuteAgo)
  return recentRequests.length >= maxRequests
}

const cleanupCache = (cache: RewriteCache[], maxSize: number, expiryTime: number): RewriteCache[] => {
  const now = Date.now()
  
  // Remove expired entries
  let cleanedCache = cache.filter(item => (now - item.timestamp) < expiryTime)
  
  // If still over max size, remove least recently used items
  if (cleanedCache.length > maxSize) {
    cleanedCache.sort((a, b) => b.lastAccessed - a.lastAccessed)
    cleanedCache = cleanedCache.slice(0, maxSize)
  }
  
  return cleanedCache
}

// Optimized async thunk with caching and rate limiting
export const performGradeLevelRewriteOptimized = createAsyncThunk(
  'editor/performGradeLevelRewriteOptimized',
  async ({ 
    text, 
    gradeLevel, 
    priority = 'normal' as 'high' | 'normal' | 'low'
  }: { 
    text: string
    gradeLevel: string
    currentContent?: any[]
    priority?: 'high' | 'normal' | 'low'
  }, { getState, dispatch, rejectWithValue }) => {
    const state = getState() as { editor: EditorState }
    const rewriteState = state.editor.gradeLevelRewrite
    const startTime = Date.now()
    
    try {
      // Generate cache key
      const cacheKey = generateCacheKey(text, gradeLevel)
      
      // Check cache first
      const cachedResult = rewriteState.cache.find(item => item.key === cacheKey)
      if (cachedResult && (Date.now() - cachedResult.timestamp) < rewriteState.cacheExpiryTime) {
        console.log('🎯 Cache hit for grade level rewrite:', { cacheKey, age: Date.now() - cachedResult.timestamp })
        
        // Update cache access stats
        dispatch(updatePerformanceMetrics({
          type: 'cache_hit',
          responseTime: Date.now() - startTime
        }))
        
        // Update last accessed time
        dispatch(updateCacheAccess(cacheKey))
        
        return cachedResult.result
      }
      
      // Check rate limiting
      if (isRateLimited(rewriteState.rateLimitWindow, rewriteState.maxRequestsPerMinute)) {
        console.log('⏳ Rate limited - adding to retry queue')
        
        dispatch(updatePerformanceMetrics({
          type: 'rate_limit_hit'
        }))
        
        // Add to retry queue if not already there
        const existingRetry = rewriteState.retryQueue.find(item => 
          item.text === text && item.gradeLevel === gradeLevel
        )
        
        if (!existingRetry) {
          dispatch(addToRetryQueue({
            text,
            gradeLevel,
            retryCount: 0
          }))
        }
        
        return rejectWithValue('Rate limited. Request queued for retry.')
      }
      
      console.log('🎓 Starting optimized grade level rewrite:', { 
        text: text.substring(0, 50) + '...', 
        gradeLevel,
        priority,
        cacheKey
      })
      
      // Update rate limit tracking
      dispatch(updateRateLimitWindow())
      
      // Perform the actual rewrite
      const result = await rewriteGradeLevelWithOpenAI(text, gradeLevel)
      
      if (!result.success) {
        throw new Error(result.error || 'Grade level rewrite failed')
      }

      // Create rewrite result
      const rewriteResult: GradeLevelRewriteResult = {
        id: `grade-rewrite-${Date.now()}`,
        originalText: text,
        rewrittenText: result.rewrittenText,
        gradeLevel,
        timestamp: new Date(),
        originalReadability: result.originalReadability || {
          fleschKincaid: 0,
          readingEase: 0,
          level: 'Unknown'
        },
        newReadability: result.newReadability || {
          fleschKincaid: 0,
          readingEase: 0,
          level: 'Unknown'
        },
        hasChanges: result.hasChanges || false,
        method: result.method || 'openai'
      }

      // Cache the result
      dispatch(addToCache({
        key: cacheKey,
        result: rewriteResult
      }))
      
      // Update performance metrics
      dispatch(updatePerformanceMetrics({
        type: 'request_complete',
        responseTime: Date.now() - startTime,
        tokensUsed: result.tokensUsed || 0
      }))

      console.log('✅ Optimized grade level rewrite completed:', {
        cacheKey,
        responseTime: Date.now() - startTime
      })
      
      return rewriteResult
    } catch (error) {
      console.error('❌ Optimized grade level rewrite failed:', error)
      
      // Update performance metrics for failed request
      dispatch(updatePerformanceMetrics({
        type: 'request_failed',
        responseTime: Date.now() - startTime
      }))
      
      throw error
    }
  }
)

// Debounced version for real-time preview
export const performGradeLevelRewriteDebounced = createAsyncThunk(
  'editor/performGradeLevelRewriteDebounced',
  async (params: { 
    text: string
    gradeLevel: string
    currentContent: any[]
    debounceMs?: number
  }, { dispatch, getState }) => {
    const { debounceMs = 1500 } = params
    const state = getState() as { editor: EditorState }
    
    // Clear existing debounce timer
    if (state.editor.gradeLevelRewrite.debounceTimer) {
      clearTimeout(state.editor.gradeLevelRewrite.debounceTimer)
    }
    
    // Set new debounce timer
    const timerId = window.setTimeout(() => {
      dispatch(performGradeLevelRewriteOptimized({
        text: params.text,
        gradeLevel: params.gradeLevel,
        priority: 'low' // Preview requests have low priority
      }))
    }, debounceMs)
    
    dispatch(setDebounceTimer(timerId))
    
    return null // This thunk doesn't return a result directly
  }
)

// Retry failed requests
export const processRetryQueue = createAsyncThunk(
  'editor/processRetryQueue',
  async (_, { getState, dispatch }) => {
    const state = getState() as { editor: EditorState }
    const retryQueue = state.editor.gradeLevelRewrite.retryQueue
    const now = Date.now()
    
    const readyToRetry = retryQueue.filter(item => now >= item.nextRetryTime)
    
    if (readyToRetry.length === 0) {
      return { processed: 0 }
    }
    
    console.log(`🔄 Processing ${readyToRetry.length} retry requests`)
    
    let processed = 0
    for (const retryItem of readyToRetry) {
      try {
        await dispatch(performGradeLevelRewriteOptimized({
          text: retryItem.text,
          gradeLevel: retryItem.gradeLevel,
          priority: 'high' // Retry requests get high priority
        })).unwrap()
        
        // Remove from retry queue on success
        dispatch(removeFromRetryQueue(retryItem.id))
        processed++
      } catch (error) {
        // Update retry count and schedule next retry
        const nextRetryDelay = Math.min(
          1000 * Math.pow(2, retryItem.retryCount), // Exponential backoff
          5 * 60 * 1000 // Max 5 minutes
        )
        
        dispatch(updateRetryItem({
          id: retryItem.id,
          retryCount: retryItem.retryCount + 1,
          nextRetryTime: now + nextRetryDelay
        }))
        
        // Remove from queue if too many retries
        if (retryItem.retryCount >= 3) {
          dispatch(removeFromRetryQueue(retryItem.id))
        }
      }
    }
    
    return { processed }
  }
)

// Keep the original thunk for backward compatibility
export const performGradeLevelRewrite = performGradeLevelRewriteOptimized

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setEditorInstance: (state, action: PayloadAction<Editor | null>) => {
      state.editorInstance = action.payload
    },
    setContent: (state, action: PayloadAction<any[]>) => {
      state.content = action.payload
      // Calculate word and character count
      const text = action.payload
        .map(node => node.children?.map((child: any) => child.text).join('') || '')
        .join(' ')
      state.wordCount = text.split(/\s+/).filter(word => word.length > 0).length
      state.characterCount = text.length
    },
    
    // Grade Level Rewrite Actions
    setShowGradeLevelPanel: (state, action: PayloadAction<boolean>) => {
      state.gradeLevelRewrite.showGradeLevelPanel = action.payload
    },
    setTargetGradeLevel: (state, action: PayloadAction<string | null>) => {
      state.gradeLevelRewrite.targetGradeLevel = action.payload
    },
    setPreviewText: (state, action: PayloadAction<string | null>) => {
      state.gradeLevelRewrite.previewText = action.payload
    },
    clearGradeLevelRewriteError: (state) => {
      state.gradeLevelRewrite.rewriteError = null
    },
    resetGradeLevelRewriteState: (state) => {
      // Clear timers
      if (state.gradeLevelRewrite.debounceTimer) {
        clearTimeout(state.gradeLevelRewrite.debounceTimer)
      }
      
      state.gradeLevelRewrite = {
        ...initialState.gradeLevelRewrite,
        // Preserve cache and performance metrics
        cache: state.gradeLevelRewrite.cache,
        performanceMetrics: state.gradeLevelRewrite.performanceMetrics,
        rateLimitWindow: state.gradeLevelRewrite.rateLimitWindow
      }
    },
    
    // Performance Optimization Actions
    addToCache: (state, action: PayloadAction<{ key: string; result: GradeLevelRewriteResult }>) => {
      const { key, result } = action.payload
      const now = Date.now()
      
      // Remove existing entry if it exists
      state.gradeLevelRewrite.cache = state.gradeLevelRewrite.cache.filter(item => item.key !== key)
      
      // Add new entry
      state.gradeLevelRewrite.cache.push({
        key,
        result,
        timestamp: now,
        accessCount: 1,
        lastAccessed: now
      })
      
      // Cleanup cache
      state.gradeLevelRewrite.cache = cleanupCache(
        state.gradeLevelRewrite.cache,
        state.gradeLevelRewrite.maxCacheSize,
        state.gradeLevelRewrite.cacheExpiryTime
      )
    },
    
    updateCacheAccess: (state, action: PayloadAction<string>) => {
      const cacheKey = action.payload
      const cacheItem = state.gradeLevelRewrite.cache.find(item => item.key === cacheKey)
      if (cacheItem) {
        cacheItem.accessCount++
        cacheItem.lastAccessed = Date.now()
      }
    },
    
    clearCache: (state) => {
      state.gradeLevelRewrite.cache = []
    },
    
    setDebounceTimer: (state, action: PayloadAction<number | null>) => {
      if (state.gradeLevelRewrite.debounceTimer) {
        clearTimeout(state.gradeLevelRewrite.debounceTimer)
      }
      state.gradeLevelRewrite.debounceTimer = action.payload
    },
    
    updateRateLimitWindow: (state) => {
      const now = Date.now()
      const oneMinuteAgo = now - 60000
      
      // Clean old entries and add new one
      state.gradeLevelRewrite.rateLimitWindow = [
        ...state.gradeLevelRewrite.rateLimitWindow.filter(time => time > oneMinuteAgo),
        now
      ]
      
      // Update rate limit status
      state.gradeLevelRewrite.isRateLimited = isRateLimited(
        state.gradeLevelRewrite.rateLimitWindow,
        state.gradeLevelRewrite.maxRequestsPerMinute
      )
    },
    
    updatePerformanceMetrics: (state, action: PayloadAction<{
      type: 'cache_hit' | 'cache_miss' | 'request_complete' | 'request_failed' | 'rate_limit_hit'
      responseTime?: number
      tokensUsed?: number
    }>) => {
      const { type, responseTime = 0, tokensUsed = 0 } = action.payload
      const metrics = state.gradeLevelRewrite.performanceMetrics
      
      switch (type) {
        case 'cache_hit':
          metrics.cacheHits++
          break
        case 'cache_miss':
          metrics.cacheMisses++
          break
        case 'request_complete':
          metrics.requestCount++
          metrics.totalTokensUsed += tokensUsed
          // Update average response time
          metrics.averageResponseTime = 
            (metrics.averageResponseTime * (metrics.requestCount - 1) + responseTime) / metrics.requestCount
          metrics.lastRequestTime = Date.now()
          break
        case 'request_failed':
          metrics.requestCount++
          metrics.lastRequestTime = Date.now()
          break
        case 'rate_limit_hit':
          metrics.rateLimitHits++
          break
      }
    },
    
    addToRetryQueue: (state, action: PayloadAction<{
      text: string
      gradeLevel: string
      retryCount: number
    }>) => {
      const { text, gradeLevel, retryCount } = action.payload
      const id = `retry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const nextRetryTime = Date.now() + (1000 * Math.pow(2, retryCount)) // Exponential backoff
      
      state.gradeLevelRewrite.retryQueue.push({
        id,
        text,
        gradeLevel,
        retryCount,
        nextRetryTime
      })
    },
    
    removeFromRetryQueue: (state, action: PayloadAction<string>) => {
      const id = action.payload
      state.gradeLevelRewrite.retryQueue = state.gradeLevelRewrite.retryQueue.filter(item => item.id !== id)
    },
    
    updateRetryItem: (state, action: PayloadAction<{
      id: string
      retryCount: number
      nextRetryTime: number
    }>) => {
      const { id, retryCount, nextRetryTime } = action.payload
      const retryItem = state.gradeLevelRewrite.retryQueue.find(item => item.id === id)
      if (retryItem) {
        retryItem.retryCount = retryCount
        retryItem.nextRetryTime = nextRetryTime
      }
    },
    
    // Rewrite History Actions
    addToRewriteHistory: (state, action: PayloadAction<{
      type: 'grade-level' | 'tone' | 'manual'
      originalContent: any[]
      newContent: any[]
      gradeLevel?: string
      tone?: string
      description: string
      readabilityBefore?: { fleschKincaid: number; readingEase: number; level: string }
      readabilityAfter?: { fleschKincaid: number; readingEase: number; level: string }
    }>) => {
      const historyItem: RewriteHistoryItem = {
        id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        ...action.payload
      }

      // Remove any items after current index (if user was in middle of history and made new change)
      if (state.currentHistoryIndex < state.rewriteHistory.length - 1) {
        state.rewriteHistory = state.rewriteHistory.slice(0, state.currentHistoryIndex + 1)
      }

      // Add new item
      state.rewriteHistory.push(historyItem)
      state.currentHistoryIndex = state.rewriteHistory.length - 1

      // Keep only maxHistoryItems
      if (state.rewriteHistory.length > state.maxHistoryItems) {
        const itemsToRemove = state.rewriteHistory.length - state.maxHistoryItems
        state.rewriteHistory = state.rewriteHistory.slice(itemsToRemove)
        state.currentHistoryIndex -= itemsToRemove
      }

      console.log('📝 Redux: Added to rewrite history:', {
        item: historyItem,
        historyLength: state.rewriteHistory.length,
        currentIndex: state.currentHistoryIndex
      })
    },
    
    undoRewrite: (state) => {
      if (state.currentHistoryIndex > 0) {
        state.currentHistoryIndex -= 1
        const historyItem = state.rewriteHistory[state.currentHistoryIndex]
        state.content = [...historyItem.originalContent]
        
        // Update word and character count
        const text = state.content
          .map(node => node.children?.map((child: any) => child.text).join('') || '')
          .join(' ')
        state.wordCount = text.split(/\s+/).filter(word => word.length > 0).length
        state.characterCount = text.length

        console.log('↶ Redux: Undo rewrite applied:', {
          undoToIndex: state.currentHistoryIndex,
          description: historyItem.description
        })
      }
    },
    
    redoRewrite: (state) => {
      if (state.currentHistoryIndex < state.rewriteHistory.length - 1) {
        state.currentHistoryIndex += 1
        const historyItem = state.rewriteHistory[state.currentHistoryIndex]
        state.content = [...historyItem.newContent]
        
        // Update word and character count
        const text = state.content
          .map(node => node.children?.map((child: any) => child.text).join('') || '')
          .join(' ')
        state.wordCount = text.split(/\s+/).filter(word => word.length > 0).length
        state.characterCount = text.length

        console.log('↷ Redux: Redo rewrite applied:', {
          redoToIndex: state.currentHistoryIndex,
          description: historyItem.description
        })
      }
    },
    
    clearRewriteHistory: (state) => {
      state.rewriteHistory = []
      state.currentHistoryIndex = -1
      console.log('🗑️ Redux: Rewrite history cleared')
    },
    
    applyGradeLevelRewrite: (state, action: PayloadAction<{
      rewrittenText: string
      originalContent: any[]
      rewriteResult: GradeLevelRewriteResult
    }>) => {
      const { rewrittenText, originalContent, rewriteResult } = action.payload

      // Create new content with rewritten text
      const newContent = [
        {
          type: 'paragraph',
          children: [{ text: rewrittenText }],
        },
      ]

      // Add to history before applying the change
      const historyItem: RewriteHistoryItem = {
        id: `grade-rewrite-${Date.now()}`,
        type: 'grade-level',
        originalContent: [...originalContent],
        newContent: [...newContent],
        timestamp: new Date(),
        gradeLevel: rewriteResult.gradeLevel,
        description: `Grade level rewrite to ${rewriteResult.gradeLevel} level`,
        readabilityBefore: rewriteResult.originalReadability,
        readabilityAfter: rewriteResult.newReadability
      }

      // Remove items after current index
      if (state.currentHistoryIndex < state.rewriteHistory.length - 1) {
        state.rewriteHistory = state.rewriteHistory.slice(0, state.currentHistoryIndex + 1)
      }

      // Add to history
      state.rewriteHistory.push(historyItem)
      state.currentHistoryIndex = state.rewriteHistory.length - 1

      // Keep only maxHistoryItems
      if (state.rewriteHistory.length > state.maxHistoryItems) {
        const itemsToRemove = state.rewriteHistory.length - state.maxHistoryItems
        state.rewriteHistory = state.rewriteHistory.slice(itemsToRemove)
        state.currentHistoryIndex -= itemsToRemove
      }

      // Apply the content change
      state.content = newContent
      
      // Update word and character count
      state.wordCount = rewrittenText.split(/\s+/).filter(word => word.length > 0).length
      state.characterCount = rewrittenText.length

      // Update grade level state
      state.gradeLevelRewrite.currentGradeLevel = rewriteResult.gradeLevel
      state.gradeLevelRewrite.lastRewriteResult = rewriteResult
      state.gradeLevelRewrite.showGradeLevelPanel = false

      console.log('✅ Redux: Applied grade level rewrite and added to history:', {
        gradeLevel: rewriteResult.gradeLevel,
        wordCount: state.wordCount,
        historyIndex: state.currentHistoryIndex
      })
    },

    // Existing actions
    toggleDarkMode: (state) => {
      state.isDarkMode = !state.isDarkMode
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('darkMode', JSON.stringify(state.isDarkMode))
      }
      // Update document class
      if (typeof document !== 'undefined') {
        if (state.isDarkMode) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    },
    setDarkMode: (state, action: PayloadAction<boolean>) => {
      state.isDarkMode = action.payload
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('darkMode', JSON.stringify(action.payload))
      }
      if (typeof document !== 'undefined') {
        if (action.payload) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    },
    toggleFullscreen: (state) => {
      state.isFullscreen = !state.isFullscreen
    },
    toggleStats: (state) => {
      state.showStats = !state.showStats
    },
    setAutoSave: (state, action: PayloadAction<boolean>) => {
      state.autoSaveEnabled = action.payload
    },
    setLastSaved: (state, action: PayloadAction<Date>) => {
      state.lastSaved = action.payload
    },
    resetEditor: (state) => {
      // Clear any active timers
      if (state.gradeLevelRewrite.debounceTimer) {
        clearTimeout(state.gradeLevelRewrite.debounceTimer)
      }
      
      state.content = [
        {
          type: 'paragraph',
          children: [{ text: '' }],
        },
      ]
      state.wordCount = 0
      state.characterCount = 0
      state.lastSaved = null
      // Clear grade level rewrite state but preserve cache and metrics
      state.gradeLevelRewrite = {
        ...initialState.gradeLevelRewrite,
        cache: state.gradeLevelRewrite.cache,
        performanceMetrics: state.gradeLevelRewrite.performanceMetrics,
        rateLimitWindow: state.gradeLevelRewrite.rateLimitWindow
      }
      // Clear history
      state.rewriteHistory = []
      state.currentHistoryIndex = -1
    },
    initializeDarkMode: (state) => {
      // Apply the current dark mode state to the DOM
      if (typeof document !== 'undefined') {
        if (state.isDarkMode) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Optimized Grade Level Rewrite
      .addCase(performGradeLevelRewriteOptimized.pending, (state) => {
        state.gradeLevelRewrite.isRewriting = true
        state.gradeLevelRewrite.rewriteError = null
        console.log('🔄 Redux: Optimized grade level rewrite started')
      })
      .addCase(performGradeLevelRewriteOptimized.fulfilled, (state, action) => {
        state.gradeLevelRewrite.isRewriting = false
        state.gradeLevelRewrite.lastRewriteResult = action.payload
        state.gradeLevelRewrite.rewriteError = null
        console.log('✅ Redux: Optimized grade level rewrite completed successfully')
      })
      .addCase(performGradeLevelRewriteOptimized.rejected, (state, action) => {
        state.gradeLevelRewrite.isRewriting = false
        state.gradeLevelRewrite.rewriteError = action.payload as string || action.error.message || 'Grade level rewrite failed'
        console.error('❌ Redux: Optimized grade level rewrite failed:', action.error.message)
      })
      
      // Debounced Grade Level Rewrite
      .addCase(performGradeLevelRewriteDebounced.pending, () => {
        // Don't set loading state for debounced requests to avoid UI flicker
        console.log('⏳ Redux: Debounced grade level rewrite scheduled')
      })
      .addCase(performGradeLevelRewriteDebounced.fulfilled, () => {
        console.log('✅ Redux: Debounced grade level rewrite scheduled successfully')
      })
      .addCase(performGradeLevelRewriteDebounced.rejected, (_, action) => {
        console.error('❌ Redux: Debounced grade level rewrite failed:', action.error.message)
      })
      
      // Retry Queue Processing
      .addCase(processRetryQueue.fulfilled, (_, action) => {
        console.log(`✅ Redux: Processed ${action.payload.processed} retry requests`)
      })
  },
})

export const {
  setEditorInstance,
  setContent,
  // Grade Level Rewrite Actions
  setShowGradeLevelPanel,
  setTargetGradeLevel,
  setPreviewText,
  clearGradeLevelRewriteError,
  resetGradeLevelRewriteState,
  applyGradeLevelRewrite,
  // Performance Optimization Actions
  addToCache,
  updateCacheAccess,
  clearCache,
  setDebounceTimer,
  updateRateLimitWindow,
  updatePerformanceMetrics,
  addToRetryQueue,
  removeFromRetryQueue,
  updateRetryItem,
  // Rewrite History Actions
  addToRewriteHistory,
  undoRewrite,
  redoRewrite,
  clearRewriteHistory,
  // Existing actions
  toggleDarkMode,
  setDarkMode,
  toggleFullscreen,
  toggleStats,
  setAutoSave,
  setLastSaved,
  resetEditor,
  initializeDarkMode,
} = editorSlice.actions

// Selectors for grade level rewrite state
export const selectGradeLevelRewriteState = (state: { editor: EditorState }) => state.editor.gradeLevelRewrite
export const selectIsRewriting = (state: { editor: EditorState }) => state.editor.gradeLevelRewrite.isRewriting
export const selectLastRewriteResult = (state: { editor: EditorState }) => state.editor.gradeLevelRewrite.lastRewriteResult
export const selectRewriteError = (state: { editor: EditorState }) => state.editor.gradeLevelRewrite.rewriteError
export const selectShowGradeLevelPanel = (state: { editor: EditorState }) => state.editor.gradeLevelRewrite.showGradeLevelPanel
export const selectTargetGradeLevel = (state: { editor: EditorState }) => state.editor.gradeLevelRewrite.targetGradeLevel
export const selectCurrentGradeLevel = (state: { editor: EditorState }) => state.editor.gradeLevelRewrite.currentGradeLevel

// Performance optimization selectors
export const selectRewriteCache = (state: { editor: EditorState }) => state.editor.gradeLevelRewrite.cache
export const selectPerformanceMetrics = (state: { editor: EditorState }) => state.editor.gradeLevelRewrite.performanceMetrics
export const selectIsRateLimited = (state: { editor: EditorState }) => state.editor.gradeLevelRewrite.isRateLimited
export const selectRetryQueue = (state: { editor: EditorState }) => state.editor.gradeLevelRewrite.retryQueue
export const selectCacheStats = (state: { editor: EditorState }) => {
  const cache = state.editor.gradeLevelRewrite.cache
  const metrics = state.editor.gradeLevelRewrite.performanceMetrics
  const totalRequests = metrics.cacheHits + metrics.cacheMisses
  
  return {
    size: cache.length,
    maxSize: state.editor.gradeLevelRewrite.maxCacheSize,
    hitRate: totalRequests > 0 ? (metrics.cacheHits / totalRequests * 100).toFixed(1) : '0',
    totalHits: metrics.cacheHits,
    totalMisses: metrics.cacheMisses
  }
}

// Selectors for rewrite history
export const selectRewriteHistory = (state: { editor: EditorState }) => state.editor.rewriteHistory
export const selectCurrentHistoryIndex = (state: { editor: EditorState }) => state.editor.currentHistoryIndex
export const selectCanUndo = (state: { editor: EditorState }) => state.editor.currentHistoryIndex > 0
export const selectCanRedo = (state: { editor: EditorState }) => state.editor.currentHistoryIndex < state.editor.rewriteHistory.length - 1
export const selectRewriteHistoryStats = (state: { editor: EditorState }) => ({
  totalItems: state.editor.rewriteHistory.length,
  currentIndex: state.editor.currentHistoryIndex,
  canUndo: state.editor.currentHistoryIndex > 0,
  canRedo: state.editor.currentHistoryIndex < state.editor.rewriteHistory.length - 1,
  lastAction: state.editor.rewriteHistory[state.editor.currentHistoryIndex]?.description || null
})

export default editorSlice.reducer 