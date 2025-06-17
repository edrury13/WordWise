#!/bin/bash

# WordWise Build Script for Vercel Deployment

echo "🚀 Building WordWise for Vercel deployment..."

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install

# Build frontend
echo "🏗️ Building frontend..."
npm run build

# Check if build was successful
if [ -d "dist" ]; then
    echo "✅ Frontend build successful!"
    echo "📁 Build output in frontend/dist/"
else
    echo "❌ Frontend build failed!"
    exit 1
fi

# Go back to root
cd ..

# Install API dependencies
echo "📦 Installing API dependencies..."
cd api
npm install
cd ..

echo "🎉 Build complete! Ready for Vercel deployment."
echo ""
echo "Next steps:"
echo "1. Commit and push to GitHub"
echo "2. Connect repository to Vercel"
echo "3. Set environment variables in Vercel dashboard"
echo "4. Deploy!" 