# Nik Server

A Node.js Express API server similar to Dropbox for mobile applications. Users can register, login, and upload files to the server with SQLite database integration for metadata storage.

## Features

- User registration and authentication
- File upload with multiple file support
- SQLite database for user and file metadata
- Environment-based configuration (local, dev, prod)
- Comprehensive logging with Winston
- File type validation and security
- MD5 hash generation for file integrity

## Tech Stack

- **Node.js** with Express.js framework
- **SQLite3** database
- **Multer** for file upload handling
- **Winston** for logging
- **Crypto** for password hashing and file integrity

## Project Structure

```
nik-server/
├── index.js                 # Main server file
├── config.js                # Configuration loader
├── database.js              # SQLite database models
├── package.json
├── properties/
│   ├── application-local.properties
│   ├── application-dev.properties
│   └── application-prod.properties
├── uploads/                 # File storage directory
└── database/                # SQLite database files
```

## API Endpoints

### Health Check
- **GET** `/api/health` - Server health status

### User Management
- **POST** `/api/register` - Register a new user
- **POST** `/api/login` - User authentication

### File Management
- **POST** `/api/upload` - Upload files (requires userId)
- **GET** `/api/users/:id/files` - Get user's uploaded files
- **GET** `/api/download/:filename` - Download file by filename

## Build and Run

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd nik-server

# Install dependencies
npm install
```

### Configuration
The server uses environment-based configuration files in the `properties/` directory:

- `application-local.properties` - Local development
- `application-dev.properties` - Development environment  
- `application-prod.properties` - Production environment

Set the `NODE_ENV` environment variable to choose configuration:
```bash
export NODE_ENV=local    # or dev, prod
```

### Running the Server
```bash
# Development mode (uses local configuration by default)
npm run dev

# Production mode
npm start

# With specific environment
NODE_ENV=dev npm start
```

The server will start on port 3000 by default (configurable via PORT environment variable).

## API Usage Examples

### 1. Register a User
```bash
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com", 
    "password": "mypassword123"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "mypassword123"
  }'
```

### 3. Upload Files
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "userId=1" \
  -F "files=@test.txt" \
  -F "files=@image.jpg"
```

### 4. Get User Files
```bash
curl -X GET http://localhost:3000/api/users/1/files
```

### 5. Download File
```bash
curl -X GET http://localhost:3000/api/download/files-1691234567890-123456789.txt -o downloaded_file.txt
```

## Database Schema

### Users Table
- `id` - Primary key
- `username` - Unique username
- `email` - Unique email address
- `password_hash` - SHA256 hashed password
- `created_at` - Registration timestamp
- `updated_at` - Last update timestamp

### Files Table
- `id` - Primary key
- `user_id` - Foreign key to users table
- `original_name` - Original filename
- `filename` - Stored filename (with unique suffix)
- `file_path` - Full path to stored file
- `file_size` - File size in bytes
- `mime_type` - File MIME type
- `file_hash` - MD5 hash for integrity
- `uploaded_at` - Upload timestamp

## Supported File Types
- Images: JPEG, JPG, PNG, GIF
- Documents: PDF, TXT, DOC, DOCX

## Environment Variables
- `NODE_ENV` - Environment (local, dev, prod)
- `PORT` - Server port (default: 3000)

## Development

### Adding New Endpoints
1. Add route handlers in `index.js`
2. Add database methods in `database.js` if needed
3. Update this README with new API documentation

### Database Management
The database is automatically created and initialized on server startup. Tables are created if they don't exist.

## License
ISC