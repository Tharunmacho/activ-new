# ACTIV Platform - Deployment Guide

## 🎯 Deployment Architecture

```
Frontend (Vercel) → Backend (Render) → Database (MongoDB Atlas)
```

---

## 📦 **Part 1: Backend Deployment (Render)**

### Step 1: Prepare Backend for Deployment

1. **Create `vercel.json` in server folder** (if using Vercel for backend):
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

2. **Or use Render (Recommended)**:
   - No config file needed
   - Just point to `server.js`

### Step 2: Environment Variables for Backend

Set these in Render/Vercel dashboard:

```env
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb+srv://your-connection-string
JWT_SECRET=your-jwt-secret-here
CORS_ORIGIN=https://your-frontend-domain.vercel.app
INSTAMOJO_API_KEY=your-key
INSTAMOJO_AUTH_TOKEN=your-token
INSTAMOJO_ENDPOINT=https://api.instamojo.com/v2/
```

### Step 3: Deploy Backend to Render

1. Go to https://render.com
2. Sign up with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name**: activ-backend
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
6. Add environment variables (from Step 2)
7. Click "Create Web Service"

**Your backend URL**: `https://activ-backend.onrender.com`

---

## 🎨 **Part 2: Frontend Deployment (Vercel)**

### Step 1: Update Frontend API URLs

Create `.env.production` in frontend root:

```env
VITE_API_URL=https://activ-backend.onrender.com
```

### Step 2: Update API calls to use environment variable

In your API files, change:
```javascript
// Before
const API_URL = 'http://localhost:4000';

// After
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
```

### Step 3: Deploy to Vercel

**Option A: Vercel CLI**
```bash
cd c:\active-web-day-2-push\active-web-day-2-push
npm install -g vercel
vercel login
vercel
```

**Option B: Vercel Dashboard**
1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "Add New" → "Project"
4. Import your GitHub repository
5. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (or leave empty)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Add environment variable:
   - `VITE_API_URL` = `https://activ-backend.onrender.com`
7. Click "Deploy"

**Your frontend URL**: `https://your-project.vercel.app`

---

## 🗄️ **Part 3: Database Configuration**

### MongoDB Atlas Setup

1. Go to MongoDB Atlas dashboard
2. Click "Network Access"
3. Click "Add IP Address"
4. Select "Allow Access from Anywhere" (0.0.0.0/0)
5. Click "Confirm"

**Why**: Render/Vercel use dynamic IPs, so we need to allow all IPs

---

## ⚙️ **Part 4: CORS Configuration**

Update `server/server.js`:

```javascript
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## 🔧 **Alternative: Deploy Backend to Vercel**

If you want everything on Vercel:

### Create `vercel.json` in server folder:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Deploy:
```bash
cd server
vercel
```

**Note**: Vercel has 10-second timeout for serverless functions. Render is better for long-running processes.

---

## 📊 **Comparison Table**

| Platform | Frontend | Backend | Cost | Speed | Reliability |
|----------|----------|---------|------|-------|-------------|
| **Vercel** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Free | Fast | Good |
| **Render** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Free | Medium | Excellent |
| **Railway** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | $5/mo | Fast | Excellent |
| **Netlify** | ⭐⭐⭐⭐⭐ | ⭐⭐ | Free | Fast | Good |

---

## 🎯 **Recommended Setup for Client Demo**

```
Frontend: Vercel (Free)
Backend: Render (Free)
Database: MongoDB Atlas (Free)
Total Cost: $0/month
```

**Why this combo?**
- ✅ Completely free
- ✅ Easy to set up
- ✅ Professional URLs
- ✅ Automatic deployments
- ✅ Good performance

---

## 🚨 **Important Notes**

### 1. **Render Free Tier Limitation**
- Backend spins down after 15 minutes of inactivity
- First request after spin-down takes 30-60 seconds
- **Solution**: Use a cron job to ping every 10 minutes (or upgrade to $7/month)

### 2. **Environment Variables**
- Never commit `.env` files to Git
- Set all env vars in hosting platform dashboard

### 3. **Build Time**
- Frontend: ~2-3 minutes
- Backend: ~3-5 minutes

---

## 📝 **Quick Deployment Checklist**

- [ ] MongoDB Atlas allows connections from anywhere (0.0.0.0/0)
- [ ] Backend deployed to Render/Vercel
- [ ] Backend environment variables set
- [ ] Backend URL noted (e.g., https://activ-backend.onrender.com)
- [ ] Frontend `.env.production` created with backend URL
- [ ] Frontend deployed to Vercel
- [ ] Test login on production
- [ ] Test payment flow on production
- [ ] Share production URL with client

---

## 🔗 **Final URLs**

After deployment, you'll have:

```
Frontend: https://activ-platform.vercel.app
Backend:  https://activ-backend.onrender.com
API Docs: https://activ-backend.onrender.com/api/health
```

Share the **Frontend URL** with your client!

---

## 🆘 **Troubleshooting**

### Issue: CORS errors
**Solution**: Add frontend URL to `CORS_ORIGIN` in backend env vars

### Issue: Backend not responding
**Solution**: Render free tier spins down - wait 30-60 seconds for first request

### Issue: Database connection failed
**Solution**: Check MongoDB Atlas network access allows 0.0.0.0/0

### Issue: Environment variables not working
**Solution**: Restart backend service after adding env vars

---

**Need help with deployment? Let me know which platform you choose!**
