# Fixing TensorFlow.js Node on Windows

## The Problem

You're seeing this error:
```
Error: The specified module could not be found.
\\?\C:\Users\Josh\Downloads\baseballhackathon\node_modules\@tensorflow\tfjs-node\lib\napi-v8\tfjs_binding.node
```

This is a **common Windows issue** with TensorFlow.js Node native bindings.

## Solutions

### Option 1: Install Visual C++ Redistributables (Recommended)

1. Download and install **Microsoft Visual C++ Redistributable**:
   - For x64: https://aka.ms/vs/17/release/vc_redist.x64.exe
   - For x86: https://aka.ms/vs/17/release/vc_redist.x86.exe

2. Restart your computer after installation.

3. Try running the backend again:
   ```bash
   npm run dev:server
   ```

### Option 2: Use Client-Side Pose Detection Only

The app is already configured to work **without server-side pose detection**:

- ✅ **Client-side pose detection works perfectly** in the browser
- ✅ The backend will start successfully even if TensorFlow.js Node fails
- ✅ All features work except server-side AI processing

The frontend uses TensorFlow.js in the browser, which doesn't require native bindings.

### Option 3: Use Docker or WSL2

If you need server-side pose detection, you can:
- Run the backend in **Docker** (Linux container)
- Use **WSL2** (Windows Subsystem for Linux)

Both avoid Windows native binding issues.

## Current Status

✅ **The backend is configured to start even if TensorFlow.js Node fails**
✅ **Client-side pose detection works in the browser**
✅ **All other features work normally**

The server will show a warning but continue running:
```
⚠️  TensorFlow.js Node not available (native bindings issue).
   This is common on Windows. Server-side pose detection will be disabled.
   Client-side pose detection will still work in the browser.
```

## Testing

1. Start the backend:
   ```bash
   npm run dev:server
   ```

2. You should see:
   - ✅ Server starts successfully
   - ⚠️  Warning about TensorFlow.js Node (if native bindings fail)
   - ✅ All other endpoints work

3. Use the frontend - pose detection will work in the browser!

