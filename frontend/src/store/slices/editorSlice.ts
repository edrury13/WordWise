import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Editor } from 'slate'

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
}

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
      state.content = [
        {
          type: 'paragraph',
          children: [{ text: '' }],
        },
      ]
      state.wordCount = 0
      state.characterCount = 0
      state.lastSaved = null
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
})

export const {
  setEditorInstance,
  setContent,
  toggleDarkMode,
  setDarkMode,
  toggleFullscreen,
  toggleStats,
  setAutoSave,
  setLastSaved,
  resetEditor,
  initializeDarkMode,
} = editorSlice.actions

export default editorSlice.reducer 