# Railway Frontend Deployment Guide

**Phase 9 - Demo Deployment Architecture**

Frontend만 Railway에 배포하고, Backend/DB는 로컬에서 Cloudflare Tunnel을 통해 연결하는 구조입니다.

## Prerequisites

- Railway account (https://railway.app)
- GitHub repository with frontend code
- Cloudflare Tunnel already running (see `cloudflare_tunnel_setup.md`)
- Backend running locally with tunnel URL accessible

---

## Step 1: Prepare Frontend for Deployment

### 1.1 Create Production Environment File

Create `frontend/.env.production`:

```bash
# Backend API URL (Cloudflare Tunnel URL)
NEXT_PUBLIC_API_URL=https://labeler-api.yourdomain.com

# App Configuration
NEXT_PUBLIC_APP_NAME=Vision AI Labeler
NEXT_PUBLIC_APP_VERSION=0.1.0
```

### 1.2 Update package.json Scripts (if needed)

Check `frontend/package.json`:

```json
{
  "scripts": {
    "dev": "next dev -p 3010",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

### 1.3 Create Railway Configuration (Optional)

Create `frontend/railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## Step 2: Deploy to Railway

### Option A: Using Railway CLI (Recommended)

#### Install Railway CLI

```powershell
# Using npm
npm install -g @railway/cli

# Verify installation
railway --version
```

#### Login to Railway

```powershell
railway login
```

#### Initialize Project

```powershell
cd frontend
railway init
```

Select:
- **Create new project** → Enter project name: `labeler-frontend`
- **Link to GitHub** (optional but recommended)

#### Deploy

```powershell
# Deploy frontend
railway up
```

This will:
1. Upload frontend code
2. Detect Next.js project
3. Install dependencies
4. Build production bundle
5. Start server

#### Set Environment Variables

```powershell
# Set API URL
railway variables set NEXT_PUBLIC_API_URL=https://labeler-api.yourdomain.com

# Set app name
railway variables set NEXT_PUBLIC_APP_NAME="Vision AI Labeler"

# Set version
railway variables set NEXT_PUBLIC_APP_VERSION="0.1.0"
```

#### Open Deployment

```powershell
railway open
```

### Option B: Using Railway Dashboard

#### 2.1 Create New Project

1. Go to https://railway.app/dashboard
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Authorize Railway to access your GitHub
5. Select repository: `mvp-vision-ai-labeler`
6. Railway will detect the project

#### 2.2 Configure Service

1. **Root Directory**: Set to `frontend`
   - Settings → Service → Root Directory → `frontend`

2. **Build Command**: (Auto-detected)
   ```
   npm run build
   ```

3. **Start Command**: (Auto-detected)
   ```
   npm run start
   ```

4. **Port**: Railway auto-detects Next.js port (3000)

#### 2.3 Set Environment Variables

Go to **Variables** tab and add:

```bash
NEXT_PUBLIC_API_URL=https://labeler-api.yourdomain.com
NEXT_PUBLIC_APP_NAME=Vision AI Labeler
NEXT_PUBLIC_APP_VERSION=0.1.0
```

#### 2.4 Deploy

1. Railway will automatically trigger deployment
2. Wait for build to complete (3-5 minutes)
3. Check deployment logs for errors

---

## Step 3: Configure Custom Domain (Optional)

### 3.1 Generate Railway Domain

Railway provides a free subdomain:
```
https://labeler-frontend-production.up.railway.app
```

### 3.2 Add Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Click **Add Domain**
3. Enter your domain: `labeler.yourdomain.com`
4. Add CNAME record to your DNS:
   - Name: `labeler`
   - Value: `labeler-frontend-production.up.railway.app`

---

## Step 4: Update Backend CORS

After getting Railway frontend URL, update backend CORS:

Edit `backend/.env`:

```bash
CORS_ORIGINS=https://labeler-frontend-production.up.railway.app,http://localhost:3010
```

Restart local backend for changes to take effect.

---

## Step 5: Test Deployment

### 5.1 Check Deployment Status

Visit Railway dashboard and check:
- ✅ Build succeeded
- ✅ Service is running
- ✅ No errors in logs

### 5.2 Test Frontend Access

Visit your Railway URL:
```
https://labeler-frontend-production.up.railway.app
```

**Expected:** Login page loads correctly

### 5.3 Test API Connection

1. Open browser DevTools → Network tab
2. Try to login
3. Check API requests go to:
   ```
   https://labeler-api.yourdomain.com/api/v1/auth/login
   ```

### 5.4 Test Full Flow

1. Login with test credentials
2. View datasets
3. Upload images
4. Annotate images
5. Check all features work

---

## Step 6: Monitor Deployment

### Check Logs

```powershell
# Using Railway CLI
railway logs

# Or view in Railway Dashboard → Deployments → Logs
```

### Check Metrics

Railway Dashboard → Metrics:
- CPU usage
- Memory usage
- Network bandwidth
- Build time

---

## Troubleshooting

### Build Failed

**Check build logs:**
```powershell
railway logs --deployment
```

**Common issues:**
- Missing dependencies: Check `package.json`
- TypeScript errors: Fix type issues
- Environment variables: Ensure all required vars are set

### 502 Bad Gateway

**Possible causes:**
- Backend not running locally
- Cloudflare Tunnel stopped
- CORS misconfiguration

**Fix:**
1. Check local backend is running
2. Verify tunnel: `cloudflared tunnel info labeler-backend`
3. Test tunnel URL: `curl https://labeler-api.yourdomain.com/health`

### API Requests Failing

**Check CORS settings:**
```bash
# Backend .env should include Railway URL
CORS_ORIGINS=https://labeler-frontend-production.up.railway.app
```

**Check environment variable:**
```powershell
railway variables
# Should show NEXT_PUBLIC_API_URL=https://labeler-api.yourdomain.com
```

### Images Not Loading

**Check R2 configuration:**
- Verify R2 public URL in backend `.env`
- Test image URL directly in browser
- Check browser console for CORS errors

### Slow Performance

**Optimize build:**
1. Enable Next.js Image Optimization
2. Use static generation where possible
3. Minimize bundle size

**Check Railway plan:**
- Starter: 512MB RAM, shared CPU
- Developer: 8GB RAM, more resources

---

## Cost Optimization

### Railway Pricing

**Starter Plan (Free):**
- $5 credit per month
- Shared CPU
- 512MB RAM
- 1GB Disk
- **Good for demos**

**Developer Plan ($5/month):**
- $5 credit + usage-based
- Shared CPU
- 8GB RAM
- 100GB Disk

### Estimated Costs

| Resource | Usage | Cost |
|----------|-------|------|
| Next.js Server | ~0.5GB RAM | ~$5/month |
| Network | <10GB egress | Free |
| Build time | ~3 min/build | Minimal |
| **Total** | | **~$5/month** |

### Tips to Reduce Costs

1. **Use Static Generation** where possible
   ```tsx
   export const generateStaticParams = () => { ... }
   ```

2. **Disable Preview Environments**
   - Settings → Deployments → Only deploy from `main` branch

3. **Optimize Images**
   ```tsx
   import Image from 'next/image'
   <Image ... loader="custom" />
   ```

4. **Monitor Usage**
   - Check Railway dashboard regularly
   - Set up billing alerts

---

## Continuous Deployment

### Enable Auto-Deploy from GitHub

1. Railway Dashboard → Settings → GitHub
2. **Enable:** Deploy on push to `main` branch
3. **Branch:** Select `main` (or `develop`)

### Deploy Workflow

```
Push to GitHub main branch
  ↓
Railway detects push
  ↓
Automatic build & deploy
  ↓
New version live in 3-5 minutes
```

### Rollback

If deployment fails:
1. Railway Dashboard → Deployments
2. Find previous successful deployment
3. Click **Redeploy**

---

## Health Checks

Railway automatically health checks your service:
- **HTTP check** on port 3000
- **Timeout**: 30 seconds
- **Retries**: 3 attempts

If health check fails, Railway will:
1. Mark deployment as failed
2. Keep previous version running
3. Send notification (if configured)

---

## Security Considerations

### Environment Variables

- ✅ Never commit `.env.production` to Git
- ✅ Use Railway's environment variable management
- ✅ Rotate secrets regularly

### HTTPS

- ✅ Railway provides free HTTPS
- ✅ Automatic SSL certificate renewal
- ✅ Forces HTTPS by default

### API Security

- ✅ Backend requires JWT authentication
- ✅ Cloudflare Tunnel provides additional security layer
- ✅ Rate limiting on backend (consider adding)

---

## Next Steps

After successful deployment:
1. ✅ Test all features thoroughly
2. ✅ Share demo URL with limited users
3. ✅ Monitor costs and performance
4. ✅ Collect feedback
5. ✅ Plan for production deployment (Phase 11)

---

## Quick Reference

### Railway CLI Commands

```powershell
# Login
railway login

# Link to project
railway link

# Deploy
railway up

# View logs
railway logs

# Set environment variable
railway variables set KEY=VALUE

# Open in browser
railway open

# Check status
railway status
```

### Important URLs

- Railway Dashboard: https://railway.app/dashboard
- Deployment URL: https://labeler-frontend-production.up.railway.app
- Backend (via Tunnel): https://labeler-api.yourdomain.com
- R2 Public URL: https://pub-300ed1553b304fc5b1d83684b73fc318.r2.dev

---

## Support

If you encounter issues:
1. Check Railway docs: https://docs.railway.app
2. Railway Discord: https://discord.gg/railway
3. Check backend logs: `railway logs` (if backend was on Railway)
4. Check tunnel logs: `cloudflared tunnel info labeler-backend`
