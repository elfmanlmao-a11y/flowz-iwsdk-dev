import * as THREE from 'three';
import type { World } from '@iwsdk/core';

export class BoundsDebugger {
  private entity?: any;

  show(bounds: THREE.Box3, world: World, cityMesh: THREE.Group): void {
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
    );
    box.position.copy(center);
    this.entity = world.createTransformEntity(box);
    cityMesh.add(this.entity.object3D);
  }

  destroy(cityMesh: THREE.Group): void {
    if (this.entity?.object3D) {
      cityMesh.remove(this.entity.object3D);
      this.entity.destroy?.();
    }
  }
}