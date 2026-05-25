import fetch from 'node-fetch';
import { DigestClient } from 'digest-fetch';
import 'dotenv/config';

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
  return ip.replace(/https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
}

async function main() {
  if (!rokuIP) {
    log('Roku IP address not provided', 'error');
    log('Usage: npm run check:roku -- <roku-ip>', 'warn');
    log('Or set ROKU_DEV_TARGET environment variable', 'warn');
    process.exit(1);
  }

  const cleanIP = cleanRokuIP(rokuIP);
  const deviceInfoUrl = `http://${cleanIP}:8060/query/device-info`;
  const appsUrl = `http://${cleanIP}:8060/query/apps`;
  const devPortalUrl = `http://${cleanIP}/plugin_inspect`;

  for (const url of [deviceInfoUrl, appsUrl]) {
    log(`Checking ${url}`);
    const response = await fetch(url, { timeout: 5000 });

    if (!response.ok) {
      throw new Error(`${url} returned HTTP ${response.status}`);
    }
  }

  log(`Roku ECP is reachable at ${cleanIP}`);

  if (password) {
    log(`Checking Developer Portal at ${devPortalUrl}...`);
    try {
      const client = new DigestClient(username, password);
      const response = await client.fetch(devPortalUrl, { timeout: 5000 });
      
      if (response.status === 401) {
        log('Developer Portal authentication failed (check password)', 'error');
      } else if (response.ok) {
        const html = await response.text();
        log('Developer Portal is accessible and authenticated');
        if (!html.includes('value="Screenshot"')) {
          log('Warning: Screenshot button not found in HTML. Is an app sideloaded?', 'warn');
        }
      } else {
        log(`Developer Portal returned HTTP ${response.status}`, 'error');
      }
    } catch (e) {
      log(`Developer Portal check failed: ${e.message}`, 'error');
    }
  }
}

main().catch((error) => {
  log(`Endpoint check failed: ${error.message}`, 'error');
  process.exit(1);
});
