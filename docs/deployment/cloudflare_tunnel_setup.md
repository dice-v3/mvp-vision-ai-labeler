# Cloudflare Tunnel Setup Guide

**Phase 9 - Demo Deployment Architecture**

Local Backend + Local DB를 Cloudflare Tunnel을 통해 공개하고, Frontend만 Railway에 배포하는 구조입니다.

## Architecture Overview

```
Demo Users
  ↓
Railway Frontend (https://labeler-demo.railway.app)
  ↓
Cloudflare Tunnel (https://labeler-api.yourdomain.com)
  ↓
Local PC
  ├─ Backend (FastAPI:8011)
  ├─ PostgreSQL (User DB)
  └─ PostgreSQL (Labeler DB)
  ↓
Cloudflare R2 (Image Storage)
```

## Benefits

- **Cost-effective**: ~$6.5/month (Railway Frontend + R2) vs $40/month (Full Railway)
- **Full control**: Local DB, easy backup/restore
- **Demo-friendly**: Can start/stop anytime
- **Secure**: Cloudflare HTTPS tunnel with authentication

## Prerequisites

- Windows 10/11
- Cloudflare account (free)
- Domain name managed by Cloudflare (optional but recommended)
- Local PostgreSQL running
- Backend running on `localhost:8011`

---

## Step 1: Install Cloudflared

### Option A: Using Winget (Recommended)

```powershell
winget install cloudflare.cloudflared
```

### Option B: Manual Download

1. Download from: https://github.com/cloudflare/cloudflared/releases
2. Download `cloudflared-windows-amd64.exe`
3. Rename to `cloudflared.exe`
4. Move to `C:\Program Files\cloudflared\`
5. Add to PATH environment variable

### Verify Installation

```powershell
cloudflared --version
# Expected output: cloudflared version 2024.x.x
```

---

## Step 2: Authenticate with Cloudflare

```powershell
cloudflared tunnel login
```

This will:
1. Open browser for authentication
2. Ask you to select domain
3. Save credentials to `~/.cloudflared/cert.pem`

---

## Step 3: Create Tunnel

```powershell
# Create tunnel named "labeler-backend"
cloudflared tunnel create labeler-backend
```

This will:
- Generate tunnel credentials: `~/.cloudflared/<TUNNEL-ID>.json`
- Display tunnel ID (save this!)

**Expected output:**
```
Created tunnel labeler-backend with id abc123-def456-ghi789
```

---

## Step 4: Configure Tunnel

### Create Configuration File

Create `C:\Users\<YourUsername>\.cloudflared\config.yml`:

```yaml
tunnel: labeler-backend
credentials-file: C:\Users\<YourUsername>\.cloudflared\<TUNNEL-ID>.json

ingress:
  # Route API requests to local backend
  - hostname: labeler-api.yourdomain.com
    service: http://localhost:8011

  # Catch-all rule (required)
  - service: http_status:404
```

**Replace:**
- `<TUNNEL-ID>` with your actual tunnel ID
- `<YourUsername>` with your Windows username
- `labeler-api.yourdomain.com` with your actual domain

---

## Step 5: Configure DNS

### Option A: Using CLI (Recommended)

```powershell
cloudflared tunnel route dns labeler-backend labeler-api.yourdomain.com
```

### Option B: Using Cloudflare Dashboard

1. Go to Cloudflare Dashboard → DNS
2. Add CNAME record:
   - Name: `labeler-api`
   - Target: `<TUNNEL-ID>.cfargotunnel.com`
   - Proxy status: Proxied (orange cloud)

---

## Step 6: Test Tunnel

### Start Tunnel

```powershell
cloudflared tunnel run labeler-backend
```

**Expected output:**
```
2024-11-25T10:00:00Z INF Starting tunnel tunnelID=abc123
2024-11-25T10:00:00Z INF Connection registered connIndex=0
2024-11-25T10:00:00Z INF Registered tunnel connection
```

### Test Backend Access

Open browser and visit:
```
https://labeler-api.yourdomain.com/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "environment": "development"
}
```

---

## Step 7: Run as Windows Service (Production)

### Install Service

```powershell
# Run as Administrator
cloudflared service install
```

### Start Service

```powershell
# Start service
net start cloudflared

# OR using Services.msc
# Find "Cloudflare Tunnel" and start it
```

### Verify Service

```powershell
cloudflared service status
```

---

## Step 8: Update Backend CORS

Edit `backend/.env`:

```bash
# Add your Railway frontend URL and tunnel URL
CORS_ORIGINS=https://labeler-demo.railway.app,https://labeler-api.yourdomain.com,http://localhost:3010
```

Restart backend for changes to take effect.

---

## Step 9: Configure Railway Frontend

In Railway Dashboard → Environment Variables:

```bash
NEXT_PUBLIC_API_URL=https://labeler-api.yourdomain.com
```

Deploy frontend to Railway.

---

## Troubleshooting

### Tunnel Not Connecting

**Check backend is running:**
```powershell
curl http://localhost:8011/health
```

**Check tunnel logs:**
```powershell
cloudflared tunnel info labeler-backend
```

### 502 Bad Gateway

- Backend not running on port 8011
- Check firewall settings (allow localhost connections)
- Restart cloudflared tunnel

### DNS Not Resolving

```powershell
# Check DNS propagation
nslookup labeler-api.yourdomain.com

# Force DNS update
cloudflared tunnel route dns labeler-backend labeler-api.yourdomain.com
```

### CORS Errors

- Verify CORS_ORIGINS includes Railway frontend URL
- Check browser console for exact error
- Restart backend after .env changes

---

## Monitoring

### Check Tunnel Status

```powershell
cloudflared tunnel info labeler-backend
```

### View Tunnel Logs

```powershell
# If running as service
Get-Content "C:\Program Files\cloudflared\logs\cloudflared.log" -Tail 50

# If running manually
# Logs will appear in terminal
```

### Test Backend Health

```powershell
# Local access
curl http://localhost:8011/health

# Public access (via tunnel)
curl https://labeler-api.yourdomain.com/health
```

---

## Security Considerations

### Best Practices

1. **Environment Variables**: Never commit `.env` files with secrets
2. **Tunnel Credentials**: Protect `~/.cloudflared/*.json` files
3. **Rate Limiting**: Consider adding rate limiting to backend
4. **Authentication**: Ensure JWT authentication is working
5. **DB Access**: PostgreSQL should only accept local connections

### Firewall Rules

```powershell
# PostgreSQL should NOT be accessible from internet
# Only localhost connections allowed
netstat -an | findstr :5432
# Should only show 127.0.0.1:5432
```

---

## Cost Breakdown

| Service | Cost | Notes |
|---------|------|-------|
| Railway Frontend | ~$5/month | Static hosting |
| Cloudflare Tunnel | $0 | Free tier |
| Local PostgreSQL | $0 | Local |
| Cloudflare R2 | ~$1.5/month | 100GB storage |
| **Total** | **~$6.5/month** | 84% savings vs full Railway |

---

## Alternative: No Custom Domain

If you don't have a custom domain, you can use Cloudflare's temporary URL:

### Step 3b: Create Tunnel with Quick Tunnel

```powershell
cloudflared tunnel --url http://localhost:8011
```

This will generate a temporary URL like:
```
https://random-words-1234.trycloudflare.com
```

**Limitations:**
- URL changes every time you restart
- Not suitable for production
- Good for quick testing only

---

## Quick Start (TL;DR)

```powershell
# 1. Install
winget install cloudflare.cloudflared

# 2. Authenticate
cloudflared tunnel login

# 3. Create tunnel
cloudflared tunnel create labeler-backend

# 4. Create config file
# Edit ~/.cloudflared/config.yml (see Step 4)

# 5. Configure DNS
cloudflared tunnel route dns labeler-backend labeler-api.yourdomain.com

# 6. Test tunnel
cloudflared tunnel run labeler-backend

# 7. Install as service (optional)
cloudflared service install
net start cloudflared
```

---

## Next Steps

After tunnel is running:
1. Deploy frontend to Railway (see `railway_deployment.md`)
2. Test complete flow (login, dataset selection, annotation)
3. Monitor performance and costs
4. Plan for production deployment (Phase 11)
