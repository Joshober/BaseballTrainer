# MongoDB Connection Troubleshooting

## 🔴 **Current Error: "bad auth : authentication failed"**

This error means MongoDB Atlas is rejecting your credentials. Here's how to fix it:

---

## ✅ **Step-by-Step Fix**

### **1. Verify Database User in MongoDB Atlas**

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Log in to your account
3. Select your cluster
4. Go to **Security** → **Database Access**
5. Find the user `Josh` (or your username)
6. **Click the pencil icon** to edit the user
7. **Reset the password** if needed
8. Make sure the user has **"Read and write to any database"** permissions
9. Click **"Update User"**

### **2. Get the Correct Connection String**

1. In MongoDB Atlas, go to **Deployment** → **Database**
2. Click **"Connect"** on your cluster
3. Select **"Connect your application"**
4. Choose **"Node.js"** as the driver
5. Copy the connection string - it should look like:

```
mongodb+srv://Josh:<password>@cluster0.jouf3pd.mongodb.net/?retryWrites=true&w=majority
```

6. **Replace `<password>`** with your actual password
7. **Add database name** before the `?`:

```
mongodb+srv://Josh:YourPassword@cluster0.jouf3pd.mongodb.net/baseballhackathon?retryWrites=true&w=majority
```

### **3. URL-Encode Password (if needed)**

If your password has special characters, you need to URL-encode them:

| Character | URL-Encoded |
|-----------|-------------|
| `@` | `%40` |
| `#` | `%23` |
| `$` | `%24` |
| `%` | `%25` |
| `&` | `%26` |
| `+` | `%2B` |
| `=` | `%3D` |
| `?` | `%3F` |
| `/` | `%2F` |
| ` ` (space) | `%20` |

**Example:**
- Password: `My@Pass#123`
- URL-Encoded: `My%40Pass%23123`
- Connection string: `mongodb+srv://Josh:My%40Pass%23123@cluster0.jouf3pd.mongodb.net/baseballhackathon?retryWrites=true&w=majority`

### **4. Whitelist Your IP Address**

1. In MongoDB Atlas, go to **Security** → **Network Access**
2. Click **"Add IP Address"**
3. For development, click **"Add Current IP Address"**
   - OR use **"Allow Access from Anywhere"** (`0.0.0.0/0`) - less secure but easier
4. Click **"Confirm"**
5. Wait 1-2 minutes for the change to take effect

### **5. Update .env.local**

1. Open `.env.local` in your project root
2. Update the `MONGODB_URI` line:

```env
# Remove quotes and add database name
MONGODB_URI=mongodb+srv://Josh:YourPassword@cluster0.jouf3pd.mongodb.net/baseballhackathon?retryWrites=true&w=majority

# Make sure DATABASE_TYPE is set to mongodb
DATABASE_TYPE=mongodb
```

**Important:**
- ❌ **Don't use quotes** around the connection string
- ✅ **Add database name** before the `?`
- ✅ **Use the password from MongoDB Atlas** (not the one you think it is)
- ✅ **URL-encode special characters** in password

### **6. Test Connection**

```bash
npm run test:mongodb
```

---

## 🔍 **Common Issues**

### **Issue 1: Password Has Special Characters**

**Symptom:** Authentication fails even with correct password

**Solution:** URL-encode special characters in the password

**Example:**
```env
# Wrong (if password is "Pass@123")
MONGODB_URI=mongodb+srv://Josh:Pass@123@cluster0.jouf3pd.mongodb.net/baseballhackathon

# Correct (URL-encoded)
MONGODB_URI=mongodb+srv://Josh:Pass%40123@cluster0.jouf3pd.mongodb.net/baseballhackathon
```

### **Issue 2: IP Address Not Whitelisted**

**Symptom:** Connection timeout or "ENOTFOUND" error

**Solution:** 
1. Go to MongoDB Atlas → Network Access
2. Add your current IP address
3. Or use `0.0.0.0/0` for development (less secure)

### **Issue 3: Database User Doesn't Exist**

**Symptom:** "bad auth : authentication failed"

**Solution:**
1. Go to MongoDB Atlas → Database Access
2. Create a new database user
3. Set password
4. Give "Read and write to any database" permissions
5. Update connection string with new credentials

### **Issue 4: Wrong Password**

**Symptom:** "bad auth : authentication failed"

**Solution:**
1. Go to MongoDB Atlas → Database Access
2. Edit the user
3. Click "Edit Password"
4. Set a new password
5. Update `.env.local` with new password

### **Issue 5: Connection String Has Quotes**

**Symptom:** Connection string not being read correctly

**Solution:** Remove quotes from `.env.local`:

```env
# Wrong
MONGODB_URI="mongodb+srv://..."

# Correct
MONGODB_URI=mongodb+srv://...
```

### **Issue 6: Missing Database Name**

**Symptom:** Connection works but can't find database

**Solution:** Add database name before `?` in connection string:

```env
# Wrong
MONGODB_URI=mongodb+srv://.../?retryWrites=true&w=majority

# Correct
MONGODB_URI=mongodb+srv://.../baseballhackathon?retryWrites=true&w=majority
```

---

## 🧪 **Quick Test**

Run this to test your connection:

```bash
npm run test:mongodb
```

**Expected output:**
```
✅ MongoDB connection successful!
  Your MongoDB is configured correctly.
  You can now use MongoDB as your database.
```

---

## 📞 **Still Not Working?**

1. **Double-check password** in MongoDB Atlas
2. **Reset the password** in MongoDB Atlas and try again
3. **Check IP whitelist** - make sure your IP is added
4. **Try creating a new database user** with a simple password (no special characters)
5. **Verify connection string format** - use the one from MongoDB Atlas "Connect" button

---

## 💡 **Pro Tips**

1. **Use a simple password** for development (no special characters)
2. **Use `0.0.0.0/0` for IP whitelist** during development (less secure but easier)
3. **Copy connection string directly** from MongoDB Atlas "Connect" button
4. **Test connection immediately** after updating `.env.local`
5. **Restart dev server** after changing `.env.local`

---

## ✅ **Checklist**

- [ ] Database user exists in MongoDB Atlas
- [ ] Password is correct (or reset it)
- [ ] Password is URL-encoded if it has special characters
- [ ] IP address is whitelisted in MongoDB Atlas
- [ ] Connection string has database name (before `?`)
- [ ] Connection string has no quotes in `.env.local`
- [ ] `DATABASE_TYPE=mongodb` is set in `.env.local`
- [ ] Test connection with `npm run test:mongodb`

Once all these are checked, your MongoDB connection should work! 🚀

