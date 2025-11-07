# Getting Started - Baseball Swing Analysis App

## 🎉 **Your App is Running!**

### **Current Status:**
- ✅ **Next.js Frontend**: Running on http://localhost:3000
- ✅ **MongoDB**: Connected and ready
- ✅ **Auth0**: Configured
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

**Note**: Auth0 provides free tier for development

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
- **Storage**: Local storage (default)
- **Auth**: Auth0 Authentication

### **To Change Storage:**
Edit `.env.local`:
```env
# Use local storage
STORAGE_TYPE=local
```

Then start Express server:
```bash
npm run dev:server
```

### **To Change Database:**
Edit `.env.local`:
```env
# MongoDB is the only supported database
DATABASE_TYPE=mongodb
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

### **"Auth0 not configured"**
- Check `.env.local` has all `AUTH0_*` variables
- See `AUTH0_SETUP.md` for setup guide

### **"MongoDB connection failed"**
- Check `.env.local` has `MONGODB_URI`
- Run `npm run test:mongodb` to test connection
- See `MONGODB_SETUP.md` for troubleshooting

### **"AI models not loading"**
- Models download automatically on first use
- Check internet connection
- Run `npm run install:models` to pre-download

### **"Can't upload photos"**
- If using local storage: Start storage server (`npm run dev:storage`)

---

## 📚 **Documentation**

All documentation files are in the `docs/` directory:

- **Auth0 Setup**: `AUTH0_SETUP.md`
- **MongoDB Setup**: `MONGODB_SETUP.md`
- **MongoDB Troubleshooting**: `MONGODB_SETUP.md`
- **Ngrok Setup**: `NGROK_SETUP.md` (for remote backend)
- **Billing Protection**: `BILLING_PROTECTION.md`
- **Costs**: `BILLING_PROTECTION.md`

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
   - Or use Vercel Hosting
   - See deployment guides in `../README.md`

---

## 💡 **Tips**

- **Auth0** - provides free tier for development
- **MongoDB FREE tier** - 512MB is plenty for development
- **AI models** - download once, cached locally
- **Local storage** - use for development

---

## 🆘 **Need Help?**

- Check the troubleshooting guides above
- Review the documentation files
- Test connections: `npm run test:mongodb`

**Enjoy your Baseball Swing Analysis App!** 🚀⚾

