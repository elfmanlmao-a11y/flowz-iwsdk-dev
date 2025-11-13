# Flowz IWSDK Development

A VR visualization tool that displays Garry's Mod player positions in a 3D city environment using Meta's Immersive Web SDK.

## Project Structure

- `/src` - IWSDK TypeScript source code
- `/server` - Express.js server for player data relay
- `/gmod` - Garry's Mod Lua scripts
- `/public` - Static assets (3D models, textures, etc.)

## Prerequisites

- Node.js >= 20.19.0
- Garry's Mod
- Meta Quest headset (or other VR device)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure Garry's Mod:
- Copy `gmod/Flows_ClientTracker.lua` to `garrysmod/lua/autorun/client/`
- Add the following to `garrysmod/cfg/http.cfg`:
```
127.0.0.1:3000
localhost:3000
```

3. Start the development server:
```bash
# Terminal 1 - Data relay server
npm run server

# Terminal 2 - IWSDK development server
npm run dev
```

4. Open Garry's Mod and connect to a game

5. Open https://localhost:8082 in your browser

## Development

- `npm run dev` - Start IWSDK development server
- `npm run server` - Start data relay server
- `npm run build` - Build for production

## Controls

In Garry's Mod:
- Type `!flows_toggle` in chat to enable/disable tracking
- Set `developer 1` in console to see debug messages

https://drive.google.com/file/d/1TJZ-u0SG3AsUgJIfn2viOdYPzllJggFT/view?usp=drive_link Summoners rift
https://drive.google.com/file/d/1_ElBnk0GyKlKhpNgkcJlqu9cxGTW5lCU/view?usp=drive_link BigCity

## License

MIT
