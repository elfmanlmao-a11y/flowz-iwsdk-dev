// Import libraries for 3D graphics and loading models
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { World } from '@iwsdk/core';

// Define what player data looks like
export interface PlayerData {
  name: string; // Unique player name
  x: number; // Position on X axis
  y: number; // Position on Y axis
  z: number; // Position on Z axis
  velocity: { x: number; y: number; z: number } | string; // Speed, can be object or string
}

// Response format from data source
interface DataResponse {
  players: PlayerData[];
}

// Settings for the player visualizer
interface PlayerVisualizerConfig {
  dataUrl: string; // URL for real player data
  useMock?: boolean; // Use test data?
  scaleFactor: number; // How to scale positions
  offset: THREE.Vector3; // Shift positions
  rotation: THREE.Euler; // Rotate positions
  updateInterval: number; // How often to check for updates (in ms)
  playerRadius: number; // Size of player markers
  playerColor: number; // Color of markers (hex code)
  debugMode?: boolean; // Show extra logs?
  boundingBox?: THREE.Box3; // Area to keep players inside
  showBounds?: boolean; // Draw boundary box?
  boundsExpansion?: number; // Make boundary bigger?
}

// Class to show players in the 3D scene
export class PlayerVisualizer {
  private world: World; // The VR world
  private cityMesh: THREE.Group; // The city model
  private playerEntities: Map<string, { entity: any; mesh: THREE.Mesh }> = new Map(); // Track player objects
  private updateTimer?: number; // Timer for updates
  private config: PlayerVisualizerConfig; // Settings
  private loader: GLTFLoader; // For loading models (not used yet)
  private cityBounds?: THREE.Box3; // Area limits
  private boundsEntity?: any; // Debug boundary object

  // Set up the visualizer
  constructor(world: World, cityMesh: THREE.Group, config: Partial<PlayerVisualizerConfig> = {}) {
    this.world = world;
    this.cityMesh = cityMesh;
    this.loader = new GLTFLoader(); // Ready for future model loading

    // Use default settings if not provided
    this.config = {
      dataUrl: config.dataUrl || 'https://flowz-iwsdk-dev.onrender.com/data',
      useMock: config.useMock ?? false,
      scaleFactor: config.scaleFactor ?? 0.01904, // Default scale (Hammer Units to meters)
      offset: config.offset ?? new THREE.Vector3(0, 0, 0),
      rotation: config.rotation ?? new THREE.Euler(0, Math.PI / 2, 0), // Default 90 degree rotation (in radians)
      updateInterval: config.updateInterval ?? 100, // Update every 100ms
      playerRadius: config.playerRadius ?? 0.00005, // Small size by default
      playerColor: config.playerColor ?? 0xff0000, // Red by default
      debugMode: config.debugMode ?? false,
      boundingBox: config.boundingBox,
      showBounds: config.showBounds ?? false,
      boundsExpansion: config.boundsExpansion ?? 1.0,
    };

    // Set up area limits (bounds)
    this.cityBounds = this.config.boundingBox || new THREE.Box3().setFromObject(this.cityMesh);

    // Make bounds bigger if needed
    if (!this.config.boundingBox && this.config.boundsExpansion !== undefined && this.config.boundsExpansion !== 1.0) {
      this.cityBounds.expandByScalar(this.config.boundsExpansion!);
      console.log(`Bounds expanded by ${this.config.boundsExpansion}.`);
    }

    // Log bounds for debugging if enabled
    if (this.config.debugMode) {
      this.logCityBounds();
    }

    // Draw boundary box if enabled
    if (this.config.showBounds) {
      this.renderBoundsDebug();
    }

    // Start checking for player updates
    this.startPolling();
  }

  // Log the area limits (for setup help)
  private logCityBounds(): void {
    if (!this.cityBounds) return;
    const center = this.cityBounds.getCenter(new THREE.Vector3());
    const size = this.cityBounds.getSize(new THREE.Vector3());
    console.log(`City area center: [${center.toArray().join(', ')}], Size: [${size.toArray().join(', ')}]`);
  }

