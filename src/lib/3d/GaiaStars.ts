/**
 * GaiaStars.ts - Gaia DR3 恒星渲染器
 * 
 * 加载并渲染 Gaia DR3 数据中的恒星
 * 数据格式：每颗恒星 24 字节 (6 x float32)
 * [x, y, z, mag, bp_rp, padding]
 * 坐标单位：parsec
 * 
 * 分为两组渲染：
 * - 亮星（mag < 4）：在太阳系尺度就可见
 * - 普通星：远距离才显示
 */

import * as THREE from 'three';
import { SCALE_VIEW_CONFIG, PARSEC_TO_AU } from '../config/galaxyConfig';

// Gaia 恒星配置
export const GAIA_STARS_CONFIG = {
  enabled: true,
  dataPath: '/data/gaia/gaia_gdr3-39aea62e-e77a-11f0-a3b5-bc97e148b76b-O-result.vot.bin',
  basePointSize: 1.0,         // 基础点大小（减小）
  brightnessScale: 5.0,       // 亮度缩放（增大，让亮星更突出）
  minPointSize: 1.0,          // 最小点大小
  maxPointSize: 35.0,         // 最大点大小
  // 亮星阈值（仍用于内部分组，但不再提前显示）
  brightStarMagThreshold: 4.0,
};

export class GaiaStars {
  private group: THREE.Group;
  private brightStarsCloud: THREE.Points | null = null;  // 亮星
  private normalStarsCloud: THREE.Points | null = null;  // 普通星
  private brightStarsOpacity: number = 0;
  private normalStarsOpacity: number = 0;
  private isLoaded: boolean = false;
  private starCount: number = 0;
  private brightStarCount: number = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'GaiaStars';
    this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      console.log('[GaiaStars] 开始加载数据...');
      const response = await fetch(GAIA_STARS_CONFIG.dataPath);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const buffer = await response.arrayBuffer();
      const stars = new Float32Array(buffer);
      
      this.starCount = Math.floor(stars.length / 6);
      console.log(`[GaiaStars] 加载了 ${this.starCount} 颗恒星`);
      
      // 先统计亮星数量
      let brightCount = 0;
      for (let i = 0; i < this.starCount; i++) {
        const mag = stars[i * 6 + 3];
        if (mag < GAIA_STARS_CONFIG.brightStarMagThreshold) {
          brightCount++;
        }
      }
      this.brightStarCount = brightCount;
      console.log(`[GaiaStars] 亮星数量: ${brightCount}`);
      
      // 分别创建亮星和普通星数组
      const brightPositions = new Float32Array(brightCount * 3);
      const brightColors = new Float32Array(brightCount * 3);
      const brightSizes = new Float32Array(brightCount);
      
      const normalCount = this.starCount - brightCount;
      const normalPositions = new Float32Array(normalCount * 3);
      const normalColors = new Float32Array(normalCount * 3);
      const normalSizes = new Float32Array(normalCount);
      
      let brightIdx = 0;
      let normalIdx = 0;
      
      // 统计星等范围
      let minMag = Infinity, maxMag = -Infinity;
      
      for (let i = 0; i < this.starCount; i++) {
        const idx = i * 6;
        const x = stars[idx];
        const y = stars[idx + 1];
        const z = stars[idx + 2];
        const mag = stars[idx + 3];
        const bpRp = stars[idx + 4];
        
        if (mag < minMag) minMag = mag;
        if (mag > maxMag) maxMag = mag;
        
        // 转换坐标：parsec -> AU
        const posX = x * PARSEC_TO_AU;
        const posY = z * PARSEC_TO_AU;  // Y 轴向上
        const posZ = y * PARSEC_TO_AU;
        
        // 颜色
        const color = this.bpRpToColor(bpRp);
        
        // 大小：让暗星很小，亮星很大
        // 星等范围大约 -1.5 到 10
        // 使用更激进的公式：暗星（mag > 6）很小，亮星（mag < 2）很大
        const mag_normalized = Math.max(-2, Math.min(mag, 10)); // 限制范围
        
        // 使用指数函数，让亮星和暗星差异巨大
        // mag = -1.5 时 size 最大，mag = 10 时 size 最小
        const sizeFactor = Math.pow(2.512, (6 - mag_normalized) * 0.8);
        const size = GAIA_STARS_CONFIG.basePointSize * sizeFactor * GAIA_STARS_CONFIG.brightnessScale;
        // 暗星最小 0.2，亮星最大 80
        const clampedSize = Math.max(0.2, Math.min(size, 80));
        
        if (mag < GAIA_STARS_CONFIG.brightStarMagThreshold) {
          // 亮星
          brightPositions[brightIdx * 3] = posX;
          brightPositions[brightIdx * 3 + 1] = posY;
          brightPositions[brightIdx * 3 + 2] = posZ;
          brightColors[brightIdx * 3] = color.r;
          brightColors[brightIdx * 3 + 1] = color.g;
          brightColors[brightIdx * 3 + 2] = color.b;
          brightSizes[brightIdx] = clampedSize;
          brightIdx++;
        } else {
          // 普通星
          normalPositions[normalIdx * 3] = posX;
          normalPositions[normalIdx * 3 + 1] = posY;
          normalPositions[normalIdx * 3 + 2] = posZ;
          normalColors[normalIdx * 3] = color.r;
          normalColors[normalIdx * 3 + 1] = color.g;
          normalColors[normalIdx * 3 + 2] = color.b;
          normalSizes[normalIdx] = clampedSize;
          normalIdx++;
        }
      }
      
