# .env.local Troubleshooting Guide

## Common Issues with python-dotenv Parsing

If you see an error like:
```
Python-dotenv could not parse statement starting at line X
```

This means there's a syntax error in your `.env.local` file. Here are common issues and how to fix them:

## 1. Unquoted Values with Special Characters

**Problem:**
```env
# ❌ Wrong - special characters in unquoted value
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db?retryWrites=true&w=majority
NEXT_PUBLIC_BACKEND_URL=https://baseball.ngrok.app
```

**Solution:**
```env
# ✅ Correct - quote values with special characters
MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/db?retryWrites=true&w=majority"
NEXT_PUBLIC_BACKEND_URL="https://baseball.ngrok.app"
```

## 2. Private Keys with Newlines

**Problem:**
```env
# ❌ Wrong - private key with actual newlines
FIREBASE_ADMIN_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----
```

**Solution:**
```env
# ✅ Correct - use \n for newlines and quote the entire value
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----"
```

## 3. Comments on the Same Line

**Problem:**
```env
# ❌ Wrong - comment after value
STORAGE_TYPE=firebase  # or "local"
DATABASE_TYPE=firestore  # or "mongodb"
```

**Solution:**
```env
# ✅ Correct - put comments on separate lines
# Storage type: firebase or local
STORAGE_TYPE=firebase
# Database type: firestore or mongodb
DATABASE_TYPE=firestore
```

## 4. Spaces Around Equals Sign

**Problem:**
```env
# ❌ Wrong - spaces around =
KEY = value
```

**Solution:**
```env
# ✅ Correct - no spaces around =
KEY=value
```

## 5. Missing Quotes for Values with Spaces

**Problem:**
```env
# ❌ Wrong - unquoted value with spaces
DESCRIPTION=This is a description with spaces
```

**Solution:**
```env
# ✅ Correct - quote values with spaces
DESCRIPTION="This is a description with spaces"
```

## 6. Empty Values

**Problem:**
```env
# ❌ Wrong - empty value without quotes
API_KEY=
```

**Solution:**
```env
# ✅ Correct - use empty string or omit the variable
API_KEY=""
# or just omit it if not needed
```

## Validating Your .env.local File

Use the validation script to check for issues:

```bash
npm run validate:env
```

This will:
- Check for syntax errors
- Warn about unquoted values with special characters
- Verify that private keys are properly quoted
- Test if python-dotenv can parse the file

## Example .env.local Template

Here's a properly formatted `.env.local` template:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY="your_api_key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project_id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_project.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
NEXT_PUBLIC_FIREBASE_APP_ID="your_app_id"

# Firebase Admin (for server-side operations)
FIREBASE_ADMIN_PROJECT_ID="your_project_id"
FIREBASE_ADMIN_CLIENT_EMAIL="your_service_account_email"
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"

# MongoDB Atlas (if using MongoDB)
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority"

# Storage & Database Toggles
STORAGE_TYPE=firebase
DATABASE_TYPE=firestore

# Backend Gateway Configuration
GATEWAY_PORT=3001
GATEWAY_URL="http://localhost:3001"
NEXT_PUBLIC_GATEWAY_URL="http://localhost:3001"

# Flask Services Configuration
POSE_DETECTION_SERVICE_PORT=5000
POSE_DETECTION_SERVICE_URL="http://localhost:5000"
DRILL_RECOMMENDER_PORT=5001
DRILL_RECOMMENDER_URL="http://localhost:5001"
BLAST_CONNECTOR_PORT=5002
BLAST_CONNECTOR_URL="http://localhost:5002"

# Test Mode (for Flask services - bypasses authentication)
TEST_MODE=false

# Ngrok Configuration (optional)
NEXT_PUBLIC_BACKEND_URL="https://baseball.ngrok.app"
NGROK_URL="https://baseball.ngrok.app"
NEXT_PUBLIC_NGROK_FRONTEND_URL="https://baseball.ngrok.dev"
NGROK_FRONTEND_URL="https://baseball.ngrok.dev"
```

## Quick Fix Checklist

If you're getting parsing errors:

1. ✅ Run `npm run validate:env` to identify the issue
2. ✅ Check line 3 (or the line mentioned in the error)
3. ✅ Quote all values with special characters (`#`, `&`, `?`, `=`, spaces, etc.)
4. ✅ Ensure private keys use `\n` for newlines and are quoted
5. ✅ Put comments on separate lines (not after values)
6. ✅ Remove spaces around the `=` sign
7. ✅ Quote values that contain spaces

## Still Having Issues?

If you're still getting errors after following this guide:

1. Check the exact line number mentioned in the error
2. Look for any unusual characters or formatting
3. Try removing that line temporarily to see if the rest loads
4. Use a text editor that shows hidden characters
5. Ensure the file is saved as UTF-8 encoding

