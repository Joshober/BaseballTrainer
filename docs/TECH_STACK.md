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
- **Main Gateway**: Node.js/Express (port 3001) - Handles auth and routing
- **Pose Detection Service**: Python Flask 3.0.0 (port 5000)
  - MediaPipe 0.10.8 for pose detection
  - OpenCV 4.8.1, Pillow 10.1.0 for image processing
- **Drill Recommender Service**: Python Flask 3.0.0 (port 5001)
- **Blast Connector Service**: Python Flask 3.0.0 (port 5002)

### **AI/ML**
- **Client-Side**: TensorFlow.js 4.22.0
  - `@tensorflow-models/pose-detection` 2.1.3
  - MoveNet Lightning (~5MB) - Fast, for client-side
- **Server-Side (Pose Detection Service)**: MediaPipe 0.10.8
  - MediaPipe Pose (pre-trained, included)
  - More accurate than TensorFlow.js Node
  - No native binding issues on Windows

### **Database**
- **Option 1**: Firebase Firestore (cloud)
- **Option 2**: MongoDB Atlas (cloud) via `pymongo` 4.6.0
- **Toggle**: Set `DATABASE_TYPE` in `.env.local`

### **Storage**
- **Option 1**: Firebase Storage (cloud)
- **Option 2**: Local file system (via Pose Detection Service)
- **Toggle**: Set `STORAGE_TYPE` in `.env.local`

### **Authentication**
- **Provider**: Firebase Authentication
- **Methods**: Google Sign-In, Email/Password
- **Backend**: Firebase Admin SDK (Python)

### **Image Processing**
- **Server-side**: OpenCV 4.8.1, Pillow 10.1.0 (Python)
- **Client-side**: Native HTML5 Canvas API

### **File Upload**
- **Python**: Flask file handling (built-in)

### **Other**
- **CORS**: Flask-CORS 4.0.0
- **Environment**: python-dotenv 1.0.0

---

## 🤖 **AI Models: Where They Are & How They Work**

### **Models Used**

1. **MoveNet Lightning** (~5MB)
   - Fast, lightweight pose detection
   - Used for client-side (browser) processing
   - 17 keypoints detection
   - TensorFlow.js model

2. **MediaPipe Pose** (pre-trained, included)
   - More accurate pose detection
   - Used for server-side processing
   - 33 keypoints detection
   - Included with MediaPipe (no download needed)

3. **Custom Baseball Swing Detector**
   - Built on top of MoveNet/MediaPipe
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

**1. Client-Side (TensorFlow.js):**
- Models are downloaded from **Google's TensorFlow.js Model Hub** (CDN)
- URLs: `https://tfhub.dev/` or `https://storage.googleapis.com/`
- **Cost**: FREE (hosted by Google)
- **Size**: ~5MB (MoveNet Lightning)
- Cached in browser's **IndexedDB** or **browser cache**

**2. Server-Side (MediaPipe):**
- MediaPipe Pose is **included** with the MediaPipe package
- **No download needed** - comes with `pip install mediapipe`
- **Cost**: FREE (open-source)
- **Size**: Included in MediaPipe package (~100MB total)
- Models are loaded from the installed package

**3. Pre-Installation (Optional):**
- Client-side: Run `npm run install:models` to pre-download TensorFlow.js models
- Server-side: MediaPipe models are included with the package

### **How Models Are Loaded**

**Client-Side (`lib/pose/client.ts`):**
```typescript
// Models are loaded on-demand when first used
const detector = await posedetection.createDetector(
  posedetection.SupportedModels.MoveNet,
  { modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
);
// If not cached, downloads from Google CDN
// If cached, loads from browser storage
```

**Server-Side (`python-backend/services/pose_detector.py`):**
```python
# MediaPipe Pose is initialized when the service starts
self.pose = self.mp_pose.Pose(
    static_image_mode=True,
    model_complexity=2,
    enable_segmentation=False,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)
# Models are included with MediaPipe package
```

### **Model Installation Script**

**Location**: `scripts/install-models.ts`

