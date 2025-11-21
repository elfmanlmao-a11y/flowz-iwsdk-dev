// ─────────────────────────────────────────────────────────────────────────────
// playerVisualizer.ts – COMPACT, FULLY COMMENTED
// Visualises Garry’s-Mod (EMM) players in a 3-D city scene inside a VR/MR world.
// Uses real-time data from an Express server (or mock data) and renders:
//   • Player spheres (colored by speed)
//   • Optional 3-D text / sprite labels
//   • World-space ribbon trails
//   • Debug bounding box (optional)
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import type { World } from '@iwsdk/core';

// Extend THREE to recognise the runtime Font class (loaded from JSON)
declare module 'three' { export class Font { constructor(data: any); data: any; } }

// ── Data contracts ───────────────────────────────────────────────────────────
export interface PlayerData {
  name: string;                     // Player identifier
  x: number; y: number; z: number; // Raw GMod coordinates
  velocity: { x: number; y: number; z: number } | string; // Speed vector (or string format)
}
interface DataResponse { players: PlayerData[]; }

// ── Optional configuration (all values have sensible defaults) ───────────────
interface PlayerVisualizerConfig {
  dataUrl?: string;          // Endpoint that returns PlayerData[]
  useMock?: boolean;         // Use hard-coded mock data for offline testing
  updateInterval?: number;   // ms between server polls
  playerRadius?: number;     // Radius of the player sphere
  playerColor?: number;      // Base colour (overridden by speed hue)
  debugMode?: boolean;       // Enable console logs
  boundingBox?: THREE.Box3;  // Optional explicit bounds for culling
  showBounds?: boolean;      // Render a wireframe debug box
  labelHeight?: number;      // Vertical offset for name labels
  labelFontSize?: number;    // Size of 3-D text (also scales sprite canvas)
  labelColor?: number;       // Colour of the name label
  trailEnabled?: boolean;    // Show movement ribbon
  trailLength?: number;      // Max points kept in the trail
  trailOpacity?: number;     // 0-1 transparency of the ribbon
  trailWidth?: number;       // Tube radius of the trail
}

// ── Main visualiser class ─────────────────────────────────────────────────────
export class PlayerVisualizer {
  // Core references
  private world: World;                     // IWSDK world (camera, entity system)
  private cityMesh: THREE.Group;            // Parent group that holds the city model

  // Player tracking
  private players = new Map<string, {       // One entry per active player
    entity: any;                            // IWSDK transform entity (holds sphere)
    mesh: THREE.Mesh;                       // The visible sphere
    label?: THREE.Mesh | THREE.Sprite;      // 3-D text or fallback sprite
    trail?: THREE.Mesh;                     // Ribbon tube (world-space)
    points: THREE.Vector3[];                // Trail position buffer
  }>();
  private lastPos = new Map<string, THREE.Vector3>(); // Previous frame position (for trail)

  // Lifecycle
  private timer?: number;                   // setInterval ID for polling
  private frameId?: number;                 // requestAnimationFrame ID for billboarding

  // Configuration (required fields are filled with defaults)
  private config: Required<PlayerVisualizerConfig>;

  // Font handling
  private font: THREE.Font | null = null;   // Loaded Helvetiker font (or null → sprite)

  // Debug bounds
  private bounds?: THREE.Box3;              // Calculated or supplied culling volume
  private boundsEnt?: any;                  // Debug wireframe entity

  // ── Coordinate transform (GMod → Three.js world) ───────────────────────
  // Cached once to avoid allocating a new Matrix3 on every frame.
  private readonly transform = {
    matrix: new THREE.Matrix3().set(
      0.00646297824, -0.000079977569, 0.000127492645,
      0.00000378432681, 0.0000487270525, 0.00630588861,
      0.000169270224, -0.00659015663, 0.000106918946
    ),
    offset: new THREE.Vector3(0.73352882, 68.92531057, 8.32454724)
  };

  // ── Constructor – initialise everything ─────────────────────────────────
  constructor(world: World, cityMesh: THREE.Group, cfg: Partial<PlayerVisualizerConfig> = {}) {
    this.world = world;
    this.cityMesh = cityMesh;

    // Merge user config with defaults
    this.config = {
      dataUrl: cfg.dataUrl ?? 'https://flowz-iwsdk-dev.onrender.com/data',
      useMock: cfg.useMock ?? false,
      updateInterval: cfg.updateInterval ?? 100,
      playerRadius: cfg.playerRadius ?? 1,
      playerColor: cfg.playerColor ?? 0xff0000,
      debugMode: cfg.debugMode ?? false,
      boundingBox: cfg.boundingBox,
      showBounds: cfg.showBounds ?? false,
      labelHeight: cfg.labelHeight ?? 5,
      labelFontSize: cfg.labelFontSize ?? 5,
      labelColor: cfg.labelColor ?? 0x00ff00,
      trailEnabled: cfg.trailEnabled ?? true,
      trailLength: cfg.trailLength ?? 40,
      trailOpacity: cfg.trailOpacity ?? 0.9,
      trailWidth: cfg.trailWidth ?? 0.4,
    };

    // Determine culling bounds (explicit or auto from city mesh)
    this.bounds = this.config.boundingBox
      ? this.config.boundingBox.clone().expandByScalar(2)
      : new THREE.Box3().setFromObject(cityMesh);

    if (this.config.debugMode) this.logBounds();
    if (this.config.showBounds) this.showBounds();

    this.loadFont();          // Async – will use sprite fallback if it fails
    this.startPolling();      // Begin fetching player data
    this.startBillboard();    // Keep labels facing the camera each frame
  }

