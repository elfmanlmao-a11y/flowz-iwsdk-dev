// Import necessary libraries and components
import * as THREE from 'three'; // For 3D math like positions and rotations

// Core SDK imports for building the VR world
import {
  AssetManifest,
  AssetType,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SessionMode,
  SRGBColorSpace,
  AssetManager,
  World,
} from "@iwsdk/core";

// Additional SDK components for interactions and audio
import {
  AudioSource,
  DistanceGrabbable,
  MovementMode,
  Interactable,
  PanelUI,
  PlaybackMode,
  ScreenSpace,
} from "@iwsdk/core";

// Environment and locomotion components
import { EnvironmentType, LocomotionEnvironment } from "@iwsdk/core";

// Custom systems and visualizers
import { PanelSystem } from "./panel.js";
import { Robot, RobotSystem } from "./robot.js";
import { PlayerVisualizer } from "./playerVisualizer";

// Define the assets to load (like sounds, textures, and 3D models)
// MODIFIED: Added summonersRift asset
const assets: AssetManifest = {
  chimeSound: { url: "/audio/chime.mp3", type: AssetType.Audio, priority: "background" },
  webxr: { url: "/textures/webxr.png", type: AssetType.Texture, priority: "critical" },
  environmentDesk: { url: "/gltf/environmentDesk/environmentDesk.gltf", type: AssetType.GLTF, priority: "critical" },
  plantSansevieria: { url: "/gltf/plantSansevieria/plantSansevieria.gltf", type: AssetType.GLTF, priority: "critical" },
  bigCity: { url: "/gltf/BigCity/BigcityV1.glb", type: AssetType.GLTF, priority: "critical" },
  // NEW: Summoner's Rift map asset (adjust URL if file path differs)
  summonersRift: { url: "/gltf/SummonersRift/SUMMONERSRIFT.glb", type: AssetType.GLTF, priority: "critical" },
  robot: { url: "/gltf/robot/robot.gltf", type: AssetType.GLTF, priority: "critical" },
};

// NEW: Define map configurations (meshes, positions, scales, and bounding boxes)
interface MapConfig {
  meshKey: string;
  position: THREE.Vector3;
  scale: number;
  boundingBox: THREE.Box3;
}

const mapConfigs: Record<string, MapConfig> = {
  bigCity: {
    meshKey: 'bigCity',
    position: new THREE.Vector3(0, 0.9, -2),
    scale: 0.01,
    boundingBox: new THREE.Box3(
      new THREE.Vector3(-85, -2, -75),
      new THREE.Vector3(85, 100, 95)
    ),
  },
  summonersRift: {
    meshKey: 'summonersRift',
    position: new THREE.Vector3(0, -2.3, -2), // Same position as BigCity; adjust if needed
    scale: 0.2, // Adjust scale based on Summoner's Rift model dimensions
    boundingBox: new THREE.Box3(
      new THREE.Vector3(-15, 17.3, -15), // Sample bounds; measure your GLTF for accuracy (e.g., Summoner's Rift is ~10k x 10k units)
      new THREE.Vector3(15, 19, 15)
    ),
  },
};

let currentMap: string = 'bigCity'; // NEW: Track active map
let currentVisualizer: PlayerVisualizer | null = null; // NEW: Track visualizer for toggling

