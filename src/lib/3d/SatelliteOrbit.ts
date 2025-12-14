import * as THREE from 'three';
import { ORBIT_RENDER_CONFIG, ORBIT_GRADIENT_CONFIG } from '@/lib/config/visualConfig';

/**
 * 卫星轨道渲染类（支持倾角的圆形轨道）
 * - 生成倾斜的圆形线条，反映卫星轨道的真实倾角和升交点黄经
 */
export class SatelliteOrbit {
  private line: THREE.Line;
  private radius: number;
  private color: string;
  private inclination: number;  // 轨道倾角（弧度）
  private Omega: number;         // 升交点黄经（弧度）

  constructor(
    radius: number,
    color: string = '#ffffff',
    segments: number = 128,
    inclination: number = 0,
    Omega: number = 0
  ) {
    this.radius = radius;
    this.color = color;
    this.inclination = inclination;
    this.Omega = Omega;

    const points: THREE.Vector3[] = [];
    
    // 生成轨道上的点（在轨道平面内）
    const cos_i = Math.cos(inclination);
    const sin_i = Math.sin(inclination);
    const cos_Om = Math.cos(Omega);
    const sin_Om = Math.sin(Omega);

    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      
      // 轨道平面坐标（标准轨道面）
      const x_orb = Math.cos(theta) * radius;
      const y_orb = Math.sin(theta) * radius;
      const z_orb = 0;

      // ⚠️ 关键修复：正确的旋转顺序（欧拉角 Z-X-Z 约定）
      // 第一步：绕 Z 轴旋转升交点黄经 (Omega)
      const x_1 = x_orb * cos_Om - y_orb * sin_Om;
      const y_1 = x_orb * sin_Om + y_orb * cos_Om;
      const z_1 = z_orb;

      // 第二步：绕 X 轴旋转倾角 (inclination)
      const x_final = x_1;
      const y_final = y_1 * cos_i - z_1 * sin_i;
      const z_final = y_1 * sin_i + z_1 * cos_i;

      points.push(new THREE.Vector3(x_final, y_final, z_final));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // 简单材质（不做渐变，因为卫星轨道通常较小）
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.color),
      transparent: true,
      opacity: 0.35,
      linewidth: ORBIT_RENDER_CONFIG.lineWidth,
    });

    this.line = new THREE.Line(geometry, material);
  }

  getLine() {
    return this.line;
  }

  /**
   * 将轨道中心移动到给定世界坐标位置
   */
  updatePlanetPosition(position: THREE.Vector3): void {
    this.line.position.copy(position);
  }

  dispose() {
    this.line.geometry.dispose();
    // @ts-ignore
    if (this.line.material) this.line.material.dispose();
  }
}
