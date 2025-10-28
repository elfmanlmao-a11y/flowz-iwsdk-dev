import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { World } from '@iwsdk/core';

export interface PlayerData {
  name: string;  // Serves as unique ID
  x: number;
  y: number;
  z: number;
  velocity: { x: number; y: number; z: number } | string;  // Support string format from GMod
}

interface DataResponse {
  players: PlayerData[];
}

interface PlayerVisualizerConfig {
  dataUrl: string;
  useMock?: boolean;
  scaleFactor: number;
  offset: THREE.Vector3;
  rotation: THREE.Euler;
  updateInterval: number;
  playerRadius: number;
  playerColor: number;
  debugMode?: boolean;
  boundingBox?: THREE.Box3;  // Pre-defined bounds in world space; if omitted, auto-computed from cityMesh
  showBounds?: boolean;      // Render wireframe box for debugging
  boundsExpansion?: number;  // Scalar to inflate computed bounds (default: 1.0)
}

export class PlayerVisualizer {
  private world: World;
  private cityMesh: THREE.Group;
  private playerEntities: Map<string, { entity: any; mesh: THREE.Mesh }> = new Map();
  private updateTimer?: number;
  private config: PlayerVisualizerConfig;
  private loader: GLTFLoader;
  private cityBounds?: THREE.Box3;
  private boundsEntity?: any;  // For debug visualization

  constructor(world: World, cityMesh: THREE.Group, config: Partial<PlayerVisualizerConfig> = {}) {
    this.world = world;
    this.cityMesh = cityMesh;
    this.loader = new GLTFLoader();
    this.config = {
      dataUrl: config.dataUrl || 'https://flowz-iwsdk-dev.onrender.com/data',
      useMock: config.useMock ?? false,
      scaleFactor: config.scaleFactor ?? 0.01904,  // Adjusted: 1 HU to meters (city scale applied via parent)
      offset: config.offset ?? new THREE.Vector3(0, 0, 0),
      rotation: config.rotation ?? new THREE.Euler(0, Math.PI / 2, 0),
      updateInterval: config.updateInterval ?? 100,
      playerRadius: config.playerRadius ?? 0.00005,
      playerColor: config.playerColor ?? 0xff0000,
      debugMode: config.debugMode ?? false,
      boundingBox: config.boundingBox,
      showBounds: config.showBounds ?? false,
      boundsExpansion: (config.boundsExpansion ?? 1.0) as number,
    };

    // Compute or use provided bounds (in world space)
    this.cityBounds = config.boundingBox || new THREE.Box3().setFromObject(this.cityMesh);

    // Apply expansion after initial computation
    if (!config.boundingBox && this.config.boundsExpansion !== 1.0) {
      this.cityBounds.expandByScalar(this.config.boundsExpansion!);
      console.log(`Bounds expanded by factor ${this.config.boundsExpansion}.`);
    }

    // Debug logging (now after expansion to reflect correct state)
    if (this.config.debugMode) {
      this.logCityBounds();
    }

    // Optional: Render bounds as wireframe cube for debugging (using final expanded bounds)
    if (this.config.showBounds) {
      this.renderBoundsDebug();
    }

    this.startPolling();
  }

  /**
   * Logs current city model bounds for calibration (no re-computation).
   */
  private logCityBounds(): void {
    if (!this.cityBounds) return;
    const center = this.cityBounds.getCenter(new THREE.Vector3());
    const size = this.cityBounds.getSize(new THREE.Vector3());
    console.log(`City bounds - Center: [${center.toArray().join(', ')}], Size: [${size.toArray().join(', ')}]`);
  }

  /**
   * Renders a wireframe bounding box for visual debugging.
   */
  private renderBoundsDebug(): void {
    if (!this.cityBounds) return;
    const size = this.cityBounds.getSize(new THREE.Vector3());
    const center = this.cityBounds.getCenter(new THREE.Vector3());
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
    const boxMesh = new THREE.Mesh(geometry, material);
    boxMesh.position.copy(center);
    this.boundsEntity = this.world.createTransformEntity(boxMesh);
    this.cityMesh.add(this.boundsEntity.object3D);
    console.log('Debug bounding box rendered (green wireframe).');
  }

  /**
   * Maps GMod coordinates to Three.js space (scale, offset, rotate).
   */
  private mapCoordinates(gmodPos: THREE.Vector3): THREE.Vector3 {
    const mapped = gmodPos.clone().multiplyScalar(this.config.scaleFactor);
    mapped.add(this.config.offset);
    mapped.applyEuler(this.config.rotation);
    return mapped;
  }

  private getMockData(): PlayerData[] {
    return [
      {
        name: 'TestPlayer1',  // Reference point 1 (tower spire)
        x: 1983.8521728515625,
        y: -9436.94140625,
        z: 2688.650634765625,
        velocity: { x: 0, y: 0, z: 0 }
      },
      {
        name: 'TestPlayer2',  // Reference point 2 (sewage plant)
        x: 9215.21484375,
        y: 9232.8564453125,
        z: -11263.96875,
        velocity: { x: 0, y: 0, z: 0 }
      }
    ];
  }

