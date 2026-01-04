# Flowz – Immersive World Streaming SDK (Prototype)
Experimental WebXR prototype exploring spatial spectating via live game telemetry.

Flowz is an experimental **immersive world streaming SDK** that transforms **live game telemetry** into a **spatial, holographic viewing experience** using Web technologies.

Instead of watching gameplay through a flat video stream, Flowz reconstructs the live game state in **3D space**, allowing viewers to observe matches, players, and maps as **anchored holograms** in VR, AR, or desktop browsers.

This repository contains an **early MVP prototype** demonstrating the concept using **Garry's Mod**.

---

## What This Prototype Demonstrates

This project proves that:

* Live game telemetry (position, rotation, velocity) can be extracted from a running game
* That data can be streamed in real time via WebSockets
* A web-based immersive client can reconstruct the game world spatially
* Player movement in the source game maps 1:1 to a holographic representation
* Spectators can observe gameplay **from any angle**, at any scale

This is **not a replay system** — it is a **live spatial mirror** of an active game session.

---

## Core Idea

> Game data becomes more meaningful when experienced spatially rather than through flat video.

Flowz explores an alternative to traditional livestreaming by treating a game world as **data first**, visuals second.
The immersive client is decoupled from the game engine and driven entirely by streamed state.

---

## Current Scope (Intentional Limitations)

This prototype is intentionally narrow in scope:

* Supports **one game**
* Supports **one map** (`gm_bigcity`)
* Streams **one or more live players**
* No UI polish
* No social features
* No replay indexing or discovery layer

The goal is **clarity of concept**, not feature completeness.

---

## Architecture Overview

**1. Game-side telemetry script**

* Runs inside the Garry’s Mod client or server
* Collects per-player:

  * Position (XYZ)
  * Rotation (roll / pitch / yaw)
  * Velocity
* Sends updates over a WebSocket connection

**2. WebSocket relay**

* Transmits live world state data
* Designed to be game-agnostic

**3. Immersive Web Client**

* Connects to the WebSocket
* Parses incoming telemetry
* Renders a 3D representation of the map
* Updates player entities in real time

The immersive client has **no direct dependency on the source game engine**.

---

## Why This Matters

Traditional game spectating is limited by:

* Fixed camera perspectives
* Compression artifacts
* Lack of spatial context

Flowz enables:

* Free-form observation
* True spatial understanding of movement and positioning
* New ways to analyze performance, routes, and tactics
* Viewing experiences designed specifically for VR / AR / Mixed Reality

---

## Intended Future Direction (Conceptual)

This prototype is a foundation for a broader vision:

* Multi-game telemetry adapters
* Replay and timeline scrubbing
* Competitive esports visualization
* Track, arena, and map holograms anchored to real-world surfaces
* WebXR-first immersive viewing experiences

These features are **out of scope for this repository**.

---

## Status

* Experimental
* Early-stage MVP
* Actively used to explore immersive spectator design

This repository should be evaluated as:

> a proof of concept for **spatial game state streaming**, not a finished product.

---

## Disclaimer

This project is not affiliated with or endorsed by Facepunch Studios or Garry’s Mod.
All assets and references are used for experimental and educational purposes.

---
