# Cost Breakdown: What You Pay For vs What Runs Locally

## 💰 **PAID SERVICES** (Cloud-based)

### 1. **Firebase Services** (Google Cloud)
   - **Firebase Authentication**: ✅ **COMPLETELY FREE** on Spark plan:
     - 50,000 MAU (Monthly Active Users) - FREE
     - Beyond that: $0.0055 per MAU (but you can stay on Spark plan)
     - **No charges for Auth** - use it freely!
   - **Firestore Database**: 
     - FREE tier: 50K reads/day, 20K writes/day, 20K deletes/day, 1GB storage
     - Paid: $0.06 per 100K reads, $0.18 per 100K writes, $0.02 per 100K deletes, $0.18/GB storage
   - **Firebase Storage**:
     - FREE tier: 5GB storage, 1GB/day downloads
     - Paid: $0.026/GB storage, $0.12/GB downloads
   - **Firebase Hosting** (if you deploy Next.js there):
     - FREE tier: 10GB storage, 360MB/day transfer
     - Paid: $0.026/GB storage, $0.15/GB transfer

### 2. **MongoDB Atlas** (Optional - if `DATABASE_TYPE=mongodb`)
   - **FREE tier (M0)**: 
     - 512MB storage
     - Shared CPU/RAM
     - Perfect for development/testing
   - **Paid tiers**: Start at $9/month (M2) for 2GB storage

### 3. **Vercel/Netlify** (Optional - if you deploy Next.js there)
   - **Vercel FREE tier**: 
     - Unlimited personal projects
     - 100GB bandwidth/month
     - Serverless functions included
   - **Paid**: Starts at $20/month for team features

---

## 🆓 **FREE / LOCAL** (Runs on Your PC)

### 1. **Next.js Application** (Frontend + API Routes)
   - Runs locally on `localhost:3000` (or your chosen port)
   - **Cost**: FREE (just your electricity)
   - **What it does**:
     - Serves the React frontend
     - Handles API routes (`/api/pose`, `/api/sessions`, etc.)
     - Client-side pose detection (runs in browser)

### 2. **Express Server** (Optional - if `STORAGE_TYPE=local`)
   - Runs locally on `localhost:3001` (or your chosen port)
   - **Cost**: FREE (just your electricity)
   - **What it does**:
     - Stores uploaded images/videos in `server/uploads/` folder
     - Server-side pose detection (runs on your PC)
     - Serves stored files via HTTP

### 3. **AI Models (TensorFlow.js MoveNet)**
   - **Models**: MoveNet Lightning (~5MB) and Thunder (~12MB)
   - **Source**: Google's TensorFlow.js Model Hub (FREE, open-source)
   - **Cost**: $0.00 (completely FREE)
   - **Download**: One-time download from Google CDN (FREE)
   - **Caching**: Models cached after first download
   - **No API Calls**: All inference runs locally (no cloud costs)

### 4. **Client-Side AI (TensorFlow.js)**
   - Runs entirely in the user's browser
   - **Cost**: FREE (no server needed, no API calls)
   - **What it does**:
     - Pose detection using MoveNet Lightning model
     - All processing happens on user's device
     - No data sent to servers
     - Model downloaded once, cached forever

### 5. **Server-Side AI (TensorFlow.js Node)**
   - Runs on your local Express server (if enabled)
   - **Cost**: FREE (uses your PC's CPU/GPU, no API costs)
   - **What it does**:
     - More accurate pose detection using MoveNet Thunder
     - Processes images server-side
     - Requires your PC to be running
     - Model downloaded once, cached forever

---

## 📊 **Configuration Options**

You can choose what to pay for by setting environment variables:

### **Option 1: Fully Cloud (Most Convenient)**
```env
STORAGE_TYPE=firebase      # Pay for Firebase Storage
DATABASE_TYPE=firestore    # Pay for Firestore
```
- ✅ No local server needed
- ✅ Access from anywhere
- ❌ Costs money (but FREE tier is generous)

### **Option 2: Hybrid (Best of Both Worlds)**
```env
STORAGE_TYPE=local         # FREE - stores on your PC
DATABASE_TYPE=firestore    # Pay for Firestore (or use MongoDB FREE tier)
```
- ✅ Free storage (on your PC)
- ✅ Cloud database (accessible from anywhere)
- ❌ Need to run Express server locally

### **Option 3: Fully Local (Completely FREE)**
```env
STORAGE_TYPE=local         # FREE - stores on your PC
DATABASE_TYPE=mongodb      # FREE - use MongoDB Atlas M0 (FREE tier)
```
- ✅ Completely free (within FREE tier limits)
- ❌ Need to run Express server locally
- ❌ MongoDB Atlas M0 has 512MB limit

### **Option 4: Cloud Database, Local Storage**
```env
STORAGE_TYPE=local         # FREE - stores on your PC
DATABASE_TYPE=firestore    # Pay for Firestore
```
- ✅ Free storage
- ✅ Cloud database
- ❌ Need Express server running

---

## 💡 **Cost Optimization Tips**

1. **For Development/Testing**: Use FREE tiers
   - Firebase FREE tier is very generous
   - MongoDB Atlas M0 is completely FREE
   - AI models are completely FREE (open-source, no API costs)
   - Run everything locally when possible

2. **For Production**:
   - Start with FREE tiers and monitor usage
   - Firebase FREE tier handles ~1,000-10,000 users easily
   - AI models scale for free (each user's device processes their own data)
   - Upgrade only when you hit limits

3. **Minimize Costs**:
   - Use `STORAGE_TYPE=local` to avoid Firebase Storage costs
   - Use client-side pose detection when possible (no server needed, no API costs)
   - AI models are cached after first download (no repeated downloads)
   - Cache frequently accessed data

4. **AI Model Costs**:
   - ✅ All models are FREE (open-source Apache 2.0)
   - ✅ No API calls (runs locally on device/server)
   - ✅ No per-request fees (all inference is local)
   - ✅ Models cached after first download (~5-12MB one-time)
   - ✅ Scales infinitely (each user's device processes their own data)

---

## 📈 **Estimated Monthly Costs**

### **Small App (< 1,000 users)**
- Firebase: **$0** (within FREE tier)
- MongoDB Atlas: **$0** (M0 FREE tier)
- AI Models: **$0** (FREE, open-source, runs locally)
- **Total: $0/month**

### **Medium App (1,000-10,000 users)**
- Firebase: **$0-50/month** (mostly FREE tier)
- MongoDB Atlas: **$0-9/month** (M0 or M2)
- AI Models: **$0** (FREE, scales with users' devices)
- **Total: $0-59/month**

### **Large App (10,000+ users)**
- Firebase: **$50-500/month** (depends on usage)
- MongoDB Atlas: **$9-50/month**
- AI Models: **$0** (FREE, scales infinitely with users' devices)
- **Total: $59-550/month**

---

## 🎯 **Recommendation**

For MVP/Development:
- Use **Firebase FREE tier** for everything
- Set `STORAGE_TYPE=firebase` and `DATABASE_TYPE=firestore`
- AI models are completely FREE (no configuration needed)
- No local server needed
- **Cost: $0/month**

For Production (when you have users):
- Monitor Firebase usage
- Consider `STORAGE_TYPE=local` if you have many uploads
- Keep `DATABASE_TYPE=firestore` for reliability
- AI models scale for free (each user's device processes their own data)
- **Cost: $0-50/month** (likely still FREE tier)