  // Draw a wireframe box to show the area limits
  private renderBoundsDebug(): void {
    if (!this.cityBounds) return;
    const size = this.cityBounds.getSize(new THREE.Vector3());
    const center = this.cityBounds.getCenter(new THREE.Vector3());
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true }); // Green lines
    const boxMesh = new THREE.Mesh(geometry, material);
    boxMesh.position.copy(center);
    this.boundsEntity = this.world.createTransformEntity(boxMesh);
    this.cityMesh.add(this.boundsEntity.object3D);
    console.log('Debug boundary box shown (green lines).');
  }

  // Convert GMod positions to 3D scene positions (scale, shift, rotate)
  private mapCoordinates(gmodPos: THREE.Vector3): THREE.Vector3 {
    const mapped = gmodPos.clone().multiplyScalar(this.config.scaleFactor);
    mapped.add(this.config.offset);
    mapped.applyEuler(this.config.rotation);
    return mapped;
  }

  // Fake test data for setup
  private getMockData(): PlayerData[] {
    return [
      { name: 'TestPlayer1', x: 1983.8521728515625, y: -9436.94140625, z: 2688.650634765625, velocity: { x: 0, y: 0, z: 0 } },
      { name: 'TestPlayer2', x: 9215.21484375, y: 9232.8564453125, z: -11263.96875, velocity: { x: 0, y: 0, z: 0 } },
    ];
  }

  // Get player data (test or real)
  private async fetchData(): Promise<PlayerData[] | null> {
    if (this.config.useMock) {
      return this.getMockData();
    }

    try {
      const response = await fetch(this.config.dataUrl, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const data: DataResponse = await response.json();
      if (data.players?.length > 0) {
        console.log(`Got ${data.players.length} players.`);
        return data.players;
      } else {
        console.warn('No players found.');
        return [];
      }
    } catch (error) {
      console.error('Data fetch failed:', error);
      return [];
    }
  }

  // Update players in the scene
  private async updatePlayers(): Promise<void> {
    const players = await this.fetchData();
    if (!players || players.length === 0) return;

    // Remove old players
    this.playerEntities.forEach(({ entity, mesh }) => {
      if (entity.object3D) {
        this.cityMesh.remove(entity.object3D);
        entity.destroy?.();
      }
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material?.dispose();
      }
    });
    this.playerEntities.clear();

    // Add new players
    players.forEach((player) => {
      console.log('Player data:', JSON.stringify(player, null, 2));

      // Parse speed if it's a string
      let velocity = player.velocity;
      if (typeof velocity === 'string') {
        const match = velocity.match(/\[([\d.-]+) ([\d.-]+) ([\d.-]+)\]/);
        if (match) {
          velocity = { x: parseFloat(match[1]), y: parseFloat(match[2]), z: parseFloat(match[3]) };
          console.log('Parsed speed:', velocity);
        } else {
          console.warn('Bad speed format:', velocity);
          velocity = { x: 0, y: 0, z: 0 };
        }
      }

      // Map position to scene
      const gmodPos = new THREE.Vector3(player.x, player.y, player.z);
      const scenePos = this.mapCoordinates(gmodPos);

      // Skip if outside area
      if (!this.cityBounds || !this.cityBounds.containsPoint(scenePos)) {
        const info = this.cityBounds ? `[${this.cityBounds.min.toArray().join(', ')} to ${this.cityBounds.max.toArray().join(', ')}]` : '(no bounds)';
        console.warn(`Player ${player.name} at [${scenePos.toArray().join(', ')}] outside area ${info}; skipping.`);
        return;
      }

      // Create player marker (a sphere)
      const geometry = new THREE.SphereGeometry(this.config.playerRadius);
      const material = new THREE.MeshBasicMaterial({ color: this.config.playerColor });
      const sphereMesh = new THREE.Mesh(geometry, material);

      // Add to scene
      const playerEntity = this.world.createTransformEntity(sphereMesh);
      if (playerEntity.object3D) {
        playerEntity.object3D.position.copy(scenePos);
        this.cityMesh.add(playerEntity.object3D);
      } else {
        console.warn(`Could not add player ${player.name}`);
        geometry.dispose();
        material.dispose();
        return;
      }

      this.playerEntities.set(player.name, { entity: playerEntity, mesh: sphereMesh });

      // Calculate speed and color based on it
      const vel = velocity as { x: number; y: number; z: number };
      const speed = Math.sqrt(
        (isNaN(vel.x) ? 0 : vel.x) ** 2 +
        (isNaN(vel.y) ? 0 : vel.y) ** 2 +
        (isNaN(vel.z) ? 0 : vel.z) ** 2
      );
      console.log(`Placed ${player.name} at [${scenePos.toArray().join(', ')}]; speed: ${speed.toFixed(2)}`);
      material.color.setHSL((speed / 100) % 1, 1, 0.5); // Change color by speed

      // Add a label box above the player (big for testing)
      const labelGeometry = new THREE.BoxGeometry(50, 10, 10);
      const labelMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green
      const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
      labelMesh.position.set(0, this.config.playerRadius + 20, 0); // Above the sphere
      sphereMesh.add(labelMesh);
    });
  }

  // Start regular updates
  private startPolling(): void {
    this.updatePlayers();
    this.updateTimer = window.setInterval(() => this.updatePlayers(), this.config.updateInterval);
  }

  // Clean up everything
  destroy(): void {
    if (this.updateTimer !== undefined) {
      window.clearInterval(this.updateTimer);
    }
    this.playerEntities.forEach(({ entity, mesh }) => {
      if (entity.object3D) {
        this.cityMesh.remove(entity.object3D);
        entity.destroy?.();
      }
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material?.dispose();
      }
    });
    this.playerEntities.clear();

    // Remove debug boundary
    if (this.boundsEntity) {
      if (this.boundsEntity.object3D) {
        this.cityMesh.remove(this.boundsEntity.object3D);
      }
      this.boundsEntity.destroy?.();
    }
  }
}