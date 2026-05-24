# TV Time Roku

A Roku SceneGraph channel for showing remaining TV viewing time from a local TV Time backend server.

## Features

- Automatic backend discovery on the local network
- Status polling every 5 seconds
- Color-coded remaining time: green over 30 minutes, orange from 10 to 30 minutes, red under 10 minutes
- Full-screen timeout state when the daily limit is reached
- Simple error state when the backend cannot be found

## Backend API

The backend must be reachable from the Roku device and expose:

```text
GET /api/status/limit
```

Expected JSON response:

```json
{
  "todayUsageMinutes": 40,
  "dailyLimitMinutes": 120,
  "limitExceeded": false
}
```

## Setup

Install dependencies:

```bash
npm install
```

Create a local `.env` file from `.env.example` and set your Roku and backend values:

```text
ROKU_DEV_TARGET=192.168.0.52
ROKU_DEV_USERNAME=rokudev
ROKU_DEV_PASSWORD=rokudev
ROKU_DEV_INSTALL_PORT=80
BACKEND_URL=http://192.168.0.141:3000/
```

`BACKEND_URL` is baked into the generated Roku package at build time. If it is omitted, the app falls back to local network discovery.

Build the sideload package:

```bash
npm run build
```

The package is written to `dist/apps/tv-time-roku.zip`.

Clean generated output:

```bash
npm run clean
```

## Deploy

Enable Developer Mode on the Roku and note the device IP address. Then either pass the values on the command line:

```bash
npm run deploy -- 192.168.1.100 rokudev your-dev-password
```

Or set environment variables:

```bash
ROKU_DEV_TARGET=192.168.1.100
ROKU_DEV_USERNAME=rokudev
ROKU_DEV_PASSWORD=your-dev-password
npm run deploy
```

To build and deploy in one command:

```bash
npm run deploy:build -- 192.168.1.100 rokudev your-dev-password
```

Check that Roku ECP endpoints are reachable:

```bash
npm run check:roku -- 192.168.1.100
```

Deploy uses the Roku developer web installer on port `80`. `check:roku` uses the ECP API on port `8060`.

View the Roku BrightScript debug console:

```bash
npm run debug:roku
```

The debug console uses `ROKU_DEV_TARGET` from `.env` by default. You can also pass an IP address:

```bash
npm run debug:roku -- 192.168.1.100
```

## Project Layout

- `source/manifest`: Roku channel manifest
- `source/source/Main.brs`: app entry point and polling loop
- `source/source/SSDP.brs`: backend discovery
- `source/source/HTTP.brs`: backend API request helpers
- `source/components/TVTime.xml`: SceneGraph UI
- `scripts/build.js`: npm package builder
- `scripts/deploy.js`: Roku sideload deployer
