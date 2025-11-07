# Getting Started - Baseball Swing Analysis App

## 🎉 **Your App is Running!**

### **Current Status:**
- ✅ **Next.js Frontend**: Running on http://localhost:3000
- ✅ **MongoDB**: Connected and ready
- ✅ **Firebase Auth**: Configured (FREE tier)
- ✅ **AI Models**: Will download on first use

---

## 🚀 **Quick Start**

### **1. Open the App**

Open your browser and go to:
```
http://localhost:3000
```

### **2. Sign In**

Click **"Sign In"** and choose:
- **Google Sign-In** (recommended)
- **Email/Password** (if you set it up)

**Note**: Firebase Auth is FREE on Spark plan (50K users/month) - no charges!

### **3. Start Your First Mission**

1. Click **"Start Mission"** on the home page
2. Choose how to capture your swing:
   - **Take Photo**: Use your camera
   - **Upload Photo**: Upload an existing photo
   - **Upload Video**: Upload a video (best frame will be extracted)
   - **Manual Mode**: Enter values manually

3. **Analyze Your Swing**:
   - AI will detect your pose and estimate launch angle
   - Enter your exit velocity
   - See your distance calculation!

4. **View Results**:
   - See your swing metrics
   - Check which space zone you reached
   - View your leaderboard position

---

## 📋 **Available Pages**

- **Home** (`/`): Landing page with mission start
- **Mission** (`/mission`): Swing analysis flow
- **Leaderboard** (`/leaderboard`): Team leaderboard
- **Teams** (`/teams`): Team management
- **Coach Dashboard** (`/coach`): Coach analytics

---

## 🔧 **Configuration**

### **Current Setup:**
- **Database**: MongoDB Atlas (connected ✓)
- **Storage**: Firebase Storage (default)
- **Auth**: Firebase Authentication (FREE tier)

### **To Change Storage:**
Edit `.env.local`:
```env
# Use local storage instead of Firebase
STORAGE_TYPE=local
```

Then start Express server:
```bash
npm run dev:server
```

### **To Change Database:**
Edit `.env.local`:
```env
# Use Firestore instead of MongoDB
DATABASE_TYPE=firestore
```

---

## 🎮 **How It Works**

### **1. Pose Detection**
- **Client-Side**: Runs in browser using TensorFlow.js
- **Server-Side**: Can use Express server for more processing power
- **Model**: MoveNet Thunder (high accuracy)

### **2. Swing Analysis**
- Detects key points: shoulders, hips, bat position
- Calculates: launch angle, bat path, hip/shoulder rotation
- Estimates: swing phase and form

### **3. Distance Calculation**
- Uses physics: exit velocity + launch angle
- Calculates distance traveled
- Maps to space zones: Atmosphere → Moon → Mars

### **4. Leaderboard**
- Tracks best distance per user
- Team-based competition
- Real-time updates

---

## 🐛 **Troubleshooting**

### **"Firebase Auth not configured"**
- Check `.env.local` has all `NEXT_PUBLIC_FIREBASE_*` variables
- See `FIREBASE_SETUP.md` for setup guide

### **"MongoDB connection failed"**
- Check `.env.local` has `MONGODB_URI`
- Run `npm run test:mongodb` to test connection
- See `MONGODB_QUICK_FIX.md` for troubleshooting

### **"AI models not loading"**
- Models download automatically on first use
- Check internet connection
- Run `npm run install:models` to pre-download

### **"Can't upload photos"**
- If using Firebase Storage: Check Firebase config
- If using local storage: Start Express server (`npm run dev:server`)

---

## 📚 **Documentation**

- **Firebase Setup**: `FIREBASE_SETUP.md`
- **MongoDB Setup**: `MONGODB_SETUP.md`
- **MongoDB Troubleshooting**: `MONGODB_QUICK_FIX.md`
- **Ngrok Setup**: `NGROK_SETUP.md` (for remote backend)
- **Billing Protection**: `BILLING_PROTECTION.md`
- **Costs**: `COSTS.md`

---

## 🎯 **Next Steps**

1. **Test the App**:
   - Sign in
   - Upload a test photo
   - See the pose detection in action

2. **Customize**:
   - Adjust game physics in `lib/game/physics.ts`
   - Modify space zones in `lib/game/zones.ts`
   - Update UI in `components/`

3. **Deploy** (when ready):
   - Deploy to Vercel (recommended for Next.js)
   - Or use Firebase Hosting
   - See deployment guides in `README.md`

---

## 💡 **Tips**

- **Firebase Auth is FREE** - use it freely!
- **MongoDB FREE tier** - 512MB is plenty for development
- **AI models** - download once, cached locally
- **Local storage** - use for development, Firebase for production

---

## 🆘 **Need Help?**

- Check the troubleshooting guides above
- Review the documentation files
- Test connections: `npm run test:mongodb`

**Enjoy your Baseball Swing Analysis App!** 🚀⚾

