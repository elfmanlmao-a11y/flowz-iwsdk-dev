import * as THREE from 'three';
import { MapConfig } from '../types';

const SummonersRiftMap: MapConfig = {
  meshKey: 'summonersRift',
  position: new THREE.Vector3(0, -1.75, -2),
  scale: 0.15,
  boundingBox: new THREE.Box3(
    new THREE.Vector3(-15, 17.3, -15),
    new THREE.Vector3(15, 19, 15)
  )
};

export default SummonersRiftMap;
