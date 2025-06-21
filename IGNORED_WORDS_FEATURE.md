# Ignored Words Feature

## Overview

The Ignored Words feature allows users to permanently ignore spelling mistakes, particularly for proper nouns and specialized terminology. Once a word is ignored, it will no longer be marked as misspelled in any document.

## Features

- **Persistent Storage**: Ignored words are saved to the database and persist across sessions
- **Proper Noun Detection**: Automatically detects and tags proper nouns based on capitalization and context
- **User-Specific**: Each user has their own list of ignored words
- **Easy Management**: View, search, and remove ignored words through a dedicated interface
- **Automatic Filtering**: Ignored words are automatically filtered out during spell checking

## Database Setup

Before using this feature, you need to create the necessary database table. Run the following SQL in your Supabase SQL editor:

```sql
-- Run the SQL from database/ignored_words.sql
```

## How to Use

### Ignoring a Word

1. When you see a spelling suggestion (orange highlight), hover over the word
2. Click "Ignore" in the tooltip
3. The word will be added to your ignored words list and the suggestion will disappear
4. You'll see a toast notification confirming the word was added

### Managing Ignored Words

1. Click the "Ignored Words" button in the editor toolbar
2. The Ignored Words Manager will open, showing all your ignored words
3. You can:
   - Search for specific words
   - See which words are marked as proper nouns
   - Remove individual words
   - Clear all ignored words

### Automatic Proper Noun Detection

The system automatically detects if a word is likely a proper noun by checking:
- If it starts with a capital letter
- If it's not at the beginning of a sentence
- The context around the word

## Technical Implementation

### Components

- **IgnoredWordsManager**: UI component for managing ignored words
- **ignoredWordsService**: Service for CRUD operations on ignored words
- **GrammarTextEditor**: Updated to save ignored words when user clicks "Ignore"

### Database Schema

```sql
CREATE TABLE user_ignored_words (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    word TEXT NOT NULL,
    word_lower TEXT NOT NULL,
    context TEXT,
    document_type VARCHAR(50),
    is_proper_noun BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, word_lower)
);
```

### API Endpoints

The backend provides the following endpoints (not currently used, as we're using Supabase directly):

- `GET /api/ignored-words` - Get all ignored words for the current user
- `POST /api/ignored-words` - Add a new ignored word
- `DELETE /api/ignored-words/:wordId` - Remove a specific ignored word
- `DELETE /api/ignored-words` - Clear all ignored words

## Benefits

1. **Better User Experience**: No more repeatedly ignoring the same proper nouns or specialized terms
2. **Personalized**: Each user maintains their own dictionary of acceptable words
3. **Context-Aware**: Stores context to help with proper noun detection
4. **Efficient**: Uses caching to minimize database queries during spell checking

## Future Enhancements

- Import/export ignored words lists
- Suggest commonly ignored words based on document type
- Share ignored word lists between team members
- Auto-learn from user corrections 