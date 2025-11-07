# Tech Stack & AI Models Overview

## 🛠️ **Complete Tech Stack**

### **Frontend**
- **Framework**: Next.js 16.0.1 (React 19.2.0)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **UI Components**: 
  - Framer Motion (animations)
  - Lucide React (icons)

### **Backend**
- **Server**: Express.js 5.1.0
- **Runtime**: Node.js 20+
- **Language**: TypeScript (via tsx)

### **AI/ML**
- **Framework**: TensorFlow.js 4.22.0
- **Models**: 
  - `@tensorflow-models/pose-detection` 2.1.3
  - `@tensorflow/tfjs-node` 4.22.0 (for server-side)
- **Pose Detection**: MoveNet (Google's open-source model)
  - **Lightning** variant (~5MB) - Fast, for client-side
  - **Thunder** variant (~12MB) - More accurate, for server-side

### **Database**
- **Option 1**: Firebase Firestore (cloud)
- **Option 2**: MongoDB Atlas (cloud) via `mongodb` 6.20.0
- **Toggle**: Set `DATABASE_TYPE` in `.env.local`

### **Storage**
- **Option 1**: Firebase Storage (cloud)
- **Option 2**: Local file system (via Express server)
- **Toggle**: Set `STORAGE_TYPE` in `.env.local`

### **Authentication**
- **Provider**: Firebase Authentication
- **Methods**: Google Sign-In, Email/Password

### **Image Processing**
- **Server-side**: `canvas` 3.2.0 (for Node.js)
- **Client-side**: Native HTML5 Canvas API

### **File Upload**
- **Middleware**: `multer` 2.0.2 (Express file uploads)

### **Other**
- **CORS**: `cors` 2.8.5
- **Environment**: `dotenv` 17.2.3

---

## 🤖 **AI Models: Where They Are & How They Work**

### **Models Used**
1. **MoveNet Lightning** (~5MB)
   - Fast, lightweight pose detection
   - Used for client-side (browser) processing
   - 17 keypoints detection

2. **MoveNet Thunder** (~12MB)
   - More accurate pose detection
   - Used for server-side processing
   - 17 keypoints detection

3. **Custom Baseball Swing Detector**
   - Built on top of MoveNet
   - Analyzes baseball-specific metrics
   - Calculates bat path angle, hip rotation, shoulder rotation

4. **Bat Detection (Computer Vision)**
   - Hough Line Transform algorithm
   - Detects bat lines in images
   - Not a machine learning model (traditional CV)

### **Where Models Are Stored**

#### **❌ NOT in the Repository**
- Models are **NOT** stored in the `git` repository
- Models are **NOT** in a `models/` folder
- Models are **NOT** committed to version control

#### **✅ Models Are Downloaded & Cached**

**1. First-Time Download:**
- Models are downloaded from **Google's TensorFlow.js Model Hub** (CDN)
- URLs: `https://tfhub.dev/` or `https://storage.googleapis.com/`
- **Cost**: FREE (hosted by Google)
- **Size**: ~17MB total (one-time download)

**2. Caching Locations:**

**Client-Side (Browser):**
- Cached in browser's **IndexedDB** or **browser cache**
- Location: User's browser storage
- Persists across sessions
- Size: ~5MB (Lightning) or ~12MB (Thunder)

**Server-Side (Node.js):**
- Cached in **Node.js cache** or `node_modules/.cache/`
- Location: Your PC's file system
- Persists until cache is cleared
- Size: ~12MB (Thunder)

**3. Pre-Installation (Optional):**
- Run `npm run install:models` to pre-download and cache models
- This happens automatically after `npm install` (via `postinstall` script)
- Models are downloaded and tested before first use
- Makes first-time usage faster

### **How Models Are Loaded**

**Client-Side (`lib/pose/client.ts`):**
```typescript
// Models are loaded on-demand when first used
const detector = await posedetection.createDetector(
  posedetection.SupportedModels.MoveNet,
  { modelType: posedetection.movenet.modelType.SINGLEPOSE_THUNDER }
);
// If not cached, downloads from Google CDN
// If cached, loads from browser storage
```

**Server-Side (`lib/pose/server.ts`):**
```typescript
// Models are loaded on-demand when first used
const detector = await posedetection.createDetector(
  posedetection.SupportedModels.MoveNet,
  { modelType: posedetection.movenet.modelType.SINGLEPOSE_THUNDER }
);
// If not cached, downloads from Google CDN
// If cached, loads from Node.js cache
```

### **Model Installation Script**

**Location**: `scripts/install-models.ts`

**What it does:**
1. Downloads MoveNet Lightning from Google CDN
2. Downloads MoveNet Thunder from Google CDN
3. Tests both models with dummy images
4. Caches models for faster loading
5. Reports installation status

**Run manually:**
```bash
npm run install:models
```

**Automatic:**
- Runs automatically after `npm install` (via `postinstall` script)
- If installation fails, models will download on first use

---

## 💰 **Model Costs: $0.00**

### **Completely FREE**
- ✅ Models are open-source (Apache 2.0 license)
- ✅ No API calls (runs locally)
- ✅ No per-request fees
- ✅ No subscription costs
- ✅ Models cached after first download
- ✅ No cloud inference costs

### **What You Pay For**
- **Nothing!** Models are completely free
- Only "cost" is initial download (~17MB, one-time)
- Uses your device's CPU/GPU (which you already have)

---

## 📊 **Model Performance**

### **MoveNet Lightning**
- **Speed**: ~50-100ms per image (client-side)
- **Accuracy**: Good (17 keypoints)
- **Size**: ~5MB
- **Best for**: Real-time browser processing

### **MoveNet Thunder**
- **Speed**: ~100-200ms per image (server-side)
- **Accuracy**: Better (17 keypoints, more precise)
- **Size**: ~12MB
- **Best for**: Server-side processing, higher accuracy needs

---

## 🔄 **Model Lifecycle**

### **First Use (No Cache)**
1. User uploads image
2. App requests model from Google CDN
3. Model downloads (~5-12MB, 2-5 seconds)
4. Model is cached
5. Inference runs
6. Results returned

### **Subsequent Uses (Cached)**
1. User uploads image
2. App loads model from cache (instant)
3. Inference runs
4. Results returned

### **Cache Management**
- **Browser**: Managed by browser (IndexedDB/cache)
- **Node.js**: Managed by TensorFlow.js (system cache)
- **Clearing**: Cache persists until manually cleared or browser cache cleared

---

## ✅ **Summary**

### **Tech Stack**
- Next.js + React + TypeScript (frontend)
- Express.js + Node.js (backend)
- TensorFlow.js (AI/ML)
- Firebase or MongoDB (database)
- Firebase Storage or Local (storage)

### **AI Models**
- **Source**: Google's TensorFlow.js Model Hub (FREE)
- **Storage**: Downloaded and cached (NOT in repo)
- **Location**: Browser cache (client) or Node.js cache (server)
- **Cost**: $0.00 (completely free)
- **Installation**: Automatic or manual via `npm run install:models`

### **Key Points**
- ✅ Models are NOT stored in the repository
- ✅ Models are downloaded from Google CDN (FREE)
- ✅ Models are cached after first download
- ✅ All inference runs locally (no cloud costs)
- ✅ Completely free to use

---

## 🎯 **Bottom Line**

**We DO use AI models**, but they're:
- **Not stored locally in the repo** (downloaded on-demand)
- **Cached after first download** (browser or Node.js cache)
- **Completely free** (open-source, no API costs)
- **Run locally** (no cloud inference)

The models are "local" in the sense that they run on your device/server, but they're not stored in the git repository - they're downloaded and cached automatically.