      console.log(`[GaiaStars] 星等范围: ${minMag.toFixed(2)} 到 ${maxMag.toFixed(2)}`);
      
      // 创建两个点云
      this.brightStarsCloud = this.createPointCloud(brightPositions, brightColors, brightSizes, 96);
      this.normalStarsCloud = this.createPointCloud(normalPositions, normalColors, normalSizes, 95);
      
      this.group.add(this.brightStarsCloud);
      this.group.add(this.normalStarsCloud);
      
      this.isLoaded = true;
      console.log('[GaiaStars] 数据加载完成');
      
    } catch (error) {
      console.error('[GaiaStars] 加载数据失败:', error);
    }
  }

  private bpRpToColor(bpRp: number): THREE.Color {
    if (isNaN(bpRp) || bpRp === 0) {
      return new THREE.Color(0xfff4ea);
    }
    
    const clampedBpRp = Math.max(-0.5, Math.min(4.0, bpRp));
    
    if (clampedBpRp < -0.2) {
      return new THREE.Color(0x9bb0ff); // O 型
    } else if (clampedBpRp < 0.0) {
      return new THREE.Color(0xaabfff); // B 型
    } else if (clampedBpRp < 0.3) {
      return new THREE.Color(0xcad7ff); // A 型
    } else if (clampedBpRp < 0.6) {
      return new THREE.Color(0xf8f7ff); // F 型
    } else if (clampedBpRp < 0.9) {
      return new THREE.Color(0xfff4ea); // G 型
    } else if (clampedBpRp < 1.4) {
      return new THREE.Color(0xffd2a1); // K 型
    } else if (clampedBpRp < 2.0) {
      return new THREE.Color(0xffcc6f); // 早期 M 型
    } else {
      return new THREE.Color(0xff8844); // 晚期 M 型
    }
  }

  private createPointCloud(
    positions: Float32Array,
    colors: Float32Array,
    sizes: Float32Array,
    renderOrder: number
  ): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
        uBrightness: { value: 1.0 },  // 亮度调整参数
        uMinSize: { value: GAIA_STARS_CONFIG.minPointSize },
        uMaxSize: { value: GAIA_STARS_CONFIG.maxPointSize },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vSize;
        varying float vOriginalSize;
        uniform float uMinSize;
        uniform float uMaxSize;
        uniform float uBrightness;
        
        void main() {
          vColor = color;
          vOriginalSize = size;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          float dist = -mvPosition.z;
          // 基础倍数
          float baseSize = size * 8.0;
          float pointSize = baseSize * (800000.0 / dist);
          gl_PointSize = clamp(pointSize, uMinSize, uMaxSize);
          vSize = gl_PointSize;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vSize;
        varying float vOriginalSize;
        uniform float uOpacity;
        uniform float uBrightness;
        
        // RGB 转 HSL
        vec3 rgb2hsl(vec3 c) {
          float maxC = max(max(c.r, c.g), c.b);
          float minC = min(min(c.r, c.g), c.b);
          float l = (maxC + minC) / 2.0;
          
          if (maxC == minC) {
            return vec3(0.0, 0.0, l);
          }
          
          float d = maxC - minC;
          float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
          
          float h;
          if (maxC == c.r) {
            h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
          } else if (maxC == c.g) {
            h = (c.b - c.r) / d + 2.0;
          } else {
            h = (c.r - c.g) / d + 4.0;
          }
          h /= 6.0;
          
          return vec3(h, s, l);
        }
        
        // HSL 转 RGB
        float hue2rgb(float p, float q, float t) {
          if (t < 0.0) t += 1.0;
          if (t > 1.0) t -= 1.0;
          if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
          if (t < 1.0/2.0) return q;
          if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
          return p;
        }
        
        vec3 hsl2rgb(vec3 hsl) {
          float h = hsl.x;
          float s = hsl.y;
          float l = hsl.z;
          
          if (s == 0.0) {
            return vec3(l, l, l);
          }
          
          float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
          float p = 2.0 * l - q;
          
          float r = hue2rgb(p, q, h + 1.0/3.0);
          float g = hue2rgb(p, q, h);
          float b = hue2rgb(p, q, h - 1.0/3.0);
          
          return vec3(r, g, b);
        }
        
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          
          // 使用更平滑的边缘衰减，避免像素化
          // 高斯衰减：exp(-dist^2 * k)
          float gaussianFalloff = exp(-dist * dist * 8.0);
          
          // 核心亮点（更小更亮）
          float core = exp(-dist * dist * 200.0);
          
          // 光晕（平滑衰减）
          float glow = gaussianFalloff;
          
          // 四芒星光芒（亮星）- 使用更平滑的衰减避免锯齿
          float spikes = 0.0;
          if (vSize > 5.0) {
            vec2 absCoord = abs(center);
            
            // 使用二次衰减而非指数，更平滑
            // spike 宽度随距离中心增加而变窄
            float width1 = 0.02 + dist * 0.1;  // 动态宽度
            float width2 = 0.01 + dist * 0.05;
            
            // 水平和垂直 spike
            float spike1 = smoothstep(width1, 0.0, absCoord.x) * smoothstep(0.5, 0.0, absCoord.y);
            float spike2 = smoothstep(width1, 0.0, absCoord.y) * smoothstep(0.5, 0.0, absCoord.x);
            
            // 45度旋转的 spike
            vec2 rotCoord = vec2(
              abs(center.x * 0.707 + center.y * 0.707),
              abs(center.x * 0.707 - center.y * 0.707)
            );
            float spike3 = smoothstep(width2, 0.0, rotCoord.x) * smoothstep(0.5, 0.0, rotCoord.y);
            float spike4 = smoothstep(width2, 0.0, rotCoord.y) * smoothstep(0.5, 0.0, rotCoord.x);
            
            float spikeIntensity = min((vSize - 5.0) / 10.0, 1.0);
            spikes = (spike1 + spike2) * spikeIntensity * 0.6 + (spike3 + spike4) * spikeIntensity * 0.3;
          }
          
          float alpha = core + glow * 0.4 + spikes;
          
          // 边缘完全透明
          if (alpha < 0.001) discard;
          
          // 非线性亮度调整：暗星增亮更多，亮星增亮更少
          float sizeNormalized = clamp((vOriginalSize - 0.2) / 40.0, 0.0, 1.0);
          float exponent = 4.0 - sizeNormalized * 3.0;
          float brightnessMultiplier = pow(uBrightness, exponent);
          
          // 使用 HSL 调整亮度，保持饱和度
          vec3 hsl = rgb2hsl(vColor);
          float newL = clamp(hsl.z * brightnessMultiplier, 0.0, 1.0);
          vec3 adjustedColor = hsl2rgb(vec3(hsl.x, hsl.y, newL));
          
          // 中心更亮（白色叠加）
          vec3 finalColor = mix(adjustedColor, vec3(1.0), core * 0.6);
          
          // 透明度也随亮度调整
          float finalAlpha = alpha * uOpacity * clamp(brightnessMultiplier, 0.2, 3.0);
          
          gl_FragColor = vec4(finalColor, finalAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = renderOrder;
    return points;
  }

  update(cameraDistance: number, deltaTime: number, starBrightness: number = 1.0): void {
    if (!this.isLoaded) return;
    
    // 所有恒星使用相同的显示逻辑（与近邻恒星相同）
    const config = SCALE_VIEW_CONFIG;
    let targetOpacity = 0;
    
    if (cameraDistance < config.nearbyStarsShowStart) {
      targetOpacity = 0;
    } else if (cameraDistance < config.nearbyStarsShowFull) {
      const range = config.nearbyStarsShowFull - config.nearbyStarsShowStart;
      targetOpacity = (cameraDistance - config.nearbyStarsShowStart) / range;
    } else if (cameraDistance < config.nearbyStarsFadeStart) {
      targetOpacity = 1;
    } else if (cameraDistance < config.nearbyStarsFadeEnd) {
      const range = config.nearbyStarsFadeEnd - config.nearbyStarsFadeStart;
      targetOpacity = 1 - (cameraDistance - config.nearbyStarsFadeStart) / range;
    } else {
      targetOpacity = 0;
    }
    
    // 平滑过渡
    const fadeSpeed = 2.0;
    this.brightStarsOpacity += (targetOpacity - this.brightStarsOpacity) * Math.min(deltaTime * fadeSpeed, 1);
    this.normalStarsOpacity += (targetOpacity - this.normalStarsOpacity) * Math.min(deltaTime * fadeSpeed, 1);
    
    // 更新点云
    if (this.brightStarsCloud) {
      this.brightStarsCloud.visible = this.brightStarsOpacity > 0.01;
      const mat = this.brightStarsCloud.material as THREE.ShaderMaterial;
      mat.uniforms.uOpacity.value = this.brightStarsOpacity;
      mat.uniforms.uBrightness.value = starBrightness;
    }
    
    if (this.normalStarsCloud) {
      this.normalStarsCloud.visible = this.normalStarsOpacity > 0.01;
      const mat = this.normalStarsCloud.material as THREE.ShaderMaterial;
      mat.uniforms.uOpacity.value = this.normalStarsOpacity;
      mat.uniforms.uBrightness.value = starBrightness;
    }
  }

  getGroup(): THREE.Group { return this.group; }
  getStarCount(): number { return this.starCount; }
  getBrightStarCount(): number { return this.brightStarCount; }

  dispose(): void {
    if (this.brightStarsCloud) {
      this.brightStarsCloud.geometry.dispose();
      (this.brightStarsCloud.material as THREE.Material).dispose();
    }
    if (this.normalStarsCloud) {
      this.normalStarsCloud.geometry.dispose();
      (this.normalStarsCloud.material as THREE.Material).dispose();
    }
    this.group.clear();
  }
}
