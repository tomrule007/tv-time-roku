# TV Time - Roku Client

This is a Roku SceneGraph channel that serves as a client for the TV Time monitoring system. It displays the remaining TV viewing time allocated for the day, providing a clear visual indicator for users (and parents) directly on the television screen.

This project requires the **[TV Time Backend](https://github.com/tomrule007/tv-time)** to be running on your local network to manage time limits and usage data.

## Features

- Automatic backend discovery on the local network
- Status polling every 5 seconds
- **Visual Alerts**: Color-coded countdown (Green > 30m, Orange 10-30m, Red < 10m)
- Full-screen timeout state when the daily limit is reached
- Simple error state when the backend cannot be found

## Screenshots

<p align="center">
  <img src="screenshots/screenshot-1.png" width="400" alt="TV Time Remaining">
  <img src="screenshots/screenshot-2.png" width="400" alt="Limit Reached">
</p>

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

1. **Install dependencies**:

```bash
npm install
```

2. **Configure environment**: Create a `.env` file in the root directory:

```text
ROKU_DEV_TARGET=192.168.0.52
ROKU_DEV_USERNAME=rokudev
ROKU_DEV_PASSWORD=rokudev
ROKU_DEV_INSTALL_PORT=80
BACKEND_URL=http://192.168.0.141:3000/
```

`BACKEND_URL` is baked into the generated Roku package at build time. If it is omitted, the app falls back to local network discovery.

3. **Build the package**:

```bash
npm run build
```

The package is written to `dist/apps/tv-time-roku.zip`.

Clean generated output:

```bash
npm run clean
```

## Deploy

Ensure **Developer Mode** is enabled on your Roku. If you have configured your `.env` file as described in the Setup section, you can deploy with a single command:

```bash
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
