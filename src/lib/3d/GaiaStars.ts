/**
 * GaiaStars.ts - Gaia DR3 恒星渲染器
 * 
 * 加载并渲染 Gaia DR3 数据中的恒星
 * 数据格式：每颗恒星 24 字节 (6 x float32)
 * [x, y, z, mag, bp_rp, padding]
 * 坐标单位：parsec
 */

import * as THREE from 'three';
import { SCALE_VIEW_CONFIG, LIGHT_YEAR_TO_AU, PARSEC_TO_AU } from '../config/galaxyConfig';

// Gaia 恒星配置
export const GAIA_STARS_CONFIG = {
  enabled: true,
  dataPath: '/data/gaia/gaia_gdr3-39aea62e-e77a-11f0-a3b5-bc97e148b76b-O-result.vot.bin',
  basePointSize: 6.0,        // 基础点大小（增大）
  brightnessScale: 2.0,      // 亮度缩放（增大）
  minPointSize: 2.0,         // 最小点大小（像素）
  maxPointSize: 15.0,        // 最大点大小（像素）
};

export class GaiaStars {
  private group: THREE.Group;
  private pointCloud: THREE.Points | null = null;
  private currentOpacity: number = 0;
  private targetOpacity: number = 0;
  private isVisible: boolean = false;
  private isLoaded: boolean = false;
  private starCount: number = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'GaiaStars';
    this.group.visible = false;
    
    this.loadData();
  }

  /**
   * 加载 Gaia 二进制数据
   */
  private async loadData(): Promise<void> {
    try {
      console.log('[GaiaStars] 开始加载数据...');
      const response = await fetch(GAIA_STARS_CONFIG.dataPath);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const buffer = await response.arrayBuffer();
      const stars = new Float32Array(buffer);
      
      // 每颗恒星 6 个 float32
      this.starCount = Math.floor(stars.length / 6);
      console.log(`[GaiaStars] 加载了 ${this.starCount} 颗恒星`);
      
      // 创建数组
      const positions = new Float32Array(this.starCount * 3);
      const colors = new Float32Array(this.starCount * 3);
      const sizes = new Float32Array(this.starCount);
      
      for (let i = 0; i < this.starCount; i++) {
        const idx = i * 6;
        const x = stars[idx];     // parsec
        const y = stars[idx + 1]; // parsec
        const z = stars[idx + 2]; // parsec
        const mag = stars[idx + 3];     // G 波段星等
        const bpRp = stars[idx + 4];    // 颜色指数
        
        // 调试：记录前几颗恒星的数据
        if (i < 5) {
          console.log(`[GaiaStars] 恒星 ${i}: x=${x}, y=${y}, z=${z}, mag=${mag}, bp_rp=${bpRp}`);
        }
        
        // 转换坐标：parsec -> AU
        positions[i * 3] = x * PARSEC_TO_AU;
        positions[i * 3 + 1] = z * PARSEC_TO_AU;  // Y 轴向上
        positions[i * 3 + 2] = y * PARSEC_TO_AU;
        
        // 根据 bp_rp 颜色指数计算颜色
        const color = this.bpRpToColor(bpRp);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        
        // 根据视星等计算大小
        // 视星等范围大约 -1.5 (天狼星) 到 10 (肉眼极限)
        // 星等每差 5 等，亮度差 100 倍
        // 大幅增加亮度差异
        const referenceMag = 8; // 参考星等
        const brightness = Math.pow(2.512, referenceMag - mag);
        // 使用更激进的缩放，让亮星更大
        const size = GAIA_STARS_CONFIG.basePointSize * 
          Math.pow(brightness, 0.5) * GAIA_STARS_CONFIG.brightnessScale;
        sizes[i] = Math.max(0.3, Math.min(size, 30)); // 扩大范围
        
        // 记录亮度范围
        if (i < 5) {
          console.log(`[GaiaStars] 恒星 ${i}: brightness=${brightness.toFixed(2)}, size=${sizes[i].toFixed(2)}`);
        }
      }
      
      // 统计星等范围
      let minMag = Infinity, maxMag = -Infinity;
      for (let i = 0; i < this.starCount; i++) {
        const mag = stars[i * 6 + 3];
        if (mag < minMag) minMag = mag;
        if (mag > maxMag) maxMag = mag;
      }
      console.log(`[GaiaStars] 星等范围: ${minMag.toFixed(2)} 到 ${maxMag.toFixed(2)}`);
      
      this.createPointCloud(positions, colors, sizes);
      this.isLoaded = true;
      console.log('[GaiaStars] 数据加载完成');
      
    } catch (error) {
      console.error('[GaiaStars] 加载数据失败:', error);
    }
  }

  /**
   * 将 BP-RP 颜色指数转换为 RGB 颜色
   * BP-RP 范围大约 -0.5 (蓝) 到 5.0 (红)
   * 使用更鲜艳的颜色以匹配原有恒星风格
   */
  private bpRpToColor(bpRp: number): THREE.Color {
    // 处理无效值
    if (isNaN(bpRp) || bpRp === 0) {
      return new THREE.Color(0xfff4ea); // 默认类太阳色
    }
    
    // 限制范围
    const clampedBpRp = Math.max(-0.5, Math.min(4.0, bpRp));
    
    // 使用与 NearbyStars 相似的颜色映射
    // 基于光谱类型的典型颜色
    if (clampedBpRp < -0.2) {
      // O 型星 - 蓝色
      return new THREE.Color(0x9bb0ff);
    } else if (clampedBpRp < 0.0) {
      // B 型星 - 蓝白色
      return new THREE.Color(0xaabfff);
    } else if (clampedBpRp < 0.3) {
      // A 型星 - 白色偏蓝
      return new THREE.Color(0xcad7ff);
    } else if (clampedBpRp < 0.6) {
      // F 型星 - 白色
      return new THREE.Color(0xf8f7ff);
    } else if (clampedBpRp < 0.9) {
      // G 型星 - 黄白色（类太阳）
      return new THREE.Color(0xfff4ea);
    } else if (clampedBpRp < 1.4) {
      // K 型星 - 橙色
      return new THREE.Color(0xffd2a1);
    } else if (clampedBpRp < 2.0) {
      // 早期 M 型星 - 橙红色
      return new THREE.Color(0xffcc6f);
    } else {
      // 晚期 M 型星 - 红色
      return new THREE.Color(0xff8844);
    }
  }

  /**
   * 创建点云
   */
  private createPointCloud(
    positions: Float32Array,
    colors: Float32Array,
    sizes: Float32Array
  ): void {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
        uMinSize: { value: GAIA_STARS_CONFIG.minPointSize },
        uMaxSize: { value: GAIA_STARS_CONFIG.maxPointSize },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vSize;
        uniform float uMinSize;
        uniform float uMaxSize;
        
        void main() {
          vColor = color;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // 点大小：基于距离缩放
          float dist = -mvPosition.z;
          float baseSize = size * 10.0;
          float pointSize = baseSize * (800000.0 / dist);
          gl_PointSize = clamp(pointSize, uMinSize, uMaxSize);
          vSize = gl_PointSize;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vSize;
        uniform float uOpacity;
        
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          
          if (dist > 0.5) discard;
          
          // 基础圆形光晕
          float core = 1.0 - smoothstep(0.0, 0.12, dist);
          float glow = 1.0 - smoothstep(0.05, 0.5, dist);
          
          // 四芒星光芒效果（仅对亮星，即大点）
          float spikes = 0.0;
          if (vSize > 6.0) {
            // 计算到四条光芒轴的距离
            vec2 absCoord = abs(center);
            float spike1 = max(0.0, 1.0 - absCoord.x * 8.0) * max(0.0, 1.0 - absCoord.y * 25.0);
            float spike2 = max(0.0, 1.0 - absCoord.y * 8.0) * max(0.0, 1.0 - absCoord.x * 25.0);
            
            // 45度方向的光芒
            vec2 rotCoord = vec2(
              abs(center.x * 0.707 + center.y * 0.707),
              abs(center.x * 0.707 - center.y * 0.707)
            );
            float spike3 = max(0.0, 1.0 - rotCoord.x * 10.0) * max(0.0, 1.0 - rotCoord.y * 30.0);
            float spike4 = max(0.0, 1.0 - rotCoord.y * 10.0) * max(0.0, 1.0 - rotCoord.x * 30.0);
            
            // 光芒强度随大小增加
            float spikeIntensity = (vSize - 6.0) / 10.0;
            spikes = (spike1 + spike2 + spike3 * 0.5 + spike4 * 0.5) * spikeIntensity * 0.8;
          }
          
          float alpha = core + glow * 0.5 + spikes;
          
          // 中心更亮
          float brightness = 1.0 + core * 2.5;
          
          gl_FragColor = vec4(vColor * brightness, alpha * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    
    this.pointCloud = new THREE.Points(geometry, material);
    this.pointCloud.frustumCulled = false;
    this.pointCloud.renderOrder = 95; // 在近邻恒星之前渲染
    this.group.add(this.pointCloud);
  }

  /**
   * 更新渲染
   */
  update(cameraDistance: number, deltaTime: number): void {
    if (!this.isLoaded) return;
    
    // 计算目标透明度（与近邻恒星相同的显示范围）
    this.calculateTargetOpacity(cameraDistance);
    
    // 平滑过渡
    const fadeSpeed = 2.0;
    this.currentOpacity += (this.targetOpacity - this.currentOpacity) * Math.min(deltaTime * fadeSpeed, 1);
    
    // 更新可见性
    const shouldBeVisible = this.currentOpacity > 0.01;
    if (shouldBeVisible !== this.isVisible) {
      this.isVisible = shouldBeVisible;
      this.group.visible = this.isVisible;
    }
    
    if (!this.isVisible || !this.pointCloud) return;
    
    // 更新透明度
    const material = this.pointCloud.material as THREE.ShaderMaterial;
    material.uniforms.uOpacity.value = this.currentOpacity;
  }

  /**
   * 计算目标透明度
   */
  private calculateTargetOpacity(cameraDistance: number): void {
    const config = SCALE_VIEW_CONFIG;
    
    // 使用与近邻恒星相同的显示范围
    if (cameraDistance < config.nearbyStarsShowStart) {
      this.targetOpacity = 0;
    } else if (cameraDistance < config.nearbyStarsShowFull) {
      const range = config.nearbyStarsShowFull - config.nearbyStarsShowStart;
      this.targetOpacity = (cameraDistance - config.nearbyStarsShowStart) / range;
    } else if (cameraDistance < config.nearbyStarsFadeStart) {
      this.targetOpacity = 1;
    } else if (cameraDistance < config.nearbyStarsFadeEnd) {
      const range = config.nearbyStarsFadeEnd - config.nearbyStarsFadeStart;
      this.targetOpacity = 1 - (cameraDistance - config.nearbyStarsFadeStart) / range;
    } else {
      this.targetOpacity = 0;
    }
  }

  getGroup(): THREE.Group { return this.group; }
  getOpacity(): number { return this.currentOpacity; }
  getIsVisible(): boolean { return this.isVisible; }
  getStarCount(): number { return this.starCount; }

  dispose(): void {
    if (this.pointCloud) {
      this.pointCloud.geometry.dispose();
      (this.pointCloud.material as THREE.Material).dispose();
    }
    this.group.clear();
  }
}
