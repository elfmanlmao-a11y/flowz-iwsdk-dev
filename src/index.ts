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
const assets: AssetManifest = {
  chimeSound: { url: "/audio/chime.mp3", type: AssetType.Audio, priority: "background" },
  webxr: { url: "/textures/webxr.png", type: AssetType.Texture, priority: "critical" },
  environmentDesk: { url: "/gltf/environmentDesk/environmentDesk.gltf", type: AssetType.GLTF, priority: "critical" },
  plantSansevieria: { url: "/gltf/plantSansevieria/plantSansevieria.gltf", type: AssetType.GLTF, priority: "critical" },
  bigCity: { url: "/gltf/BigCity/BigcityV1.glb", type: AssetType.GLTF, priority: "critical" },
  robot: { url: "/gltf/robot/robot.gltf", type: AssetType.GLTF, priority: "critical" },
};

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

  // Add the big city model
  const { scene: cityMesh } = AssetManager.getGLTF("bigCity")!;
  cityMesh.position.set(0, 0.9, -2); // Place it on the desk
  cityMesh.scale.setScalar(0.01); // Make it small to fit
  cityMesh.updateMatrix(); // Update its position and scale
  cityMesh.updateMatrixWorld(true); // Update for the whole scene
  world.createTransformEntity(cityMesh)
    .addComponent(Interactable) // Allow interactions
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget }); // Allow grabbing from afar

  // Set up player visualizer (shows players in the city)
  const playerVisualizer = new PlayerVisualizer(world, cityMesh, {
    useMock: false, // Use test data for setup
    dataUrl: 'https://flowz-iwsdk-dev.onrender.com/data', // Real data source
    playerRadius: 2, // Size of player markers (big for testing)
    debugMode: true, // Show debug info
    showBounds: true, // Show boundary box
    boundingBox: new THREE.Box3(
      new THREE.Vector3(-85, -2, -75), // Bottom corner of area
      new THREE.Vector3(85, 100, 95) // Top corner of area
    ),
  });

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

  // Commented out: Add a UI panel (uncomment if needed)
  /* const panelEntity = world
    .createTransformEntity()
    .addComponent(PanelUI, { config: "/ui/welcome.json", maxHeight: 0.8, maxWidth: 1.6 })
    .addComponent(Interactable)
    .addComponent(ScreenSpace, { top: "20px", left: "20px", height: "40%" });
  panelEntity.object3D!.position.set(0, 1.29, -1.9); */

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
    playerVisualizer.destroy(); // Stop player updates
  });
});