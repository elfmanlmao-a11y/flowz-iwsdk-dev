import * as THREE from 'three';

export class CoordinateTransformer {
  private readonly matrix = new THREE.Matrix3().set(
    0.00646297824, -0.000079977569, 0.000127492645,
    0.00000378432681, 0.0000487270525, 0.00630588861,
    0.000169270224, -0.00659015663, 0.000106918946
  );
  private readonly offset = new THREE.Vector3(0.73352882, 68.92531057, 8.32454724);

  map(pos: THREE.Vector3): THREE.Vector3 {
    return pos.clone().applyMatrix3(this.matrix).add(this.offset);
  }
}