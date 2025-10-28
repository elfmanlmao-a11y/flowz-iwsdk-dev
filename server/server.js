import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Enable CORS for local development
app.use(cors({
  origin: process.env.CLIENT_URL,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept']
}));

// Sample player data for testing
let players = [
  {
    steamID: "STEAM_0:1:123456",
    name: "TestPlayer1",
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    vel_len: 0,
    vel_dir: 0,
    angles: { pitch: 0, yaw: 0, roll: 0 }
  }
];

// Endpoint to get player data
app.get('/data', (req, res) => {
  res.json(players);
});

// Endpoint to update player data (useful for testing)
app.use(express.urlencoded({ extended: true }));

app.post('/data', (req, res) => {
  try {
    const jsonData = req.body.data;
    const playerData = JSON.parse(jsonData);
    players = [playerData];
    console.log('Received player data:', playerData);
    res.json({ success: true, message: 'Data received successfully' });
  } catch (error) {
    console.error('Error processing player data:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Accepting requests from ${process.env.CLIENT_URL}`);
});