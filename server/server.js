const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ---------- State ----------
const players = new Map(); // Live state
let isRecording = false;
let currentReplayBuffer = [];
let savedReplays = []; // In-Memory Storage (Clears on restart)

// ---------- Control Endpoints ----------

// 1. Start Recording
app.post("/record/start", (req, res) => {
  if (isRecording) return res.status(400).json({ error: "Already recording" });
  
  isRecording = true;
  currentReplayBuffer = []; // Reset buffer
  console.log("[REC] Started");
  res.json({ status: "recording_started" });
});

// 2. Stop Recording
app.post("/record/stop", (req, res) => {
  if (!isRecording) return res.status(400).json({ error: "Not recording" });

  isRecording = false;
  const id = `replay_${Date.now()}`;
  
  if (currentReplayBuffer.length > 0) {
    savedReplays.push({
      id: id,
      timestamp: Date.now(),
      frames: currentReplayBuffer,
      duration: currentReplayBuffer.length * 100 // Approx duration
    });
    console.log(`[REC] Stopped. Saved ${id} (${currentReplayBuffer.length} frames)`);
  }

  res.json({ status: "recording_stopped", id: id });
});

// 3. List Replays
app.get("/replays", (req, res) => {
  // Send metadata only (not full frames) to save bandwidth
  const meta = savedReplays.map(r => ({
    id: r.id,
    timestamp: r.timestamp,
    frameCount: r.frames.length
  }));
  res.json(meta);
});

// 4. Load Specific Replay
app.get("/replays/:id", (req, res) => {
  const replay = savedReplays.find(r => r.id === req.params.id);
  if (!replay) return res.status(404).json({ error: "Replay not found" });
  res.json(replay.frames);
});

// ---------- Main Data Bridge (GMod -> Server) ----------
app.post("/", (req, res) => {
  try {
    // GMod sends data wrapped in a "data" form field
    const rawData = req.body.data;
    if (!rawData) return res.status(400).json({ error: 'Missing "data"' });

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(rawData);
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const now = Date.now();

    // A. Update Live Map
    if (parsedPayload.players && Array.isArray(parsedPayload.players)) {
      parsedPayload.players.forEach((p) => {
        if (p.name) players.set(p.name, { ...p, t: now });
      });
    } else if (parsedPayload.name) {
      // Legacy single-player fallback
      players.set(parsedPayload.name, { ...parsedPayload, t: now });
    }

    // B. VCR Recording
    if (isRecording) {
      // Store the raw list of players for this frame
      currentReplayBuffer.push({
        t: now,
        players: parsedPayload.players || [parsedPayload]
      });
    }

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("POST / error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- Live Data Poll (App -> Server) ----------
app.get("/data", (req, res) => {
  const now = Date.now();
  const activePlayers = [];

  players.forEach((data, name) => {
    // 5-second timeout for stale players
    if (now - data.t < 5000) {
      activePlayers.push(data);
    } else {
      players.delete(name);
    }
  });

  res.json({ players: activePlayers });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
