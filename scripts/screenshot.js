import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { DigestClient } from 'digest-fetch';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const screenshotsDir = path.join(rootDir, 'screenshots');

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

function getBaseUrl(ip, port) {
  const cleanIP = cleanRokuIP(ip);
  return port === '80' ? `http://${cleanIP}` : `http://${cleanIP}:${port}`;
}

function generateFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `screenshot-${timestamp}.png`;
}

async function captureScreenshot() {
  if (!rokuIP) {
    log('Roku IP address not provided', 'error');
    log('Usage: npm run screenshot -- <roku-ip> [username] [password]', 'warn');
    log('Or set ROKU_DEV_TARGET environment variable', 'warn');
    process.exitCode = 1;
    return;
  }

  if (!password) {
    log('Roku developer password not provided', 'error');
    log('Pass it as the third argument or set ROKU_DEV_PASSWORD', 'warn');
    process.exitCode = 1;
    return;
  }

  const cleanIP = cleanRokuIP(rokuIP);
  const baseUrl = getBaseUrl(cleanIP, installerPort);
  
  // Create screenshots directory if it doesn't exist
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    log(`Created screenshots directory: ${path.relative(rootDir, screenshotsDir)}`);
  }

  log(`Roku IP: ${cleanIP}`);
  log(`Connecting to Roku at ${baseUrl}...`);

  try {
    const client = new DigestClient(username, password);
    const url = `${baseUrl}/plugin_inspect`;
    
    const form = new FormData();
    // Reordered to match browser behavior: archive -> passwd -> mysubmit
    form.append('archive', Buffer.alloc(0), { 
      filename: '', 
      contentType: 'application/octet-stream' 
    });
    form.append('passwd', password);
    form.append('mysubmit', 'Screenshot');

    log(`Requesting screenshot from ${url}...`);

    const response = await client.fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Origin': baseUrl,
        'Referer': `${baseUrl}/plugin_inspect`,
        ...form.getHeaders(),
        'Content-Length': form.getLengthSync()
      },
      body: form.getBuffer(),
      timeout: 20000
    });

    const status = response.status;
    const contentType = response.headers.get('content-type') || '';
    const headers = Object.fromEntries(response.headers.entries());

    log(`Response Status: ${status}`);
    log(`Content-Type: ${contentType}`);

    let buffer;

    if (response.ok && contentType.includes('image/')) {
      // Direct image response (older firmware)
      buffer = Buffer.from(await response.arrayBuffer());
    } else if (response.ok && contentType.includes('text/html')) {
      const text = await response.text();
      
      // Check if the screenshot was actually successful
      if (!text.includes('Screenshot ok')) {
        const debugJsonPath = path.join(rootDir, 'screenshot-debug.json');
        const debugHtmlPath = path.join(rootDir, 'screenshot-response.html');
        fs.writeFileSync(debugJsonPath, JSON.stringify({ url, status, headers, bodySnippet: text.slice(0, 1000) }, null, 2));
        fs.writeFileSync(debugHtmlPath, text);
        
        log(`Debug info saved to ${path.relative(rootDir, debugJsonPath)}`, 'warn');
        log(`Full HTML response saved to ${path.relative(rootDir, debugHtmlPath)}`, 'warn');

        if (text.includes('No application is currently sideloaded')) {
          throw new Error('No sideloaded application is currently running.');
        }
        throw new Error('Roku returned HTML but the screenshot failed. Check screenshot-response.html');
      }

      // Step 2: Download the generated image
      const imageUrl = `${baseUrl}/pkgs/dev.jpg?time=${Date.now()}`;
      log(`Screenshot triggered. Downloading image from ${imageUrl}...`);
      
      const imageResponse = await client.fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image after trigger (HTTP ${imageResponse.status})`);
      }
      buffer = Buffer.from(await imageResponse.arrayBuffer());
    } else {
      // Error handling for non-200 or unexpected types
      const text = await response.text();

      const debugJsonPath = path.join(rootDir, 'screenshot-debug.json');
      const debugHtmlPath = path.join(rootDir, 'screenshot-response.html');

      fs.writeFileSync(debugJsonPath, JSON.stringify({ url, status, headers, bodySnippet: text.slice(0, 1000) }, null, 2));
      fs.writeFileSync(debugHtmlPath, text);

      log(`Debug info saved to ${path.relative(rootDir, debugJsonPath)}`, 'warn');
      log(`Full HTML response saved to ${path.relative(rootDir, debugHtmlPath)}`, 'warn');
      
      throw new Error(`Roku did not return an image. (HTTP ${response.status}, Content-Type: ${contentType})`);
    }

    if (buffer.length < 1000) {
      throw new Error(`Captured data is too small (${buffer.length} bytes). The app might be suspended.`);
    }

    const filename = generateFilename();
    const filepath = path.join(screenshotsDir, filename);
    fs.writeFileSync(filepath, buffer);
    log(`Screenshot saved: ${path.relative(rootDir, filepath)}`);
    log('Note: Screenshots only capture the sideloaded app. If the image is black, ensure your app is in the foreground.', 'warn');

  } catch (err) {
    log(`Screenshot failed: ${err.message}`, 'error');
    if (err.message?.includes('401')) {
      log('Authentication failed. Verify ROKU_DEV_PASSWORD.', 'warn');
    } else {
      log('Troubleshooting:', 'warn');
      log('  1. Ensure Roku developer mode is enabled', 'warn');
      log('  2. Verify network connectivity to the device', 'warn');
    }
    process.exitCode = 1;
  }
}

await captureScreenshot();
