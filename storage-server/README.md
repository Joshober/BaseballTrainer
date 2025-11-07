# Storage Server

A Flask-based storage server for video and image files. Can run on a separate computer as a dedicated storage server.

## Features

- Upload videos and images
- Retrieve files via URL
- Delete files (with authentication)
- Firebase authentication support
- CORS enabled for cross-origin requests
- Demo mode for testing without Firebase

## Setup

### 1. Install Dependencies

```bash
cd storage-server
pip install -r requirements.txt
```

### 2. Configure Environment

Add to `.env.local` in the project root:

```env
# Storage Server Configuration
STORAGE_SERVER_PORT=5003
STORAGE_SERVER_HOST=0.0.0.0  # Use 0.0.0.0 to allow external connections
STORAGE_UPLOAD_DIR=uploads

# Firebase Admin (for authentication)
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account_email
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Optional: Demo mode (skip authentication)
DEMO_MODE=false
```

### 3. Run the Server

```bash
python app.py
```

The server will start on `http://localhost:5003` (or the port specified in `STORAGE_SERVER_PORT`).

## API Endpoints

### Upload File

```http
POST /api/storage/upload
Authorization: Bearer <firebase_token>
Content-Type: multipart/form-data

file: <file>
path: <optional_custom_path>
```

**Response:**
```json
{
  "url": "/api/storage/user123/video.mp4",
  "path": "user123/video.mp4",
  "size": 1234567
}
```

### Get File

```http
GET /api/storage/{path}
```

Returns the file with appropriate content type.

### Delete File

```http
DELETE /api/storage?path={path}
Authorization: Bearer <firebase_token>
```

**Response:**
```json
{
  "message": "File deleted successfully"
}
```

## Running on Another Computer

1. Set `STORAGE_SERVER_HOST=0.0.0.0` in `.env.local`
2. Configure firewall to allow connections on the storage server port
3. Update the frontend config to point to the storage server URL:
   ```env
   STORAGE_SERVER_URL=http://<storage-server-ip>:5003
   ```

## Demo Mode

For testing without Firebase authentication:

```env
DEMO_MODE=true
```

In demo mode, all requests are allowed without authentication.

## File Organization

Files are stored in the `uploads` directory (or `STORAGE_UPLOAD_DIR`) with the following structure:

```
uploads/
  user123/
    video1.mp4
    image1.jpg
  user456/
    video2.mp4
```

## Security

- Files are stored with user-specific paths (user_id/filename)
- Users can only delete their own files
- Path traversal attacks are prevented
- Firebase authentication required for upload/delete operations

