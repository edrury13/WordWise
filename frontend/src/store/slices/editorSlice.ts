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

const initialState: EditorState = {
  editorInstance: null,
  content: [
    {
      type: 'paragraph',
      children: [{ text: 'Start writing your document...' }],
    },
  ],
  isDarkMode: false,
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
} = editorSlice.actions

export default editorSlice.reducer 