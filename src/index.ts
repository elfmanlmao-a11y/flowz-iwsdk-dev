// src/index.ts
import * as THREE from 'three';

import {
  AssetManifest,
  AssetType,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SessionMode,
  SRGBColorSpace,
  PanelUI,
  AssetManager,
  World,
} from "@iwsdk/core";

import {
  AudioSource,
  DistanceGrabbable,
  MovementMode,
  Interactable,
  PlaybackMode,   
  ScreenSpace,
} from "@iwsdk/core";

import { EnvironmentType, LocomotionEnvironment } from "@iwsdk/core";

// Custom systems & visualizers
import { MapRotationSystem, Rotation } from "./mapRotation";
import { PanelSystem } from "./panel.js";
import { Robot, RobotSystem } from "./robot.js";
import { PlayerVisualizer } from './Visualizer/PlayerVisualizer';
import { KeyboardMovementSystem } from './keyboardMovement';
import { ReplayPanelSystem } from "./ReplayPanelSystem";



// === ASSETS ===
// === ASSETS — GitHub Pages Subdirectory Paths ===
const assets: AssetManifest = {
  chimeSound: { url: "audio/chime.mp3", type: AssetType.Audio, priority: "background" },
  webxr: { url: "textures/webxr.png", type: AssetType.Texture, priority: "critical" },
  environmentDesk: { url: "gltf/environmentDesk/environmentDesk.gltf", type: AssetType.GLTF, priority: "critical" },
  plantSansevieria: { url: "gltf/plantSansevieria/plantSansevieria.gltf", type: AssetType.GLTF, priority: "critical" },
  bigCity: { url: "gltf/BigCity/BigcityV1.glb", type: AssetType.GLTF, priority: "critical" },
  robot: { url: "gltf/robot/robot.gltf", type: AssetType.GLTF, priority: "critical" },
};

// === MAP CONFIGS ===
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
      new THREE.Vector3(-80, -2, -70),
      new THREE.Vector3(80, 100, 90)
    ).expandByScalar(2),
  },

};

let currentMap: string = 'bigCity';
let currentVisualizer: PlayerVisualizer | null = null;

World.create(document.getElementById("scene-container") as HTMLDivElement, {
  assets,
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: "always",
    features: { handTracking: true, layers: true },
  },
  features: {
    locomotion: { useWorker: true },
    grabbing: true,
    physics: false,
    sceneUnderstanding: false,
  },
}).then((world) => {
  // Register rotation system early
  world.registerSystem(MapRotationSystem);


  const { camera } = world;
  camera.position.set(-4, 1.5, -6);
  camera.rotateY(-Math.PI * 0.75);
  // Replay Panel
  const replayPanelPlane = new Mesh(
    new PlaneGeometry(1.2, 0.8, 0.2),
    new MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    })

  );

  // Position it in front of the user
  replayPanelPlane.position.set(0, 1.4, -1.5);
  replayPanelPlane.renderOrder = 10;

  world.createTransformEntity(replayPanelPlane)
    .addComponent(PanelUI, { config: "/ui/replay.json" })
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget });


  // Desk
  const { scene: deskMesh } = AssetManager.getGLTF("environmentDesk")!;
  deskMesh.rotateY(Math.PI);
  deskMesh.position.set(0, -0.1, 0);
  world.createTransformEntity(deskMesh)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  // Load maps
  const bigCityMesh = AssetManager.getGLTF("bigCity")!.scene;
  

  // BigCity
  bigCityMesh.position.copy(mapConfigs.bigCity.position);
  bigCityMesh.scale.setScalar(mapConfigs.bigCity.scale);
  bigCityMesh.updateMatrixWorld(true);
  world.createTransformEntity(bigCityMesh)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget })
    .addComponent(Rotation, { speed: 0.05, axis: "Y" });


  // Player Visualizer – attached to world root
  currentVisualizer = new PlayerVisualizer(world, bigCityMesh, {
    useMock: false,
    dataUrl: 'https://flowz-iwsdk-dev.onrender.com/data',
    playerRadius: 1,
    debugMode: false,
    showBounds: true,
    boundingBox: mapConfigs.bigCity.boundingBox,
    trailEnabled: true,
    trailLength: 40,
    trailWidth: 0.4,
    trailOpacity: 0.9,
    labelFontSize: .1,     
  });

  const toggleMap = () => {
    const nextMap = currentMap === 'bigCity' ? 'summonersRift' : 'bigCity';
    const nextConfig = mapConfigs[nextMap];
    const nextMesh = nextMap === 'bigCity' ? bigCityMesh : bigCityMesh;

    bigCityMesh.visible = nextMap === 'bigCity';
    

    currentVisualizer?.destroy();
    currentVisualizer = new PlayerVisualizer(world, nextMesh, {
      useMock: false,
      dataUrl: 'https://flowz-iwsdk-dev.onrender.com/data',
      playerRadius: 1,
      debugMode: false,
      showBounds: false,
      boundingBox: nextConfig.boundingBox,
      trailEnabled: true,
      trailLength: 40,
      trailWidth: 0.4,
      trailOpacity: 0.9,
      labelFontSize: .8,
    });

    currentMap = nextMap;
    console.log(`Switched to ${nextMap}`);
  };

  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm') toggleMap();
  });

  // Plant
  const { scene: plantMesh } = AssetManager.getGLTF("plantSansevieria")!;
  plantMesh.position.set(1.2, 0.85, -1.8);
  world.createTransformEntity(plantMesh)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget });

  // Robot
  const { scene: robotMesh } = AssetManager.getGLTF("robot")!;
  robotMesh.position.set(-1.2, 0.95, -1.8);
  robotMesh.scale.setScalar(0.5);
  world.createTransformEntity(robotMesh)
    .addComponent(Interactable)
    .addComponent(Robot)
    .addComponent(AudioSource, {
      maxInstances: 3,
      playbackMode: PlaybackMode.FadeRestart,
    });
    
  // Logo
  const webxrLogoTexture = AssetManager.getTexture("webxr")!;
  webxrLogoTexture.colorSpace = SRGBColorSpace;
  const logoBanner = new Mesh(
    new PlaneGeometry(3.39, 0.96),
    new MeshBasicMaterial({ map: webxrLogoTexture, transparent: true })
  );
  world.createTransformEntity(logoBanner);
  logoBanner.position.set(0, 1, 1.8);
  logoBanner.rotateY(Math.PI);

  // Register remaining systems
  world
    .registerSystem(PanelSystem)
    .registerSystem(ReplayPanelSystem)
    .registerSystem(RobotSystem);
    
  // Desktop keyboard movement (WASD + Space/Shift)
  world.registerSystem(KeyboardMovementSystem);

  window.addEventListener('beforeunload', () => {
    currentVisualizer?.destroy();
  });
});