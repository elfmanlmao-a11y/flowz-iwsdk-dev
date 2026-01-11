const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(cors());
// GMod http.Post usually sends data as form-urlencoded
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(bodyParser.json());

// ---------- Live Player State ----------
// Stores latest data: Key = "PlayerName", Value = { x, y, z, ... }
const players = new Map();

// ---------- POST: Receive Live Data (GMod -> Server) ----------
app.post("/", (req, res) => {
  try {
    // 1. GMod sends data wrapped in a "data" form field
    const rawData = req.body.data;
    
    if (!rawData) {
      return res.status(400).json({ error: 'Missing "data" field' });
    }

    // 2. Parse the JSON string contained in that field
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(rawData);
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON in data field" });
    }

    // 3. Handle GMod Batch Mode ({ players: [...] })
    if (parsedPayload.players && Array.isArray(parsedPayload.players)) {
      parsedPayload.players.forEach((p) => {
        if (p.name) {
          players.set(p.name, {
            ...p,
            t: Date.now(), // Timestamp for staleness checks
          });
        }
      });
    } 
    // 4. Handle Legacy Single Mode (Fallback)
    else if (parsedPayload.name) {
      players.set(parsedPayload.name, {
        ...parsedPayload,
        t: Date.now(),
      });
    }

    res.status(200).json({ status: "ok", count: players.size });
  } catch (err) {
    console.error("POST / error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- GET: Serve Live Data (Server -> IWSDK App) ----------
app.get("/data", (req, res) => {
  // Optional: Filter out stale players (e.g., no update in 5 seconds)
  const now = Date.now();
  const activePlayers = [];

  players.forEach((data, name) => {
    // 5000ms timeout for stale data
    if (now - data.t < 5000) { 
      activePlayers.push(data);
    } else {
      // Cleanup old players so they disappear from the table
      players.delete(name); 
    }
  });

  res.json({
    players: activePlayers
  });
});

// ---------- Health Check ----------
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    activePlayers: players.size
  });
});

// ---------- Start Server ----------
app.listen(PORT, () => {
  console.log(`Bridge Server running on port ${PORT}`);
});
