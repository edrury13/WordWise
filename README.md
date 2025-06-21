# WordWise - Intelligent Writing Assistant

WordWise is a real-time, intelligent text editor that provides grammar and spell checking, style suggestions, and readability analysis. Built with React 18, TypeScript, Node.js, Express, and Supabase.

## 🌟 Features

- **Real-time Grammar & Spell Checking**: Powered by LanguageTool API
- **Personalized Onboarding Experience**: 6-step setup to customize writing preferences
- **Style Profiles**: Academic, Business, Creative, Technical, Email, and Social Media writing modes
- **Smart Corrections**: AI-powered grammar checking that learns from your writing patterns
- **Style Suggestions & Readability Analysis**: Flesch-Kincaid scoring and writing insights
- **Clean, Responsive Text Editor**: Built with Slate.js for rich text editing
- **User Authentication**: Supabase Auth with Google sign-in support
- **Document Management**: Create, save, edit, and delete documents
- **Ignored Words**: Personal dictionary for technical terms and proper nouns
- **Dark/Light Theme**: Toggle between themes
- **Auto-save**: Documents automatically saved every few seconds
- **Grammarly-like Experience**: Inline suggestions with hover explanations
- **Writing Analytics**: Track your progress and improvement over time

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Redux Toolkit** for state management
- **Tailwind CSS** for styling
- **Slate.js** for rich text editing
- **Supabase JS** for authentication and database
- **Axios** for API requests

### Backend
- **Node.js** with Express and TypeScript
- **Supabase JS** for authentication and database
- **PostgreSQL** via Supabase for document storage
- **LanguageTool API** integration
- **Rate limiting** and security middleware

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Supabase project set up
- LanguageTool API access (free tier available)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd WordWise
```

2. **Install dependencies**
```bash
npm run install:all
```

3. **Set up environment variables**

**Frontend (.env)**
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=http://localhost:5000/api
VITE_LANGUAGETOOL_API_URL=https://api.languagetool.org/v2
```

**Backend (.env)**
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
LANGUAGETOOL_API_URL=https://api.languagetool.org/v2
```

4. **Start the development servers**
```bash
npm run dev
```

This will start both frontend (http://localhost:3000) and backend (http://localhost:5000) concurrently.

## 📚 Supabase Setup

1. **Create a Supabase project** at https://supabase.com
2. **Enable Authentication** with Email/Password and Google providers:
   - Go to Authentication > Settings
   - Enable Email provider
   - Enable Google provider (configure OAuth)

3. **Create the documents table** in your database:

```sql
-- Create documents table
create table documents (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  word_count integer default 0,
  character_count integer default 0
);

-- Enable Row Level Security (RLS)
alter table documents enable row level security;

-- Create policy for users to only access their own documents
create policy "Users can only access their own documents" on documents
  for all using (auth.uid() = user_id);

-- Create index for better performance
create index documents_user_id_idx on documents(user_id);
create index documents_updated_at_idx on documents(updated_at desc);
```

4. **Configure Row Level Security (RLS)** policies:
   - The policies above ensure users can only access their own documents
   - RLS is automatically enforced for all database operations

5. **Get your API keys**:
   - Go to Project Settings > API
   - Copy your Project URL and anon public key for the frontend
   - Copy your service_role secret key for the backend

## 🏗 Project Structure

```
WordWise/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # Reusable components
│   │   ├── pages/           # Page components
│   │   ├── store/           # Redux store and slices
│   │   ├── services/        # API services
│   │   ├── config/          # Configuration files
│   │   └── App.tsx          # Main app component
│   └── package.json
├── backend/                 # Express backend
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Custom middleware
│   │   └── server.ts        # Main server file
│   └── package.json
└── package.json            # Root package.json
```

## 🔧 Available Scripts

### Root Level
- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both frontend and backend for production
- `npm run install:all` - Install dependencies for all packages

### Frontend
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Backend
- `npm run dev` - Start with nodemon for development
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/verify` - Verify Supabase access token
- `GET /api/auth/profile` - Get user profile
- `DELETE /api/auth/account` - Delete user account

### Documents
- `GET /api/documents` - Get all user documents
- `GET /api/documents/:id` - Get specific document
- `POST /api/documents` - Create new document
- `PUT /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document

### Language Processing
- `POST /api/language/check` - Check grammar and spelling
- `POST /api/language/readability` - Analyze text readability

## 🎨 Key Components

### Text Editor
- Built with Slate.js for rich text editing
- Real-time grammar and spell checking
- Inline suggestion highlights
- Auto-save functionality

### Suggestion System
- Grammar error detection with red underlines
- Spelling error detection with orange underlines
- Style suggestions with blue underlines
- Hover tooltips with explanations and replacements

### Document Management
- Supabase PostgreSQL integration
- User-specific document access with RLS
- Real-time synchronization
- Auto-save with conflict resolution

## 🔐 Security Features

- Supabase Authentication with JWT token verification
- Row Level Security (RLS) for data isolation
- Rate limiting on API endpoints
- CORS protection
- Request validation and sanitization
- User-specific data access controls

## 🚀 Deployment

### Frontend (Vercel/Netlify)
1. Build the frontend: `cd frontend && npm run build`
2. Deploy the `dist` folder
3. Set environment variables in your hosting platform

### Backend (Railway/Heroku/DigitalOcean)
1. Build the backend: `cd backend && npm run build`
2. Deploy with start command: `npm start`
3. Set environment variables in your hosting platform

### Database
- Supabase handles hosting and scaling automatically
- Enable backups in your Supabase dashboard
- Monitor usage and performance via Supabase dashboard

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [LanguageTool](https://languagetool.org/) for grammar checking API
- [Supabase](https://supabase.com/) for authentication and database
- [Slate.js](https://github.com/ianstormtaylor/slate) for the rich text editor
- [Tailwind CSS](https://tailwindcss.com/) for styling

## 📞 Support

If you have any questions or need help setting up the project, please open an issue or contact the development team.

---

**Happy Writing with WordWise! ✍️** 