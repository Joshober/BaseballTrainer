# AI Models: Costs & Where They Run

## 🤖 **AI Models Used in This App**

### 1. **MoveNet (TensorFlow.js)**
   - **Model Type**: Pose Detection (SinglePose)
   - **Variants**:
     - **Lightning**: Fast, lightweight (~5MB) - for client-side
     - **Thunder**: More accurate (~12MB) - for server-side
   - **Source**: Google's TensorFlow.js Model Hub
   - **License**: Apache 2.0 (Open Source, FREE)

### 2. **Custom Baseball Swing Detector**
   - **Type**: Custom logic built on top of MoveNet
   - **Purpose**: Analyzes baseball-specific swing metrics
   - **Cost**: FREE (runs locally)

### 3. **Bat Detection (Hough Line Transform)**
   - **Type**: Computer vision algorithm (not ML)
   - **Purpose**: Detects bat lines in images
   - **Cost**: FREE (runs locally)

---

## 💰 **AI Model Costs: $0.00**

### ✅ **Completely FREE - No API Costs**

All AI models in this app are:
1. **Open Source**: Apache 2.0 license
2. **No API Calls**: Models run locally (no cloud inference)
3. **No Per-Request Fees**: All processing happens on-device or your server
4. **No Subscription**: Models are downloaded once and cached

---

## 📥 **Where Models Are Downloaded From**

### **TensorFlow.js Model Hub** (Google CDN)
- **URL**: `https://tfhub.dev/` or `https://storage.googleapis.com/`
- **Cost**: FREE (hosted by Google)
- **Download**: Models are downloaded automatically on first use
- **Caching**: Models are cached in browser/Node.js cache
- **Bandwidth**: Uses your internet connection (no cost)

### **Model Sizes**
- **MoveNet Lightning**: ~5MB (downloads once)
- **MoveNet Thunder**: ~12MB (downloads once)
- **Total**: ~17MB (one-time download)

---

## 🏃 **Where Models Run**

