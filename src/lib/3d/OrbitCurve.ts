/**
 * OrbitCurve.ts - 3D 轨道曲线类
 * 创建和管理 3D 轨道线
 */

import * as THREE from 'three';
import type { OrbitalElements } from '@/lib/astronomy/orbit';

export class OrbitCurve {
  private line: THREE.Line;
  private curve: THREE.CatmullRomCurve3;
  private points: THREE.Vector3[] = [];

  constructor(
    elements: OrbitalElements,
    color: string,
    segments: number = 300,
    julianDay?: number
  ) {
    // 生成轨道点
    this.generatePoints(elements, segments, julianDay);

    // 创建曲线
    this.curve = new THREE.CatmullRomCurve3(this.points, true); // true = 闭合曲线

    // 创建几何体
    const geometry = new THREE.BufferGeometry().setFromPoints(
      this.curve.getPoints(segments)
    );

    // 创建材质
    const material = new THREE.LineBasicMaterial({
      color: color,
      opacity: 0.4,
      transparent: true,
      linewidth: 1,
    });

    // 创建线条
    this.line = new THREE.Line(geometry, material);
  }

  /**
   * 生成轨道点
   */
  private generatePoints(
    elements: OrbitalElements,
    segments: number,
    julianDay?: number
  ): void {
    this.points = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const r = elements.a * (1 - elements.e * elements.e) / 
                (1 + elements.e * Math.cos(angle));

      // 转换到3D空间（简化版，假设在XY平面）
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      const z = 0;

      this.points.push(new THREE.Vector3(x, y, z));
    }
  }

  /**
   * 更新轨道（如果需要）
   */
  updateOrbit(elements: OrbitalElements, segments: number = 300): void {
    this.generatePoints(elements, segments);
    this.curve = new THREE.CatmullRomCurve3(this.points, true);
    
    const geometry = new THREE.BufferGeometry().setFromPoints(
      this.curve.getPoints(segments)
    );
    
    this.line.geometry.dispose();
    this.line.geometry = geometry;
  }

  getLine(): THREE.Line {
    return this.line;
  }

  dispose(): void {
    this.line.geometry.dispose();
    (this.line.material as THREE.Material).dispose();
  }
}

