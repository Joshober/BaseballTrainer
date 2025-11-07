# MongoDB Authentication Quick Fix

## 🔴 **Current Error: "bad auth : authentication failed"**

Your connection string format is correct, but authentication is failing. Here's how to fix it:

---

## ✅ **Step-by-Step Fix (5 minutes)**

### **Step 1: Verify/Reset Database User Password**

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Log in to your account
3. Select your cluster
4. Go to **Security** → **Database Access**
5. Find the user `Josh`
6. **Click the pencil icon** (Edit)
7. **Click "Edit Password"**
8. **Set a new password** (e.g., `BaseballApp2024!`)
   - **Save this password securely!**
9. Make sure the user has **"Read and write to any database"** permissions
10. Click **"Update User"**

### **Step 2: Whitelist Your IP Address**

1. In MongoDB Atlas, go to **Security** → **Network Access**
2. Click **"Add IP Address"**
3. For development, click **"Add Current IP Address"**
   - OR click **"Allow Access from Anywhere"** (`0.0.0.0/0`) - less secure but easier
4. Click **"Confirm"**
5. **Wait 1-2 minutes** for the change to take effect

### **Step 3: Get Fresh Connection String**

1. In MongoDB Atlas, go to **Deployment** → **Database**
2. Click **"Connect"** on your cluster
3. Select **"Connect your application"**
4. Choose **"Node.js"** as the driver
5. Copy the connection string
6. **Replace `<password>`** with your NEW password from Step 1
7. **Add database name** before the `?`:

```
mongodb+srv://Josh:YourNewPassword@cluster0.jouf3pd.mongodb.net/baseballhackathon?retryWrites=true&w=majority
```

### **Step 4: URL-Encode Password (if needed)**

If your new password has special characters, encode them:

```bash
npm run encode:password "YourNewPassword"
```

**Common special characters:**
- `#` = `%23`
- `@` = `%40`
- `$` = `%24`
- `%` = `%25`
- `&` = `%26`

### **Step 5: Update .env.local**

Open `.env.local` and update:

```env
# Use the NEW password from Step 1 (URL-encoded if needed)
MONGODB_URI=mongodb+srv://Josh:YourNewPassword@cluster0.jouf3pd.mongodb.net/baseballhackathon?retryWrites=true&w=majority

DATABASE_TYPE=mongodb
```

**Important:**
- ❌ **No quotes** around the connection string
- ✅ **Use the NEW password** from Step 1
- ✅ **URL-encode** if password has special characters
- ✅ **Database name** before the `?`

### **Step 6: Test Connection**

```bash
npm run test:mongodb
```

---

## 🎯 **Quick Checklist**

- [ ] Database user `Josh` exists in MongoDB Atlas
- [ ] Password was reset/verified in MongoDB Atlas
- [ ] User has "Read and write to any database" permissions
- [ ] IP address is whitelisted in MongoDB Atlas
- [ ] Connection string uses NEW password (not old one)
- [ ] Password is URL-encoded if it has special characters
- [ ] Connection string has no quotes
- [ ] Connection string has database name before `?`
- [ ] Waited 1-2 minutes after whitelisting IP

---

## 💡 **Pro Tips**

1. **Use a simple password** for development (no special characters)
   - Example: `BaseballApp2024`
   - No encoding needed!

2. **Use `0.0.0.0/0` for IP whitelist** during development
   - Less secure but easier
   - Change to specific IPs for production

3. **Reset password if unsure**
   - Sometimes it's easier to reset than debug
   - Make sure to update `.env.local` with new password

4. **Wait after changes**
   - MongoDB Atlas changes can take 1-2 minutes to propagate
   - Be patient!

---

## 🔍 **Still Not Working?**

If authentication still fails after all steps:

1. **Create a NEW database user** (fresh start):
   - Username: `baseball-service`
   - Password: `BaseballApp2024` (simple, no special chars)
   - Permissions: "Read and write to any database"
   - Use this in your connection string

2. **Double-check IP whitelist**:
   - Make sure your current IP is added
   - Or use `0.0.0.0/0` for development

3. **Verify connection string format**:
   ```env
   MONGODB_URI=mongodb+srv://baseball-service:BaseballApp2024@cluster0.jouf3pd.mongodb.net/baseballhackathon?retryWrites=true&w=majority
   ```

4. **Test with MongoDB Compass** (desktop app):
   - Download [MongoDB Compass](https://www.mongodb.com/products/compass)
   - Try connecting with the same credentials
   - If it works in Compass but not in code, it's a code issue
   - If it doesn't work in Compass, it's a MongoDB Atlas issue

---

## ✅ **Expected Success Output**

After fixing, you should see:

```
============================================================
  MongoDB Connection Test
  Baseball Swing Analysis App
============================================================

Testing MongoDB connection...
URI: mongodb+srv://Josh:****@cluster0.jouf3pd.mongodb.net/baseballhackathon

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

That's it! Follow these steps and your MongoDB connection should work. 🚀

