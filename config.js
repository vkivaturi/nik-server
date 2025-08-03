const fs = require('fs');
const path = require('path');

function loadProperties(env) {
  const propertiesFile = path.join(__dirname, 'properties', `application-${env}.properties`);
  
  if (!fs.existsSync(propertiesFile)) {
    throw new Error(`Properties file not found: ${propertiesFile}`);
  }
  
  const content = fs.readFileSync(propertiesFile, 'utf8');
  const properties = {};
  
  content.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        properties[key.trim()] = value.trim();
      }
    }
  });
  
  return properties;
}

const env = process.env.NODE_ENV || 'local';
const config = loadProperties(env);

module.exports = {
  uploadPath: config['upload.path'],
  maxFileSize: parseInt(config['upload.maxFileSize'], 10),
  maxFiles: parseInt(config['upload.maxFiles'], 10),
  env
};