  private async fetchData(): Promise<PlayerData[] | null> {
    if (this.config.useMock) {
      return this.getMockData();
    }

    try {
      const response = await fetch(this.config.dataUrl, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: DataResponse = await response.json();
      if (data.players && data.players.length > 0) {
        console.log(`Fetched ${data.players.length} players.`);
        return data.players;
      } else {
        console.warn('No players in response; possible error:', data);
        return [];
      }
    } catch (error) {
      console.error('Player data fetch error:', error);
      return [];
    }
  }

  private async updatePlayers(): Promise<void> {
    const players = await this.fetchData();
    if (!players || players.length === 0) return;

    // Enhanced cleanup: Remove all previous entities from map and scene
    this.playerEntities.forEach(({ entity, mesh }) => {
      if (entity.object3D) {
        this.cityMesh.remove(entity.object3D);
        if (entity.destroy) {
          entity.destroy();
        }
      }
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    });
    this.playerEntities.clear();

    players.forEach((player) => {
      console.log('Raw player data:', JSON.stringify(player, null, 2));

      // Parse velocity if it's a string
      let velObj = player.velocity;
      if (typeof player.velocity === 'string') {
        const velMatch = player.velocity.match(/\[([\d.-]+) ([\d.-]+) ([\d.-]+)\]/);
        if (velMatch) {
          velObj = {
            x: parseFloat(velMatch[1]),
            y: parseFloat(velMatch[2]),
            z: parseFloat(velMatch[3])
          };
          console.log('Parsed velocity from string:', velObj);
        } else {
          console.warn('Invalid velocity string format:', player.velocity);
          velObj = { x: 0, y: 0, z: 0 };
        }
      }

      const gmodPos = new THREE.Vector3(player.x, player.y, player.z);
      const worldPos = this.mapCoordinates(gmodPos);

      // Constrain to bounding box (check in world space)
      const tempPos = worldPos.clone().applyMatrix4(this.cityMesh.matrixWorld);
      if (!this.cityBounds || !this.cityBounds.containsPoint(tempPos)) {
        const boundsInfo = this.cityBounds ? `[${this.cityBounds.min.toArray().join(', ')} to ${this.cityBounds.max.toArray().join(', ')}]` : '(bounds not computed)';
        console.warn(`Player ${player.name} at local [${worldPos.toArray().join(', ')}] world [${tempPos.toArray().join(', ')}] is outside city bounds ${boundsInfo}; skipping render.`);
        return;  // Skip rendering
      }

      // Create and add entity (only if in bounds)
      const geometry = new THREE.SphereGeometry(this.config.playerRadius);
      const material = new THREE.MeshBasicMaterial({ color: this.config.playerColor });
      const sphereMesh = new THREE.Mesh(geometry, material);

      const playerEntity = this.world.createTransformEntity(sphereMesh);
      if (playerEntity.object3D) {
        playerEntity.object3D.position.copy(worldPos);
        this.cityMesh.add(playerEntity.object3D);
      } else {
        console.warn(`Failed to create object3D for player ${player.name}`);
        geometry.dispose();
        material.dispose();
        return;
      }

      this.playerEntities.set(player.name, { entity: playerEntity, mesh: sphereMesh });

      // Velocity and speed
      const vel = velObj as { x: number; y: number; z: number };
      const speed = Math.sqrt(
        (isNaN(vel.x) ? 0 : vel.x) ** 2 +
        (isNaN(vel.y) ? 0 : vel.y) ** 2 +
        (isNaN(vel.z) ? 0 : vel.z) ** 2
      );
      console.log(`Positioned ${player.name} at [${worldPos.toArray().join(', ')}]; speed: ${speed.toFixed(2)}`);
      material.color.setHSL((speed / 100) % 1, 1, 0.5);

      // Placeholder label
      const labelGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.1);
      const labelMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
      labelMesh.position.set(0, this.config.playerRadius + 0.2, 0);
      sphereMesh.add(labelMesh);
    });
  }

  private startPolling(): void {
    this.updatePlayers();
    this.updateTimer = window.setInterval(() => this.updatePlayers(), this.config.updateInterval);
  }

  destroy(): void {
    if (this.updateTimer !== undefined) {
      window.clearInterval(this.updateTimer);
    }
    this.playerEntities.forEach(({ entity, mesh }) => {
      if (entity.object3D) {
        this.cityMesh.remove(entity.object3D);
        if (entity.destroy) {
          entity.destroy();
        }
      }
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    });
    this.playerEntities.clear();
    // Cleanup debug bounds
    if (this.boundsEntity) {
      if (this.boundsEntity.object3D) {
        this.cityMesh.remove(this.boundsEntity.object3D);
      }
      if (this.boundsEntity.destroy) {
        this.boundsEntity.destroy();
      }
    }
  }
}