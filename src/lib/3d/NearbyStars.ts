/**
 * NearbyStars.ts - 近邻恒星渲染器
 * 
 * 功能：
 * - 渲染 100-300 光年内的近邻恒星
 * - 使用点光源或小球渲染
 * - 支持恒星颜色温度映射
 * - 支持恒星闪烁效果
 * - 根据相机距离动态显示/隐藏
 * 
 * 数据来源：Hipparcos / Gaia 精选近邻恒星
 */

import * as THREE from 'three';
import {
  NEARBY_STARS_CONFIG,
  NEARBY_STARS_DATA,
  SCALE_VIEW_CONFIG,
  LIGHT_YEAR_TO_AU,
  equatorialToCartesian,
  StarData,
} from '../config/galaxyConfig';

export class NearbyStars {
  private group: THREE.Group;
  private pointCloud: THREE.Points | null = null;
  private spheres: THREE.Mesh[] = [];
  private starPositions: Float32Array;
  private starColors: Float32Array;
  private starSizes: Float32Array;
  private originalSizes: Float32Array;
  private currentOpacity: number = 0;
  private targetOpacity: number = 0;
  private time: number = 0;
  private isVisible: boolean = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'NearbyStars';
    
    // 初始化数组
    const starCount = NEARBY_STARS_DATA.length;
    this.starPositions = new Float32Array(starCount * 3);
    this.starColors = new Float32Array(starCount * 3);
    this.starSizes = new Float32Array(starCount);
    this.originalSizes = new Float32Array(starCount);
    
