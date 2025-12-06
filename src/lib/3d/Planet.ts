/**
 * Planet.ts - 3D 行星类
 * 
 * 功能：
 * - 创建和管理 3D 行星网格（SphereGeometry + MeshStandardMaterial）
 * - 管理行星自转动画
 * - 创建标记圈（CSS2D，用于小行星的可视化）
 * - 为太阳添加光晕效果
 * 
 * 使用：
 * - 通过 PlanetConfig 创建行星实例
 * - 在动画循环中调用 updatePosition() 和 updateRotation()
 * - 通过 getMesh() 获取 Three.js Mesh 对象添加到场景
 */

import * as THREE from 'three';
import type { CelestialBody } from '@/lib/astronomy/orbit';
import { MARKER_CONFIG, SUN_GLOW_CONFIG, SUN_RAINBOW_LAYERS } from '@/lib/config/visualConfig';

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
  private glowMesh: THREE.Mesh | null = null; // 太阳光晕网格
  private rainbowSprites: THREE.Sprite[] = [];
  private isSun: boolean = false; // 是否为太阳

  constructor(config: PlanetConfig) {
    this.rotationSpeed = config.rotationSpeed;
    this.isSun = config.body.isSun || false;
    
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
      emissive: config.body.isSun ? 0xffffaa : 0x000000, // 太阳使用更亮的黄色发光
      emissiveIntensity: config.body.isSun ? 2.0 : 0, // 增加太阳的发光强度
    });

    // 创建网格
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    
    // 如果是太阳，创建光晕效果（使用屏幕空间 Sprite 替代嵌套球体）
    if (this.isSun && SUN_GLOW_CONFIG.enabled) {
      this.createSunGlow();
    }
    
    // 注意：标记圈在外部通过 createMarkerCircle() 方法创建
  }
  
  /**
   * 创建太阳光晕效果（多层光晕，模拟发光）
   */
  private createSunGlow(): void {
    // 使用 canvas 生成径向渐变纹理，作为 Sprite 的贴图
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 中心到外部的渐变：白色内核 -> 太阳色 -> 透明
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0.0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.12, 'rgba(255,245,220,0.95)');
    grad.addColorStop(0.28, 'rgba(255,220,120,0.8)');
    grad.addColorStop(0.5, 'rgba(255,180,80,0.45)');
    grad.addColorStop(0.85, 'rgba(255,140,40,0.12)');
    grad.addColorStop(1.0, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // 创建纹理
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // SpriteMaterial 使用 AdditiveBlending 来模拟发光叠加
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    // 初始大小依据真实半径（后续在 updateGlow 中根据相机距离调整）
    const baseSize = this.realRadius * SUN_GLOW_CONFIG.radiusMultiplier * 2; // world units
    sprite.scale.set(baseSize, baseSize, 1);
    sprite.renderOrder = 999; // 确保在前面渲染
    this.glowMesh = sprite as unknown as THREE.Mesh; // 复用字段名，类型为 Mesh|null 原因兼容旧代码
    this.mesh.add(sprite);

    // 创建彩虹色的散射层（多层、低不透明度、叠加）
    this.rainbowSprites = [];
    for (const layer of SUN_RAINBOW_LAYERS) {
      const csize = 512;
      const cCanvas = document.createElement('canvas');
      cCanvas.width = csize;
      cCanvas.height = csize;
      const cctx = cCanvas.getContext('2d')!;

      // 渐变从半透明色到完全透明
      const cgrad = cctx.createRadialGradient(csize / 2, csize / 2, 0, csize / 2, csize / 2, csize / 2);
      // 中心非常透明，让主光晕保持主色
      cgrad.addColorStop(0.0, 'rgba(0,0,0,0)');
      cgrad.addColorStop(0.6, `${layer.color}`);
      cgrad.addColorStop(1.0, 'rgba(0,0,0,0)');

      cctx.fillStyle = cgrad;
      cctx.fillRect(0, 0, csize, csize);

      const ctexture = new THREE.CanvasTexture(cCanvas);
      ctexture.needsUpdate = true;

      const mat = new THREE.SpriteMaterial({
        map: ctexture,
        color: 0xffffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: layer.opacity,
      });

      const spr = new THREE.Sprite(mat);
      const baseSize = this.realRadius * layer.radiusMultiplier * 2;
      spr.scale.set(baseSize, baseSize, 1);
      spr.renderOrder = 998; // 稍后于主光晕或之前，根据需要
      this.mesh.add(spr);
      this.rainbowSprites.push(spr);
    }
  }

  /**
   * 每帧更新太阳光晕的大小/强度以模拟散射（基于相机距离和视角）
   */
  updateGlow(camera: THREE.Camera): void {
    if (!this.isSun || !this.glowMesh) return;
    // glowMesh 实际为 Sprite
    const sprite = this.glowMesh as unknown as THREE.Sprite;
    // 计算太阳到相机的距离
    const sunWorldPos = new THREE.Vector3();
    this.mesh.getWorldPosition(sunWorldPos);
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    const dist = sunWorldPos.distanceTo(camPos);

    // 控制屏幕空间大小：保持在一定的视觉角度范围内
    // 目标屏幕半径（world units）与相机距离的比例关系： size ~ apparentAngle * dist
    // 设定一个视觉角度（弧度）随 sun radius 调节
    const apparentAngle = Math.max(0.02, Math.min(0.8, (this.realRadius * 3) / (dist / 10)));
    const targetSize = dist * apparentAngle;

    // 平滑缩放
    const current = sprite.scale.x;
    const lerped = current + (targetSize - current) * 0.12;
    sprite.scale.set(lerped, lerped, 1);

    // 根据距离调整不透明度（近时强，远时弱）
    const mat = sprite.material as THREE.SpriteMaterial;
    if (mat) {
      const intensity = Math.max(0.2, Math.min(1.6, (200 / (dist + 50))));
      mat.opacity = Math.min(1.0, SUN_GLOW_CONFIG.opacity * intensity);
      mat.needsUpdate = true;
    }

    // 更新彩虹散射层：根据相机距离略微扩大并降低不透明度，制造色散效果
    if (this.rainbowSprites && this.rainbowSprites.length > 0) {
      for (let i = 0; i < this.rainbowSprites.length; i++) {
        const rs = this.rainbowSprites[i];
        const layer = SUN_RAINBOW_LAYERS[i];
        const currentRs = rs.scale.x;
        const targetRs = lerped * (layer.radiusMultiplier / SUN_GLOW_CONFIG.radiusMultiplier);
        const newRs = currentRs + (targetRs - currentRs) * 0.08;
        rs.scale.set(newRs, newRs, 1);
        const rmat = rs.material as THREE.SpriteMaterial;
        if (rmat) {
          // 使远处更暗，近处更明显
          const rIntensity = Math.max(0.02, Math.min(0.6, (120 / (dist + 30))));
          rmat.opacity = layer.opacity * rIntensity;
          rmat.needsUpdate = true;
        }
      }
    }
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

