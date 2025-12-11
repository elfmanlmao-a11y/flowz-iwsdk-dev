const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all origins (adjust for production security)
app.use(bodyParser.urlencoded({ extended: true })); // Parse form-encoded bodies
app.use(bodyParser.json()); // Parse JSON bodies (fallback)

// In-memory storage for players (Map: name -> player data)
const players = new Map();

// POST / - Receive player data from Garry's Mod
app.post('/', (req, res) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing "data" field in request body' });
    }

    // Parse the JSON string from the form-encoded 'data'
    const playerData = JSON.parse(data);
    if (!playerData.name || typeof playerData.x !== 'number' || typeof playerData.y !== 'number' || typeof playerData.z !== 'number' || !playerData.velocity) {
      return res.status(400).json({ error: 'Invalid player data structure' });
    }

    // Store or update player
    players.set(playerData.name, {
      name: playerData.name,
      x: playerData.x,
      y: playerData.y,
      z: playerData.z,
      velocity: playerData.velocity // Assumes { x, y, z } object
    });

    console.log(`Updated player: ${playerData.name} at (${playerData.x}, ${playerData.y}, ${playerData.z})`);
    res.status(200).json({ status: 'success', message: 'Player data received' });
  } catch (error) {
    console.error('POST / error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /data - Aggregate and return all players
app.get('/data', (req, res) => {
  try {
    const playerArray = Array.from(players.values());
    res.status(200).json({ players: playerArray });
    console.log(`Served ${playerArray.length} players via /data`);
  } catch (error) {
    console.error('GET /data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper: map platform to Riot host
function platformToHost(platform) {
  if (!platform) return 'na1.api.riotgames.com';
  return `${platform.toLowerCase()}.api.riotgames.com`;
}

// Riot proxy endpoints - keep API key server-side (set RIOT_API_KEY in env)
app.get('/riot/summonerByName', async (req, res) => {
  try {
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'RIOT_API_KEY not configured on server' });

    const { platform = 'NA1', summonerName } = req.query;
    if (!summonerName) return res.status(400).json({ error: 'Missing summonerName query parameter' });

    const host = platformToHost(platform);
    const url = `https://${host}/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`;
    const r = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });
    const body = await r.text();
    res.status(r.status).type('application/json').send(body);
  } catch (err) {
    console.error('/riot/summonerByName error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/riot/activeGame', async (req, res) => {
  try {
    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'RIOT_API_KEY not configured on server' });

    const { platform = 'NA1', summonerId, summonerName } = req.query;
    if (!summonerId && !summonerName) return res.status(400).json({ error: 'Provide summonerId or summonerName' });

    const host = platformToHost(platform);
    let targetId = summonerId;

    // If summonerName supplied, resolve it first
    if (!targetId && summonerName) {
      const urlName = `https://${host}/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`;
      const rName = await fetch(urlName, { headers: { 'X-Riot-Token': apiKey } });
      if (!rName.ok) {
        const t = await rName.text();
        return res.status(rName.status).type('application/json').send(t);
      }
      const nameBody = await rName.json();
      targetId = nameBody.id;
    }

    const url = `https://${host}/lol/spectator/v4/active-games/by-summoner/${encodeURIComponent(targetId)}`;
    const r = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });
    const body = await r.text();
    res.status(r.status).type('application/json').send(body);
  } catch (err) {
    console.error('/riot/activeGame error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', players: players.size });
});

// Start server
app.listen(PORT, () => {
  console.log(`Player data relay server running on port ${PORT}`);
  console.log(`POST player data to /`);
  console.log(`GET aggregated data from /data`);
});