    this.initializeStars();
  }

  /**
   * 初始化恒星数据
   */
  private initializeStars(): void {
    const config = NEARBY_STARS_CONFIG;
    
    // 处理每颗恒星
    NEARBY_STARS_DATA.forEach((star, index) => {
      // 计算 3D 位置（equatorialToCartesian 已经是 Y 轴向上）
      const pos = equatorialToCartesian(star.ra, star.dec, star.distance);
      this.starPositions[index * 3] = pos.x;
      this.starPositions[index * 3 + 1] = pos.y;
      this.starPositions[index * 3 + 2] = pos.z;
      
      // 设置颜色
      const color = new THREE.Color(star.color);
      this.starColors[index * 3] = color.r;
      this.starColors[index * 3 + 1] = color.g;
      this.starColors[index * 3 + 2] = color.b;
      
      // 计算大小（基于绝对星等）
      // 绝对星等越小，恒星越亮越大
      const brightnessRatio = Math.pow(10, (4.83 - star.absoluteMagnitude) / 2.5);
      const size = config.basePointSize * Math.min(Math.max(brightnessRatio * config.brightnessScale, 0.5), 10);
      this.starSizes[index] = size;
      this.originalSizes[index] = size;
    });
    
    // 创建点云或球体
    if (config.useSpheres) {
      this.createSpheres();
    } else {
      this.createPointCloud();
    }
  }

  /**
   * 创建点云渲染
   */
  private createPointCloud(): void {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.starPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.starColors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.starSizes, 1));
    
    // 创建自定义着色器材质
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
        uBrightness: { value: 1.0 },  // 亮度调整参数
        uTime: { value: 0 },
        uTwinkleEnabled: { value: NEARBY_STARS_CONFIG.twinkleEnabled ? 1.0 : 0.0 },
        uTwinkleIntensity: { value: NEARBY_STARS_CONFIG.twinkleIntensity },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vSize;
        varying float vOriginalSize;
        uniform float uTime;
        uniform float uTwinkleEnabled;
        uniform float uTwinkleIntensity;
        
        // 简单的伪随机函数
        float random(vec3 p) {
          return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
        }
        
        void main() {
          vColor = color;
          vOriginalSize = size;
          
          // 闪烁效果
          float twinkle = 1.0;
          if (uTwinkleEnabled > 0.5) {
            float phase = random(position) * 6.28318;
            float speed = 0.5 + random(position.zxy) * 1.5;
            twinkle = 1.0 - uTwinkleIntensity * 0.5 * (1.0 + sin(uTime * speed + phase));
          }
          
          vSize = size * twinkle;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // 点大小 - 大幅增加基础大小，确保可见
          float dist = -mvPosition.z;
          float baseSize = vSize * 8.0; // 增大基础倍数
          gl_PointSize = max(baseSize * (800000.0 / dist), 4.0); // 最小 4 像素
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
          // 圆形点
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          
          if (dist > 0.5) discard;
          
          // 核心白点和光晕
          float core = 1.0 - smoothstep(0.0, 0.05, dist);
          float glow = 1.0 - smoothstep(0.03, 0.5, dist);
          
          // 四芒星光芒（亮星）- 使用 smoothstep 避免锯齿
          float spikes = 0.0;
          if (vSize > 5.0) {
            vec2 absCoord = abs(center);
            
            // 使用 smoothstep 实现平滑边缘
            float width1 = 0.02 + dist * 0.1;
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
          
          float alpha = core + glow * 0.5 + spikes;
          
          // 非线性亮度调整：暗星增亮更多，亮星增亮更少
          float sizeNormalized = clamp((vOriginalSize - 0.5) / 8.0, 0.0, 1.0);
          
          // 计算亮度增益指数：暗星指数大（4.0），亮星指数小（1.0）
          float exponent = 4.0 - sizeNormalized * 3.0;
          
          // 应用非线性亮度调整
          float brightnessMultiplier = pow(uBrightness, exponent);
          
          // 使用 HSL 调整亮度，保持饱和度
          vec3 hsl = rgb2hsl(vColor);
          float newL = clamp(hsl.z * brightnessMultiplier, 0.0, 1.0);
          vec3 adjustedColor = hsl2rgb(vec3(hsl.x, hsl.y, newL));
          
          // 中心更亮
          vec3 finalColor = mix(adjustedColor, vec3(1.0), core * 0.5);
          
          // 透明度也随亮度调整
          float finalAlpha = alpha * uOpacity * clamp(brightnessMultiplier, 0.2, 3.0);
          
          gl_FragColor = vec4(finalColor, finalAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    
    this.pointCloud = new THREE.Points(geometry, material);
    this.pointCloud.frustumCulled = false;
    this.pointCloud.renderOrder = 100;
    this.group.add(this.pointCloud);
  }

  /**
   * 创建球体渲染（用于近距离查看）
   */
  private createSpheres(): void {
    const config = NEARBY_STARS_CONFIG;
    
    NEARBY_STARS_DATA.forEach((star, index) => {
      // 计算球体大小
      const brightnessRatio = Math.pow(10, (4.83 - star.absoluteMagnitude) / 2.5);
      const radius = config.sphereBaseRadius * Math.min(Math.max(brightnessRatio, 0.1), 5);
      
      const geometry = new THREE.SphereGeometry(radius, 16, 12);
      const material = new THREE.MeshBasicMaterial({
        color: star.color,
        transparent: true,
        opacity: 0,
      });
      
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(
        this.starPositions[index * 3],
        this.starPositions[index * 3 + 1],
        this.starPositions[index * 3 + 2]
      );
      sphere.userData.starData = star;
      
      this.spheres.push(sphere);
      this.group.add(sphere);
    });
  }

  /**
   * 更新渲染（每帧调用）
   */
  update(cameraDistance: number, deltaTime: number, starBrightness: number = 1.0): void {
    this.time += deltaTime * NEARBY_STARS_CONFIG.twinkleSpeed;
    
    // 计算目标透明度
    this.calculateTargetOpacity(cameraDistance);
    
    // 平滑过渡透明度
    const fadeSpeed = 2.0;
    this.currentOpacity += (this.targetOpacity - this.currentOpacity) * Math.min(deltaTime * fadeSpeed, 1);
    
    // 更新可见性
    const shouldBeVisible = this.currentOpacity > 0.01;
    if (shouldBeVisible !== this.isVisible) {
      this.isVisible = shouldBeVisible;
      this.group.visible = this.isVisible;
    }
    
    if (!this.isVisible) return;
    
    // 更新点云
    if (this.pointCloud) {
      const material = this.pointCloud.material as THREE.ShaderMaterial;
      material.uniforms.uOpacity.value = this.currentOpacity;
      material.uniforms.uBrightness.value = starBrightness;
      material.uniforms.uTime.value = this.time;
    }
    
    // 更新球体（球体使用简单的透明度调整）
    this.spheres.forEach((sphere) => {
      const material = sphere.material as THREE.MeshBasicMaterial;
      material.opacity = this.currentOpacity * starBrightness;
    });
  }

  /**
   * 计算目标透明度
   */
  private calculateTargetOpacity(cameraDistance: number): void {
    const config = SCALE_VIEW_CONFIG;
    
    // 淡入阶段
    if (cameraDistance < config.nearbyStarsShowStart) {
      this.targetOpacity = 0;
    } else if (cameraDistance < config.nearbyStarsShowFull) {
      const range = config.nearbyStarsShowFull - config.nearbyStarsShowStart;
      this.targetOpacity = (cameraDistance - config.nearbyStarsShowStart) / range;
    }
    // 完全显示阶段
    else if (cameraDistance < config.nearbyStarsFadeStart) {
      this.targetOpacity = 1;
    }
    // 淡出阶段
    else if (cameraDistance < config.nearbyStarsFadeEnd) {
      const range = config.nearbyStarsFadeEnd - config.nearbyStarsFadeStart;
      this.targetOpacity = 1 - (cameraDistance - config.nearbyStarsFadeStart) / range;
    }
    // 完全隐藏
    else {
      this.targetOpacity = 0;
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
   * 获取恒星数据（用于标签显示）
   */
  getStarData(): StarData[] {
    return NEARBY_STARS_DATA;
  }

  /**
   * 获取恒星位置
   */
  getStarPosition(index: number): THREE.Vector3 {
    return new THREE.Vector3(
      this.starPositions[index * 3],
      this.starPositions[index * 3 + 1],
      this.starPositions[index * 3 + 2]
    );
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.pointCloud) {
      this.pointCloud.geometry.dispose();
      (this.pointCloud.material as THREE.Material).dispose();
    }
    
    this.spheres.forEach((sphere) => {
      sphere.geometry.dispose();
      (sphere.material as THREE.Material).dispose();
    });
    
    this.group.clear();
  }
}
