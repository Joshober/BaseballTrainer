# Firebase Billing Protection Guide

This guide explains how to protect yourself from Firebase charges beyond your $1 limit.

## 🆓 **What's FREE on Spark Plan**

**Firebase Auth is completely FREE** on the Spark (free) plan:
- **50,000 Monthly Active Users (MAU)** - FREE
- No charges for authentication
- No limits on sign-ins
- Works perfectly for small to medium apps

**You can use Firebase Auth without any charges!** 🎉

The billing protection only applies to **paid services**:
- Firestore (database)
- Firebase Storage
- Bandwidth

**Auth is always allowed** - it's free!

## 🛡️ **Billing Protection Features**

The app includes automatic billing protection that:

1. **Monitors Usage**: Tracks Firestore reads/writes, storage, and bandwidth
2. **Calculates Costs**: Estimates costs based on Firebase pricing
3. **Warns Early**: Shows warnings at 75% of limits
4. **Auto-Disables**: Automatically disables Firebase at 90% of limits
5. **Prevents Charges**: Stops Firebase usage before exceeding $1

## ⚙️ **Configuration**

Add these to your `.env.local` file:

```env
# Billing Protection (enabled by default)
FIREBASE_BILLING_PROTECTION=true

# Maximum spend limit (default: $1.00)
FIREBASE_MAX_SPEND=1.0

# Daily limits (conservative, below FREE tier)
FIREBASE_MAX_READS_PER_DAY=40000    # FREE tier: 50K/day
FIREBASE_MAX_WRITES_PER_DAY=15000  # FREE tier: 20K/day
FIREBASE_MAX_STORAGE_GB=4.0        # FREE tier: 5GB
FIREBASE_MAX_BANDWIDTH_GB=0.8      # FREE tier: 1GB/day
```

## 📊 **How It Works**

### **Usage Tracking**

The app tracks:
- **Firestore Reads**: Every database read operation
- **Firestore Writes**: Every database write operation
- **Storage**: Total storage used (GB)
- **Bandwidth**: Data downloaded (GB)

### **Cost Calculation**

Estimated costs are calculated using Firebase pricing:
- **Firestore Reads**: $0.06 per 100K reads
- **Firestore Writes**: $0.18 per 100K writes
- **Storage**: $0.026 per GB/month
- **Bandwidth**: $0.12 per GB

### **Protection Levels**

1. **75% Warning**: Shows warnings but continues operation
2. **90% Auto-Disable**: Automatically disables Firebase features
3. **100% Block**: Completely blocks Firebase usage

## 🚨 **Automatic Disabling**

When limits are approached:

1. **Firebase Auth**: ✅ **ALWAYS ALLOWED** (FREE on Spark plan - 50K MAU/month)
2. **Firestore**: Disabled (database operations fail gracefully)
3. **Firebase Storage**: Disabled (file uploads fail gracefully)
4. **App Continues**: App switches to local storage/database if configured

**Important**: Firebase Auth will **never be disabled** due to billing protection because it's FREE on the Spark plan!

## 📈 **Monitoring Usage**

### **API Endpoint**

Check billing status:

```bash
GET /api/billing/status
```

Response:
```json
{
  "enabled": true,
  "limits": {
    "maxSpend": 1.0,
    "firestoreReadsPerDay": 40000,
    "firestoreWritesPerDay": 15000,
    "storageGB": 4.0,
    "bandwidthGB": 0.8
  },
  "usage": {
    "firestoreReads": 5000,
    "firestoreWrites": 2000,
    "storageUsed": 0.5,
    "bandwidthUsed": 0.1,
    "estimatedCost": 0.15
  },
  "warnings": [],
  "shouldDisable": false
}
```

## 🔧 **Firebase Console Setup**

### **1. Set Up Billing Alerts**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Usage and Billing** > **Billing**
4. Click **Set Budget Alert**
5. Set alert at **$0.50** (50% of $1 limit)
6. Set alert at **$0.90** (90% of $1 limit)

### **2. Set Spending Limit**

1. Go to **Usage and Billing** > **Billing**
2. Click **Set Budget**
3. Set budget to **$1.00**
4. Enable **Auto-disable** at budget limit

### **3. Monitor Usage**

1. Go to **Usage and Billing** > **Usage**
2. Monitor:
   - Firestore reads/writes
   - Storage usage
   - Bandwidth usage
   - Estimated costs

## 💡 **Best Practices**

### **1. Use Local Storage When Possible**

```env
STORAGE_TYPE=local  # Use local storage instead of Firebase
DATABASE_TYPE=mongodb  # Use MongoDB instead of Firestore
```

### **2. Set Conservative Limits**

Set limits below FREE tier to ensure you never exceed:

```env
FIREBASE_MAX_READS_PER_DAY=40000    # 80% of FREE tier
FIREBASE_MAX_WRITES_PER_DAY=15000   # 75% of FREE tier
FIREBASE_MAX_STORAGE_GB=4.0         # 80% of FREE tier
```

### **3. Monitor Daily**

Check usage daily:

```bash
curl http://localhost:3000/api/billing/status
```

### **4. Use FREE Tier First**

Firebase FREE tier is very generous:
- **50K reads/day** - Usually enough for small apps
- **20K writes/day** - Usually enough for small apps
- **5GB storage** - Usually enough for small apps
- **1GB bandwidth/day** - Usually enough for small apps

## 🚫 **Disable Billing Protection**

If you want to disable billing protection (not recommended):

```env
FIREBASE_BILLING_PROTECTION=false
```

**Warning**: This will allow unlimited Firebase usage and potential charges.

## 📊 **Usage Examples**

### **Small App (< 1,000 users)**
- **Reads**: ~1,000/day
- **Writes**: ~500/day
- **Storage**: ~100MB
- **Cost**: ~$0.00 (within FREE tier)

### **Medium App (1,000-10,000 users)**
- **Reads**: ~10,000/day
- **Writes**: ~5,000/day
- **Storage**: ~1GB
- **Cost**: ~$0.00-0.50 (mostly FREE tier)

### **Large App (10,000+ users)**
- **Reads**: ~50,000/day
- **Writes**: ~20,000/day
- **Storage**: ~5GB
- **Cost**: ~$0.50-1.00 (at FREE tier limits)

## ✅ **Summary**

1. **Billing Protection**: Enabled by default
2. **Auto-Disable**: At 90% of limits
3. **Monitoring**: Check `/api/billing/status`
4. **Firebase Console**: Set up billing alerts
5. **Local Alternatives**: Use local storage/database when possible

**You're protected!** The app will automatically disable Firebase before exceeding your $1 limit. 🛡️

