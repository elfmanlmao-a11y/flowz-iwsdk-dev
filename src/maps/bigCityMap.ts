import * as THREE from 'three';
import { MapConfig } from '../types';

const BigCityMap: MapConfig = {
  meshKey: 'bigCity',
  position: new THREE.Vector3(0, 0.9, -2),
  scale: 0.01,
  boundingBox: new THREE.Box3(
    new THREE.Vector3(-85, -2, -75),
    new THREE.Vector3(85, 100, 95)
  )
};

export default BigCityMap;
