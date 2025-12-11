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

## Development status & next steps

Current codebase snapshot
- Client: `src/` contains the IWSDK app, `src/Visualizer/PlayerVisualizer.ts` handles in-scene player entities, and `src/index.ts` is the main app + UI scaffolding. The repository includes map assets (BigCity, Summoner's Rift) and helper systems (billboarding, trails, labels).
- Server: `server/server.js` is a small Express relay used for Garry's Mod player data and has been extended in development to accept replay uploads and to proxy Riot API requests.

What we attempted (and what failed)
- Riot Spectator API integration: I implemented a client and a server-side proxy so the Riot API key remains secret and requests can be proxied from the client. Testing revealed persistent 403 responses from Riot due to API key expiration/permission issues and regional routing complexities. Live spectating via Riot's spectator endpoints was not completed. Spectator v5 calls will return 403 or 404 in many cases.
- Match v5 approach: I added code to query match history and match details and UI to select a match to visualize. This path is preferable to live spectating for replaying past matches, but it relies on Developer Riot API credentials and regional routing (americas/europe/asia mapping), which also need verification and a valid key.
- Replay parsing: Initially tested a simple client-side ASCII substring extraction to detect player names from `.rofl` files — this is unreliable. Parsing League replay files properly requires a dedicated parser (open-source options exist such as `pyLoL` or `LeagueReplayParser`).

Current pivot and plan
- Pivot: focus on a reliable replay-based workflow where users upload a `.rofl` file and the server runs a proper parser to produce structured JSON that the client will visualize. This avoids live spectator fragility and keeps replay parsing server-side where proper tools and Python/C# runtimes can be installed.

Short-term next steps (practical)
1. Implement server-side replay parser integration
	- Install a parser (recommended: `pyLoL` for Python or `LeagueReplayParser` for C#) on the server or build container image that includes it.
	- Provide a small wrapper script (e.g. `parse_replay.py`) that accepts a replay file path and writes JSON to stdout. Set `REPLAY_PARSER_CMD` to that command on the server.
2. Add/complete the client upload UI
	- Upload `.rofl` (<= ~100KB) to `server/upload/rolf` as base64 or multipart form-data; server runs parser and returns structured JSON suitable for `PlayerVisualizer.updateFromSpectatorPlayers()`.
3. Rotate Riot API key and secure it
	- Generate a new Riot API key in the Riot Developer Portal and set it in Render as `RIOT_API_KEY`. Redeploy the server and verify `/riot/ping` and other proxy routes respond.
4. Validate visualization flow locally
	- Upload a sample `.rofl` via the UI; confirm parsed JSON, map placements, and player spawning on Summoner's Rift.
5. Improve UX and safety
	- Add UI to edit parsed name list before spawning, show parser logs, and add tests and sample replays to `tests/`.

- Replay parsers may require additional native dependencies; follow the parser's installation guide and prefer running them on the server-side build/deploy pipeline rather than in-browser.


— End of update
