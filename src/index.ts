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
  AssetManager,
  World,
} from "@iwsdk/core";

import {
  AudioSource,
  DistanceGrabbable,
  MovementMode,
  Interactable,
  PlaybackMode,        // ← Fixed: was missing here
  ScreenSpace,
} from "@iwsdk/core";

import { EnvironmentType, LocomotionEnvironment } from "@iwsdk/core";

// Custom systems & visualizers
import { MapRotationSystem, Rotation } from "./mapRotation";
import { PanelSystem } from "./panel.js";
import { Robot, RobotSystem } from "./robot.js";
import { PlayerVisualizer } from './Visualizer/PlayerVisualizer';
import { parseCurrentGameToVisualizerPlayers, parseMatchToVisualizerPlayers } from './replay/Visualizer/riotSpectator';
import { KeyboardMovementSystem } from './keyboardMovement';
// === ASSETS ===
const assets: AssetManifest = {
  chimeSound: { url: "audio/chime.mp3", type: AssetType.Audio, priority: "background" },
  webxr: { url: "textures/webxr.png", type: AssetType.Texture, priority: "critical" },
  environmentDesk: { url: "gltf/environmentDesk/environmentDesk.gltf", type: AssetType.GLTF, priority: "critical" },
  plantSansevieria: { url: "gltf/plantSansevieria/plantSansevieria.gltf", type: AssetType.GLTF, priority: "critical" },
  bigCity: { url: "gltf/BigCity/BigcityV1.glb", type: AssetType.GLTF, priority: "critical" },
  summonersRift: { url: "gltf/SummonersRift/SUMMONERSRIFT.glb", type: AssetType.GLTF, priority: "critical" },
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
      new THREE.Vector3(-85, -2, -75),
      new THREE.Vector3(85, 100, 95)
    ).expandByScalar(2),
  },
  summonersRift: {
    meshKey: 'summonersRift',
    position: new THREE.Vector3(0, -1.75, -2),
    scale: 0.15,
    boundingBox: new THREE.Box3(
      new THREE.Vector3(-15, 17.3, -15),
      new THREE.Vector3(15, 19, 15)
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

  // Desk
  const { scene: deskMesh } = AssetManager.getGLTF("environmentDesk")!;
  deskMesh.rotateY(Math.PI);
  deskMesh.position.set(0, -0.1, 0);
  world.createTransformEntity(deskMesh)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  // Load maps
  const bigCityMesh = AssetManager.getGLTF("bigCity")!.scene;
  const summonersRiftMesh = AssetManager.getGLTF("summonersRift")!.scene;

  // BigCity
  bigCityMesh.position.copy(mapConfigs.bigCity.position);
  bigCityMesh.scale.setScalar(mapConfigs.bigCity.scale);
  bigCityMesh.updateMatrixWorld(true);
  world.createTransformEntity(bigCityMesh)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget })
    .addComponent(Rotation, { speed: 0.05, axis: "Y" });

  // Summoner's Rift (hidden)
  summonersRiftMesh.position.copy(mapConfigs.summonersRift.position);
  summonersRiftMesh.scale.setScalar(mapConfigs.summonersRift.scale);
  summonersRiftMesh.updateMatrixWorld(true);
  world.createTransformEntity(summonersRiftMesh)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget })
    .addComponent(Rotation, { speed: 0.05, axis: "Y" });
  summonersRiftMesh.visible = false;

  // Player Visualizer – attached to world root
  currentVisualizer = new PlayerVisualizer(world, bigCityMesh, {
    useMock: false,
    dataUrl: 'https://flowz-iwsdk-dev.onrender.com/data',
    playerRadius: 1,
    debugMode: true,
    showBounds: true,
    boundingBox: mapConfigs.bigCity.boundingBox,
    trailEnabled: true,
    trailLength: 40,
    trailWidth: 0.4,
    trailOpacity: 0.9,
    labelFontSize: .1,     
  });

  // Attempt to load a Riot active game if the user provides a summoner name
  async function tryLoadRiotMatchForSummoner(summonerName?: string, platform: string = 'OC1') {
    if (!summonerName) return;
    const serverBase = 'https://flowz-iwsdk-dev.onrender.com';
    try {
      const res = await fetch(`${serverBase}/riot/activeGame?platform=${encodeURIComponent(platform)}&summonerName=${encodeURIComponent(summonerName)}`);
      if (!res.ok) {
        console.warn('No active Riot game or fetch failed:', await res.text());
        return;
      }
      const riotGame = await res.json();
      const players = parseCurrentGameToVisualizerPlayers(riotGame);

      // Switch to Summoner's Rift map and create visualizer there
      bigCityMesh.visible = false;
      summonersRiftMesh.visible = true;

      currentVisualizer?.destroy();
      currentVisualizer = new PlayerVisualizer(world, summonersRiftMesh, {
        useMock: false,
        dataUrl: 'https://flowz-iwsdk-dev.onrender.com/data',
        playerRadius: 1,
        debugMode: true,
        showBounds: true,
        boundingBox: mapConfigs.summonersRift.boundingBox,
        trailEnabled: true,
        trailLength: 40,
        trailWidth: 0.4,
        trailOpacity: 0.9,
        labelFontSize: .8,
      });

      // Pass Riot players to visualizer
      currentVisualizer.updateFromSpectatorPlayers(players as any);
      currentMap = 'summonersRift';
      console.log('Loaded Riot match and spawned players on Summoner\'s Rift');
    } catch (err) {
      console.error('Error loading Riot match:', err);
    }
  }

  // Expose helper and currentVisualizer for console testing and add on-screen controls
  // Default platform set to OC1 (Oceania) since many active games may exist there.
  try {
    (window as any).currentVisualizer = currentVisualizer;
    (window as any).tryLoadRiotMatchForSummoner = tryLoadRiotMatchForSummoner;

    function createRiotControlPanel() {
      const panel = document.createElement('div');
      panel.style.position = 'fixed';
      panel.style.right = '12px';
      panel.style.top = '12px';
      panel.style.padding = '10px';
      panel.style.background = 'rgba(0,0,0,0.6)';
      panel.style.color = '#fff';
      panel.style.fontFamily = 'sans-serif';
      panel.style.zIndex = '9999';
      panel.style.borderRadius = '6px';
      panel.style.minWidth = '220px';
      panel.style.maxHeight = '80vh';
      panel.style.overflowY = 'auto';
      panel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';

      const title = document.createElement('div');
      title.textContent = 'Riot Match Visualizer';
      title.style.fontWeight = '700';
      title.style.marginBottom = '8px';
      panel.appendChild(title);

      const nameInput = document.createElement('input');
      nameInput.placeholder = 'Summoner name';
      nameInput.style.width = '100%';
      nameInput.style.marginBottom = '6px';
      panel.appendChild(nameInput);

      const regionSelect = document.createElement('select');
      regionSelect.style.width = '100%';
      regionSelect.style.marginBottom = '8px';
      const regions = ['OC1','NA1','EUW1','EUN1','KR','BR1','JP1','TR1','RU','AMERICAS','EUROPE','ASIA'];
      for (const r of regions) {
        const o = document.createElement('option'); o.value = r; o.text = r; regionSelect.appendChild(o);
      }
      regionSelect.value = 'OC1';
      panel.appendChild(regionSelect);

      const btn = document.createElement('button');
      btn.textContent = 'Load Match History';
      btn.style.width = '100%';
      btn.style.padding = '6px 8px';
      btn.style.cursor = 'pointer';
      btn.style.marginBottom = '8px';
      panel.appendChild(btn);

      const matchList = document.createElement('div');
      matchList.style.display = 'none';
      matchList.style.maxHeight = '300px';
      matchList.style.overflowY = 'auto';
      matchList.style.marginBottom = '8px';
      panel.appendChild(matchList);

      const status = document.createElement('div');
      status.style.marginTop = '8px';
      status.style.fontSize = '12px';
      status.style.opacity = '0.9';
      panel.appendChild(status);

      // Store loaded match IDs for later fetching
      let matchIds: string[] = [];
      let selectedRegion = 'europe';

      btn.addEventListener('click', async () => {
        const name = nameInput.value && nameInput.value.trim();
        const region = regionSelect.value;
        if (!name) { status.textContent = 'Enter a summoner name.'; return; }
        
        // Map platform to regional routing
        selectedRegion = region === 'AMERICAS' ? 'americas' : region === 'ASIA' ? 'asia' : 'europe';

        status.textContent = 'Loading match history...';
        try {
          const serverBase = 'https://flowz-iwsdk-dev.onrender.com';
          const res = await fetch(`${serverBase}/riot/matchHistory?platform=${encodeURIComponent(region)}&summonerName=${encodeURIComponent(name)}&count=10`);
          if (!res.ok) throw new Error(await res.text());
          matchIds = await res.json();

          // Display match list
          matchList.innerHTML = '';
          matchList.style.display = 'block';
          matchIds.forEach((mId: string, idx: number) => {
            const item = document.createElement('div');
            item.style.padding = '6px';
            item.style.background = 'rgba(100,150,200,0.3)';
            item.style.marginBottom = '4px';
            item.style.cursor = 'pointer';
            item.style.borderRadius = '3px';
            item.textContent = `Match ${idx + 1}: ${mId.slice(0, 16)}...`;
            item.addEventListener('mouseover', () => item.style.background = 'rgba(100,150,200,0.6)');
            item.addEventListener('mouseout', () => item.style.background = 'rgba(100,150,200,0.3)');
            item.addEventListener('click', async () => {
              status.textContent = 'Fetching match details...';
              try {
                const matchRes = await fetch(`${serverBase}/riot/match?matchId=${encodeURIComponent(mId)}&region=${encodeURIComponent(selectedRegion)}`);
                if (!matchRes.ok) throw new Error(await matchRes.text());
                const matchData = await matchRes.json();

                // Switch to Summoner's Rift and spawn players
                bigCityMesh.visible = false;
                summonersRiftMesh.visible = true;

                currentVisualizer?.destroy();
                currentVisualizer = new PlayerVisualizer(world, summonersRiftMesh, {
                  useMock: false,
                  dataUrl: 'https://flowz-iwsdk-dev.onrender.com/data',
                  playerRadius: 1,
                  debugMode: true,
                  showBounds: true,
                  boundingBox: mapConfigs.summonersRift.boundingBox,
                  trailEnabled: true,
                  trailLength: 40,
                  trailWidth: 0.4,
                  trailOpacity: 0.9,
                  labelFontSize: .8,
                });

                const players = parseMatchToVisualizerPlayers(matchData);
                currentVisualizer.updateFromSpectatorPlayers(players as any);
                currentMap = 'summonersRift';
                status.textContent = 'Match spawned!';
              } catch (err) {
                status.textContent = 'Match fetch failed';
                console.error('Match detail fetch error', err);
              }
            });
            matchList.appendChild(item);
          });

          status.textContent = `Loaded ${matchIds.length} matches. Click to view.`;
        } catch (err) {
          status.textContent = 'History fetch failed';
          console.error('Match history fetch error', err);
        }
      });

      nameInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') btn.click();
      });

      document.body.appendChild(panel);
    }

    createRiotControlPanel();

    // Backwards-compatible prompt for quick testing (optional)
    const summ = window.prompt('Enter summoner name to spectate (or Cancel to skip):');
    if (summ) {
      const platformPrompt = window.prompt('Enter platform code (e.g. OC1, NA1, EUW1). Default: OC1');
      const platform = platformPrompt && platformPrompt.trim() ? platformPrompt.trim() : 'OC1';
      tryLoadRiotMatchForSummoner(summ.trim(), platform);
    }
  } catch (e) { /* ignore prompt in non-browser envs */ }

  const toggleMap = () => {
    const nextMap = currentMap === 'bigCity' ? 'summonersRift' : 'bigCity';
    const nextConfig = mapConfigs[nextMap];
    const nextMesh = nextMap === 'bigCity' ? bigCityMesh : summonersRiftMesh;

    bigCityMesh.visible = nextMap === 'bigCity';
    summonersRiftMesh.visible = nextMap === 'summonersRift';

    currentVisualizer?.destroy();
    currentVisualizer = new PlayerVisualizer(world, nextMesh, {
      useMock: false,
      dataUrl: 'https://flowz-iwsdk-dev.onrender.com/data',
      playerRadius: 1,
      debugMode: true,
      showBounds: true,
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
    .registerSystem(RobotSystem);
    
  // Desktop keyboard movement (WASD + Space/Shift)
  world.registerSystem(KeyboardMovementSystem);

  window.addEventListener('beforeunload', () => {
    currentVisualizer?.destroy();
  });
});