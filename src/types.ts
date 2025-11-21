// Shared types for map configs and player visualization

import * as THREE from 'three';

export interface MapConfig {
  meshKey: string;
  position: THREE.Vector3;
  scale: number;
  boundingBox: THREE.Box3;
}

export interface PlayerVisualizerConfig {
  dataUrl: string;
  useMock?: boolean;
  playerRadius: number;
  playerColor?: number;
  debugMode?: boolean;
  showBounds?: boolean;
  boundingBox: THREE.Box3;
}
