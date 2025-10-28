// playerVisualizer.ts
import { World, Mesh, MeshBasicMaterial, SphereGeometry } from "@iwsdk/core";
import * as THREE from 'three'; // Required for Object3D, Euler, and Quaternion

interface PlayerData {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation?: { yaw: number; pitch: number; roll: number };
}

interface ApiResponse {
  players: PlayerData[];
}

export class PlayerVisualizer {
  private world: World;
  private cityParent: THREE.Object3D; // Parent mesh for relative positioning
  private playerEntities = new Map<string, any>(); // Inferred entity type from createTransformEntity
  private pollInterval?: number; // Use number for browser setInterval

  constructor(world: World, cityParent: THREE.Object3D) {
    this.world = world;
    this.cityParent = cityParent;
    this.startPolling();
  }

  private async fetchAndUpdatePlayers(): Promise<void> {
    try {
      const response = await fetch('https://flowz-odll.onrender.com/data');
      if (!response.ok) {
        console.warn('API fetch failed:', response.status);
        return;
      }
      const data: ApiResponse = await response.json();

      const currentIds = new Set(data.players.map(p => p.id));

      // Remove stale players
      for (const [id, entity] of this.playerEntities.entries()) {
        if (!currentIds.has(id)) {
          entity.dispose(); // Assumes ECS entity dispose method
          this.playerEntities.delete(id);
        }
      }

      // Update or create players
      for (const player of data.players) {
        let entity = this.playerEntities.get(player.id);
        if (!entity) {
          // Create new player entity (simple sphere; extend with GLTF if needed)
          const geometry = new SphereGeometry(0.5, 16, 16); // Scaled for visibility
          const material = new MeshBasicMaterial({ color: 0xff0000 }); // Red marker
          const mesh = new Mesh(geometry, material);
          entity = this.world.createTransformEntity(mesh);
          entity.object3D!.position.set(0, 0, 0); // Initial relative to parent
          entity.object3D!.parent = this.cityParent; // Attach to city for world-relative coords
          this.playerEntities.set(player.id, entity);

          // Optional: Add metadata or label component
          (entity as any).userData = { name: player.name };
        }

        // Update position (scale GMod units to match city scale: e.g., divide by 39.37 for meters)
        const scaledPos = {
          x: player.position.x / 39.37,
          y: player.position.y / 39.37,
          z: player.position.z / 39.37,
        };
        entity.object3D!.position.set(scaledPos.x, scaledPos.y, scaledPos.z);

        // Update rotation if available (convert to Quaternion)
        if (player.rotation) {
          const quat = new THREE.Quaternion();
          quat.setFromEuler(
            new THREE.Euler(
              player.rotation.pitch * (Math.PI / 180),
              player.rotation.yaw * (Math.PI / 180),
              player.rotation.roll * (Math.PI / 180)
            )
          );
          entity.object3D!.quaternion.copy(quat);
        }
      }

      console.log(`Updated ${data.players.length} players`);
    } catch (error) {
      console.error('Error in player update:', error);
    }
  }

  private startPolling(): void {
    // Poll every 200ms; adjust for performance
    this.pollInterval = setInterval(() => this.fetchAndUpdatePlayers(), 200);
    // Initial fetch
    this.fetchAndUpdatePlayers();
  }

  dispose(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    for (const entity of this.playerEntities.values()) {
      entity.dispose();
    }
    this.playerEntities.clear();
  }
}