// Create the VR world and set it up
World.create(document.getElementById("scene-container") as HTMLDivElement, {
  assets,
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: "always",
    features: { handTracking: true, layers: true }, // Enable hand tracking and layers
  },
  features: {
    locomotion: { useWorker: true }, // Smooth movement
    grabbing: true, // Allow grabbing objects
    physics: false, // No physics simulation
    sceneUnderstanding: false, // No AI scene analysis
  },
}).then((world) => {
  // Set up the camera (user's viewpoint)
  const { camera } = world;
  camera.position.set(-4, 1.5, -6); // Position the camera
  camera.rotateY(-Math.PI * 0.75); // Rotate it slightly

  // Add the desk environment
  const { scene: deskMesh } = AssetManager.getGLTF("environmentDesk")!;
  deskMesh.rotateY(Math.PI); // Rotate to face correctly
  deskMesh.position.set(0, -0.1, 0); // Place it on the floor
  world.createTransformEntity(deskMesh)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC }); // Make it walkable

  // NEW: Load and prepare both map meshes
  const bigCityMesh = AssetManager.getGLTF("bigCity")!.scene;
  const summonersRiftMesh = AssetManager.getGLTF("summonersRift")!.scene;

  // Apply initial transforms to BigCity (hidden for Summoner's Rift)
  bigCityMesh.position.copy(mapConfigs.bigCity.position);
  bigCityMesh.scale.setScalar(mapConfigs.bigCity.scale);
  bigCityMesh.updateMatrix();
  bigCityMesh.updateMatrixWorld(true);
  const bigCityEntity = world.createTransformEntity(bigCityMesh)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget });

  // Apply transforms to Summoner's Rift (initially hidden)
  summonersRiftMesh.position.copy(mapConfigs.summonersRift.position);
  summonersRiftMesh.scale.setScalar(mapConfigs.summonersRift.scale);
  summonersRiftMesh.updateMatrix();
  summonersRiftMesh.updateMatrixWorld(true);
  const summonersRiftEntity = world.createTransformEntity(summonersRiftMesh)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget });
  summonersRiftMesh.visible = false; // NEW: Hide initially

  // MODIFIED: Initialize PlayerVisualizer with initial map config
  const initialConfig = mapConfigs.bigCity;
  currentVisualizer = new PlayerVisualizer(world, bigCityMesh, {
    useMock: false,
    dataUrl: 'https://flowz-iwsdk-dev.onrender.com/data',
    playerRadius: 2,
    debugMode: true,
    showBounds: true,
    boundingBox: initialConfig.boundingBox,
  });

  // NEW: Toggle function for switching maps
  const toggleMap = () => {
    const nextMap = currentMap === 'bigCity' ? 'summonersRift' : 'bigCity';
    const nextConfig = mapConfigs[nextMap];
    const nextMesh = nextMap === 'bigCity' ? bigCityMesh : summonersRiftMesh;

    // Swap visibility
    bigCityMesh.visible = nextMap === 'bigCity';
    summonersRiftMesh.visible = nextMap === 'summonersRift';

    // Destroy and recreate visualizer
    if (currentVisualizer) {
      currentVisualizer.destroy();
    }
    currentVisualizer = new PlayerVisualizer(world, nextMesh, {
      useMock: false,
      dataUrl: 'https://flowz-iwsdk-dev.onrender.com/data',
      playerRadius: 2,
      debugMode: true,
      showBounds: true,
      boundingBox: nextConfig.boundingBox,
    });

    currentMap = nextMap;
    console.log(`Switched to ${nextMap} map`); // Debug log
  };

  // NEW: Keyboard toggle (press 'M' for Map)
  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'm') {
      toggleMap();
    }
  });

  // OPTIONAL: VR-friendly toggle via PanelUI (uncomment to enable)
  /*
  const panelEntity = world
    .createTransformEntity()
    .addComponent(PanelUI, { 
      config: "/ui/mapToggle.json", // Create this JSON with a button that calls toggleMap()
      maxHeight: 0.5, 
      maxWidth: 1.0 
    })
    .addComponent(Interactable)
    .addComponent(ScreenSpace, { top: "20px", left: "20px", height: "30%" });
  panelEntity.object3D!.position.set(0, 1.5, -2);
  */

  // Add a plant model
  const { scene: plantMesh } = AssetManager.getGLTF("plantSansevieria")!;
  plantMesh.position.set(1.2, 0.85, -1.8); // Place it on the desk
  world.createTransformEntity(plantMesh)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget });

  // Add a robot model
  const { scene: robotMesh } = AssetManager.getGLTF("robot")!;
  robotMesh.position.set(-1.2, 0.95, -1.8); // Place it on the desk
  robotMesh.scale.setScalar(0.5); // Make it half size
  world.createTransformEntity(robotMesh)
    .addComponent(Interactable)
    .addComponent(Robot) // Custom robot behavior
    .addComponent(AudioSource, {
      src: "/audio/chime.mp3", // Sound file
      maxInstances: 3, // Up to 3 sounds at once
      playbackMode: PlaybackMode.FadeRestart, // Fade when restarting
    });

  // Add a logo banner
  const webxrLogoTexture = AssetManager.getTexture("webxr")!;
  webxrLogoTexture.colorSpace = SRGBColorSpace; // Correct color display
  const logoBanner = new Mesh(
    new PlaneGeometry(3.39, 0.96), // Flat rectangle
    new MeshBasicMaterial({ map: webxrLogoTexture, transparent: true }) // With texture
  );
  world.createTransformEntity(logoBanner);
  logoBanner.position.set(0, 1, 1.8); // Place it in view
  logoBanner.rotateY(Math.PI); // Flip it around

  // Start custom systems
  world.registerSystem(PanelSystem).registerSystem(RobotSystem);

  // Clean up when page closes
  window.addEventListener('beforeunload', () => {
    if (currentVisualizer) {
      currentVisualizer.destroy(); // Stop player updates
    }
  });
});