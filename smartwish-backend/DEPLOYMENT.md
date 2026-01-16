# Smartwish Backend Deployment Guide

## Overview
This backend supports both the main Smartwish application and the hotels subdomain (hotels.smartwish.us) with integrated static file serving.

## Deployment Structure
```
smartwish-backend/
├── backend/                 # NestJS application
│   ├── src/                # Source code
│   ├── dist/               # Compiled JavaScript (generated)
│   ├── package.json        # Backend dependencies
│   └── .env.production     # Production environment variables
├── hotels-static/          # Static files for hotels subdomain
│   ├── index.html         # Hotels landing page
│   ├── locations.html     # Hotels locations page
│   └── assets/            # CSS, JS, images
├── package.json           # Root deployment configuration
└── Procfile              # Render.com deployment command
```

## Key Features
- **Subdomain Routing**: Automatically serves hotels-static files for hotels.smartwish.us
- **CORS Configuration**: Supports multiple origins including hotels subdomain
- **Production Ready**: Environment-specific configurations
- **Static File Integration**: Hotels static files are served directly by the backend

## Deployment Steps

### 1. Environment Variables
Ensure these environment variables are set in your deployment platform:
- `NODE_ENV=production`
- `PORT` (automatically set by Render.com)
- Database credentials (Supabase)
- API keys (Gemini, etc.)

### 2. Build Process
The deployment will:
1. Install root dependencies
2. Navigate to backend directory
3. Install backend dependencies
4. Build TypeScript to JavaScript
5. Start the production server

### 3. Verification
After deployment, verify:
- Main API: `https://your-app.onrender.com/api/v1/health`
- Hotels subdomain: `https://hotels.smartwish.us/` (serves hotels-static/index.html)
- CORS headers are properly set for all origins

## Production Configuration
- **Static Path**: Uses `join(process.cwd(), '../hotels-static')` to locate static files
- **CORS Origins**: Includes hotels.smartwish.us in allowed origins
- **Security**: HSTS headers with subdomain support enabled
- **Logging**: Set to error level for production

## Troubleshooting
- If hotels subdomain returns 404, check that hotels-static folder is at the correct path
- Verify CORS origins include your frontend domains
- Check environment variables are properly set
- Monitor logs for any startup errors

## Files Modified for Integration
- `backend/src/main.ts`: Added subdomain middleware and static file serving
- `backend/.env`: Updated CORS origins to include hotels subdomain
- `Procfile`: Updated to use NestJS backend instead of old server.js
- Root `package.json`: Created for deployment dependency management

Deployment is ready for production on Render.com or similar platforms.