**What it does:**
1. Downloads MoveNet Lightning from Google CDN
2. Tests the model with dummy images
3. Caches models for faster loading
4. Reports installation status

**Run manually:**
```bash
npm run install:models
```

**Automatic:**
- Runs automatically after `npm install` (via `postinstall` script)
- If installation fails, models will download on first use

**Server-Side:**
- MediaPipe models are installed with `pip install mediapipe`
- No separate installation script needed

---

## 💰 **Model Costs: $0.00**

### **Completely FREE**
- ✅ Models are open-source (Apache 2.0 license)
- ✅ No API calls (runs locally)
- ✅ No per-request fees
- ✅ No subscription costs
- ✅ Models cached after first download (client-side)
- ✅ MediaPipe models included with package (server-side)
- ✅ No cloud inference costs

### **What You Pay For**
- **Nothing!** Models are completely free
- Only "cost" is initial download (~5MB for client-side, one-time)
- MediaPipe package size (~100MB, one-time install)
- Uses your device's CPU/GPU (which you already have)

---

## 📊 **Model Performance**

### **MoveNet Lightning (Client-Side)**
- **Speed**: ~50-100ms per image (browser)
- **Accuracy**: Good (17 keypoints)
- **Size**: ~5MB
- **Best for**: Real-time browser processing

### **MediaPipe Pose (Server-Side)**
- **Speed**: ~30-50ms per image (CPU)
- **Accuracy**: Excellent (33 keypoints)
- **Size**: Included with MediaPipe (~100MB package)
- **Best for**: Server-side processing, higher accuracy needs
- **Windows**: No native binding issues (pure Python)

---

## 🔄 **Model Lifecycle**

### **Client-Side (First Use)**
1. User uploads image
2. App requests MoveNet Lightning from Google CDN
3. Model downloads (~5MB, 1-2 seconds)
4. Model is cached in browser
5. Inference runs
6. Results returned

### **Client-Side (Subsequent Uses)**
1. User uploads image
2. App loads MoveNet Lightning from browser cache (instant)
3. Inference runs
4. Results returned

### **Server-Side (MediaPipe)**
1. Python backend starts
2. MediaPipe Pose is initialized (models included with package)
3. User uploads image
4. Inference runs (fast, no download needed)
5. Results returned

### **Cache Management**
- **Browser**: Managed by browser (IndexedDB/cache)
- **MediaPipe**: Models included with package (no cache needed)
- **Clearing**: Client-side cache persists until manually cleared

---

## ✅ **Summary**

### **Tech Stack**
- Next.js + React + TypeScript (frontend)
- Main Backend Gateway (Node.js/Express) + Flask Services (Python)
- TensorFlow.js (client-side AI) + MediaPipe (server-side AI)
- Firebase or MongoDB (database)
- Firebase Storage or Local (storage)

### **AI Models**
- **Client-Side**: Google's TensorFlow.js Model Hub (FREE)
- **Server-Side**: MediaPipe (included with package, FREE)
- **Storage**: Downloaded and cached (client) or included (server)
- **Cost**: $0.00 (completely free)
- **Installation**: Automatic or manual via `npm run install:models` (client)

### **Key Points**
- ✅ Models are NOT stored in the repository
- ✅ Client-side models downloaded from Google CDN (FREE)
- ✅ Server-side models included with MediaPipe package (FREE)
- ✅ Client-side models cached after first download
- ✅ All inference runs locally (no cloud costs)
- ✅ Completely free to use
- ✅ No Windows native binding issues (MediaPipe is pure Python)

---

## 🎯 **Bottom Line**

**We DO use AI models**, but they're:
- **Not stored locally in the repo** (downloaded on-demand or included with packages)
- **Cached after first download** (client-side) or **included with package** (server-side)
- **Completely free** (open-source, no API costs)
- **Run locally** (no cloud inference)
- **Windows-friendly** (MediaPipe has no native binding issues)

The client-side models are "local" in the sense that they run in the browser and are cached there, but they're not stored in the git repository - they're downloaded and cached automatically. The server-side MediaPipe models are included with the Python package, so no separate download is needed.
