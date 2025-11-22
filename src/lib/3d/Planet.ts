/**
 * Planet.ts - 3D 行星类
 * 创建和管理 3D 行星网格
 */

import * as THREE from 'three';
import type { CelestialBody } from '@/lib/astronomy/orbit';

// ==================== 可调参数配置 ====================

// 标记圈配置
const MARKER_CONFIG = {
  size: 20, // 标记圈大小（像素，固定大小）- 增大以便更容易看到
  strokeWidth: 2, // 标记圈线条宽度（像素）
  baseOpacity: 1.0, // 标记圈基础透明度（完全不透明）
  fadeSpeed: 0.2, // 渐隐速度（0-1，值越大变化越快）
  minOpacity: 0.1, // 最小透明度（低于此值不显示）- 提高以便更容易看到
};

// 真实行星半径（AU单位）
// 1 AU = 149,597,870 km
// 地球半径 = 6,371 km ≈ 0.0000426 AU
// 太阳半径 = 696,340 km ≈ 0.00465 AU
const REAL_PLANET_RADII: Record<string, number> = {
  sun: 0.00465,      // 太阳半径（AU）
  mercury: 0.000015, // 水星半径（AU）
  venus: 0.000037,   // 金星半径（AU）
  earth: 0.000043,   // 地球半径（AU）
  mars: 0.000023,    // 火星半径（AU）
  jupiter: 0.000477, // 木星半径（AU）
  saturn: 0.000402,  // 土星半径（AU）
  uranus: 0.000170,  // 天王星半径（AU）
  neptune: 0.000165, // 海王星半径（AU）
};

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
  private realRadius: number; // 真实半径（AU）
  private markerDiv: HTMLDivElement | null = null; // 标记圈DOM元素（2D）
  private markerObject: any = null; // CSS2DObject（当行星很小时显示）
  private currentOpacity: number = 0; // 当前透明度（用于渐隐）
  private targetOpacity: number = 0; // 目标透明度

  constructor(config: PlanetConfig) {
    this.rotationSpeed = config.rotationSpeed;
    
    // 使用真实行星半径（AU单位）
    const planetName = config.body.name.toLowerCase();
    this.realRadius = REAL_PLANET_RADII[planetName] || config.body.radius;
    
    // 使用真实半径创建行星
    const radius = this.realRadius;

    // 创建几何体（根据半径动态调整细节）
    const segments = Math.max(16, Math.min(64, Math.floor(radius * 1000)));
    this.geometry = new THREE.SphereGeometry(radius, segments, segments);

    // 创建材质
    this.material = new THREE.MeshStandardMaterial({
      color: config.body.color || 0xffffff,
      emissive: config.body.isSun ? config.body.color || 0xffff00 : 0x000000,
      emissiveIntensity: config.body.isSun ? 0.5 : 0,
    });

    // 创建网格
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    // 注意：标记圈在外部通过 createMarkerCircle() 方法创建
  }

  /**
   * 创建标记圈（类似 NASA JPL Eyes）
   * 当行星很小时，显示一个2D圆圈标记其位置
   */
  createMarkerCircle(CSS2DObject: any): void {
    if (this.markerDiv) return; // 已经创建过了
    
    // 创建标记圈DOM元素（固定像素大小，始终显示）
    this.markerDiv = document.createElement('div');
    this.markerDiv.style.width = `${MARKER_CONFIG.size}px`;
    this.markerDiv.style.height = `${MARKER_CONFIG.size}px`;
    const colorHex = this.material.color.getHexString();
    this.markerDiv.style.border = `${MARKER_CONFIG.strokeWidth}px solid #${colorHex}`;
    this.markerDiv.style.borderRadius = '50%';
    this.markerDiv.style.pointerEvents = 'auto'; // 允许点击标记圈
    this.markerDiv.style.cursor = 'pointer'; // 鼠标悬停时显示手型光标
    this.markerDiv.style.userSelect = 'none';
    this.markerDiv.style.opacity = '1'; // 初始显示，由重叠检测控制
    this.markerDiv.style.transition = 'opacity 0.2s ease-out';
    this.markerDiv.style.position = 'absolute';
    this.markerDiv.style.transform = 'translate(-50%, -50%)'; // 居中显示
    this.markerDiv.style.display = 'block'; // 默认显示
    this.markerDiv.style.visibility = 'visible';
    this.markerDiv.style.backgroundColor = 'transparent'; // 确保背景透明
    this.markerDiv.style.boxSizing = 'border-box'; // 确保边框计算正确
    
    // 初始化透明度状态
    this.currentOpacity = 1.0;
    this.targetOpacity = 1.0;
    
    // 创建CSS2DObject
    this.markerObject = new CSS2DObject(this.markerDiv);
    this.markerObject.position.set(0, 0, 0);
    this.mesh.add(this.markerObject);
  }
  
  /**
   * 获取标记圈对象（用于添加到场景）
   */
  getMarkerObject(): any {
    return this.markerObject;
  }
  
  /**
   * 更新标记圈的透明度（根据重叠情况，类似2D版本）
   * targetOpacity 由外部根据重叠检测结果设置
   */
  updateMarkerOpacity(): void {
    if (!this.markerDiv) return;
    
    // 平滑过渡透明度（渐隐效果）
    const diff = this.targetOpacity - this.currentOpacity;
    if (Math.abs(diff) > 0.001) {
      this.currentOpacity += diff * MARKER_CONFIG.fadeSpeed;
      this.currentOpacity = Math.max(0, Math.min(1, this.currentOpacity));
    } else {
      this.currentOpacity = this.targetOpacity;
    }
    
    // 更新DOM元素的透明度
    if (this.markerDiv) {
      this.markerDiv.style.opacity = this.currentOpacity.toString();
      // 确保标记圈在可见时显示
      if (this.currentOpacity > MARKER_CONFIG.minOpacity) {
        this.markerDiv.style.display = 'block';
      } else {
        this.markerDiv.style.display = 'none';
      }
    }
  }
  
  /**
   * 设置标记圈的目标透明度（用于重叠检测）
   */
  setMarkerTargetOpacity(opacity: number): void {
    this.targetOpacity = Math.max(0, Math.min(1, opacity));
  }
  
  /**
   * 获取标记圈的当前透明度（用于同步标签透明度）
   */
  getMarkerOpacity(): number {
    return this.currentOpacity;
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
  
  /**
   * 获取真实半径
   */
  getRealRadius(): number {
    return this.realRadius;
  }

  dispose(): void {
    if (this.markerObject && this.markerObject.parent) {
      this.markerObject.parent.remove(this.markerObject);
    }
    if (this.markerDiv && this.markerDiv.parentNode) {
      this.markerDiv.parentNode.removeChild(this.markerDiv);
    }
    this.geometry.dispose();
    this.material.dispose();
  }
}

