# MongoDB Connection Error Fix

## Problem
The application is getting a 500 error when trying to access sessions:
```
Error: querySrv ENOTFOUND _mongodb._tcp.cluster0.jouf3pd.mongodb.net
```

## Root Cause
The MongoDB cluster `cluster0.jouf3pd.mongodb.net` cannot be found (DNS resolution fails). This means:
- The cluster doesn't exist
- The cluster URL is incorrect
- The cluster was deleted

## Solution

### Step 1: Verify MongoDB Atlas Cluster
1. Go to [MongoDB Atlas Dashboard](https://cloud.mongodb.com/)
2. Check if your cluster exists
3. If it doesn't exist, create a new cluster (free tier available)

### Step 2: Get the Correct Connection String
1. In MongoDB Atlas, click "Connect" on your cluster
2. Choose "Connect your application"
3. Copy the connection string (it should look like):
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/<database>?retryWrites=true&w=majority
   ```

### Step 3: Update .env.local
Update your `.env.local` file with the correct connection string:
```env
MONGODB_URI="mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/baseballhackathon?retryWrites=true&w=majority"
DATABASE_TYPE=mongodb
```

**Important:**
- Replace `username` with your MongoDB username
- Replace `password` with your MongoDB password (URL-encode special characters)
- Replace `cluster0.xxxxx.mongodb.net` with your actual cluster URL
- Replace `baseballhackathon` with your database name (or keep it)

### Step 4: Test Connection
Run the MongoDB connection test:
```bash
npm run test:mongodb
```

### Step 5: Restart Services
After updating the connection string, restart your development server:
```bash
# Kill existing processes
pkill -f "next dev"
pkill -f "node.*gateway"

# Restart services
npm run dev
npm run dev:gateway
```

## Alternative: Use Local MongoDB
If you prefer to use a local MongoDB instance instead of Atlas:

1. Install MongoDB locally
2. Update `.env.local`:
   ```env
   MONGODB_URI="mongodb://localhost:27017/baseballhackathon"
   DATABASE_TYPE=mongodb
   ```

## Password Encoding
If your password contains special characters, they need to be URL-encoded:
- `@` becomes `%40`
- `#` becomes `%23`
- `$` becomes `%24`
- etc.

You can use this command to encode your password:
```bash
node -e "console.log(encodeURIComponent('YourPassword'))"
```

