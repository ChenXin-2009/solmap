/**
 * Planet.ts - 3D 行星类
 * 
 * 功能：
 * - 创建和管理 3D 行星网格（SphereGeometry + 自定义 Shader 材质）
 * - 实现真实的太阳光照效果（向阳面亮，背阳面暗）
 * - 支持地球昼夜贴图渐变（nightmap）
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
import { CelestialBodyConfig, rotationPeriodToSpeed } from '@/lib/types/celestialTypes';
import { MARKER_CONFIG, SUN_GLOW_CONFIG, SUN_RAINBOW_LAYERS, PLANET_LOD_CONFIG, PLANET_GRID_CONFIG, PLANET_AXIAL_TILT, PLANET_LIGHTING_CONFIG, getCelestialMaterialParams, SATURN_RING_CONFIG } from '@/lib/config/visualConfig';

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
  body?: CelestialBody; // Optional for backward compatibility
  config?: CelestialBodyConfig; // Optional celestial body configuration with rotation period
  rotationSpeed?: number; // 弧度/秒 (deprecated, use config.rotationPeriod instead)
  
  // Direct CelestialBodyConfig properties (for test compatibility)
  name?: string;
  radius?: number;
  color?: string;
  rotationPeriod?: number;
}

export class Planet {
  private mesh: THREE.Mesh;
  private geometry: THREE.SphereGeometry;
  private material: THREE.ShaderMaterial | THREE.MeshStandardMaterial;
  private rotationSpeed: number;
  private currentRotation: number = 0;
  private realRadius: number; // 真实半径（AU）
  private markerDiv: HTMLDivElement | null = null; // 标记圈DOM元素（2D）
  private markerObject: any = null; // CSS2DObject（当行星很小时显示）
  private currentOpacity: number = 0; // 当前透明度（用于渐隐）
  private targetOpacity: number = 0; // 目标透明度
  private glowMesh: THREE.Mesh | null = null; // 太阳光晕网格
  private rainbowSprites: THREE.Sprite[] = [];
  private gridGroup: THREE.Group | null = null; // 经纬线组
  private isSun: boolean = false; // 是否为太阳
  private currentSegments: number = 32; // 当前分段数（用于平滑过渡）
  private targetSegments: number = 32; // 目标分段数
  
  // Rotation tracking for pause/resume functionality
  private lastUpdateTime: number = 0; // Last time updateRotation was called
  private accumulatedRotation: number = 0; // Accumulated rotation from previous updates
  
  /**
   * 获取累积旋转角度（用于测试和调试）
   */
  getAccumulatedRotation(): number {
    return this.accumulatedRotation;
  }
  
  // Texture support (Render Layer only - does not affect physics)
  private textureLoaded: boolean = false; // 是否已应用贴图
  private textureBodyId: string | null = null; // 贴图对应的 BodyId（用于引用跟踪）
  private planetName: string = ''; // 行星名称（用于贴图查找）
  private axialTilt: number = 0; // 轴倾角（弧度）
  private isTidallyLocked: boolean = false; // 是否潮汐锁定
  private parentBodyName: string | null = null; // 母行星名称（用于潮汐锁定）
  
  // 夜间贴图支持（仅地球）
  private nightTexture: THREE.Texture | null = null;
  private hasNightMap: boolean = false;
  
  // 土星环支持
  private ringMesh: THREE.Mesh | null = null;
  private ringTexture: THREE.Texture | null = null;
  
  // 原始颜色（用于无贴图时的着色器）
  private originalColor: THREE.Color;

  constructor(config: PlanetConfig) {
    // Handle both old PlanetConfig (with body) and new CelestialBodyConfig (direct properties)
    let celestialConfig: CelestialBodyConfig | undefined;
    let bodyInfo: { name: string; color: string; radius: number; isSun?: boolean };
    
    if (config.body) {
      // Old style: config has body property
      celestialConfig = config.config;
      bodyInfo = {
        name: config.body.name,
        color: config.body.color,
        radius: config.body.radius,
        isSun: config.body.isSun
      };
    } else {
      // New style: config is CelestialBodyConfig-like (for tests)
      celestialConfig = config as CelestialBodyConfig;
      bodyInfo = {
        name: config.name || 'Unknown',
        color: config.color || '#FFFFFF',
        radius: config.radius || 0.01,
        isSun: false
      };
    }

    // 保存原始颜色
    this.originalColor = new THREE.Color(bodyInfo.color || 0xffffff);
    
    // Calculate rotation speed from rotation period if available
    if (celestialConfig?.rotationPeriod) {
      this.rotationSpeed = rotationPeriodToSpeed(celestialConfig.rotationPeriod);
    } else if (config.rotationPeriod) {
      this.rotationSpeed = rotationPeriodToSpeed(config.rotationPeriod);
    } else {
      this.rotationSpeed = config.rotationSpeed || 0;
    }
    
    this.isSun = bodyInfo.isSun || false;
    
    // 保存行星名称（用于贴图查找）
    this.planetName = bodyInfo.name.toLowerCase();
    
    // 检查是否为潮汐锁定的卫星
    if (celestialConfig?.isSatellite && celestialConfig?.parentBody) {
      this.isTidallyLocked = true;
      this.parentBodyName = celestialConfig.parentBody;
    }
    
    // 使用真实行星半径（AU单位）
    const planetName = bodyInfo.name.toLowerCase();
    this.realRadius = REAL_PLANET_RADII[planetName] || bodyInfo.radius;
    
    // 使用真实半径创建行星
    const radius = this.realRadius;

    // 创建几何体（初始化为基础分段数）
    this.targetSegments = PLANET_LOD_CONFIG.baseSegments;
    this.currentSegments = PLANET_LOD_CONFIG.baseSegments;
    this.geometry = new THREE.SphereGeometry(radius, this.currentSegments, this.currentSegments);

    // 创建材质
    if (this.isSun) {
      // 太阳使用标准材质（自发光）
      this.material = new THREE.MeshStandardMaterial({
        color: bodyInfo.color || 0xffffff,
        emissive: 0xffffaa,
        emissiveIntensity: 2.0,
      });
    } else {
      // 行星使用自定义着色器材质（真实光照）
      this.material = this.createPlanetShaderMaterial(bodyInfo.color || '#ffffff');
    }

    // 创建网格
    this.mesh = new THREE.Mesh(this.geometry, this.material);

    // 设置渲染顺序：行星应该在轨道和星空之后渲染（正数表示后渲染，会遮挡先渲染的物体）
    this.mesh.renderOrder = 0; // 默认渲染顺序
    
    // 应用轴倾角（相对于黄道面）
    // 在我们的坐标系中：Y 轴向上（黄道面法线），XZ 是黄道面
    // 轴倾角使北极从 +Y 方向倾斜
    // 绕 X 轴负向旋转，使北极向 +Z 方向倾斜
    const tiltDegrees = PLANET_AXIAL_TILT[this.planetName] ?? 0;
    this.axialTilt = THREE.MathUtils.degToRad(tiltDegrees);
    // 初始轴倾角设置（使用四元数，后续在 updateRotation 中会重新设置）
    const initialTiltQuaternion = new THREE.Quaternion();
    // 绕 X 轴负向旋转（使用负角度）
    initialTiltQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -this.axialTilt);
    this.mesh.quaternion.copy(initialTiltQuaternion);
    
    // 如果是太阳，创建光晕效果（使用屏幕空间 Sprite 替代嵌套球体）
    if (this.isSun && SUN_GLOW_CONFIG.enabled) {
      this.createSunGlow();
    }
    
    // 注意：标记圈在外部通过 createMarkerCircle() 方法创建
    // 创建经纬线（如果启用）
    if (PLANET_GRID_CONFIG.enabled && !this.isSun) {
      this.createLatLonGrid();
    }
    
    // 创建土星环（如果是土星）
    if (this.planetName === 'saturn' && SATURN_RING_CONFIG.enabled) {
      this.createSaturnRing();
    }
  }


  /**
   * 创建行星着色器材质
   * 实现真实的太阳光照效果：
   * - 向阳面亮，背阳面暗
   * - 昼夜交界处平滑渐变
   * - 支持地球夜间贴图
   * - 修复极点条纹问题
   * - 对比度、饱和度、伽马校正
   * - 菲涅尔边缘光照效果
   * - 每个天体使用独立的材质参数
   */
  private createPlanetShaderMaterial(color: string): THREE.ShaderMaterial {
    // 获取该天体的特定材质参数
    const params = getCelestialMaterialParams(this.planetName);
    
    const vertexShader = `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vPosition;
      varying vec3 vViewDirection;
      
      void main() {
        vUv = uv;
        vPosition = position;
        // 计算世界空间中的法线（考虑模型旋转）
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        
        // 计算视线方向（用于菲涅尔效果）
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        
        #include <logdepthbuf_vertex>
      }
    `;
    
    const fragmentShader = `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      
      uniform vec3 uColor;
      uniform vec3 uSunPosition;
      uniform sampler2D uDayTexture;
      uniform sampler2D uNightTexture;
      uniform float uHasTexture;
      uniform float uHasNightTexture;
      uniform float uAmbientIntensity;
      uniform float uTerminatorWidth;
      uniform float uNightMapIntensity;
      
      // 对比度、饱和度、伽马参数
      uniform float uContrastBoost;
      uniform float uSaturationBoost;
      uniform float uGamma;
      uniform float uMaxDaylightIntensity;
      uniform float uMinNightIntensity;
      
      // 菲涅尔效果参数
      uniform float uEnableFresnel;
      uniform float uFresnelIntensity;
      uniform vec3 uFresnelColor;
      uniform float uFresnelPower;
      
      // 极点修复参数
      uniform float uPoleBlendStart;
      uniform float uPoleBlendEnd;
      uniform float uPoleSampleCount;
      uniform float uPoleSampleRadius;
      
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vPosition;
      varying vec3 vViewDirection;
      
      // 辅助函数：调整对比度
      vec3 adjustContrast(vec3 color, float contrast) {
        return (color - 0.5) * contrast + 0.5;
      }
      
      // 辅助函数：调整饱和度
      vec3 adjustSaturation(vec3 color, float saturation) {
        float luminance = dot(color, vec3(0.299, 0.587, 0.114));
        return mix(vec3(luminance), color, saturation);
      }
      
      // 辅助函数：伽马校正
      vec3 applyGamma(vec3 color, float gamma) {
        return pow(max(color, vec3(0.0)), vec3(1.0 / gamma));
      }
      
      void main() {
        #include <logdepthbuf_fragment>
        
        // 计算从行星表面点到太阳的方向（世界空间）
        vec3 sunDirection = normalize(uSunPosition - vWorldPosition);
        
        // 使用世界空间法线计算光照
        float dotNL = dot(vWorldNormal, sunDirection);
        
        // 使用 smoothstep 创建平滑的昼夜过渡
        float dayFactor = smoothstep(-uTerminatorWidth, uTerminatorWidth, dotNL);
        
        // 修复极点条纹：在极点附近使用极点颜色混合
        // 计算到极点的距离（基于 Y 坐标，假设 Y 轴是极轴）
        vec3 normalizedPos = normalize(vPosition);
        float poleDistance = abs(normalizedPos.y); // 0 = 赤道, 1 = 极点
        
        // 使用配置参数进行极点混合
        float poleFactor = smoothstep(uPoleBlendStart, uPoleBlendEnd, poleDistance);
        
        // 获取白天颜色
        vec3 dayColor;
        if (uHasTexture > 0.5) {
          // 采样贴图
          vec3 texColor = texture2D(uDayTexture, vUv).rgb;
          
          // 在极点附近，采样周围的颜色进行平均，减少条纹
          if (poleFactor > 0.0) {
            // 在极点使用多个采样点的平均值
            vec3 poleColor = vec3(0.0);
            for (float i = 0.0; i < 16.0; i++) {
              if (i >= uPoleSampleCount) break;
              float angle = i * 3.14159265 * 2.0 / uPoleSampleCount;
              vec2 offset = vec2(cos(angle), sin(angle)) * uPoleSampleRadius;
              vec2 sampleUv = vec2(vUv.x + offset.x, vUv.y);
              // 确保 UV 在有效范围内
              sampleUv.x = fract(sampleUv.x);
              poleColor += texture2D(uDayTexture, sampleUv).rgb;
            }
            poleColor /= uPoleSampleCount;
            
            // 混合原始颜色和极点平均颜色
            texColor = mix(texColor, poleColor, poleFactor);
          }
          
          dayColor = texColor;
        } else {
          dayColor = uColor;
        }
        
        // 计算最终颜色
        vec3 finalColor;
        
        if (uHasNightTexture > 0.5) {
          // 地球：混合白天和夜间贴图
          vec3 nightColor = texture2D(uNightTexture, vUv).rgb * uNightMapIntensity;
          
          // 在极点也应用相同的混合
          if (poleFactor > 0.0) {
            vec3 poleNightColor = vec3(0.0);
            for (float i = 0.0; i < 16.0; i++) {
              if (i >= uPoleSampleCount) break;
              float angle = i * 3.14159265 * 2.0 / uPoleSampleCount;
              vec2 offset = vec2(cos(angle), sin(angle)) * uPoleSampleRadius;
              vec2 sampleUv = vec2(vUv.x + offset.x, vUv.y);
              sampleUv.x = fract(sampleUv.x);
              poleNightColor += texture2D(uNightTexture, sampleUv).rgb;
            }
            poleNightColor /= uPoleSampleCount;
            nightColor = mix(nightColor, poleNightColor * uNightMapIntensity, poleFactor);
          }
          
          vec3 nightBase = dayColor * uAmbientIntensity + nightColor;
          finalColor = mix(nightBase, dayColor * uMaxDaylightIntensity, dayFactor);
        } else {
          // 其他行星：使用配置的亮度范围
          float lightIntensity = mix(uAmbientIntensity, uMaxDaylightIntensity, dayFactor);
          finalColor = dayColor * lightIntensity;
        }
        
        // 确保颜色不会太暗
        finalColor = max(finalColor, vec3(uMinNightIntensity));
        
        // 应用对比度增强
        finalColor = adjustContrast(finalColor, uContrastBoost);
        
        // 应用饱和度增强
        finalColor = adjustSaturation(finalColor, uSaturationBoost);
        
        // 应用伽马校正
        finalColor = applyGamma(finalColor, uGamma);
        
        // 菲涅尔边缘光照效果（模拟大气散射）
        if (uEnableFresnel > 0.5) {
          float fresnel = pow(1.0 - max(dot(vWorldNormal, vViewDirection), 0.0), uFresnelPower);
          // 只在向阳面和边缘添加菲涅尔效果
          float fresnelMask = max(dayFactor * 0.5 + 0.5, 0.3); // 背面也有一点边缘光
          finalColor += uFresnelColor * fresnel * uFresnelIntensity * fresnelMask;
        }
        
        // 确保颜色在有效范围内
        finalColor = clamp(finalColor, vec3(0.0), vec3(1.0));
        
        // 输出完全不透明的颜色
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;
    
    // 使用天体特定的菲涅尔颜色
    const fresnelColor = new THREE.Color(params.fresnelColor);
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
        uDayTexture: { value: null },
        uNightTexture: { value: null },
        uHasTexture: { value: 0.0 },
        uHasNightTexture: { value: 0.0 },
        // 使用天体特定参数
        uAmbientIntensity: { value: params.ambientIntensity },
        uTerminatorWidth: { value: params.terminatorWidth },
        uNightMapIntensity: { value: params.nightMapIntensity },
        uContrastBoost: { value: params.contrastBoost },
        uSaturationBoost: { value: params.saturationBoost },
        uGamma: { value: params.gamma },
        uMaxDaylightIntensity: { value: params.maxDaylightIntensity },
        uMinNightIntensity: { value: params.minNightIntensity },
        // 菲涅尔效果
        uEnableFresnel: { value: params.enableFresnelEffect ? 1.0 : 0.0 },
        uFresnelIntensity: { value: params.fresnelIntensity },
        uFresnelColor: { value: fresnelColor },
        uFresnelPower: { value: params.fresnelPower },
        // 极点修复参数（全局配置）
        uPoleBlendStart: { value: PLANET_LIGHTING_CONFIG.poleBlendStart },
        uPoleBlendEnd: { value: PLANET_LIGHTING_CONFIG.poleBlendEnd },
        uPoleSampleCount: { value: PLANET_LIGHTING_CONFIG.poleSampleCount },
        uPoleSampleRadius: { value: PLANET_LIGHTING_CONFIG.poleSampleRadius },
      },
      vertexShader,
      fragmentShader,
      // 确保完全不透明
      transparent: false,
      opacity: 1.0,
      depthWrite: true,
      depthTest: true,
      side: THREE.FrontSide,
      blending: THREE.NormalBlending,
    });
    
    return material;
  }

  /**
   * 更新太阳位置（用于光照计算）
   * 每帧调用以更新着色器中的太阳位置
   */
  updateSunPosition(sunPosition: THREE.Vector3): void {
    if (this.isSun) return;
    
    if (this.material instanceof THREE.ShaderMaterial) {
      this.material.uniforms.uSunPosition.value.copy(sunPosition);
    }
  }


  /**
   * 创建土星环
   * 使用 RingGeometry 创建环形几何体，应用带 alpha 通道的贴图
   */
  private createSaturnRing(): void {
    const cfg = SATURN_RING_CONFIG;
    const saturnRadius = this.realRadius;
    
    // 计算环的内外半径
    const innerRadius = saturnRadius * cfg.innerRadius;
    const outerRadius = saturnRadius * cfg.outerRadius;
    
    // 创建环形几何体
    const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, cfg.segments, 1);
    
    // 修正 UV 映射，使贴图从内到外正确映射
    const pos = ringGeometry.attributes.position;
    const uv = ringGeometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const dist = Math.sqrt(x * x + y * y);
      // 将距离映射到 0-1 范围（内边缘到外边缘）
      const u = (dist - innerRadius) / (outerRadius - innerRadius);
      uv.setXY(i, u, 0.5);
    }
    uv.needsUpdate = true;
    
    // 创建材质（初始使用回退颜色，贴图稍后加载）
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: cfg.fallbackColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: cfg.opacity,
      depthWrite: false, // 避免透明部分遮挡
    });
    
    // 创建环网格
    this.ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    
    // 环默认在 XY 平面，需要旋转到 XZ 平面（赤道面）
    this.ringMesh.rotation.x = -Math.PI / 2;
    
    // 将环添加为土星的子对象，这样会跟随土星的轴倾角
    this.mesh.add(this.ringMesh);
    
    // 异步加载环贴图
    this.loadRingTexture();
  }
  
  /**
   * 加载土星环贴图
   */
  private loadRingTexture(): void {
    if (!this.ringMesh) return;
    
    const loader = new THREE.TextureLoader();
    loader.load(
      SATURN_RING_CONFIG.texturePath,
      (texture) => {
        // 贴图加载成功
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        this.ringTexture = texture;
        
        if (this.ringMesh) {
          const material = this.ringMesh.material as THREE.MeshBasicMaterial;
          material.map = texture;
          material.color.setHex(0xffffff); // 使用贴图颜色
          material.alphaMap = texture; // 使用贴图的 alpha 通道
          material.needsUpdate = true;
        }
      },
      undefined,
      (error) => {
        console.warn('Failed to load Saturn ring texture:', error);
        // 保持回退颜色
      }
    );
  }

  /**
   * 创建经纬线网格（细线，略微向外偏移避免与星球表面 Z-fighting）
   */
  private createLatLonGrid(): void {
    const cfg = PLANET_GRID_CONFIG;
    const radius = this.realRadius;
    // 使用相对于半径的偏移量，确保网格始终贴近表面
    const outward = radius * (cfg.outwardOffset || 0.002); // 相对偏移量
    const segs = Math.max(12, cfg.segments || 96);

    this.gridGroup = new THREE.Group();
    
    // 使用半透明的颜色来模拟透明度效果，但材质本身不透明
    const gridColor = new THREE.Color(cfg.color);
    // 将颜色与黑色混合来模拟透明度
    gridColor.multiplyScalar(cfg.opacity);
    
    const lineMat = new THREE.LineBasicMaterial({
      color: gridColor,
      transparent: false, // 不透明，确保正确的深度测试
      depthWrite: true,
      depthTest: true,
    });

    // 经线（固定经度，变化纬度）
    for (let i = 0; i < cfg.meridians; i++) {
      const lon = (i / cfg.meridians) * Math.PI * 2;
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= segs; j++) {
        const lat = -Math.PI / 2 + (j / segs) * Math.PI;
        const r = radius + outward;
        const x = r * Math.cos(lat) * Math.cos(lon);
        const y = r * Math.sin(lat);
        const z = r * Math.cos(lat) * Math.sin(lon);
        pts.push(new THREE.Vector3(x, y, z));
      }
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geom, lineMat);
      this.gridGroup.add(line);
    }

    // 纬线（固定纬度，变化经度）
    for (let i = 1; i <= cfg.parallels; i++) {
      const lat = -Math.PI / 2 + (i / (cfg.parallels + 1)) * Math.PI;
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= segs; j++) {
        const lon = (j / segs) * Math.PI * 2;
        const r = radius + outward;
        const x = r * Math.cos(lat) * Math.cos(lon);
        const y = r * Math.sin(lat);
        const z = r * Math.cos(lat) * Math.sin(lon);
        pts.push(new THREE.Vector3(x, y, z));
      }
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geom, lineMat);
      this.gridGroup.add(line);
    }

    // 将经纬线添加为行星的子对象，保持与行星一起移动/旋转
    if (this.gridGroup) {
      this.mesh.add(this.gridGroup);
      
      // 网格位于星球中心，不需要额外缩放（偏移已经在计算中处理）
      this.gridGroup.position.set(0, 0, 0);
      
      // 设置渲染顺序：经纬线在行星之后渲染，但会被行星遮挡
      this.gridGroup.renderOrder = 1;
    }
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
    // 使用保存的原始颜色（因为着色器材质没有 color 属性）
    const colorHex = this.originalColor.getHexString();
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
   * 更新星球自转
   * @param currentTime 当前时间（天）
   * @param timeSpeed 时间速度倍数
   * 
   * 自转实现说明：
   * 1. 轴倾角（axialTilt）定义了自转轴相对于黄道面法线的倾斜角度
   * 2. 自转应该绕着倾斜后的自转轴进行，而不是绕世界坐标系的 Y 轴
   * 3. 使用四元数来正确组合轴倾角和自转
   * 
   * 坐标系约定：
   * - Y 轴向上（黄道面法线方向，指向北黄极）
   * - XZ 平面是黄道面
   * - 北极默认指向 +Y，轴倾角使其向 +Z 方向倾斜
   */
  updateRotation(currentTime: number, timeSpeed: number = 1): void {
    // 潮汐锁定的卫星不使用常规自转，而是通过 updateTidalLocking 方法更新朝向
    if (this.isTidallyLocked) {
      this.lastUpdateTime = currentTime;
      return;
    }
    
    if (this.rotationSpeed === 0) {
      this.lastUpdateTime = currentTime;
      return;
    }
    
    // Calculate incremental rotation since last update
    const deltaTime = currentTime - this.lastUpdateTime;
    
    // If time is paused (timeSpeed = 0), don't add rotation but update time
    if (timeSpeed === 0) {
      this.lastUpdateTime = currentTime;
      return;
    }

    const deltaTimeInSeconds = deltaTime * 24 * 3600; // Convert days to seconds
    const deltaRotation = this.rotationSpeed * deltaTimeInSeconds * timeSpeed;
    
    // Accumulate rotation
    this.accumulatedRotation += deltaRotation;
    
    // 使用四元数正确组合轴倾角和自转
    // 步骤：
    // 1. 创建轴倾角四元数：绕 X 轴负向旋转，使北极向 +Z 方向倾斜
    // 2. 创建自转四元数：绕 Y 轴（本地坐标系）旋转
    // 3. 组合：先应用轴倾角，再应用自转（自转是绕倾斜后的轴）
    
    const tiltQuaternion = new THREE.Quaternion();
    // 绕 X 轴负向旋转（使用负角度）
    tiltQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -this.axialTilt);
    
    const spinQuaternion = new THREE.Quaternion();
    spinQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.accumulatedRotation);
    
    // 组合四元数：先倾斜，再自转（注意顺序：tilt * spin）
    // 这样自转是绕着倾斜后的本地 Y 轴进行的
    const finalQuaternion = new THREE.Quaternion();
    finalQuaternion.multiplyQuaternions(tiltQuaternion, spinQuaternion);
    
    this.mesh.quaternion.copy(finalQuaternion);
    
    // Update last update time
    this.lastUpdateTime = currentTime;
    
    // Since the grid is a child of the mesh, it will automatically rotate with the planet
    // This creates the visual effect of the latitude/longitude lines rotating with the planet
  }

  /**
   * 更新潮汐锁定卫星的朝向
   * 潮汐锁定的卫星始终以同一面朝向母行星
   * 
   * 实现说明：
   * 1. 计算从卫星指向母行星的方向向量
   * 2. 使用 lookAt 的原理，但需要考虑轴倾角
   * 3. 卫星的 +Z 方向（前方）应该指向母行星
   * 4. 同时保持轴倾角的影响
   * 
   * @param parentPosition - 母行星的世界坐标位置
   */
  updateTidalLocking(parentPosition: THREE.Vector3): void {
    if (!this.isTidallyLocked) return;
    
    // 获取卫星当前位置
    const satellitePosition = this.mesh.position.clone();
    
    // 计算从卫星指向母行星的方向向量（在 XZ 平面上）
    const directionToParent = new THREE.Vector3()
      .subVectors(parentPosition, satellitePosition);
    
    // 计算卫星应该面向的角度（绕 Y 轴）
    // atan2 返回从正 Z 轴到方向向量的角度
    const targetRotationY = Math.atan2(directionToParent.x, directionToParent.z);
    
    // 使用四元数正确组合轴倾角和朝向
    // 步骤：
    // 1. 创建轴倾角四元数：绕 X 轴负向旋转（使北极向 +Z 方向倾斜）
    // 2. 创建朝向四元数：绕 Y 轴旋转使卫星面向母行星
    // 3. 组合：先应用轴倾角，再应用朝向
    
    const tiltQuaternion = new THREE.Quaternion();
    // 绕 X 轴负向旋转（使用负角度）
    tiltQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -this.axialTilt);
    
    const facingQuaternion = new THREE.Quaternion();
    facingQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetRotationY);
    
    // 组合四元数：先倾斜，再朝向
    const finalQuaternion = new THREE.Quaternion();
    finalQuaternion.multiplyQuaternions(tiltQuaternion, facingQuaternion);
    
    this.mesh.quaternion.copy(finalQuaternion);
  }

  /**
   * 检查是否为潮汐锁定的卫星
   */
  getIsTidallyLocked(): boolean {
    return this.isTidallyLocked;
  }

  /**
   * 获取母行星名称（用于潮汐锁定）
   */
  getParentBodyName(): string | null {
    return this.parentBodyName;
  }

  /**
   * 设置经纬线网格的可见性
   */
  setGridVisible(visible: boolean): void {
    if (this.gridGroup) {
      this.gridGroup.visible = visible;
    }
  }
  
  /**
   * 获取经纬线网格的可见性
   */
  getGridVisible(): boolean {
    return this.gridGroup ? this.gridGroup.visible : false;
  }

  /**
   * 更新网格可见性（基于相机距离）
   * @param distance 相机到星球中心的距离（world units）
   */
  updateGridVisibility(distance: number): void {
    if (!this.gridGroup) return;
    
    // 根据距离调整网格颜色亮度（模拟透明度效果）
    // 距离越近，网格越清晰；距离越远，网格越淡
    const minDistance = this.realRadius * 2; // 最小距离（网格完全可见）
    const maxDistance = this.realRadius * 50; // 最大距离（网格开始淡出）
    
    let brightness = PLANET_GRID_CONFIG.opacity;
    if (distance > minDistance) {
      const fadeRange = maxDistance - minDistance;
      const fadeProgress = Math.min(1, (distance - minDistance) / fadeRange);
      brightness = PLANET_GRID_CONFIG.opacity * (1 - fadeProgress * 0.7); // 最多淡化70%
    }
    
    // 更新所有网格线的颜色亮度
    const baseColor = new THREE.Color(PLANET_GRID_CONFIG.color);
    const adjustedColor = baseColor.clone().multiplyScalar(brightness);
    
    this.gridGroup.traverse((child) => {
      if (child instanceof THREE.Line) {
        const material = child.material as THREE.LineBasicMaterial;
        if (material) {
          material.color.copy(adjustedColor);
          material.needsUpdate = true;
        }
      }
    });
  }


  /**
   * 更新 LOD（根据相机距离动态调整星球的几何细节）
   * 
   * 原理：
   * - 当相机远离时，分段数减少以优化性能
   * - 当相机靠近时，分段数增加以显示更多细节，消除棱角感
   * - 使用平滑过渡避免频繁重建几何体
   * 
   * @param distance 相机到星球中心的距离（world units）
   */
  updateLOD(distance: number): void {
    // 根据距离计算目标分段数
    // 使用对数缩放，使分段数的变化更平缓
    const normalizedDistance = Math.max(0.1, distance / PLANET_LOD_CONFIG.transitionDistance);
    // 使用反向函数：距离越近，分段数越多
    // baseSegments * 2 = 当距离为 transitionDistance 时的分段数
    const targetSegmentsRaw = PLANET_LOD_CONFIG.baseSegments * (1 + 1 / Math.max(0.5, normalizedDistance));
    this.targetSegments = Math.round(
      Math.max(PLANET_LOD_CONFIG.minSegments, 
               Math.min(PLANET_LOD_CONFIG.maxSegments, targetSegmentsRaw))
    );

    // 平滑过渡分段数（避免频繁重建）
    const segmentDiff = this.targetSegments - this.currentSegments;
    if (Math.abs(segmentDiff) > 0) {
      // 使用平滑系数进行缓动过渡
      const smoothedChange = Math.round(segmentDiff * PLANET_LOD_CONFIG.smoothness);
      const newSegments = this.currentSegments + smoothedChange;
      
      // 只在分段数变化达到阈值时才重建几何体（避免过于频繁的重建）
      if (newSegments !== this.currentSegments) {
        this.currentSegments = newSegments;
        this.rebuildGeometry();
      }
    }
  }

  /**
   * 重建星球几何体（更换分段数）
   * 释放旧几何体，创建新几何体
   */
  private rebuildGeometry(): void {
    const radius = this.geometry.parameters.radius;
    
    // 释放旧几何体
    this.geometry.dispose();
    
    // 创建新几何体
    this.geometry = new THREE.SphereGeometry(radius, this.currentSegments, this.currentSegments);
    
    // 更新网格的几何体
    this.mesh.geometry = this.geometry;
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

  /**
   * 获取行星名称（用于贴图查找）
   */
  getPlanetName(): string {
    return this.planetName;
  }

  /**
   * 检查是否为太阳
   */
  getIsSun(): boolean {
    return this.isSun;
  }

  /**
   * 应用贴图到行星材质
   * 
   * CRITICAL: 
   * - Sun 排除：永远不对太阳应用贴图（保持 emissive-only）
   * - 贴图仅用于渲染，不影响物理计算
   * - 支持着色器材质的贴图应用
   * 
   * @param texture - THREE.Texture 实例（或 null 表示回退到纯色）
   * @param bodyId - 天体 ID（用于引用跟踪）
   */
  applyTexture(texture: THREE.Texture | null, bodyId: string): void {
    // Sun 排除：永远不对太阳应用贴图
    if (this.isSun) {
      return;
    }
    
    if (texture) {
      if (this.material instanceof THREE.ShaderMaterial) {
        // 着色器材质：设置 uniform（使用 float 而不是 bool）
        this.material.uniforms.uDayTexture.value = texture;
        this.material.uniforms.uHasTexture.value = 1.0;
        this.material.needsUpdate = true;
      } else if (this.material instanceof THREE.MeshStandardMaterial) {
        // 标准材质：设置 map
        this.material.map = texture;
        this.material.color.setHex(0xffffff);
        this.material.needsUpdate = true;
      }
      this.textureLoaded = true;
      this.textureBodyId = bodyId;
      
      // 有贴图的星球隐藏经纬线
      if (this.gridGroup) {
        this.gridGroup.visible = false;
      }
    }
  }

  /**
   * 应用夜间贴图（仅地球）
   * 
   * @param texture - THREE.Texture 实例
   */
  applyNightTexture(texture: THREE.Texture | null): void {
    if (this.isSun || !texture) return;
    
    if (this.material instanceof THREE.ShaderMaterial) {
      this.material.uniforms.uNightTexture.value = texture;
      this.material.uniforms.uHasNightTexture.value = 1.0;
      this.material.needsUpdate = true;
      this.nightTexture = texture;
      this.hasNightMap = true;
    }
  }

  /**
   * 检查是否已应用贴图
   */
  hasTextureApplied(): boolean {
    return this.textureLoaded;
  }

  /**
   * 获取贴图对应的 BodyId（用于释放引用）
   */
  getTextureBodyId(): string | null {
    return this.textureBodyId;
  }

  dispose(): void {
    // 清除贴图引用（实际 GPU 资源由 TextureManager 管理）
    if (this.textureBodyId) {
      // 注意：TextureManager.releaseTexture 由外部调用
      if (this.material instanceof THREE.ShaderMaterial) {
        this.material.uniforms.uDayTexture.value = null;
        this.material.uniforms.uNightTexture.value = null;
      } else if (this.material instanceof THREE.MeshStandardMaterial) {
        this.material.map = null;
      }
      this.textureBodyId = null;
      this.textureLoaded = false;
    }

    // 清除夜间贴图引用
    if (this.nightTexture) {
      this.nightTexture = null;
      this.hasNightMap = false;
    }
    
    if (this.markerObject && this.markerObject.parent) {
      this.markerObject.parent.remove(this.markerObject);
    }
    if (this.markerDiv && this.markerDiv.parentNode) {
      this.markerDiv.parentNode.removeChild(this.markerDiv);
    }
    if (this.gridGroup) {
      // 释放经纬线几何体与材质
      this.gridGroup.traverse((c) => {
        if ((c as any).geometry) {
          (c as any).geometry.dispose();
        }
        if ((c as any).material) {
          (c as any).material.dispose();
        }
      });
      if (this.gridGroup.parent) this.gridGroup.parent.remove(this.gridGroup);
      this.gridGroup = null;
    }
    
    // 清理土星环
    if (this.ringMesh) {
      if (this.ringMesh.geometry) {
        this.ringMesh.geometry.dispose();
      }
      if (this.ringMesh.material) {
        (this.ringMesh.material as THREE.Material).dispose();
      }
      if (this.ringMesh.parent) {
        this.ringMesh.parent.remove(this.ringMesh);
      }
      this.ringMesh = null;
    }
    if (this.ringTexture) {
      this.ringTexture.dispose();
      this.ringTexture = null;
    }

    this.geometry.dispose();
    this.material.dispose();
  }
}
