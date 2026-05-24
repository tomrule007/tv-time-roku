const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'source');
const distDir = path.join(rootDir, 'dist', 'apps');
const packageZip = path.join(distDir, 'tv-time-roku.zip');

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

function assertSource() {
  const manifestPath = path.join(sourceDir, 'manifest');

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Roku manifest not found: ${manifestPath}`);
  }
}

function createBuild() {
  assertSource();
  fs.mkdirSync(distDir, { recursive: true });

  if (fs.existsSync(packageZip)) {
    fs.unlinkSync(packageZip);
  }

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(packageZip);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      log(`Package created: ${path.relative(rootDir, packageZip)}`);
      log(`Package size: ${(archive.pointer() / 1024).toFixed(2)} KB`);
      resolve();
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        log(err.message, 'warn');
        return;
      }

      reject(err);
    });

    archive.on('error', reject);
    output.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

createBuild().catch((err) => {
  log(`Build failed: ${err.message}`, 'error');
  process.exit(1);
});