  // ── Debug helpers ───────────────────────────────────────────────────────
  private logBounds() {
    if (!this.bounds) return;
    const c = this.bounds.getCenter(new THREE.Vector3());
    const s = this.bounds.getSize(new THREE.Vector3());
    console.log(`Bounds – center: [${c.toArray()}] size: [${s.toArray()}]`);
  }

  private showBounds() {
    if (!this.bounds) return;
    const size = this.bounds.getSize(new THREE.Vector3());
    const center = this.bounds.getCenter(new THREE.Vector3());
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
    );
    box.position.copy(center);
    this.boundsEnt = this.world.createTransformEntity(box);
    this.cityMesh.add(this.boundsEnt.object3D);
  }

  // ── Font loading (async) ───────────────────────────────────────────────
  private async loadFont() {
    try {
      this.font = await new FontLoader().loadAsync(
        'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json'
      );
      if (this.config.debugMode) console.log('Font loaded');
    } catch (e) {
      console.error('Font failed → using sprite fallback', e);
      this.font = null;
    }
  }

  // ── Coordinate conversion (GMod → scene space) ───────────────────────
  private map(pos: THREE.Vector3): THREE.Vector3 {
    return pos.clone().applyMatrix3(this.transform.matrix).add(this.transform.offset);
  }

  // ── Mock data for offline development ─────────────────────────────────
  private getMock(): PlayerData[] {
    return [
      { name: 'P1', x: 1983.85, y: -9436.94, z: 2688.65, velocity: { x: 50, y: 0, z: 30 } },
      { name: 'P2', x: 9215.21, y: 9232.86, z: -11263.97, velocity: { x: -20, y: 40, z: 0 } },
    ];
  }

  // ── Fetch player data from server (or mock) ───────────────────────────
  private async fetch(): Promise<PlayerData[]> {
    if (this.config.useMock) return this.getMock();
    try {
      const res = await fetch(this.config.dataUrl, { mode: 'cors' });
      if (!res.ok) throw res.status;
      const { players }: DataResponse = await res.json();
      return players ?? [];
    } catch {
      return []; // Silent fail – next poll will retry
    }
  }

  // ── Main update loop – called every `updateInterval` ms ───────────────
  private async updatePlayers() {
    const players = await this.fetch();
    if (!players.length) return;

    const seen = new Set<string>(); // Track players seen this frame

    // ── Process each incoming player ───────────────────────────────────
    for (const p of players) {
      seen.add(p.name);

      // Parse velocity if it arrives as a string like "[12.3 0 -5.1]"
      const vel = typeof p.velocity === 'string'
        ? p.velocity.match(/\[([\d.-]+) ([\d.-]+) ([\d.-]+)\]/)
          ? { x: +RegExp.$1, y: +RegExp.$2, z: +RegExp.$3 }
          : { x: 0, y: 0, z: 0 }
        : p.velocity;

      const worldPos = this.map(new THREE.Vector3(p.x, p.y, p.z));

      // Cull players outside the city bounds (optional performance win)
      if (this.bounds && !this.bounds.containsPoint(worldPos)) continue;

      const speed = Math.hypot(vel.x, vel.y, vel.z);
      const color = new THREE.Color().setHSL((speed / 100) % 1, 1, 0.5);

      // ── Get or create player entry ───────────────────────────────────
      let entry = this.players.get(p.name);
      if (!entry) {
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(this.config.playerRadius),
          new THREE.MeshBasicMaterial({ color: this.config.playerColor })
        );
        const entity = this.world.createTransformEntity(sphere);
        if (!entity.object3D) continue; // Safety – entity creation can fail
        this.cityMesh.add(entity.object3D);

        entry = { entity, mesh: sphere, points: [] };
        this.players.set(p.name, entry);
        this.addLabel(entry, p.name);
      }

      // Update position & colour
      entry.entity.object3D.position.copy(worldPos);
      (entry.mesh.material as THREE.MeshBasicMaterial).color.copy(color);

      // ── Trail handling (world-space ribbon) ───────────────────────
      const prev = this.lastPos.get(p.name);
      const cur = worldPos.clone();

      if (prev && entry.points.length === 0) entry.points.push(prev.clone());
      entry.points.push(cur);
      if (entry.points.length > this.config.trailLength) entry.points.shift();
      this.lastPos.set(p.name, cur);

      if (this.config.trailEnabled && entry.points.length > 1) {
        const curve = new THREE.CatmullRomCurve3(entry.points);
        const geom = new THREE.TubeGeometry(curve, 40, this.config.trailWidth, 8, false);
        const mat = new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: this.config.trailOpacity, side: THREE.DoubleSide
        });

        if (entry.trail) {
          entry.trail.geometry.dispose();
          entry.trail.geometry = geom;
          (entry.trail.material as THREE.MeshBasicMaterial).color.copy(color);
        } else {
          const line = new THREE.Mesh(geom, mat);
          this.cityMesh.add(line);
          entry.trail = line;
        }
      }
    }

    // ── Remove players that vanished from the server ───────────────────
    for (const [name] of this.players) {
      if (!seen.has(name)) this.remove(name);
    }
  }

  // ── Label creation (3-D text if font loaded, otherwise canvas sprite) ───
  private addLabel(entry: any, name: string) {
    const h = this.config.labelHeight + this.config.playerRadius;

    if (this.font) {
      // 3-D text path
      const geom = new TextGeometry(name, {
        font: this.font,
        size: this.config.labelFontSize,
        depth: 0.5,
        bevelEnabled: false
      });
      geom.computeBoundingBox();
      const w = geom.boundingBox!.max.x - geom.boundingBox!.min.x;
      const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: this.config.labelColor }));
      mesh.position.set(-w / 2, h, 0);
      entry.mesh.add(mesh);
      entry.label = mesh;
    } else {
      // Canvas sprite fallback
      const fs = this.config.labelFontSize * 8;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      ctx.font = `bold ${fs}px Arial`;
      const tw = ctx.measureText(name).width;
      canvas.width = tw + 20; canvas.height = fs + 20;
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = `#${this.config.labelColor.toString(16).padStart(6, '0')}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name, canvas.width / 2, canvas.height / 2);

      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) })
      );
      sprite.scale.set(canvas.width / 10, canvas.height / 10, 1);
      sprite.position.y = h + 10;
      entry.mesh.add(sprite);
      entry.label = sprite;
    }
  }

  // ── Perfect billboard: Horizontal-only, NO DRIFT, locked to player ───────
private startBillboard() {
  const update = () => {
    const camPos = new THREE.Vector3();
    this.world.camera.getWorldPosition(camPos);

    this.players.forEach(({ entity, label }) => {
      if (!label) return;
      entity.object3D.updateWorldMatrix(false, true);
      const anchor = new THREE.Vector3();
      entity.object3D.getWorldPosition(anchor);
      const yaw = Math.atan2(camPos.x - anchor.x, camPos.z - anchor.z);
      entity.object3D.setRotationFromAxisAngle(new THREE.Vector3(0,1,0), yaw);
      label.rotation.set(0,0,0);
      if (label instanceof THREE.Sprite) {
        (label.material as THREE.SpriteMaterial).rotation = 0;
      }
    });
    this.frameId = requestAnimationFrame(update);
  };
  update();
}

  // ── Clean-up a single player (dispose geometries, remove from scene) ───
  private remove(name: string) {
    const e = this.players.get(name);
    if (!e) return;

    const { entity, mesh, label, trail } = e;

    // Remove IWSDK entity
    if (entity.object3D) {
      this.cityMesh.remove(entity.object3D);
      entity.destroy?.();
    }

    // Dispose sphere
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();

    // Dispose label (mesh or sprite)
    if (label instanceof THREE.Mesh) {
      label.geometry.dispose();
      (label.material as THREE.Material).dispose();
    } else if (label) {
      label.material.map?.dispose();
      label.material.dispose();
    }

    // Dispose trail ribbon
    if (trail) {
      this.cityMesh.remove(trail);
      trail.geometry.dispose();
      (trail.material as THREE.Material).dispose();
    }

    this.players.delete(name);
    this.lastPos.delete(name);
  }

  // ── Start periodic data polling ───────────────────────────────────────
  private startPolling() {
    this.updatePlayers(); // Immediate first fetch
    this.timer = window.setInterval(() => this.updatePlayers(), this.config.updateInterval);
  }

  // ── Public destroy – stop everything and free resources ───────────────
  destroy() {
    clearInterval(this.timer);
    if (this.frameId) cancelAnimationFrame(this.frameId);

    this.players.forEach((_, n) => this.remove(n));
    this.players.clear();
    this.lastPos.clear();

    if (this.boundsEnt?.object3D) {
      this.cityMesh.remove(this.boundsEnt.object3D);
      this.boundsEnt.destroy?.();
    }
  }
}