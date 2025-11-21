// src/visualizer/playerEntity.ts
import * as THREE from 'three';
import type { World } from '@iwsdk/core';
import { PlayerEntry } from './types';
import { LabelRenderer } from './labelRenderer';
import { TrailRenderer } from './trailRenderer';

export class PlayerEntity {
  constructor(
    private world: World,
    private cityMesh: THREE.Group,
    private configRadius: number,
    private baseColor: number,
    private labelRenderer: LabelRenderer,
    private trailRenderer: TrailRenderer
  ) {}

  create(name: string): PlayerEntry {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(this.configRadius),
      new THREE.MeshBasicMaterial({ color: this.baseColor })
    );

    const playerEntity = this.world.createTransformEntity(sphere);
    if (!playerEntity.object3D) throw new Error('Failed');
    this.cityMesh.add(playerEntity.object3D);

    const labelRoot = new THREE.Group();
    labelRoot.matrixAutoUpdate = true;
    this.world.scene.add(labelRoot);

    const entry: PlayerEntry = {
      entity: playerEntity,
      mesh: sphere,
      label: undefined,
      labelRoot,
      points: [],
    };

    entry.label = this.labelRenderer.createLabel(labelRoot, name);
    return entry;
  }

  updateColor(mesh: THREE.Mesh, color: THREE.Color): void {
    (mesh.material as THREE.MeshBasicMaterial).color.copy(color);
  }

  updateTrail(entry: PlayerEntry, color: THREE.Color): void {
    this.trailRenderer.updateTrail(entry, color);
  }
}