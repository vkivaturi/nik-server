const express = require('express');
const winston = require('winston');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const config = require('./config');

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

app.get('/api/users', (req, res) => {
  logger.info('Users endpoint accessed');
  res.json([
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ]);
});

app.post('/api/users', (req, res) => {
  logger.info('Create user endpoint accessed', { body: req.body });
  const { name, email } = req.body;
  
  if (!name || !email) {
    logger.warn('Invalid user creation attempt', { body: req.body });
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  const newUser = { id: Date.now(), name, email };
  logger.info('User created successfully', { user: newUser });
  res.status(201).json(newUser);
});

app.post('/api/upload', upload.array('files', config.maxFiles), (req, res) => {
  try {
    logger.info('File upload endpoint accessed', {
      fileCount: req.files ? req.files.length : 0,
      environment: config.env
    });

    if (!req.files || req.files.length === 0) {
      logger.warn('No files provided for upload');
      return res.status(400).json({ error: 'No files provided' });
    }

    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      path: file.path
    }));

    logger.info('Files uploaded successfully', {
      files: uploadedFiles,
      uploadPath: config.uploadPath
    });

    res.status(201).json({
      message: 'Files uploaded successfully',
      files: uploadedFiles,
      environment: config.env
    });
  } catch (error) {
    logger.error('File upload error', { error: error.message });
    res.status(500).json({ error: 'File upload failed' });
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