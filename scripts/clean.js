import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m',
    reset: '\x1b[0m'
  };
  
  const prefix = type === 'info' ? '==>' : `${type.toUpperCase()}:`;
  console.log(`${colors[type]}${prefix} ${message}${colors.reset}`);
}

try {
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
    log('Clean complete!');
  } else {
    log('Nothing to clean');
  }
} catch (error) {
  log(`Clean failed: ${error.message}`, 'error');
  process.exitCode = 1;
}
