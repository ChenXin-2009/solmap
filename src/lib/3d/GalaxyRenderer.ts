/**
 * GalaxyRenderer.ts - 银河系渲染器
 * 
 * 功能：
 * - 渲染银河系盘面和旋臂结构
 * - 使用点云/粒子系统渲染恒星密集区
 * - 叠加银河系俯视图贴图
 * - LOD 分层渲染优化性能
 * - 根据相机距离动态显示/隐藏
 * 
 * 数据来源：Gaia DR3（亮度筛选）
 */

import * as THREE from 'three';
import {
  GALAXY_CONFIG,
  SCALE_VIEW_CONFIG,
  LIGHT_YEAR_TO_AU,
} from '../config/galaxyConfig';

export class GalaxyRenderer {
  private group: THREE.Group;
  private particleSystem: THREE.Points | null = null;
  private topViewPlane: THREE.Mesh | null = null;
  private currentOpacity: number = 0;
  private targetOpacity: number = 0;
  private isVisible: boolean = false;
  private textureLoaded: boolean = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Galaxy';
    this.group.visible = false;
    
    this.initializeGalaxy();
  }

  /**
   * 初始化银河系
   */
  private initializeGalaxy(): void {
    this.createParticleSystem();
    this.createTopViewPlane();
  }

  /**
   * 创建银河系粒子系统
   */
  private createParticleSystem(): void {
    const config = GALAXY_CONFIG;
    const particleCount = config.particleCount;
    
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    // 银河系参数
    const radiusLY = config.radius;
    const radiusAU = radiusLY * LIGHT_YEAR_TO_AU;
    const sunOffsetAU = config.sunDistanceFromCenter * LIGHT_YEAR_TO_AU;
    const armCount = config.armCount;
    const armWinding = (config.armWindingAngle * Math.PI) / 180;
    const armWidth = config.armWidth;
    const diskThicknessAU = config.diskThickness * LIGHT_YEAR_TO_AU;
    const coreThicknessAU = config.thickness * LIGHT_YEAR_TO_AU;
    
    // 颜色
    const coreColor = new THREE.Color(config.coreColor);
    const armColor = new THREE.Color(config.armColor);
    const outerColor = new THREE.Color(config.outerColor);
    
    for (let i = 0; i < particleCount; i++) {
      // 使用指数分布使中心更密集
      const u = Math.random();
      const r = radiusAU * Math.pow(u, 0.5); // 平方根分布
      
      // 基础角度
      let theta = Math.random() * Math.PI * 2;
      
      // 旋臂结构
      const armIndex = Math.floor(Math.random() * armCount);
      const armBaseAngle = (armIndex / armCount) * Math.PI * 2;
      
      // 对数螺旋臂
      const spiralAngle = armBaseAngle + armWinding * Math.log(1 + r / (radiusAU * 0.1));
      
      // 添加随机偏移（旋臂宽度）
      const armOffset = (Math.random() - 0.5) * armWidth * Math.PI * 2;
      
      // 混合旋臂和随机分布
      const armStrength = 0.7 * Math.exp(-r / (radiusAU * 0.5)); // 中心区域旋臂更明显
      theta = theta * (1 - armStrength) + (spiralAngle + armOffset) * armStrength;
      
      // 计算位置
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      
      // Y 轴（厚度）- 中心更厚
      const normalizedR = r / radiusAU;
      const localThickness = coreThicknessAU * (1 - normalizedR) + diskThicknessAU * normalizedR;
      const y = (Math.random() - 0.5) * localThickness * Math.exp(-Math.abs(Math.random() - 0.5) * 4);
      
      // 偏移太阳位置（太阳在银河系中的位置）
      positions[i * 3] = x - sunOffsetAU;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      
      // 颜色混合
      const coreWeight = Math.exp(-r / (radiusAU * 0.15));
      const armWeight = armStrength * 0.5;
      const outerWeight = normalizedR;
      
      const color = new THREE.Color();
      color.r = coreColor.r * coreWeight + armColor.r * armWeight + outerColor.r * outerWeight;
      color.g = coreColor.g * coreWeight + armColor.g * armWeight + outerColor.g * outerWeight;
      color.b = coreColor.b * coreWeight + armColor.b * armWeight + outerColor.b * outerWeight;
      color.multiplyScalar(1 / (coreWeight + armWeight + outerWeight + 0.1));
      
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      
      // 大小（中心更亮）
      const brightness = 0.5 + coreWeight * 2 + armWeight * config.armBrightnessBoost;
      sizes[i] = config.particleBaseSize * brightness * (0.5 + Math.random() * 0.5);
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // 自定义着色器
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
        uScale: { value: 1.0 },
        uParticleFade: { value: 1.0 }, // 粒子淡出控制
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlphaFade;
        uniform float uScale;
        
        void main() {
          vColor = color;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // 点大小随距离衰减
          float dist = -mvPosition.z;
          float pointSize = size * uScale * (5000000.0 / dist);
          
          // 当点太小时，逐渐淡出而不是保持最小尺寸
          vAlphaFade = smoothstep(0.5, 2.0, pointSize);
          
          gl_PointSize = max(pointSize, 0.5);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlphaFade;
        uniform float uOpacity;
        uniform float uParticleFade;
        
        void main() {
          // 当粒子太小时完全透明
          if (vAlphaFade < 0.01) discard;
          
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          
          if (dist > 0.5) discard;
          
          // 柔和边缘
          float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
          
          gl_FragColor = vec4(vColor, alpha * uOpacity * uParticleFade * vAlphaFade * 0.8);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    
    this.particleSystem = new THREE.Points(geometry, material);
    this.particleSystem.frustumCulled = false;
    this.particleSystem.renderOrder = 50;
    this.group.add(this.particleSystem);
  }

  /**
   * 创建银河系俯视图平面
   */
  private createTopViewPlane(): void {
    const config = GALAXY_CONFIG;
    const radiusAU = config.radius * LIGHT_YEAR_TO_AU * config.topViewScale;
    const sunOffsetAU = config.sunDistanceFromCenter * LIGHT_YEAR_TO_AU;
    
    // 创建平面几何体
    const geometry = new THREE.PlaneGeometry(radiusAU * 2, radiusAU * 2);
    
    // 加载贴图
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      config.topViewTexturePath,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        
        this.topViewPlane = new THREE.Mesh(geometry, material);
        this.topViewPlane.rotation.x = -Math.PI / 2; // 水平放置
        this.topViewPlane.position.set(-sunOffsetAU, 0, 0); // 偏移太阳位置
        this.topViewPlane.renderOrder = 40;
        this.group.add(this.topViewPlane);
        
        this.textureLoaded = true;
      },
      undefined,
      (error) => {
        console.warn('Failed to load galaxy top view texture:', error);
        // 即使贴图加载失败，粒子系统仍然可用
      }
    );
  }

  /**
   * 更新渲染（每帧调用）
   */
  update(cameraDistance: number, deltaTime: number): void {
    // 计算目标透明度
    this.calculateTargetOpacity(cameraDistance);
    
    // 平滑过渡透明度
    const fadeSpeed = 1.5;
    this.currentOpacity += (this.targetOpacity - this.currentOpacity) * Math.min(deltaTime * fadeSpeed, 1);
    
    // 更新可见性
    const shouldBeVisible = this.currentOpacity > 0.01;
    if (shouldBeVisible !== this.isVisible) {
      this.isVisible = shouldBeVisible;
      this.group.visible = this.isVisible;
    }
    
    if (!this.isVisible) return;
    
    // 更新粒子系统
    if (this.particleSystem) {
      const material = this.particleSystem.material as THREE.ShaderMaterial;
      material.uniforms.uOpacity.value = this.currentOpacity;
      
      // 根据距离调整粒子大小
      const scaleFactor = Math.min(cameraDistance / (100 * LIGHT_YEAR_TO_AU), 5);
      material.uniforms.uScale.value = scaleFactor;
      
      // 在非常远的距离时，让粒子完全淡出，只显示贴图
      const particleFadeStart = 1000 * LIGHT_YEAR_TO_AU;
      const particleFadeEnd = 3000 * LIGHT_YEAR_TO_AU;
      let particleFade = 1.0;
      if (cameraDistance > particleFadeStart) {
        particleFade = 1.0 - Math.min((cameraDistance - particleFadeStart) / (particleFadeEnd - particleFadeStart), 1.0);
      }
      material.uniforms.uParticleFade.value = particleFade;
    }
    
    // 更新俯视图平面
    if (this.topViewPlane) {
      const material = this.topViewPlane.material as THREE.MeshBasicMaterial;
      material.opacity = this.currentOpacity * GALAXY_CONFIG.topViewOpacity;
    }
  }

  /**
   * 计算目标透明度
   */
  private calculateTargetOpacity(cameraDistance: number): void {
    const config = SCALE_VIEW_CONFIG;
    
    // 淡入阶段
    if (cameraDistance < config.galaxyShowStart) {
      this.targetOpacity = 0;
    } else if (cameraDistance < config.galaxyShowFull) {
      const range = config.galaxyShowFull - config.galaxyShowStart;
      this.targetOpacity = (cameraDistance - config.galaxyShowStart) / range;
    }
    // 完全显示阶段
    else {
      this.targetOpacity = 1;
    }
  }

  /**
   * 获取渲染组
   */
  getGroup(): THREE.Group {
    return this.group;
  }

  /**
   * 获取当前透明度
   */
  getOpacity(): number {
    return this.currentOpacity;
  }

  /**
   * 获取是否可见
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.particleSystem) {
      this.particleSystem.geometry.dispose();
      (this.particleSystem.material as THREE.Material).dispose();
    }
    
    if (this.topViewPlane) {
      this.topViewPlane.geometry.dispose();
      const material = this.topViewPlane.material as THREE.MeshBasicMaterial;
      if (material.map) material.map.dispose();
      material.dispose();
    }
    
    this.group.clear();
  }
}
