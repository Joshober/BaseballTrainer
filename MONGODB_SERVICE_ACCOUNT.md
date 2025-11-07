# MongoDB Service Account & Authentication Options

## 🔐 **Understanding MongoDB Authentication**

MongoDB Atlas has **two types of accounts**:

1. **Service Accounts** (for Atlas API access)
   - Used for managing clusters, users, network access via API
   - Uses OAuth 2.0 Client Credentials flow
   - **NOT for database connections**

2. **Database Users** (for database connections)
   - Used for connecting to your MongoDB database
   - Uses username/password or certificates
   - **This is what you need for your app**

---

## ✅ **Option 1: Create a "Service Account" Database User (Recommended)**

You can create a dedicated database user that acts like a service account:

### **Steps:**

1. **Go to MongoDB Atlas** → **Security** → **Database Access**
2. **Click "Add New Database User"**
3. **Choose "Password" authentication**
4. **Enter Username**: `baseball-service` (or any service-oriented name)
5. **Enter Password**: Generate a strong password (save it securely!)
6. **Database User Privileges**: Select **"Read and write to any database"**
7. **Click "Add User"**

### **Update Connection String:**

```env
# Use the new service account user
MONGODB_URI=mongodb+srv://baseball-service:YourStrongPassword@cluster0.jouf3pd.mongodb.net/baseballhackathon?retryWrites=true&w=majority
```

**Benefits:**
- ✅ Dedicated user for your application
- ✅ Can be rotated/changed independently
- ✅ Better security (not your personal account)
- ✅ Easy to revoke if compromised

---

## ✅ **Option 2: Use X.509 Certificate Authentication (Most Secure)**

For production, you can use X.509 certificates instead of passwords:

### **Steps:**

1. **Generate Certificate:**
   ```bash
   openssl req -newkey rsa:2048 -nodes -keyout client.key -x509 -days 365 -out client.crt
   ```

2. **Create Certificate Bundle:**
   ```bash
   cat client.crt client.key > client.pem
   ```

3. **In MongoDB Atlas** → **Security** → **Database Access**
   - Click **"Add New Database User"**
   - Choose **"X.509 Certificate"**
   - Upload your certificate or paste the certificate data
   - Set permissions

4. **Update Connection String:**
   ```env
   MONGODB_URI=mongodb+srv://cluster0.jouf3pd.mongodb.net/baseballhackathon?retryWrites=true&w=majority&authSource=$external&authMechanism=MONGODB-X509
   ```

5. **Update Client Code** to use certificate:
   ```typescript
   import fs from 'fs';
   import { MongoClient } from 'mongodb';

   const client = new MongoClient(uri, {
     tlsCertificateKeyFile: './client.pem',
   });
   ```

**Benefits:**
- ✅ Most secure (no passwords)
- ✅ Certificate-based authentication
- ✅ Better for production

**Drawbacks:**
- ❌ More complex setup
- ❌ Need to manage certificates
- ❌ Certificate rotation required

---

## ✅ **Option 3: Use MongoDB Atlas Service Account (For API Access Only)**

MongoDB Atlas service accounts are for **API access**, not database connections. They're useful if you want to:
- Manage clusters programmatically
- Create/delete database users via API
- Manage network access via API

### **Steps:**

1. **Go to MongoDB Atlas** → **Access Manager** → **Service Accounts**
2. **Click "Create Service Account"**
3. **Assign Roles** (e.g., Organization Owner, Project Owner)
4. **Generate Client ID and Secret**
5. **Use OAuth 2.0** to get access token

### **Example Usage (for API, not database):**

```typescript
// This is for Atlas API, NOT database connections
import axios from 'axios';

async function getAccessToken() {
  const response = await axios.post('https://cloud.mongodb.com/api/atlas/v1.0/auth/oidc/azure/token', {
    grant_type: 'client_credentials',
    client_id: process.env.MONGODB_SERVICE_ACCOUNT_CLIENT_ID,
    client_secret: process.env.MONGODB_SERVICE_ACCOUNT_SECRET,
  });
  return response.data.access_token;
}
```

**Note:** This is **NOT** for database connections. You still need a database user for that.

---

## 🎯 **Recommended Approach**

For your Baseball Swing Analysis app, I recommend:

### **Option 1: Service Account Database User**

1. Create a dedicated database user named `baseball-service`
2. Use a strong, randomly generated password
3. Store password securely in `.env.local`
4. Use this user in your connection string

**Why?**
- ✅ Simple and secure
- ✅ Easy to manage
- ✅ Can rotate password independently
- ✅ Works with your current code

---

## 📝 **Implementation**

### **Step 1: Create Service Account Database User**

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. **Security** → **Database Access**
3. **Add New Database User**
4. Username: `baseball-service`
5. Password: Generate strong password (save it!)
6. Permissions: **"Read and write to any database"**
7. Click **"Add User"**

### **Step 2: Update .env.local**

```env
# Use service account database user
MONGODB_URI=mongodb+srv://baseball-service:YourStrongPassword@cluster0.jouf3pd.mongodb.net/baseballhackathon?retryWrites=true&w=majority

DATABASE_TYPE=mongodb
```

### **Step 3: Test Connection**

```bash
npm run test:mongodb
```

---

## 🔒 **Security Best Practices**

1. **Use Strong Passwords**
   - Minimum 16 characters
   - Mix of letters, numbers, symbols
   - Don't use dictionary words

2. **Rotate Passwords Regularly**
   - Change service account password every 90 days
   - Update `.env.local` when changed

3. **Limit Permissions**
   - Only give "Read and write" to specific databases if possible
   - Don't use "Atlas Admin" unless necessary

4. **Use Environment Variables**
   - Never commit passwords to git
   - Use `.env.local` (already in `.gitignore`)

5. **IP Whitelisting**
   - Whitelist only necessary IP addresses
   - Use `0.0.0.0/0` only for development

---

## ❓ **FAQ**

### **Q: Can I use MongoDB Atlas Service Account for database connections?**

**A:** No. Service accounts are for Atlas API access only. For database connections, you need a database user.

### **Q: What's the difference between a service account and a database user?**

**A:**
- **Service Account**: For managing MongoDB Atlas via API (clusters, users, network)
- **Database User**: For connecting to your MongoDB database

### **Q: Should I use my personal MongoDB account for the app?**

**A:** No. Create a dedicated database user (like `baseball-service`) for better security and management.

### **Q: Can I use certificates instead of passwords?**

**A:** Yes! X.509 certificates are more secure but more complex. See Option 2 above.

---

## ✅ **Summary**

- ✅ **Use a dedicated database user** (like `baseball-service`) for your app
- ✅ **Store password in `.env.local`** (already gitignored)
- ✅ **Use strong passwords** and rotate regularly
- ✅ **Whitelist IP addresses** for security
- ❌ **Don't use your personal account** for the app
- ❌ **Service accounts are NOT for database connections**

Your current code already supports database user authentication - just create a new database user and update your connection string! 🚀

