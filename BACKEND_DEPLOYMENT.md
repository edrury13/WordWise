# Backend Deployment Guide

The WordWise backend needs to be deployed separately from the frontend. Here's how to deploy it to popular platforms:

## Prerequisites
- Backend code in the `backend` folder
- Supabase project set up
- Environment variables ready

## Option 1: Deploy to Render (Recommended - Free Tier)

1. **Create a Render account** at [render.com](https://render.com)

2. **Create a new Web Service**:
   - Connect your GitHub repository
   - Set the following:
     - **Name**: `wordwise-backend`
     - **Root Directory**: `backend`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Environment**: `Node`

3. **Add Environment Variables** in Render dashboard:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   PORT=5000
   FRONTEND_URL=https://your-vercel-app.vercel.app
   ```

4. **Deploy** - Render will automatically deploy

5. **Update Frontend** - In Vercel, set:
   ```
   VITE_API_BASE_URL=https://wordwise-backend.onrender.com/api
   ```

## Option 2: Deploy to Railway

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and Initialize**:
   ```bash
   railway login
   cd backend
   railway init
   ```

3. **Add Environment Variables**:
   ```bash
   railway variables set SUPABASE_URL=your_supabase_url
   railway variables set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   railway variables set PORT=5000
   railway variables set FRONTEND_URL=https://your-vercel-app.vercel.app
   ```

4. **Deploy**:
   ```bash
   railway up
   ```

5. **Get URL**:
   ```bash
   railway open
   ```

6. **Update Frontend** in Vercel with the Railway URL

## Option 3: Deploy to Fly.io

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create Fly App**:
   ```bash
   cd backend
   fly launch
   ```

3. **Set Environment Variables**:
   ```bash
   fly secrets set SUPABASE_URL=your_supabase_url
   fly secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   fly secrets set FRONTEND_URL=https://your-vercel-app.vercel.app
   ```

4. **Deploy**:
   ```bash
   fly deploy
   ```

## Important Notes

1. **CORS Configuration**: The backend is already configured to accept requests from Vercel. Make sure to update `FRONTEND_URL` environment variable with your actual Vercel URL.

2. **Supabase Service Role Key**: Never expose this key in the frontend. It should only be used in the backend.

3. **API Routes**: All backend routes are prefixed with `/api`. For example:
   - Documents: `/api/documents`
   - Auth: `/api/auth`
   - Language: `/api/language`

4. **Health Check**: You can verify your backend is running by visiting:
   ```
   https://your-backend-url/health
   ```

## Updating Frontend After Backend Deployment

1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add or update:
   ```
   VITE_API_BASE_URL=https://your-backend-url/api
   ```
4. Redeploy your frontend

## Troubleshooting

- **CORS Errors**: Make sure `FRONTEND_URL` in backend matches your Vercel URL
- **404 Errors**: Verify the backend is deployed and the URL is correct
- **Auth Errors**: Check that Supabase keys match between frontend and backend 