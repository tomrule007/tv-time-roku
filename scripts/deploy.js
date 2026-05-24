const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

const rootDir = path.resolve(__dirname, '..');
const packageZip = path.join(rootDir, 'dist', 'apps', 'tv-time-roku.zip');

const rokuIP = process.argv[2] || process.env.ROKU_DEV_TARGET;
const username = process.argv[3] || process.env.ROKU_DEV_USERNAME || 'rokudev';
const password = process.argv[4] || process.env.ROKU_DEV_PASSWORD;

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

function cleanRokuIP(ip) {
  if (!ip) return null;
  return ip.replace(/https?:\/\//, '').replace(/\/$/, '').replace(/:\d+$/, '');
}

async function deploy() {
  if (!rokuIP) {
    log('Roku IP address not provided', 'error');
    log('Usage: npm run deploy -- <roku-ip> [username] [password]', 'warn');
    log('Or set ROKU_DEV_TARGET environment variable', 'warn');
    process.exit(1);
  }

  if (!password) {
    log('Roku developer password not provided', 'error');
    log('Pass it as the third argument or set ROKU_DEV_PASSWORD', 'warn');
    process.exit(1);
  }

  const cleanIP = cleanRokuIP(rokuIP);
  log(`Roku IP: ${cleanIP}`);

  if (!fs.existsSync(packageZip)) {
    log(`Package not found: ${path.relative(rootDir, packageZip)}`, 'error');
    log('Run "npm run build" first', 'warn');
    process.exit(1);
  }

  log(`Deploying package: ${path.relative(rootDir, packageZip)}`);

  try {
    const url = `http://${cleanIP}:8060/plugin_install`;
    const form = new FormData();

    form.append('mysubmit', 'Install');
    form.append('archive', fs.createReadStream(packageZip), {
      filename: path.basename(packageZip),
      contentType: 'application/zip'
    });
    form.append('passwd', password);

    log(`Uploading to ${url}...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
      },
      body: form,
      timeout: 30000
    });

    const body = await response.text();

    if (!response.ok) {
      throw new Error(`Roku returned HTTP ${response.status}: ${body.trim()}`);
    }

    log(`Successfully deployed to Roku at ${cleanIP}`);
    if (body.trim()) {
      log(body.trim());
    }
  } catch (error) {
    log(`Deployment failed: ${error.message}`, 'error');
    if (error.code === 'ECONNREFUSED') {
      log(`Could not connect to Roku at ${cleanIP}:8060`, 'error');
      log('Verify the IP address and that the Roku is in dev mode', 'warn');
    }
    process.exit(1);
  }
}

deploy();
