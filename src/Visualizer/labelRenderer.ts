// src/visualizer/labelRenderer.ts

import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

export class LabelRenderer {
  private font: any = null;

  constructor(
    private labelFontSize: number,
    private labelColor: number,
    private labelHeight: number
  ) {}

  async loadFont(): Promise<void> {
    try {
      const { FontLoader } = await import('three/examples/jsm/loaders/FontLoader.js');
      this.font = await new FontLoader().loadAsync(
        'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json'
      );
    } catch (e) {
      console.warn('Font failed → using sprite labels', e);
      this.font = null;
    }
  }

  // Accept Group or any Object3D (sphere or labelGroup)
  createLabel(parent: THREE.Object3D, name: string): THREE.Mesh | THREE.Sprite | undefined {
  // Automatically calculate perfect height from the sphere's radius
  let sphereRadius = 1;
  
  // Try to find the actual sphere radius from the player's mesh
  if (parent.parent && 'geometry' in parent.parent && (parent.parent as THREE.Mesh).geometry instanceof THREE.SphereGeometry) {
    sphereRadius = ((parent.parent as THREE.Mesh).geometry as THREE.SphereGeometry).parameters.radius;
  }

  const h = sphereRadius - 1.8;  // ← Perfect offset: 1.8 units below sphere surface

  if (this.font) {
    // 3D Text
    const geom = new TextGeometry(name, {
      font: this.font,
      size: this.labelFontSize,
      depth: 0.05,
    });
    geom.computeBoundingBox();
    const width = geom.boundingBox!.max.x - geom.boundingBox!.min.x;

    const labelMesh = new THREE.Mesh(
      geom,
      new THREE.MeshBasicMaterial({ color: this.labelColor })
    );
    labelMesh.position.set(-width / 2, h, 0);
    parent.add(labelMesh);
    return labelMesh;
  } else {
    // Sprite fallback — PERFECT SIZE & POSITION
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, size, size);
    
    ctx.font = `bold ${this.labelFontSize * 18}px Arial`;
    ctx.fillStyle = `#${this.labelColor.toString(16).padStart(6, '0')}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.center.set(0.5, 0);
    sprite.scale.set(this.labelFontSize * 3, this.labelFontSize * 3, 1);
    sprite.position.y = h;
    parent.add(sprite);
    return sprite;
  }
}
}