### **Option 1: Client-Side (Browser)**
```typescript
// lib/pose/client.ts
// Runs in user's browser using WebGL/WebGPU
```
- **Location**: User's browser (their device)
- **Cost**: $0 (uses user's device resources)
- **Performance**: Fast on modern devices
- **Privacy**: All processing happens locally (no data sent to servers)
- **Model**: MoveNet Lightning (optimized for browser)

### **Option 2: Server-Side (Your PC)**
```typescript
// lib/pose/server.ts
// Runs on your Express server using Node.js
```
- **Location**: Your local Express server (`localhost:3001`)
- **Cost**: $0 (uses your PC's CPU/GPU)
- **Performance**: More accurate (can use Thunder model)
- **Privacy**: All processing happens on your server
- **Model**: MoveNet Thunder (more accurate)

### **Option 3: Next.js API Route**
```typescript
// app/api/pose/route.ts
// Runs on Next.js server (Vercel/your server)
```
- **Location**: Next.js server (Vercel FREE tier or your server)
- **Cost**: $0 (within FREE tier limits)
- **Performance**: Good for production
- **Model**: MoveNet Thunder (more accurate)

---

## 📊 **Model Download & Caching**

### **First Time Use**
1. Model is downloaded from Google CDN (~5-12MB)
2. Cached in browser/Node.js cache
3. Takes 2-5 seconds (one-time)

### **Subsequent Uses**
1. Model loads from cache (instant)
2. No additional downloads
3. No API calls

### **Cache Locations**
- **Browser**: IndexedDB or browser cache
- **Node.js**: `node_modules/.cache/` or system cache
- **Size**: ~5-12MB per model variant

---

## 🔄 **Inference Costs**

### **Client-Side Inference**
- **Cost**: $0 (runs on user's device)
- **Resources**: Uses user's GPU/CPU
- **Speed**: ~50-100ms per image (modern devices)
- **Privacy**: No data leaves device

### **Server-Side Inference**
- **Cost**: $0 (runs on your server)
- **Resources**: Uses your server's CPU/GPU
- **Speed**: ~100-200ms per image
- **Privacy**: Data stays on your server

### **No Cloud Inference**
- ❌ No calls to Google Cloud AI
- ❌ No calls to AWS SageMaker
- ❌ No calls to Azure ML
- ✅ All inference happens locally

---

## 🎯 **Model Performance**

### **MoveNet Lightning**
- **Accuracy**: Good (17 keypoints)
- **Speed**: ~50ms per image
- **Size**: ~5MB
- **Best For**: Client-side (browser)

### **MoveNet Thunder**
- **Accuracy**: Excellent (17 keypoints)
- **Speed**: ~100ms per image
- **Size**: ~12MB
- **Best For**: Server-side (more accurate)

### **Custom Baseball Detector**
- **Accuracy**: Enhanced (baseball-specific metrics)
- **Speed**: +10ms overhead
- **Size**: ~0MB (just code)
- **Best For**: Both client and server

---

## 💡 **Cost Optimization Tips**

### **1. Use Client-Side When Possible**
- ✅ No server costs
- ✅ Better privacy
- ✅ Faster (no network latency)
- ✅ Scales automatically (each user's device)

### **2. Cache Models Aggressively**
- Models are automatically cached
- No need to download multiple times
- Consider CDN caching for production

### **3. Use Lightning for Speed**
- If accuracy is sufficient, use Lightning
- Faster inference = better UX
- Lower resource usage

### **4. Use Thunder for Accuracy**
- If you need better accuracy, use Thunder
- Only use on server-side (too slow for browser)
- Worth the extra 7MB for better results

---

## 📈 **Scaling Costs**

### **1 User**
- Model download: ~5-12MB (one-time)
- Inference: $0 (runs on user's device)
- **Total Cost**: $0

### **1,000 Users**
- Model downloads: ~5-12GB total (one-time, cached)
- Inference: $0 (runs on each user's device)
- **Total Cost**: $0

### **10,000 Users**
- Model downloads: ~50-120GB total (one-time, cached)
- Inference: $0 (runs on each user's device)
- **Total Cost**: $0

### **Server-Side (Your PC)**
- Model download: ~12MB (one-time)
- Inference: $0 (uses your PC's resources)
- **Total Cost**: $0 (just electricity)

---

## 🚀 **Alternative Models (If Needed)**

### **If You Want Better Accuracy**
1. **MediaPipe Pose**: FREE, open-source, more accurate
2. **PoseNet**: FREE, open-source, good for real-time
3. **BlazePose**: FREE, open-source, very accurate

### **If You Want Custom Training**
1. **TensorFlow.js**: FREE, train your own model
2. **PyTorch**: FREE, convert to TensorFlow.js
3. **Custom Fine-tuning**: FREE (just your time)

### **All Alternatives Are FREE**
- No paid models needed
- All open-source
- All run locally

---

## ✅ **Summary**

### **AI Model Costs: $0.00**
- ✅ Models are FREE (open-source)
- ✅ No API calls (runs locally)
- ✅ No per-request fees
- ✅ No subscription costs
- ✅ Models cached after first download

### **Where Models Run**
- **Client-Side**: User's browser (FREE)
- **Server-Side**: Your PC/server (FREE)
- **No Cloud Inference**: All processing is local

### **Total AI Cost**
- **Development**: $0
- **Production**: $0
- **Scaling**: $0 (scales with users' devices)

---

## 🎯 **Bottom Line**

**All AI models are completely FREE!**

- Models are open-source (Apache 2.0)
- No API costs (runs locally)
- No inference fees (processes on-device)
- No subscription (download once, use forever)
- Scales infinitely (each user's device processes their own data)

The only "cost" is:
- Initial model download (~5-12MB per model)
- Your device's CPU/GPU resources (which you already have)

**Total AI Cost: $0.00/month** 🎉

