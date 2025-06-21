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
        ignoredActions: ['editor/setEditorInstance'],
        ignoredPaths: ['editor.editorInstance'],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch 