# Demo Deployment Checklist

**Phase 9 - Cloudflare Tunnel + Railway Frontend**

Use this checklist to ensure successful demo deployment.

---

## Pre-Deployment Checklist

### Local Environment

- [ ] Backend running successfully on `localhost:8011`
- [ ] PostgreSQL User DB accessible
- [ ] PostgreSQL Labeler DB accessible
- [ ] Cloudflare R2 credentials configured in `.env`
- [ ] Test login works locally
- [ ] Test image upload works locally
- [ ] Test annotation works locally

### Code Quality

- [ ] All Phase 10 performance optimizations applied
- [ ] No TypeScript errors: `cd frontend && npm run build`
- [ ] Backend tests passing (if available)
- [ ] Git branch is clean and up-to-date

---

## Cloudflare Tunnel Setup

### Installation

- [ ] Cloudflared installed: `cloudflared --version`
- [ ] Authenticated with Cloudflare: `cloudflared tunnel login`

### Tunnel Configuration

- [ ] Tunnel created: `cloudflared tunnel create labeler-backend`
- [ ] Tunnel ID saved (write it here: `____________________`)
- [ ] Config file created: `~/.cloudflared/config.yml`
- [ ] DNS configured: `labeler-api.yourdomain.com` → tunnel
- [ ] DNS propagated: `nslookup labeler-api.yourdomain.com`

### Tunnel Testing

- [ ] Tunnel running: `cloudflared tunnel run labeler-backend`
- [ ] Backend accessible via tunnel: `curl https://labeler-api.yourdomain.com/health`
- [ ] Returns: `{"status":"healthy",...}`
- [ ] Tunnel installed as Windows service (optional but recommended)

---

## Backend Configuration

### Environment Variables

- [ ] `backend/.env` file exists
- [ ] R2 credentials correct (test image upload)
- [ ] PostgreSQL connections correct
- [ ] JWT secret configured
- [ ] CORS origins updated with Railway frontend URL placeholder

Example CORS configuration:
```bash
CORS_ORIGINS=https://labeler-frontend-production.up.railway.app,http://localhost:3010
```

### Backend Health Check

- [ ] Backend running: Check terminal/logs
- [ ] Local access: `curl http://localhost:8011/health`
- [ ] Tunnel access: `curl https://labeler-api.yourdomain.com/health`
- [ ] Database connections: `curl http://localhost:8011/health/db`

---

## Frontend Configuration

### Environment Variables

- [ ] `frontend/.env.production.template` copied to `.env.production`
- [ ] `NEXT_PUBLIC_API_URL` set to Cloudflare Tunnel URL
- [ ] `.env.production` added to `.gitignore`
- [ ] `.env.production` NOT committed to Git

Example `.env.production`:
```bash
NEXT_PUBLIC_API_URL=https://labeler-api.yourdomain.com
NEXT_PUBLIC_APP_NAME=Vision AI Labeler
NEXT_PUBLIC_APP_VERSION=0.1.0
```

### Build Testing

- [ ] Production build works: `npm run build`
- [ ] No build errors
- [ ] Build size reasonable (<10MB)
- [ ] Test production build locally: `npm run start`

---

## Railway Deployment

### Railway Setup

- [ ] Railway account created
- [ ] Railway CLI installed: `railway --version`
- [ ] Authenticated: `railway login`

### Project Configuration

- [ ] New project created: `labeler-frontend`
- [ ] GitHub repository linked (optional but recommended)
- [ ] Root directory set to `frontend`
- [ ] Build command: `npm run build`
- [ ] Start command: `npm run start`

### Environment Variables (Railway Dashboard)

Set these in Railway Dashboard → Variables:

- [ ] `NEXT_PUBLIC_API_URL=https://labeler-api.yourdomain.com`
- [ ] `NEXT_PUBLIC_APP_NAME=Vision AI Labeler`
- [ ] `NEXT_PUBLIC_APP_VERSION=0.1.0`

### Deployment

- [ ] Deploy: `railway up` or push to GitHub
- [ ] Build succeeded (check logs)
- [ ] Service running (no crash loop)
- [ ] Railway URL noted (write it here: `____________________`)

---

## Post-Deployment Verification

### Backend CORS Update

- [ ] Update `backend/.env` with actual Railway URL:
  ```bash
  CORS_ORIGINS=https://your-actual-railway-url.up.railway.app,http://localhost:3010
  ```
- [ ] Restart backend: `Ctrl+C` then restart uvicorn
- [ ] Verify CORS: Check browser DevTools → Network → No CORS errors

### Functional Testing

Test on Railway frontend URL:

**Authentication**
- [ ] Login page loads
- [ ] Login with test credentials works
- [ ] JWT token stored correctly
- [ ] Redirect to dashboard after login

**Dashboard**
- [ ] Datasets list loads
- [ ] Dataset creation works
- [ ] Dataset selection works
- [ ] Project stats displayed

