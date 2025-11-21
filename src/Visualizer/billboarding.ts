// src/visualizer/billboarding.ts
import * as THREE from 'three';
import type { World } from '@iwsdk/core';
import { PlayerEntry } from './types';

export class Billboarding {
  private frameId?: number;
  private camPos = new THREE.Vector3();

  start(world: World, players: Map<string, PlayerEntry>): void {
    if (this.frameId) cancelAnimationFrame(this.frameId);

    const update = () => {
      world.camera.getWorldPosition(this.camPos);

      players.forEach(entry => {
        if (!entry.labelRoot || !entry.label) return;

        const pos = new THREE.Vector3();
        entry.entity.object3D.getWorldPosition(pos);
        pos.y += entry.mesh.scale.x;

        entry.labelRoot.position.copy(pos);
        entry.labelRoot.lookAt(this.camPos.x, pos.y, this.camPos.z);

        if (entry.label instanceof THREE.Sprite) {
          (entry.label.material as THREE.SpriteMaterial).rotation = 0;
        }
      });

      console.log(`Billboarding running → ${players.size} players`);
      this.frameId = requestAnimationFrame(update);
    };

    update();
  }

  stop(): void {
    if (this.frameId) cancelAnimationFrame(this.frameId);
  }
}