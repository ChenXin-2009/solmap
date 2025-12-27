import * as THREE from 'three';
import { ORBIT_RENDER_CONFIG, ORBIT_GRADIENT_CONFIG } from '@/lib/config/visualConfig';

/**
 * 卫星轨道渲染类（支持母行星轴倾角的动态轨道平面）
 * 
 * 关键物理原理：
 * - 卫星轨道平面相对于母行星的赤道面，而不是黄道面
 * - 当母行星有轴倾角时，卫星轨道平面必须跟随母行星的朝向变化
 * - 这确保了物理正确的卫星轨道表现
 */
export class SatelliteOrbit {
  private line: THREE.Line;
  private radius: number;
  private color: string;
  private inclination: number;  // 相对于母行星赤道面的轨道倾角（弧度）
  private Omega: number;         // 升交点黄经（弧度）
  private segments: number;
  private parentBodyName: string; // 母行星名称
  private isOrientationSet: boolean = false; // 是否已设置朝向
  private eclipticOrbit: boolean; // 是否相对于黄道面而非母行星赤道面

  constructor(
    radius: number,
    color: string = '#ffffff',
    segments: number = 128,
    inclination: number = 0,
    Omega: number = 0,
    parentBodyName: string = '',
    eclipticOrbit: boolean = false
  ) {
    this.radius = radius;
    this.color = color;
    this.inclination = inclination;
    this.Omega = Omega;
    this.segments = segments;
    this.parentBodyName = parentBodyName;
    this.eclipticOrbit = eclipticOrbit;

    // 简单材质（不做渐变，因为卫星轨道通常较小）
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.color),
      transparent: false, // 不透明，确保正确的深度测试
      opacity: 1.0,
      linewidth: ORBIT_RENDER_CONFIG.lineWidth,
      depthWrite: true,
      depthTest: true,
    });

    // 创建初始轨道几何体（在母行星赤道面内）
    const initialGeometry = this.createOrbitGeometry();
    this.line = new THREE.Line(initialGeometry, material);
    
    // 立即设置正确的朝向（一次性设置）
    this.setCorrectOrientation();
  }

  /**
   * 设置正确的轨道朝向（基于母行星轴倾角，一次性设置）
   * 
   * 物理原理：
   * - 大部分卫星轨道在母行星的赤道面内
   * - 月球等特殊卫星轨道相对于黄道面倾斜
   * - 轨道平面的法向量 = 母行星的自转轴向量（赤道面轨道）或黄道面法向量（黄道面轨道）
   */
  private setCorrectOrientation(): void {
    if (this.isOrientationSet || !this.parentBodyName) return;
    
    if (this.eclipticOrbit) {
      // 月球等：轨道相对于黄道面，不需要额外变换
      this.isOrientationSet = true;
      return;
    }
    
    try {
      // 动态导入 CELESTIAL_BODIES 以获取母行星轴倾角
      const { CELESTIAL_BODIES } = require('@/lib/types/celestialTypes');
      const parentConfig = CELESTIAL_BODIES[this.parentBodyName];
      
      if (parentConfig && parentConfig.orientation && parentConfig.orientation.spinAxis) {
        const [x, y, z] = parentConfig.orientation.spinAxis;
        
        // 母行星自转轴向量（ICRF坐标系）
        const spinAxisICRF = new THREE.Vector3(x, y, z);
        
        // 转换到渲染坐标系（ICRF -> Three.js）
        const spinAxisRender = new THREE.Vector3(
          spinAxisICRF.x,  // X 保持不变
          spinAxisICRF.z,  // ICRF Z -> Render Y
          -spinAxisICRF.y  // ICRF Y -> Render -Z
        );
        
        // 🔧 关键修复：创建母行星赤道面坐标系
        // 轨道平面在赤道面内，法向量是自转轴
        // 我们需要将默认的XY平面（法向量为Z轴）转换为垂直于自转轴的平面
        
        const defaultNormal = new THREE.Vector3(0, 0, 1);  // 默认轨道平面法向量（Z轴向上）
        const targetNormal = spinAxisRender.normalize();   // 目标法向量（自转轴方向）
        
        const parentAxisQuaternion = new THREE.Quaternion();
        parentAxisQuaternion.setFromUnitVectors(defaultNormal, targetNormal);
        
        // 应用变换到轨道几何体
        this.applyOrientationTransform(parentAxisQuaternion);
        this.isOrientationSet = true;
      }
    } catch (error) {
      console.warn(`Failed to set orbit orientation for ${this.parentBodyName}:`, error);
    }
  }

  /**
   * 应用朝向变换到轨道几何体（一次性变换）
   */
  private applyOrientationTransform(quaternion: THREE.Quaternion): void {
    const positions = this.line.geometry.attributes.position.array as Float32Array;
    const transformedPoints: THREE.Vector3[] = [];

    // 对每个轨道点应用变换
    for (let i = 0; i < positions.length; i += 3) {
      const point = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
      point.applyQuaternion(quaternion);
      transformedPoints.push(point);
    }

    // 更新几何体
    const newGeometry = new THREE.BufferGeometry().setFromPoints(transformedPoints);
    this.line.geometry.dispose();
    this.line.geometry = newGeometry;
  }

  /**
   * 创建轨道几何体（在母行星赤道面内）
   */
  private createOrbitGeometry(): THREE.BufferGeometry {
    const points: THREE.Vector3[] = [];
    
    // 生成轨道上的点（在母行星赤道面内，考虑卫星轨道倾角）
    const cos_i = Math.cos(this.inclination);
    const sin_i = Math.sin(this.inclination);
    const cos_Om = Math.cos(this.Omega);
    const sin_Om = Math.sin(this.Omega);

    for (let i = 0; i <= this.segments; i++) {
      const theta = (i / this.segments) * Math.PI * 2;
      
      // 轨道平面坐标（标准轨道面，相对于母行星赤道面）
      const x_orb = Math.cos(theta) * this.radius;
      const y_orb = Math.sin(theta) * this.radius;
      const z_orb = 0;

      // 应用卫星轨道倾角和升交点黄经（相对于母行星赤道面）
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

    return new THREE.BufferGeometry().setFromPoints(points);
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
