const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ---------- Replay Storage ----------
const REPLAY_DIR = path.join(__dirname, "replays");
if (!fs.existsSync(REPLAY_DIR)) {
  fs.mkdirSync(REPLAY_DIR);
}

// ---------- Live Player State ----------
const players = new Map();

// ---------- Replay State ----------
let isRecording = false;
let currentReplay = null;

// ---------- Helpers ----------
function startRecording() {
  currentReplay = {
    id: Date.now().toString(),
    startedAt: Date.now(),
    frames: []
  };
  isRecording = true;
  console.log("[REPLAY] Recording started:", currentReplay.id);
}

function stopRecording() {
  if (!isRecording || !currentReplay) return;

  currentReplay.endedAt = Date.now();
  const filePath = path.join(
    REPLAY_DIR,
    `replay_${currentReplay.id}.json`
  );

  fs.writeFileSync(filePath, JSON.stringify(currentReplay, null, 2));
  console.log("[REPLAY] Recording saved:", filePath);

  isRecording = false;
  currentReplay = null;
}

// ---------- POST: Receive Live Player Data ----------
app.post("/", (req, res) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing "data"' });
    }

    const playerData = JSON.parse(data);

    // Validate required fields
    if (
      typeof playerData.name !== "string" ||
      typeof playerData.x !== "number" ||
      typeof playerData.y !== "number" ||
      typeof playerData.z !== "number"
    ) {
      return res.status(400).json({ error: "Invalid player data structure" });
    }

    // Update live state
    players.set(playerData.name, {
      ...playerData,
      t: Date.now()
    });

    // Record frame if recording
    if (isRecording && currentReplay) {
      currentReplay.frames.push({
        t: Date.now(),
        ...playerData
      });
    }

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("POST / error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- GET: Live Player Data ----------
app.get("/data", (req, res) => {
  res.json({
    players: Array.from(players.values())
  });
});

// ---------- REPLAY CONTROL ----------

// Start recording
app.post("/replay/start", (req, res) => {
  if (isRecording) {
    return res.status(400).json({ error: "Already recording" });
  }
  startRecording();
  res.json({ status: "recording_started" });
});

// Stop recording
app.post("/replay/stop", (req, res) => {
  if (!isRecording) {
    return res.status(400).json({ error: "Not recording" });
  }
  stopRecording();
  res.json({ status: "recording_stopped" });
});

// List replays
app.get("/replay/list", (req, res) => {
  const files = fs.readdirSync(REPLAY_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      const content = JSON.parse(
        fs.readFileSync(path.join(REPLAY_DIR, f))
      );
      return {
        id: content.id,
        startedAt: content.startedAt,
        endedAt: content.endedAt,
        frameCount: content.frames.length
      };
    });

  res.json(files);
});

// Load replay
app.get("/replay/:id", (req, res) => {
  const filePath = path.join(REPLAY_DIR, `replay_${req.params.id}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Replay not found" });
  }

  const replay = JSON.parse(fs.readFileSync(filePath));
  res.json(replay);
});

// ---------- Health ----------
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    recording: isRecording,
    livePlayers: players.size
  });
});

// ---------- Start Server ----------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
