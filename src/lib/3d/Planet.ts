/**
 * Planet.ts - 3D 行星类
 * 创建和管理 3D 行星网格
 */

import * as THREE from 'three';
import type { CelestialBody } from '@/lib/astronomy/orbit';

export interface PlanetConfig {
  body: CelestialBody;
  rotationSpeed: number; // 弧度/秒
}

export class Planet {
  private mesh: THREE.Mesh;
  private geometry: THREE.SphereGeometry;
  private material: THREE.MeshStandardMaterial;
  private rotationSpeed: number;
  private currentRotation: number = 0;

  constructor(config: PlanetConfig) {
    this.rotationSpeed = config.rotationSpeed;

    // 计算缩放后的半径
    const scaledRadius = this.getScaledRadius(config.body.radius);

    // 创建几何体（根据距离动态调整细节）
    const segments = Math.max(16, Math.min(64, Math.floor(scaledRadius * 10)));
    this.geometry = new THREE.SphereGeometry(scaledRadius, segments, segments);

    // 创建材质
    this.material = new THREE.MeshStandardMaterial({
      color: config.body.color || 0xffffff,
      emissive: config.body.isSun ? config.body.color || 0xffff00 : 0x000000,
      emissiveIntensity: config.body.isSun ? 0.5 : 0,
    });

    // 创建网格
    this.mesh = new THREE.Mesh(this.geometry, this.material);
  }

  /**
   * 对数缩放半径（使小行星可见）
   */
  private getScaledRadius(radius: number): number {
    const scaleFactor = 2.0; // 缩放因子
    const minRadius = 0.1; // 最小可见半径
    return Math.max(minRadius, Math.log10(radius + 1) * scaleFactor);
  }

  /**
   * 更新位置
   */
  updatePosition(x: number, y: number, z: number): void {
    this.mesh.position.set(x, y, z);
  }

  /**
   * 更新自转
   */
  updateRotation(deltaTime: number): void {
    if (this.rotationSpeed > 0) {
      this.currentRotation += this.rotationSpeed * deltaTime;
      this.mesh.rotation.y = this.currentRotation;
    }
  }

  /**
   * 更新 LOD（根据距离动态调整细节）
   */
  updateLOD(distance: number): void {
    const segments = Math.max(8, Math.min(64, Math.floor(100 / (distance + 1))));
    if (this.geometry.parameters.widthSegments !== segments) {
      this.geometry.dispose();
      const radius = this.geometry.parameters.radius;
      this.geometry = new THREE.SphereGeometry(radius, segments, segments);
      this.mesh.geometry = this.geometry;
    }
  }

  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

