import * as THREE from 'three';

export class TrailRenderer {
  constructor(
    private trailEnabled: boolean,
    private trailLength: number,
    private trailWidth: number,
    private trailOpacity: number,
    private cityMesh: THREE.Group
  ) {}

  updateTrail(
    entry: { trail?: THREE.Mesh; points: THREE.Vector3[] },
    color: THREE.Color
  ): void {
    if (!this.trailEnabled || entry.points.length < 2) return;

    const curve = new THREE.CatmullRomCurve3(entry.points);
    const geom = new THREE.TubeGeometry(curve, 40, this.trailWidth, 8, false);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: this.trailOpacity,
      side: THREE.DoubleSide,
    });

    if (entry.trail) {
      entry.trail.geometry.dispose();
      entry.trail.geometry = geom;
      (entry.trail.material as THREE.MeshBasicMaterial).color.copy(color);
    } else {
      const mesh = new THREE.Mesh(geom, mat);
      this.cityMesh.add(mesh);
      entry.trail = mesh;
    }
  }
}