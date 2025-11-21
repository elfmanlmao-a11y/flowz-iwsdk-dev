import type { World } from '@iwsdk/core';
import * as THREE from 'three';

export interface PlayerData {
  name: string;
  x: number; y: number; z: number;
  velocity: { x: number; y: number; z: number } | string;
}

export interface PlayerVisualizerConfig {
  dataUrl?: string;
  useMock?: boolean;
  updateInterval?: number;
  playerRadius?: number;
  playerColor?: number;
  debugMode?: boolean;
  boundingBox?: THREE.Box3;
  showBounds?: boolean;
  labelHeight?: number;
  labelFontSize?: number;
  labelColor?: number;
  trailEnabled?: boolean;
  trailLength?: number;
  trailOpacity?: number;
  trailWidth?: number;
}

export type RequiredConfig = Required<PlayerVisualizerConfig>;


export interface PlayerEntry {
  entity: any;                    // IWSDK entity for the sphere
  mesh: THREE.Mesh;               // Red sphere
  label?: THREE.Mesh | THREE.Sprite;
  labelRoot: THREE.Group;         // World-space group — THIS IS THE KEY
  trail?: THREE.Mesh;
  points: THREE.Vector3[];
}