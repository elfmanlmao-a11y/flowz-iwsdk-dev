import {
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
  Vector3,
  World,
  Object3D
} from "@iwsdk/core";

// Interface for the Garry's Mod player data
interface PlayerData {
  steamID: string;
  name: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  vel_len: number;
  vel_dir: number;
  angles: { pitch: number; yaw: number; roll: number };
}

// Class to represent each player
// Helper class to manage coordinate mapping
class CityCoordinateSystem {
  private cityBounds: {
    min: Vector3;
    max: Vector3;
    size: Vector3;
  };
  private cityScale: number;
  private cityOffset: Vector3;

  constructor(cityMesh: Object3D) {
    // Get the city's bounding box
    this.cityBounds = this.calculateBounds(cityMesh);
    this.cityScale = cityMesh.scale.x; // Assuming uniform scale
    this.cityOffset = new Vector3().copy(cityMesh.position);
  }

  private calculateBounds(cityMesh: Object3D) {
    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);

    // Traverse all meshes in the city model
    cityMesh.traverse((object: any) => {
      if (object.geometry) {
        object.geometry.computeBoundingBox();
        const box = object.geometry.boundingBox;
        min.min(box.min);
        max.max(box.max);
      }
    });

    return {
      min,
      max,
      size: new Vector3().subVectors(max, min)
    };
  }

  // Map Garry's Mod coordinates to city-relative coordinates
  mapPosition(gmPos: { x: number; y: number; z: number }) {
    // Normalize Garry's Mod coordinates to 0-1 range based on known map bounds
    // Assuming Garry's Mod coordinates typically range from -16384 to 16384
    const GMD_MAP_SIZE = 32768; // Total size of a typical Garry's Mod map
    
    const normalizedX = (gmPos.x + GMD_MAP_SIZE/2) / GMD_MAP_SIZE;
    const normalizedY = (gmPos.y + GMD_MAP_SIZE/2) / GMD_MAP_SIZE;
    const normalizedZ = gmPos.z / 1024; // Height typically ranges from -1024 to 1024

    // Map to city bounds
    return new Vector3(
      this.cityBounds.min.x + normalizedX * this.cityBounds.size.x,
      this.cityBounds.min.y + normalizedZ * this.cityBounds.size.y,
      this.cityBounds.min.z + normalizedY * this.cityBounds.size.z
    ).multiplyScalar(this.cityScale).add(this.cityOffset);
  }
}

class PlayerMarker {
  private mesh: Mesh;
  private currentPosition: Vector3;
  private object: Object3D;
  private coordinateSystem: CityCoordinateSystem;
  
  constructor(parent: Object3D, playerName: string, coordinateSystem: CityCoordinateSystem) {
    // Create a larger, more visible player model
    const geometry = new BoxGeometry(0.1, 0.2, 0.1); // Increased size
    const material = new MeshBasicMaterial({ 
      color: 0xff0000,  // Bright red
      transparent: true,
      opacity: 0.8
    });
    this.mesh = new Mesh(geometry, material);
    
    this.currentPosition = new Vector3();
    this.object = new Object3D();
    this.object.add(this.mesh);
    parent.add(this.object);
    
    this.coordinateSystem = coordinateSystem;
    console.log(`Created player marker for ${playerName}`); // Debug log
  }

  // Update player position and rotation
  update(data: PlayerData) {
    console.log('Updating player position:', data.position); // Debug log raw position
    
    // Map Garry's Mod position to city coordinates
    const cityPos = this.coordinateSystem.mapPosition(data.position);
    console.log('Mapped city position:', cityPos); // Debug log mapped position
    
    this.object.position.copy(cityPos);
    console.log('Final object position:', this.object.position); // Debug log final position

    // Update rotation based on player's view angles
    this.object.rotation.set(
      data.angles.pitch * Math.PI / 180,
      -data.angles.yaw * Math.PI / 180, // Negative to match coordinate systems
      0
    );
  }

  destroy() {
    this.object.parent?.remove(this.object);
  }
}

// System to manage all player markers
export class PlayerVisualizer {
  private players: Map<string, PlayerMarker> = new Map();
  private world: World;
  private cityRoot: Object3D;
  private pollInterval: number | null = null;
  private coordinateSystem: CityCoordinateSystem;
  
  constructor(world: World, cityRoot: Object3D) {
    this.world = world;
    this.cityRoot = cityRoot;
    this.coordinateSystem = new CityCoordinateSystem(cityRoot);
    this.startPolling();
  }

  private async fetchPlayerData() {
    try {
      console.log('Fetching player data from local server...');
      
      const response = await fetch('http://localhost:3000/data', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received player data:', data);
      
      // Handle the data format from your Lua script
      const playerData = Array.isArray(data) ? data : [data];
      console.log('Processing players:', playerData.length);
      this.updatePlayers(playerData);
    } catch (error) {
      console.error('Error fetching player data:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.log('Network error - trying to connect via CORS proxy');
      } else if (error instanceof Error) {
        console.log('Error details:', error.message);
      } else {
        console.log('Unknown error occurred');
      }
    }
  }

  private startPolling() {
    // Poll every 100ms to match Garry's Mod update rate
    this.pollInterval = window.setInterval(() => this.fetchPlayerData(), 100);
  }

  private updatePlayers(playerDataList: PlayerData[]) {
    // Update existing players and create new ones
    playerDataList.forEach(playerData => {
      let player = this.players.get(playerData.steamID);
      
      if (!player) {
        // Create new player marker if doesn't exist
        player = new PlayerMarker(this.cityRoot, playerData.name, this.coordinateSystem);
        this.players.set(playerData.steamID, player);
      }
      
      // Update position and rotation
      player.update(playerData);
    });

    // Remove disconnected players
    const currentIds = new Set(playerDataList.map(p => p.steamID));
    this.players.forEach((player, id) => {
      if (!currentIds.has(id)) {
        player.destroy();
        this.players.delete(id);
      }
    });
  }

  // Cleanup when system is destroyed
  destroy() {
    if (this.pollInterval !== null) {
      window.clearInterval(this.pollInterval);
    }
    this.players.forEach(player => player.destroy());
    this.players.clear();
  }
}