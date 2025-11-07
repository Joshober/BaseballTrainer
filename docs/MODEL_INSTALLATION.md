# AI Model Installation Guide

This guide explains how to install and cache the AI models needed for the baseball swing analysis app.

## 🤖 **Models Installed**

The installation script downloads and caches the following TensorFlow.js models:

1. **MoveNet Lightning** (~5MB)
   - Fast, lightweight model
   - Optimized for client-side (browser) use
   - Good accuracy, fast inference

2. **MoveNet Thunder** (~12MB)
   - More accurate model
   - Optimized for server-side use
   - Better accuracy, slightly slower

**Total Size**: ~17MB (one-time download)

## 🚀 **Quick Start**

### **Automatic Installation (Recommended)**

Models are automatically installed after `npm install`:

```bash
npm install
```

The `postinstall` script will automatically run the model installation.

### **Manual Installation**

If you want to install models manually:

```bash
npm run install:models
```

### **Platform-Specific Scripts**

**Windows (PowerShell):**
```powershell
.\scripts\install-models.ps1
```

**Linux/Mac:**
```bash
chmod +x scripts/install-models.sh
./scripts/install-models.sh
```

**Direct (TypeScript):**
```bash
tsx scripts/install-models.ts
```

## 📋 **What the Script Does**

1. **Downloads Models**: Downloads MoveNet Lightning and Thunder from Google's CDN
2. **Caches Models**: Saves models to Node.js cache for faster loading
3. **Tests Models**: Verifies models work by running a test inference
4. **Reports Status**: Shows installation progress and results

## ✅ **Verification**

After installation, you should see:

```
============================================================
  Installation Summary
============================================================

MoveNet Lightning: ✓ Installed
MoveNet Thunder:   ✓ Installed

✓ All models installed successfully!
  Models are now cached and ready to use.
  First-time usage will be faster now.
```

## 🔄 **When Models Are Downloaded**

### **Automatic Download (Default)**
- Models download automatically on first use
- Happens when you first run pose detection
- Takes 2-5 seconds per model

### **Pre-Installation (Recommended)**
- Run `npm run install:models` before first use
- Models are cached and ready immediately
- No waiting on first pose detection

## 📁 **Model Cache Locations**

Models are cached in:
- **Node.js**: `node_modules/.cache/` or system cache
- **Browser**: IndexedDB or browser cache (on first use)
- **Size**: ~5-12MB per model variant

## 🛠️ **Troubleshooting**

### **Installation Fails**

**Error: "tsx is not installed"**
```bash
npm install -g tsx
# or
npm install
```

**Error: "Network error"**
- Check your internet connection
- Models download from Google CDN
- Try again later

**Error: "Model download failed"**
- Check firewall settings
- Ensure you can access `https://storage.googleapis.com/`
- Try running the script again

### **Models Not Cached**

If models aren't cached after installation:
1. Check Node.js cache permissions
2. Ensure you have write access to `node_modules/.cache/`
3. Try running the script again

### **Models Still Download on First Use**

This is normal for:
- **Browser**: Models are cached separately in the browser
- **Different environments**: Each environment (dev/prod) caches separately

The installation script caches models for **server-side** use. Browser models are cached separately on first use.

## 💡 **Best Practices**

1. **Install Before Development**: Run `npm run install:models` after cloning the repo
2. **Include in CI/CD**: Add model installation to your deployment pipeline
3. **Monitor Cache Size**: Models take ~17MB total (very small)
4. **Update Models**: Re-run installation if you update TensorFlow.js

## 📊 **Installation Time**

- **Fast Connection**: ~5-10 seconds total
- **Slow Connection**: ~30-60 seconds total
- **Offline**: Will fail (models need internet to download)

## 🎯 **Summary**

- **Run**: `npm run install:models`
- **Time**: ~5-60 seconds (depends on connection)
- **Size**: ~17MB total
- **Benefit**: Faster first-time pose detection
- **Required**: Internet connection for initial download

That's it! Models are now ready to use. 🚀

