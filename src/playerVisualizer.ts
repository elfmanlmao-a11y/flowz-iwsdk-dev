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
}

export class PlayerVisualizer {
  private world: World;
  private cityMesh: THREE.Group;
  private playerEntities: Map<string, { entity: any; mesh: THREE.Mesh }> = new Map();  // ECS Entity + mesh
  private updateTimer?: number;
  private config: PlayerVisualizerConfig;
  private loader: GLTFLoader;  // Retained for potential extensions

  constructor(world: World, cityMesh: THREE.Group, config: Partial<PlayerVisualizerConfig> = {}) {
    this.world = world;
    this.cityMesh = cityMesh;
    this.loader = new GLTFLoader();
    this.config = {
      dataUrl: config.dataUrl || 'https://flowz-odll.onrender.com/data',
      useMock: config.useMock ?? false,
      scaleFactor: config.scaleFactor ?? 0.01,  // Hammer units to meters
      offset: config.offset ?? new THREE.Vector3(0, 0, 0),  // Tuned below for landmark
      rotation: config.rotation ?? new THREE.Euler(0, Math.PI / 2, 0),  // Align Z-up (GMod) to Y-up (Three.js)
      updateInterval: config.updateInterval ?? 100,  // Match Lua's 0.1s frequency
      playerRadius: config.playerRadius ?? 0.005,  // Reduced for proportionality to city scale (0.01)
      playerColor: config.playerColor ?? 0xff0000,  // Red
    };

    this.startPolling();
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
    // Simulated data for testing
    return [
      {
        name: 'TestPlayer1',
        x: 0,
        y: 0,
        z: 0,
        velocity: { x: 10, y: 0, z: 5 }
      },
      {
        name: 'TestPlayer2',
        x: 1000,
        y: 500,
        z: 200,
        velocity: { x: 0, y: 20, z: 0 }
      }
    ];
  }

  private async fetchData(): Promise<PlayerData[] | null> {
    if (this.config.useMock) {
      return this.getMockData();
    }

    try {
      const response = await fetch(this.config.dataUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: DataResponse = await response.json();
      if (data.players && data.players.length > 0) {
        console.log(`Fetched ${data.players.length} players.`);
        return data.players;
      } else {
        console.warn('No players in response; possible error:', data);
        return null;
      }
    } catch (error) {
      console.error('Player data fetch error:', error);
      return null;
    }
  }

  private async updatePlayers(): Promise<void> {
    const players = await this.fetchData();
    if (!players || players.length === 0) return;

    // Clear old player entities
    this.playerEntities.forEach(({ entity, mesh }) => {
      if (entity.object3D) {
        this.cityMesh.remove(entity.object3D);
      }
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.dispose();
      }
    });
    this.playerEntities.clear();

    players.forEach((player) => {
      // Enhanced logging for debugging
      console.log('Raw player data:', JSON.stringify(player, null, 2));

      // Parse velocity if it's a string (GMod format: "[x y z]")
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
          velObj = { x: 0, y: 0, z: 0 };  // Fallback
        }
      }

      const gmodPos = new THREE.Vector3(player.x, player.y, player.z);
      const worldPos = this.mapCoordinates(gmodPos);

      // Create sphere mesh
      const geometry = new THREE.SphereGeometry(this.config.playerRadius);
      const material = new THREE.MeshBasicMaterial({ color: this.config.playerColor });
      const sphereMesh = new THREE.Mesh(geometry, material);

      // Create ECS TransformEntity and parent to cityMesh
      const playerEntity = this.world.createTransformEntity(sphereMesh);
      if (playerEntity.object3D) {
        playerEntity.object3D.position.copy(worldPos);
        this.cityMesh.add(playerEntity.object3D);
      } else {
        console.warn(`Failed to create object3D for player ${player.name}`);
        geometry.dispose();
        material.dispose();
        return;  // Skip this player
      }

      // Store for cleanup
      this.playerEntities.set(player.name, { entity: playerEntity, mesh: sphereMesh });

      // Robust velocity handling and visualization
      const vel = velObj as { x: number; y: number; z: number };
      const speed = Math.sqrt(
        (isNaN(vel.x) ? 0 : vel.x) ** 2 +
        (isNaN(vel.y) ? 0 : vel.y) ** 2 +
        (isNaN(vel.z) ? 0 : vel.z) ** 2
      );
      console.log(`Positioned ${player.name} at [${worldPos.toArray().join(', ')}]; speed: ${speed.toFixed(2)}`);
      material.color.setHSL((speed / 100) % 1, 1, 0.5);  // Hue based on speed

      // Placeholder label (extend with THREE.FontLoader for text)
      const labelGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.1);
      const labelMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
      labelMesh.position.set(0, this.config.playerRadius + 0.2, 0);
      sphereMesh.add(labelMesh);
    });
  }

  private startPolling(): void {
    // Initial update
    this.updatePlayers();
    // Poll interval
    this.updateTimer = window.setInterval(() => this.updatePlayers(), this.config.updateInterval);
  }

  destroy(): void {
    if (this.updateTimer !== undefined) {
      window.clearInterval(this.updateTimer);
    }
    this.playerEntities.forEach(({ entity, mesh }) => {
      if (entity.object3D) {
        this.cityMesh.remove(entity.object3D);
      }
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.dispose();
      }
    });
    this.playerEntities.clear();
  }
}