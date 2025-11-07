# Firebase Setup Guide

This guide will walk you through setting up Firebase Authentication for the Baseball Swing Analysis app.

## 🆓 **Firebase Auth is FREE!**

**Good news**: Firebase Authentication is **completely FREE** on the Spark (free) plan:
- **50,000 Monthly Active Users** - FREE
- No charges for authentication
- No limits on sign-ins
- Perfect for small to medium apps

**You can use Firebase Auth without any charges!** The billing protection only applies to paid services (Firestore, Storage). Auth will always work. 🎉

## 🚀 **Quick Setup (5 minutes)**

### **Step 1: Create Firebase Project**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `baseball-swing-app` (or your preferred name)
4. Click **Continue**
5. **Disable Google Analytics** (optional, not needed for MVP)
6. Click **Create project**
7. Wait for project creation (30 seconds)
8. Click **Continue**

### **Step 2: Enable Authentication**

1. In your Firebase project, click **Authentication** in the left sidebar
2. Click **Get started**
3. Click **Sign-in method** tab
4. Enable the following providers:

#### **Enable Google Sign-In:**
1. Click **Google**
2. Toggle **Enable**
3. Select a **Project support email** (your email)
4. Click **Save**

#### **Enable Email/Password Sign-In:**
1. Click **Email/Password**
2. Toggle **Enable** (first toggle)
3. **Don't enable** "Email link (passwordless sign-in)" unless you want it
4. Click **Save**

### **Step 3: Get Firebase Config**

1. Click the **gear icon** (⚙️) next to "Project Overview" in the left sidebar
2. Click **Project settings**
3. Scroll down to **"Your apps"** section
4. Click the **Web icon** (`</>`) to add a web app
5. Enter app nickname: `Baseball Swing App`
6. **Don't check** "Also set up Firebase Hosting" (unless you want it)
7. Click **Register app**
8. **Copy the config object** - it looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

### **Step 4: Add Config to .env.local**

1. In your project root, create or edit `.env.local` file
2. Add your Firebase config:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

**Important**: Replace the values with your actual Firebase config values!

### **Step 5: Restart Dev Server**

1. Stop your dev server (Ctrl+C)
2. Restart it:

```bash
npm run dev
```

The app should now work with Firebase Auth! 🎉

---

## 📋 **Complete Setup (With Storage & Database)**

If you want to use Firebase Storage and Firestore as well:

### **Step 6: Enable Firestore Database**

1. In Firebase Console, click **Firestore Database** in the left sidebar
2. Click **Create database**
3. Select **Start in test mode** (for development)
4. Choose a **location** (closest to you)
5. Click **Enable**

### **Step 7: Enable Firebase Storage**

1. In Firebase Console, click **Storage** in the left sidebar
2. Click **Get started**
3. Click **Next** (use default security rules for now)
4. Choose a **location** (same as Firestore)
5. Click **Done**

### **Step 8: Add Storage & Database Config**

Your `.env.local` should already have the storage bucket from Step 4. If not, add:

```env
# Already added in Step 4:
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

### **Step 9: Set Up Firestore Security Rules**

1. In Firebase Console, go to **Firestore Database** > **Rules**
2. Replace with these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users: read/write own doc
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    
    // Sessions: owner can read/write; team coach can read team sessions
    match /sessions/{sessionId} {
      allow read: if request.auth != null && (
        resource.data.uid == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.teamId == resource.data.teamId
      );
      allow write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null;
    }
    
    // Teams: read all, write if coach
    match /teams/{teamId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && resource.data.coachUid == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // Leaderboards: public read per team
    match /leaderboards/{teamId}/entries/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

3. Click **Publish**

### **Step 10: Set Up Storage Security Rules**

1. In Firebase Console, go to **Storage** > **Rules**
2. Replace with these rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /swings/{uid}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

3. Click **Publish**

---

## 🔐 **Server-Side Operations (Optional)**

If you want to use server-side Firebase operations (like verifying auth tokens):

### **Step 11: Create Service Account**

1. In Firebase Console, click **Project settings** (gear icon)
2. Go to **Service accounts** tab
3. Click **Generate new private key**
4. Click **Generate key** in the popup
5. A JSON file will download - **keep this secure!**

### **Step 12: Add Service Account to .env.local**

Open the downloaded JSON file and add to `.env.local`:

```env
# Firebase Admin (for server-side operations)
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"
```

**Important**: 
- Copy the entire private key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Keep the `\n` characters (they represent newlines)
- Wrap the entire key in quotes

---

## ✅ **Verification**

### **Test Authentication**

1. Open `http://localhost:3000`
2. Click **Sign In** button
3. You should see Google sign-in popup
4. Sign in with your Google account
5. You should see your name/email in the header

### **Test Without Firebase**

If you don't want to use Firebase, you can run the app with local storage:

```env
# In .env.local
STORAGE_TYPE=local
DATABASE_TYPE=mongodb
```

The app will work without Firebase configured!

---

## 🛡️ **Billing Protection**

The app includes automatic billing protection to prevent charges over $1:

```env
# Billing Protection (enabled by default)
FIREBASE_BILLING_PROTECTION=true
FIREBASE_MAX_SPEND=1.0
FIREBASE_MAX_READS_PER_DAY=40000
FIREBASE_MAX_WRITES_PER_DAY=15000
FIREBASE_MAX_STORAGE_GB=4.0
FIREBASE_MAX_BANDWIDTH_GB=0.8
```

See `BILLING_PROTECTION.md` for details.

---

## 🐛 **Troubleshooting**

### **Error: "Firebase: Error (auth/invalid-api-key)"**

**Solution**: 
1. Check that your `.env.local` file has the correct API key
2. Make sure the API key starts with `AIzaSy`
3. Restart your dev server after adding config

### **Error: "Firebase Auth is disabled"**

**Solution**:
1. Check that all `NEXT_PUBLIC_FIREBASE_*` variables are set
2. Make sure values don't have quotes around them
3. Restart dev server

### **Google Sign-In Not Working**

**Solution**:
1. Make sure Google sign-in is enabled in Firebase Console
2. Check that you selected a support email
3. Try clearing browser cache

### **Email/Password Sign-In Not Working**

**Solution**:
1. Make sure Email/Password is enabled in Firebase Console
2. Check that you enabled the first toggle (not just passwordless)
3. Try creating a new account first

---

## 📚 **Additional Resources**

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Auth Guide](https://firebase.google.com/docs/auth)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Storage Security Rules](https://firebase.google.com/docs/storage/security)

---

## 🎯 **Quick Checklist**

- [ ] Firebase project created
- [ ] Authentication enabled (Google + Email/Password)
- [ ] Firebase config copied
- [ ] `.env.local` file created with config
- [ ] Dev server restarted
- [ ] Sign-in button works
- [ ] (Optional) Firestore enabled
- [ ] (Optional) Storage enabled
- [ ] (Optional) Security rules set up
- [ ] (Optional) Service account created

That's it! Your Firebase Auth is now set up. 🚀

