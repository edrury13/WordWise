# Supabase Setup Guide for WordWise

This guide will help you set up Supabase for the WordWise application.

## 🚀 Quick Setup

### 1. Create a Supabase Project

1. Go to [Supabase](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization and fill in project details:
   - Project name: `wordwise` (or any name you prefer)
   - Database password: Generate a strong password and save it
   - Region: Choose closest to your users
4. Click "Create new project"

### 2. Configure Authentication

1. Go to **Authentication > Settings**
2. Enable the following providers:
   - **Email**: Already enabled by default
   - **Google**: 
     - Enable it
     - Add your Google OAuth credentials (see Google Setup below)

### 3. Set up the Database

1. Go to **SQL Editor**
2. Copy and paste the contents of `database/schema.sql`
3. Click "Run" to create the tables and policies

### 4. Get Your API Keys

1. Go to **Settings > API**
2. Copy the following values:
   - **Project URL** (`VITE_SUPABASE_URL` for frontend)
   - **Anon/Public Key** (`VITE_SUPABASE_ANON_KEY` for frontend)
   - **Service Role Key** (`SUPABASE_SERVICE_ROLE_KEY` for backend)

### 5. Configure Environment Variables

**Frontend (.env)**
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_API_BASE_URL=http://localhost:5000/api
VITE_LANGUAGETOOL_API_URL=https://api.languagetool.org/v2
```

**Backend (.env)**
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
LANGUAGETOOL_API_URL=https://api.languagetool.org/v2
```

## 🔐 Google OAuth Setup (Optional)

To enable Google sign-in:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API
4. Go to **Credentials** and create OAuth 2.0 Client ID
5. Add authorized redirect URI: `https://your-project-ref.supabase.co/auth/v1/callback`
6. Copy Client ID and Client Secret
7. In Supabase, go to **Authentication > Settings > Auth Providers**
8. Enable Google and paste your credentials

## 🗄️ Database Schema

The application uses a simple `documents` table with the following structure:

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  word_count INTEGER DEFAULT 0,
  character_count INTEGER DEFAULT 0
);
```

**Key Features:**
- Row Level Security (RLS) ensures users only see their own documents
- Automatic timestamps for created_at and updated_at
- Word and character counts are calculated and stored
- Cascade delete when user is deleted

## 🔒 Security Features

### Row Level Security (RLS)
- Automatically enabled on the documents table
- Users can only access documents where `user_id = auth.uid()`
- No server-side authorization code needed

### Authentication
- JWT tokens are automatically validated by Supabase
- Session management handled automatically
- Secure password hashing and storage

## 🚀 Testing the Setup

1. Start your development servers:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:3000`
3. Register a new account
4. Create a test document
5. Verify the document appears in your Supabase dashboard

## 🔧 Common Issues

### CORS Errors
- Make sure your frontend URL is added to the allowed origins in Supabase settings
- Check that your environment variables are correctly set

### Authentication Issues
- Verify your Supabase URL and keys are correct
- Check that RLS policies are properly configured
- Ensure your JWT secret is not exposed

### Database Errors
- Run the schema.sql file to ensure tables exist
- Check that RLS policies allow the operations you're trying to perform
- Verify user authentication is working

## 📊 Monitoring

Supabase provides built-in monitoring:
- **Dashboard**: Overview of usage and performance
- **Logs**: Real-time logs for debugging
- **Database**: Monitor queries and performance
- **Auth**: Track user registrations and logins

## 🚀 Production Deployment

For production:
1. Use environment-specific Supabase projects
2. Configure custom domains if needed
3. Set up proper backup strategies
4. Monitor usage and scale as needed
5. Configure rate limiting and security policies

---

**Need help?** Check the [Supabase Documentation](https://supabase.com/docs) or open an issue in this repository. 