import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { supabase } from '../../config/supabase'

export interface Document {
  id: string
  title: string
  content: string
  user_id: string
  created_at: string
  updated_at: string
  word_count: number
  character_count: number
}

interface DocumentState {
  documents: Document[]
  currentDocument: Document | null
  loading: boolean
  error: string | null
  saving: boolean
}

const initialState: DocumentState = {
  documents: [],
  currentDocument: null,
  loading: false,
  error: null,
  saving: false,
}

// Async thunks
export const fetchDocuments = createAsyncThunk(
  'documents/fetchDocuments',
  async (userId: string, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) throw error

      return data as Document[]
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

export const fetchDocument = createAsyncThunk(
  'documents/fetchDocument',
  async (documentId: string, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (error) throw error

      return data as Document
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

export const createDocument = createAsyncThunk(
  'documents/createDocument',
  async ({ title, content, userId }: { title: string; content: string; userId: string }, { rejectWithValue }) => {
    try {
      const now = new Date().toISOString()
      const documentData = {
        title,
        content,
        user_id: userId,
        created_at: now,
        updated_at: now,
        word_count: content.split(/\s+/).filter(word => word.length > 0).length,
        character_count: content.length,
      }

      const { data, error } = await supabase
        .from('documents')
        .insert([documentData])
        .select()
        .single()

      if (error) throw error

      return data as Document
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

export const updateDocument = createAsyncThunk(
  'documents/updateDocument',
  async ({ id, title, content }: { id: string; title?: string; content?: string }, { rejectWithValue }) => {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      }
      
      if (title !== undefined) updateData.title = title
      if (content !== undefined) {
        updateData.content = content
        updateData.word_count = content.split(/\s+/).filter(word => word.length > 0).length
        updateData.character_count = content.length
      }

      const { data, error } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return data as Document
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

export const deleteDocument = createAsyncThunk(
  'documents/deleteDocument',
  async (documentId: string, { rejectWithValue }) => {
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)

      if (error) throw error

      return documentId
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

const documentSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    setCurrentDocument: (state, action: PayloadAction<Document | null>) => {
      state.currentDocument = action.payload
    },
    updateCurrentDocumentContent: (state, action: PayloadAction<string>) => {
      if (state.currentDocument) {
        state.currentDocument.content = action.payload
        state.currentDocument.word_count = action.payload.split(/\s+/).filter(word => word.length > 0).length
        state.currentDocument.character_count = action.payload.length
      }
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch documents
      .addCase(fetchDocuments.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.loading = false
        state.documents = action.payload
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string || 'Failed to fetch documents'
      })
      // Fetch single document
      .addCase(fetchDocument.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchDocument.fulfilled, (state, action) => {
        state.loading = false
        state.currentDocument = action.payload
      })
      .addCase(fetchDocument.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string || 'Failed to fetch document'
      })
      // Create document
      .addCase(createDocument.pending, (state) => {
        state.saving = true
        state.error = null
      })
      .addCase(createDocument.fulfilled, (state, action) => {
        state.saving = false
        state.documents.unshift(action.payload)
        state.currentDocument = action.payload
      })
      .addCase(createDocument.rejected, (state, action) => {
        state.saving = false
        state.error = action.payload as string || 'Failed to create document'
      })
      // Update document
      .addCase(updateDocument.pending, (state) => {
        state.saving = true
      })
      .addCase(updateDocument.fulfilled, (state, action) => {
        state.saving = false
        const index = state.documents.findIndex(doc => doc.id === action.payload.id)
        if (index !== -1) {
          state.documents[index] = action.payload
        }
        if (state.currentDocument && state.currentDocument.id === action.payload.id) {
          state.currentDocument = action.payload
        }
      })
      .addCase(updateDocument.rejected, (state, action) => {
        state.saving = false
        state.error = action.payload as string || 'Failed to update document'
      })
      // Delete document
      .addCase(deleteDocument.fulfilled, (state, action) => {
        state.documents = state.documents.filter(doc => doc.id !== action.payload)
        if (state.currentDocument && state.currentDocument.id === action.payload) {
          state.currentDocument = null
        }
      })
      .addCase(deleteDocument.rejected, (state, action) => {
        state.error = action.payload as string || 'Failed to delete document'
      })
  },
})

export const { setCurrentDocument, updateCurrentDocumentContent, clearError } = documentSlice.actions
export default documentSlice.reducer 