**Image Management**
- [ ] Image upload works
- [ ] Images displayed correctly (R2 URLs)
- [ ] Image thumbnail loading
- [ ] Batch upload works (test 10+ images)

**Annotation**
- [ ] Annotation page loads
- [ ] Canvas renders correctly
- [ ] Drawing tools work (rectangle, polygon)
- [ ] Zoom/pan works
- [ ] Minimap displays
- [ ] Magnifier works
- [ ] Save annotation works
- [ ] History panel updates

**Collaboration Features (Phase 8)**
- [ ] Invitations modal loads
- [ ] Send invitation works
- [ ] Accept invitation works
- [ ] Image locks work (concurrent editing prevented)
- [ ] Role-based permissions work

### Performance Testing

- [ ] Dashboard load time <3 seconds
- [ ] Image load time <1 second
- [ ] Annotation save time <500ms
- [ ] No unnecessary API duplication (check Network tab)
- [ ] User caching working (check backend logs: `[cached since X.XXs ago]`)

### Error Testing

- [ ] Invalid login handled gracefully
- [ ] Network error handled gracefully
- [ ] Image upload error handled gracefully
- [ ] 404 pages work correctly

---

## Monitoring Setup

### Railway Monitoring

- [ ] Check Railway Dashboard → Metrics
- [ ] CPU usage <50%
- [ ] Memory usage <400MB
- [ ] No errors in logs

### Cost Monitoring

- [ ] Railway billing page checked
- [ ] Expected cost: ~$5/month
- [ ] Set up billing alerts (optional)

### Backend Monitoring

- [ ] Backend logs clean (no repeated errors)
- [ ] Cloudflare Tunnel connected (check logs)
- [ ] Database connections stable
- [ ] R2 upload/download working

---

## Security Checklist

### Secrets Management

- [ ] No secrets in Git history
- [ ] `.env` files in `.gitignore`
- [ ] Railway environment variables secure
- [ ] JWT secret strong (32+ characters)

### Database Security

- [ ] PostgreSQL only accepts local connections
- [ ] No public PostgreSQL port exposed
- [ ] Verify: `netstat -an | findstr :5432` (should only show 127.0.0.1)

### API Security

- [ ] All endpoints require JWT (except login/register)
- [ ] CORS configured correctly
- [ ] HTTPS enforced (Railway + Cloudflare Tunnel)

---

## Rollback Plan

If deployment fails:

### Railway Rollback

1. Railway Dashboard → Deployments
2. Find last successful deployment
3. Click **Redeploy**

### Tunnel Rollback

1. Stop tunnel: `Ctrl+C` or `net stop cloudflared`
2. Check local backend: `curl http://localhost:8011/health`
3. Frontend falls back to local development

### Database Rollback

1. Local database not affected (no changes during demo)
2. If data corrupted: Restore from backup

---

## Demo Preparation

### Test Users

- [ ] Create test user accounts
- [ ] Test different roles (owner, admin, annotator, viewer)
- [ ] Prepare sample datasets

### Sample Data

- [ ] Upload sample images to test dataset
- [ ] Create sample annotations
- [ ] Test project with 100+ images

### Demo Script

- [ ] Prepare demo flow document
- [ ] Test complete user journey
- [ ] Prepare talking points
- [ ] Note known limitations

---

## Communication

### Stakeholders

- [ ] Notify team of deployment
- [ ] Share Railway URL
- [ ] Share test credentials
- [ ] Set demo time window

### Documentation

- [ ] Update README with deployment info
- [ ] Document known issues
- [ ] Prepare troubleshooting guide

---

## Post-Demo Tasks

### Data Collection

- [ ] Collect user feedback
- [ ] Monitor error logs
- [ ] Note performance issues
- [ ] Document feature requests

### Cost Analysis

- [ ] Review Railway usage/cost
- [ ] Review R2 usage/cost
- [ ] Compare with Railway DB cost (saved $10/week)

### Cleanup (Optional)

- [ ] Stop Cloudflare Tunnel: `net stop cloudflared`
- [ ] Pause Railway deployment (to stop billing)
- [ ] Export demo data (if needed)

---

## Emergency Contacts

| Issue | Action | Contact |
|-------|--------|---------|
| Backend crash | Check local logs, restart | Local troubleshooting |
| Tunnel down | Restart cloudflared service | Cloudflare support |
| Railway crash | Check Railway logs, redeploy | Railway support |
| Database issue | Check PostgreSQL status | Local DBA |

---

## Success Criteria

Demo deployment is successful when:

- ✅ Railway frontend accessible publicly
- ✅ Users can login and use all features
- ✅ No CORS errors
- ✅ Images load correctly from R2
- ✅ Annotations save successfully
- ✅ Performance acceptable (<3s page load)
- ✅ Cost under budget (~$6.5/month)
- ✅ PC can stay on during demo period

---

## Notes

**Date deployed:** _______________

**Railway URL:** _______________

**Tunnel URL:** _______________

**Issues encountered:**
-
-
-

**Next steps:**
-
-
-
