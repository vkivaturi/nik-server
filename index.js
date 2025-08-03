const express = require('express');
const winston = require('winston');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const database = require('./database');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'nik-server' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

const app = express();
const PORT = process.env.PORT || 3000;

if (!fs.existsSync(config.uploadPath)) {
  fs.mkdirSync(config.uploadPath, { recursive: true });
  logger.info(`Created upload directory: ${config.uploadPath}`);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.maxFileSize,
    files: config.maxFiles
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(jpeg|jpg|png|gif|pdf|txt|doc|docx)$/i;
    const allowedMimetypes = /^(image\/(jpeg|jpg|png|gif)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|text\/plain)$/;
    
    const extname = allowedExtensions.test(file.originalname.toLowerCase());
    const mimetype = allowedMimetypes.test(file.mimetype);
        
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, PDF, TXT, DOC, DOCX are allowed.'));
    }
  }
});

app.use(express.json());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

app.get('/', (req, res) => {
  logger.info('Root endpoint accessed');
  res.json({ message: 'Welcome to Nik Server API', status: 'running' });
});

app.get('/api/health', (req, res) => {
  logger.info('Health check endpoint accessed');
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    const user = await database.createUser(username, email, passwordHash);
    
    logger.info('User registered successfully', { userId: user.id, username });
    res.status(201).json({ id: user.id, username: user.username, email: user.email });
  } catch (error) {
    logger.error('User registration error', { error: error.message });
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const user = await database.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    if (user.password_hash !== passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    logger.info('User logged in successfully', { userId: user.id, username });
    res.json({ id: user.id, username: user.username, email: user.email });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/upload', upload.array('files', config.maxFiles), async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const user = await database.getUserById(userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid user' });
    }
    
    logger.info('File upload endpoint accessed', {
      userId,
      fileCount: req.files ? req.files.length : 0,
      environment: config.env
    });

    if (!req.files || req.files.length === 0) {
      logger.warn('No files provided for upload');
      return res.status(400).json({ error: 'No files provided' });
    }

    const uploadedFiles = [];
    
    for (const file of req.files) {
      const fileHash = crypto.createHash('md5').update(fs.readFileSync(file.path)).digest('hex');
      
      const dbFile = await database.createFile(
        userId,
        file.originalname,
        file.filename,
        file.path,
        file.size,
        file.mimetype,
        fileHash
      );
      
      uploadedFiles.push({
        id: dbFile.id,
        originalName: file.originalname,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        hash: fileHash,
        uploadedAt: new Date().toISOString()
      });
    }

    logger.info('Files uploaded successfully', {
      userId,
      files: uploadedFiles,
      uploadPath: config.uploadPath
    });

    res.status(201).json({
      message: 'Files uploaded successfully',
      files: uploadedFiles
    });
  } catch (error) {
    logger.error('File upload error', { error: error.message });
    res.status(500).json({ error: 'File upload failed' });
  }
});

app.get('/api/users/:id/files', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    const user = await database.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const files = await database.getFilesByUserId(userId);
    
    const fileList = files.map(file => ({
      id: file.id,
      originalName: file.original_name,
      filename: file.filename,
      size: file.file_size,
      mimeType: file.mime_type,
      hash: file.file_hash,
      uploadedAt: file.uploaded_at
    }));
    
    logger.info('User files retrieved', { userId, fileCount: fileList.length });
    res.json({ files: fileList });
  } catch (error) {
    logger.error('Get user files error', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});

app.get('/api/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    
    const file = await database.getFileByFilename(filename);
    if (!file) {
      logger.warn('File not found for download', { filename });
      return res.status(404).json({ error: 'File not found' });
    }
    
    const filePath = file.file_path;
    
    if (!fs.existsSync(filePath)) {
      logger.error('Physical file not found', { filename, filePath });
      return res.status(404).json({ error: 'Physical file not found on server' });
    }
    
    logger.info('File download requested', {
      filename,
      originalName: file.original_name,
      userId: file.user_id,
      fileSize: file.file_size
    });
    
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Length', file.file_size);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('end', () => {
      logger.info('File download completed', { filename, originalName: file.original_name });
    });
    
    fileStream.on('error', (error) => {
      logger.error('File download error', { filename, error: error.message });
      if (!res.headersSent) {
        res.status(500).json({ error: 'File download failed' });
      }
    });
    
  } catch (error) {
    logger.error('Download endpoint error', { error: error.message });
    res.status(500).json({ error: 'Download failed' });
  }
});

app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});