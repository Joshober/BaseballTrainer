# MongoDB Setup Guide

This guide will help you set up MongoDB Atlas (FREE tier) for the Baseball Swing Analysis app.

## 🆓 **MongoDB Atlas is FREE!**

**Good news**: MongoDB Atlas has a **completely FREE tier (M0)**:
- **512MB storage** - FREE
- **Shared CPU/RAM** - FREE
- **Perfect for development and small apps**
- **No credit card required** (for M0 tier)

## 🚀 **Quick Setup (5 minutes)**

### **Step 1: Create MongoDB Atlas Account**

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Click **"Try Free"** or **"Sign Up"**
3. Sign up with Google or Email
4. Verify your email if needed

### **Step 2: Create a Cluster**

1. After signing in, click **"Build a Database"**
2. Select **FREE (M0) Shared** tier
3. Choose a **Cloud Provider** (AWS, Google Cloud, or Azure)
4. Select a **Region** (closest to you)
5. Click **"Create"**
6. Wait for cluster creation (1-2 minutes)

### **Step 3: Create Database User**

1. In the **Security** section, click **"Database Access"**
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Enter a **Username** (e.g., `baseballapp`)
5. Enter a **Password** (save this securely!)
6. Under **"Database User Privileges"**, select **"Read and write to any database"**
7. Click **"Add User"**

### **Step 4: Whitelist IP Address**

1. In the **Security** section, click **"Network Access"**
2. Click **"Add IP Address"**
3. For development, click **"Add Current IP Address"**
4. Or use **"Allow Access from Anywhere"** (`0.0.0.0/0`) - less secure but easier for development
5. Click **"Confirm"**

### **Step 5: Get Connection String**

1. In the **Deployment** section, click **"Database"**
2. Click **"Connect"** on your cluster
3. Select **"Connect your application"**
4. Choose **"Node.js"** as the driver
5. Copy the connection string - it looks like:

```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

6. Replace `<password>` with your database user password
7. Add your database name at the end (before `?`):

```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/baseballhackathon?retryWrites=true&w=majority
```

### **Step 6: Add to .env.local**

1. Create or edit `.env.local` in your project root
2. Add your MongoDB connection string:

```env
# MongoDB Atlas (FREE tier)
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/baseballhackathon?retryWrites=true&w=majority

# Use MongoDB as database
DATABASE_TYPE=mongodb
```

**Important**: 
- Replace `username` with your database username
- Replace `password` with your database password
- Replace `cluster0.xxxxx.mongodb.net` with your cluster URL
- Replace `baseballhackathon` with your preferred database name

### **Step 7: Test Connection**

Run the connection test:

```bash
npm run test:mongodb
```

You should see:
```
✅ MongoDB connection successful!
```

---

## ✅ **Verification**

### **Test Connection**

```bash
npm run test:mongodb
```

This will:
1. Check if MongoDB URI is configured
2. Test connection to MongoDB Atlas
3. Test database operations (insert, read, delete)
4. Show any errors with helpful troubleshooting

### **Expected Output**

```
============================================================
  MongoDB Connection Test
  Baseball Swing Analysis App
============================================================

Testing MongoDB connection...
URI: mongodb+srv://username:****@cluster0.xxxxx.mongodb.net/baseballhackathon

[1/3] Connecting to MongoDB...
  ✓ Client created successfully

[2/3] Testing database connection...
  ✓ Database connection successful

[3/3] Testing ping...
  ✓ Ping successful

============================================================
  Connection Test Results
============================================================

✅ MongoDB connection successful!
  Your MongoDB is configured correctly.
  You can now use MongoDB as your database.
```

---

## 🐛 **Troubleshooting**

### **Error: "MONGODB_URI is not configured"**

**Solution**:
1. Create `.env.local` file in project root
2. Add `MONGODB_URI=your_connection_string`
3. Restart dev server

### **Error: "Authentication failed"**

**Solution**:
1. Check username and password in connection string
2. Make sure password doesn't have special characters (or URL-encode them)
3. Verify database user exists in MongoDB Atlas
4. Check user has "Read and write" permissions

### **Error: "ENOTFOUND" or "getaddrinfo"**

**Solution**:
1. Check cluster URL in connection string
2. Make sure your IP address is whitelisted in MongoDB Atlas
3. Try using `0.0.0.0/0` for development (less secure)
4. Check your internet connection

### **Error: "Connection timeout"**

**Solution**:
1. Check your IP address is whitelisted
2. Try adding `0.0.0.0/0` to Network Access (for development)
3. Check firewall settings
4. Verify cluster is running in MongoDB Atlas

### **Error: "Database name not found"**

**Solution**:
1. MongoDB Atlas creates databases automatically
2. Make sure database name is in connection string (before `?`)
3. The database will be created on first use

---

## 📊 **MongoDB Atlas FREE Tier Limits**

- **Storage**: 512MB (usually enough for small apps)
- **RAM**: Shared (sufficient for development)
- **CPU**: Shared (sufficient for development)
- **Connections**: 500 concurrent connections
- **Bandwidth**: 1GB/month

**For most small apps, this is more than enough!**

---

## 💡 **Best Practices**

### **1. Use Strong Passwords**

- Use a strong password for your database user
- Don't commit passwords to git (use `.env.local`)

### **2. Whitelist IP Addresses**

- For production, whitelist specific IP addresses
- For development, you can use `0.0.0.0/0` (less secure)

### **3. Monitor Usage**

- Check MongoDB Atlas dashboard for usage
- Monitor storage and bandwidth
- Upgrade to M2 ($9/month) if you need more

### **4. Backup Data**

- MongoDB Atlas M0 doesn't include automated backups
- Consider upgrading to M2+ for backups
- Or implement your own backup strategy

---

## 🎯 **Quick Checklist**

- [ ] MongoDB Atlas account created
- [ ] M0 (FREE) cluster created
- [ ] Database user created
- [ ] IP address whitelisted
- [ ] Connection string copied
- [ ] `.env.local` file created with `MONGODB_URI`
- [ ] `DATABASE_TYPE=mongodb` set in `.env.local`
- [ ] Connection test passed (`npm run test:mongodb`)

---

## 📚 **Additional Resources**

- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [MongoDB Node.js Driver](https://docs.mongodb.com/drivers/node/)
- [Connection String Format](https://docs.mongodb.com/manual/reference/connection-string/)

That's it! Your MongoDB is now set up and ready to use. 🚀

