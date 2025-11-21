// src/visualizer/PlayerVisualizer.ts
import * as THREE from 'three';
import type { World } from '@iwsdk/core';

import { createConfig } from './config';
import { CoordinateTransformer } from './coordinateTransformer';
import { DataFetcher } from './dataFetcher';
import { LabelRenderer } from './labelRenderer';
import { TrailRenderer } from './trailRenderer';
import { PlayerEntity } from './playerEntity';
import { BoundsDebugger } from './boundsDebugger';
import { Billboarding } from './billboarding';
import { PlayerVisualizerConfig, PlayerEntry } from './types';

export class PlayerVisualizer {
  private readonly config = createConfig(this.userConfig);
  private readonly transformer = new CoordinateTransformer();
  private readonly dataFetcher = new DataFetcher(this.config.dataUrl, this.config.useMock, this.config.debugMode);
  private readonly labelRenderer = new LabelRenderer(this.config.labelFontSize, this.config.labelColor, this.config.labelHeight);
  private readonly trailRenderer = new TrailRenderer(this.config.trailEnabled, this.config.trailLength, this.config.trailWidth, this.config.trailOpacity, this.cityMesh);
  private readonly playerEntity = new PlayerEntity(this.world, this.cityMesh, this.config.playerRadius, this.config.playerColor, this.labelRenderer, this.trailRenderer);
  private readonly boundsDebugger = new BoundsDebugger();
  private readonly billboarding = new Billboarding();

  private players = new Map<string, PlayerEntry>();
  private lastPos = new Map<string, THREE.Vector3>();
  private bounds?: THREE.Box3;
  private timer?: number;

  constructor(
    private world: World,
    private cityMesh: THREE.Group,
    private userConfig: Partial<PlayerVisualizerConfig> = {}
  ) {
    this.bounds = this.config.boundingBox
      ? this.config.boundingBox.clone().expandByScalar(2)
      : new THREE.Box3().setFromObject(cityMesh);

    if (this.config.showBounds) this.boundsDebugger.show(this.bounds, world, cityMesh);
    if (this.config.debugMode && this.bounds) {
      const c = this.bounds.getCenter(new THREE.Vector3());
      const s = this.bounds.getSize(new THREE.Vector3());
      console.log(`Bounds – center: [${c.toArray()}] size: [${s.toArray()}]`);
    }

    this.labelRenderer.loadFont().then(() => this.restartAllLabels());
    this.startPolling();
  }

  private async updatePlayers() {
    const playersData = await this.dataFetcher.fetch();
    if (!playersData.length) return;

    const seen = new Set<string>();

    for (const p of playersData) {
      seen.add(p.name);

      const vel = typeof p.velocity === 'string'
        ? p.velocity.match(/\[([\d.-]+) ([\d.-]+) ([\d.-]+)\]/)
          ? { x: +RegExp.$1, y: +RegExp.$2, z: +RegExp.$3 }
          : { x: 0, y: 0, z: 0 }
        : p.velocity;

      const worldPos = this.transformer.map(new THREE.Vector3(p.x, p.y, p.z));
      if (this.bounds && !this.bounds.containsPoint(worldPos)) continue;

      const speed = Math.hypot(vel.x, vel.y, vel.z);
      const color = new THREE.Color().setHSL((speed / 100) % 1, 1, 0.5);

      let entry = this.players.get(p.name);
      if (!entry) {
        entry = this.playerEntity.create(p.name);
        this.players.set(p.name, entry);

        // START BILLBOARDING WHEN FIRST PLAYER APPEARS
        if (this.players.size === 1) {
          this.billboarding.start(this.world, this.players);
          console.log("Billboarding STARTED with", this.players.size, "players");
        }
      }

      entry.entity.object3D.position.copy(worldPos);
      this.playerEntity.updateColor(entry.mesh, color);

      // Trail handling
      const prev = this.lastPos.get(p.name);
      const cur = worldPos.clone();
      if (prev && entry.points.length === 0) entry.points.push(prev.clone());
      entry.points.push(cur);
      if (entry.points.length > this.config.trailLength) entry.points.shift();
      this.lastPos.set(p.name, cur);

      this.playerEntity.updateTrail(entry, color);
    }

    // Remove vanished players
    for (const [name] of this.players) {
      if (!seen.has(name)) this.removePlayer(name);
    }
  }

  private removePlayer(name: string) {
    const e = this.players.get(name);
    if (!e) return;

    const { entity, mesh, label, trail, labelRoot } = e;

    if (entity.object3D) {
      this.cityMesh.remove(entity.object3D);
      entity.destroy?.();
    }
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();

    if (label instanceof THREE.Mesh) {
      label.geometry.dispose();
      (label.material as THREE.Material).dispose();
    } else if (label) {
      label.material.map?.dispose();
      label.material.dispose();
    }

    if (trail) {
      this.cityMesh.remove(trail);
      trail.geometry.dispose();
      (trail.material as THREE.Material).dispose();
    }

    // Remove world-space label root
    if (labelRoot?.parent) {
      this.world.scene.remove(labelRoot);
    }

    this.players.delete(name);
    this.lastPos.delete(name);
  }

  private restartAllLabels() {
    this.players.forEach((entry, name) => {
      if (entry.label?.parent) entry.labelRoot.remove(entry.label);
      entry.label = this.labelRenderer.createLabel(entry.labelRoot, name);
    });
  }

  private startPolling() {
    this.updatePlayers();
    this.timer = window.setInterval(() => this.updatePlayers(), this.config.updateInterval);
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    this.billboarding.stop();
    this.players.forEach((_, name) => this.removePlayer(name));
    this.players.clear();
    this.lastPos.clear();
    this.boundsDebugger.destroy(this.cityMesh);
  }
}