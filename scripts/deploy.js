import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DigestClient } from 'digest-fetch';
import FormData from 'form-data';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const packageZip = path.join(rootDir, 'dist', 'apps', 'tv-time-roku.zip');

const rokuIP = process.argv[2] || process.env.ROKU_DEV_TARGET;
const username = process.argv[3] || process.env.ROKU_DEV_USERNAME || 'rokudev';
const password = process.argv[4] || process.env.ROKU_DEV_PASSWORD;
const installerPort = process.env.ROKU_DEV_INSTALL_PORT || '80';

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
  return ip.replace(/https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
}

function getInstallerBaseUrl(ip, port) {
  const cleanIP = cleanRokuIP(ip);
  return port === '80' ? `http://${cleanIP}` : `http://${cleanIP}:${port}`;
}

function getInstallMessages(body) {
  const matches = [...body.matchAll(/"text":"([^"]+)"/g)];

  if (matches.length > 0) {
    return matches.map((match) => match[1]);
  }

  if (body.includes('Install Success')) {
    return ['Install Success'];
  }

  return [];
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
    const url = `${getInstallerBaseUrl(cleanIP, installerPort)}/plugin_install`;
    const form = new FormData();

    // Field order matters for Roku: archive -> passwd -> mysubmit
    form.append('archive', fs.readFileSync(packageZip), {
      filename: path.basename(packageZip),
      contentType: 'application/zip'
    });
    form.append('passwd', password);
    form.append('mysubmit', 'Install');

    log(`Uploading to ${url}...`);

    const client = new DigestClient(username, password);
    const response = await client.fetch(url, {
      method: 'POST',
      headers: {
        'Origin': getInstallerBaseUrl(cleanIP, installerPort),
        'Referer': `${getInstallerBaseUrl(cleanIP, installerPort)}/plugin_install`,
        ...form.getHeaders(),
        'Content-Length': form.getLengthSync()
      },
      body: form.getBuffer(),
      timeout: 30000
    });

    const body = await response.text();

    if (!response.ok) {
      const errorSnippet = body.includes('Install Failure') 
        ? 'Install Failure (check the dev console for details)' 
        : body.trim().slice(0, 100);
        
      throw new Error(`Roku returned HTTP ${response.status}: ${errorSnippet}`);
    }

    log(`Successfully deployed to Roku at ${cleanIP}`);

    for (const message of getInstallMessages(body)) {
      log(message);
    }
  } catch (error) {
    log(`Deployment failed: ${error.message}`, 'error');
    if (error.code === 'ECONNREFUSED') {
      log(`Could not connect to Roku developer installer at ${getInstallerBaseUrl(cleanIP, installerPort)}`, 'error');
      log('Verify the IP address and that the Roku is in dev mode', 'warn');
    }
    process.exit(1);
  }
}

deploy();
