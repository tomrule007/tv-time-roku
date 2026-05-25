import net from 'node:net';
import 'dotenv/config';
import process from 'node:process';

const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const rokuIP = positionalArgs[0] || process.env.ROKU_DEV_TARGET;
const debugPort = Number(process.env.ROKU_DEBUG_PORT || 8085);
const once = process.argv.includes('--once');

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

const cleanIP = cleanRokuIP(rokuIP);

if (!cleanIP) {
  log('Roku IP address not provided', 'error');
  log('Usage: npm run debug:roku -- <roku-ip>', 'warn');
  log('Or set ROKU_DEV_TARGET in .env', 'warn');
  process.exit(1); // Standard exit is fine for sync check
}

log(`Connecting to Roku debug console at ${cleanIP}:${debugPort}`);

const client = net.createConnection({ host: cleanIP, port: debugPort }, () => {
  log('Connected. Press Ctrl+C to disconnect.');

  if (!once) {
    process.stdin.resume();
    process.stdin.pipe(client);
  }
});

client.setEncoding('utf8');

client.on('data', (data) => {
  process.stdout.write(data);

  if (once) {
    client.end();
  }
});

client.on('error', (error) => {
  log(`Debug console connection failed: ${error.message}`, 'error');
  process.exitCode = 1;
});

client.on('close', () => {
  log('Disconnected from Roku debug console');
});

process.on('SIGINT', () => {
  client.end();
});
