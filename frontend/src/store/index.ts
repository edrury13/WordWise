import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice.js'
import documentReducer from './slices/documentSlice.js'
import editorReducer from './slices/editorSlice.js'
import suggestionReducer from './slices/suggestionSlice.js'
import styleProfileReducer from './slices/styleProfileSlice.js'
import onboardingReducer from './slices/onboardingSlice.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    documents: documentReducer,
    editor: editorReducer,
    suggestions: suggestionReducer,
    styleProfiles: styleProfileReducer,
    onboarding: onboardingReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: [
          'editor/setEditorInstance',
          'styleProfiles/loadUserDefault/fulfilled',
          'auth/fetchUser/fulfilled',
          'documents/fetchDocuments/fulfilled',
          'documents/createDocument/fulfilled',
          'documents/updateDocument/fulfilled',
        ],
        // Ignore these field paths in all actions
        ignoredActionPaths: [
          'meta.arg',
          'payload.preferences.onboardingCompletedAt',
          'payload.created_at',
          'payload.updated_at',
          'payload.documents',
        ],
        // Ignore these paths in the state
        ignoredPaths: [
          'editor.editorInstance',
          'auth.user',
          'documents.documents',
          'documents.currentDocument',
          'styleProfiles.profiles',
          'onboarding',
        ],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch 