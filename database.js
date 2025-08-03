const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const config = require('./config');

class Database {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    const dbDir = path.dirname(config.databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new sqlite3.Database(config.databasePath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('Connected to SQLite database:', config.databasePath);
        this.createTables();
      }
    });
  }

  createTables() {
    const userTableSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const filesTableSQL = `
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        original_name TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        file_hash TEXT,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;

    this.db.run(userTableSQL, (err) => {
      if (err) {
        console.error('Error creating users table:', err.message);
      } else {
        console.log('Users table created or already exists');
      }
    });

    this.db.run(filesTableSQL, (err) => {
      if (err) {
        console.error('Error creating files table:', err.message);
      } else {
        console.log('Files table created or already exists');
      }
    });
  }

  createUser(username, email, passwordHash) {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
      this.db.run(sql, [username, email, passwordHash], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, username, email });
        }
      });
    });
  }

  getUserByUsername(username) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE username = ?';
      this.db.get(sql, [username], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  getUserById(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE id = ?';
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  createFile(userId, originalName, filename, filePath, fileSize, mimeType, fileHash) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO files (user_id, original_name, filename, file_path, file_size, mime_type, file_hash) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      this.db.run(sql, [userId, originalName, filename, filePath, fileSize, mimeType, fileHash], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ 
            id: this.lastID, 
            userId, 
            originalName, 
            filename, 
            filePath, 
            fileSize, 
            mimeType, 
            fileHash 
          });
        }
      });
    });
  }

  getFilesByUserId(userId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM files WHERE user_id = ? ORDER BY uploaded_at DESC';
      this.db.all(sql, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getFileById(fileId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM files WHERE id = ?';
      this.db.get(sql, [fileId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  getFileByFilename(filename) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM files WHERE filename = ?';
      this.db.get(sql, [filename], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database connection closed');
          resolve();
        }
      });
    });
  }
}

module.exports = new Database();