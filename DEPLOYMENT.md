# WordWise Deployment Guide - Vercel

This guide will help you deploy WordWise to Vercel with serverless functions.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Supabase Project**: Set up your database using `SUPABASE_SETUP.md`
3. **GitHub Repository**: Your code should be in a GitHub repository

## Deployment Steps

### 1. Prepare Your Repository

Ensure these files are in your repository:
- `vercel.json` (✅ Created)
- `api/` directory with serverless functions (✅ Created)
- `frontend/` directory with React app (✅ Exists)

### 2. Connect to Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Select "WordWise" repository

### 3. Configure Build Settings

Vercel should auto-detect the configuration, but verify:

- **Framework Preset**: `Other`
- **Root Directory**: `./` (leave empty)
- **Build Command**: `cd frontend && npm run build`
- **Output Directory**: `frontend/dist`
- **Install Command**: `npm install && cd frontend && npm install && cd ../api && npm install`

### 4. Set Environment Variables

In your Vercel dashboard, go to Settings > Environment Variables and add:

#### Frontend Variables (for all environments):
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key  
VITE_API_BASE_URL=https://your-app-name.vercel.app/api
VITE_LANGUAGETOOL_API_URL=https://api.languagetool.org/v2
```

#### Backend Variables (for all environments):
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
LANGUAGETOOL_API_URL=https://api.languagetool.org/v2
NODE_ENV=production
```

⚠️ **Important**: 
- Use `SUPABASE_SERVICE_ROLE_KEY` for backend (not anon key)
- Replace `your-app-name` with your actual Vercel app name

### 5. Deploy

1. Click "Deploy" in Vercel
2. Wait for build to complete
3. Your app will be available at `https://your-app-name.vercel.app`

## API Endpoints

After deployment, your API will be available at:
- `https://your-app.vercel.app/api/auth` - Authentication
- `https://your-app.vercel.app/api/documents` - Document management  
- `https://your-app.vercel.app/api/language` - Language processing

## Troubleshooting

### Common Issues:

1. **Build Fails**
   - Check that all dependencies are in `package.json`
   - Verify TypeScript compilation passes locally

2. **API Not Working**
   - Verify environment variables are set correctly
   - Check Vercel function logs in dashboard

3. **Supabase Connection Issues**
   - Ensure RLS policies are set up correctly
   - Verify service role key has proper permissions

4. **CORS Errors**
   - API functions include CORS headers (✅ Already configured)
   - Check that frontend URL matches Supabase allowed origins

### Checking Logs:

1. Go to Vercel Dashboard
2. Select your project
3. Click on a deployment
4. View "Functions" tab for serverless function logs

## Custom Domain (Optional)

1. Go to Settings > Domains in Vercel
2. Add your custom domain
3. Update environment variables to use new domain
4. Update Supabase allowed origins

## Performance Optimization

The deployment includes:
- ✅ Code splitting for faster loading
- ✅ Serverless functions for API
- ✅ Static asset optimization
- ✅ CDN distribution via Vercel

## Monitoring

- **Vercel Analytics**: Built-in performance monitoring
- **Error Tracking**: Check function logs in Vercel dashboard
- **Supabase Monitoring**: Use Supabase dashboard for database metrics

## Cost Considerations

**Vercel Free Tier Includes:**
- 100GB bandwidth per month
- 100GB-hours of serverless function execution
- Unlimited static deployments

**Potential Costs:**
- LanguageTool API calls (if exceeding free tier)
- Supabase usage (if exceeding free tier)
- Vercel overages (if exceeding free tier)

## Security Notes

- ✅ Environment variables are secure in Vercel
- ✅ Supabase RLS policies protect data
- ✅ HTTPS enforced by default
- ✅ CORS properly configured

## Next Steps After Deployment

1. Test all functionality in production
2. Set up monitoring and alerts
3. Configure custom domain (optional)
4. Set up staging environment (optional)
5. Configure CI/CD for automatic deployments

## Support

If you encounter issues:
1. Check Vercel documentation
2. Review Supabase logs
3. Check browser console for errors
4. Review function logs in Vercel dashboard 