import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { User, AuthError } from '@supabase/supabase-js'
import { supabase } from '../../config/supabase'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  isAuthenticated: boolean
  session: any | null
}

const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
  isAuthenticated: false,
  session: null,
}

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      return { user: data.user, session: data.session }
    } catch (error) {
      const authError = error as AuthError
      return rejectWithValue(authError.message)
    }
  }
)

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) throw error

      return { user: data.user, session: data.session }
    } catch (error) {
      const authError = error as AuthError
      return rejectWithValue(authError.message)
    }
  }
)

export const loginWithGoogle = createAsyncThunk(
  'auth/loginWithGoogle',
  async (_, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })

      if (error) throw error

      return data
    } catch (error) {
      const authError = error as AuthError
      return rejectWithValue(authError.message)
    }
  }
)

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      const authError = error as AuthError
      return rejectWithValue(authError.message)
    }
  }
)

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (error) throw error
    
    return { user, session }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<{ user: User | null; session: any | null }>) => {
      state.user = action.payload.user
      state.session = action.payload.session
      state.isAuthenticated = !!action.payload.user
    },
    clearError: (state) => {
      state.error = null
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    }
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.session = action.payload.session
        state.isAuthenticated = true
        state.error = null
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string || 'Login failed'
        state.isAuthenticated = false
      })
      // Register
      .addCase(registerUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.session = action.payload.session
        state.isAuthenticated = !!action.payload.user
        state.error = null
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string || 'Registration failed'
        state.isAuthenticated = false
      })
      // Google login
      .addCase(loginWithGoogle.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loginWithGoogle.fulfilled, (state) => {
        state.loading = false
        // Note: OAuth redirect doesn't return user data immediately
        state.error = null
      })
      .addCase(loginWithGoogle.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string || 'Google login failed'
        state.isAuthenticated = false
      })
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null
        state.session = null
        state.isAuthenticated = false
        state.error = null
      })
      // Get current user
      .addCase(getCurrentUser.pending, (state) => {
        state.loading = true
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.session = action.payload.session
        state.isAuthenticated = !!action.payload.user
      })
      .addCase(getCurrentUser.rejected, (state) => {
        state.loading = false
        state.user = null
        state.session = null
        state.isAuthenticated = false
      })
  },
})

export const { setAuth, clearError, setLoading } = authSlice.actions
export default authSlice.reducer 