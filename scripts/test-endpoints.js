const fetch = require('node-fetch');

const rokuIP = process.argv[2] || process.env.ROKU_DEV_TARGET;

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

  for (const url of [deviceInfoUrl, appsUrl]) {
    log(`Checking ${url}`);
    const response = await fetch(url, { timeout: 5000 });

    if (!response.ok) {
      throw new Error(`${url} returned HTTP ${response.status}`);
    }
  }

  log(`Roku ECP is reachable at ${cleanIP}`);
}

main().catch((error) => {
  log(`Endpoint check failed: ${error.message}`, 'error');
  process.exit(1);
});
