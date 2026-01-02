/**
 * BrightStarCatalogue.ts - 亮星星表天球壳渲染器
 * 
 * 基于 Bright Star Catalogue (V/50) 第5版
 * 在太阳系尺度显示肉眼可见的亮星（视星等 < 6.5）
 * 恒星投影到固定距离的天球壳上，并显示星名标签
 */

import * as THREE from 'three';

// BSC 配置
export const BSC_CONFIG = {
  enabled: true,
  dataPath: '/data/V_50/catalog/catalog',
  // 天球壳半径（AU）- 足够大以避免缩小时看到球形
  sphereRadius: 500000,
  // 显示距离阈值（AU）- 1光年 = 63241 AU
  fadeStart: 63241,       // 1光年开始淡出
  fadeEnd: 126482,        // 2光年时完全隐藏
  // 恒星渲染
  basePointSize: 3.0,
  brightnessScale: 5.0,
  minPointSize: 2.0,
  maxPointSize: 35.0,
  // 标签配置
  labelEnabled: true,
  labelMinMagnitude: 3.0,  // 只显示亮于此星等的星名
  labelFontSize: 11,
  labelColor: 'rgba(200, 220, 255, 0.9)',
  labelOffset: 15,         // 标签偏移（像素）
};

// BSC 恒星数据接口
interface BSCStar {
  hr: number;              // Harvard Revised Number
  name: string;            // 名称（Bayer/Flamsteed）
  ra: number;              // 赤经（度，J2000）
  dec: number;             // 赤纬（度，J2000）
  vmag: number;            // 视星等
  bv: number;              // B-V 颜色指数
  spectralType: string;    // 光谱型
  position: THREE.Vector3; // 3D 位置
  color: THREE.Color;      // 颜色
}

export class BrightStarCatalogue {
  private group: THREE.Group;
  private starsCloud: THREE.Points | null = null;
  private stars: BSCStar[] = [];
  private labelSprites: THREE.Sprite[] = [];
  private currentOpacity: number = 1;  // 初始为1，立即显示
  private targetOpacity: number = 1;
  private isLoaded: boolean = false;


  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'BrightStarCatalogue';
    this.loadData();
  }


  /**
   * 加载并解析 BSC 数据
   */
  private async loadData(): Promise<void> {
    try {
      console.log('[BSC] 开始加载 Bright Star Catalogue...');
      const response = await fetch(BSC_CONFIG.dataPath);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      const lines = text.split('\n');
      
      console.log(`[BSC] 读取了 ${lines.length} 行数据`);
      
      // 解析每行数据
      for (const line of lines) {
        if (line.length < 107) continue; // 跳过不完整的行
        
        const star = this.parseLine(line);
        if (star) {
          this.stars.push(star);
        }
      }
      
      console.log(`[BSC] 成功解析 ${this.stars.length} 颗恒星`);
      
      // 创建渲染对象
      this.createStarsCloud();
      if (BSC_CONFIG.labelEnabled) {
        this.createLabels();
      }
      
      this.isLoaded = true;
      console.log('[BSC] 加载完成');
      
    } catch (error) {
      console.error('[BSC] 加载失败:', error);
    }
  }

  /**
   * 解析一行 BSC 数据
   */
  private parseLine(line: string): BSCStar | null {
    try {
      // HR 编号 (bytes 1-4, 0-indexed: 0-3)
      const hrStr = line.substring(0, 4).trim();
      const hr = parseInt(hrStr);
      if (isNaN(hr)) return null;
      
      // 名称 (bytes 5-14, 0-indexed: 4-13)
      const name = line.substring(4, 14).trim();
      
      // J2000 坐标 (bytes 76-90, 0-indexed: 75-89)
      // 格式: HHMMSSs+DDMMSS (时分秒+度分秒)
      const raHour = parseInt(line.substring(75, 77));
      const raMin = parseInt(line.substring(77, 79));
      const raSec = parseFloat(line.substring(79, 83));
      const decSign = line.charAt(83) === '-' ? -1 : 1;
      const decDeg = parseInt(line.substring(84, 86));
      const decMin = parseInt(line.substring(86, 88));
      const decSec = parseInt(line.substring(88, 90));
      
      // 检查坐标有效性
      if (isNaN(raHour) || isNaN(raMin) || isNaN(raSec) ||
          isNaN(decDeg) || isNaN(decMin) || isNaN(decSec)) {
        return null;
      }
      
      // 转换为度
      const ra = (raHour + raMin / 60 + raSec / 3600) * 15; // 时角转度
      const dec = decSign * (decDeg + decMin / 60 + decSec / 3600);
      
      // 视星等 (bytes 103-107, 0-indexed: 102-106)
      const vmagStr = line.substring(102, 107).trim();
      const vmag = parseFloat(vmagStr);
      if (isNaN(vmag)) return null;
      
      // B-V 颜色 (bytes 110-114, 0-indexed: 109-113)
      const bvStr = line.substring(109, 114).trim();
      const bv = parseFloat(bvStr) || 0;
      
      // 光谱型 (bytes 128-147, 0-indexed: 127-146)
      const spectralType = line.substring(127, 147).trim();
      
      // 计算 3D 位置（投影到天球壳）
      const position = this.equatorialToCartesian(ra, dec, BSC_CONFIG.sphereRadius);
      
      // 计算颜色
      const color = this.bvToColor(bv);
      
      return {
        hr,
        name,
        ra,
        dec,
        vmag,
        bv,
        spectralType,
        position,
        color,
      };
    } catch {
      return null;
    }
  }

  /**
   * 赤道坐标转笛卡尔坐标
   */
  private equatorialToCartesian(ra: number, dec: number, distance: number): THREE.Vector3 {
    const raRad = (ra * Math.PI) / 180;
    const decRad = (dec * Math.PI) / 180;
    
    return new THREE.Vector3(
      distance * Math.cos(decRad) * Math.cos(raRad),
      distance * Math.sin(decRad),  // Y 轴向上
      -distance * Math.cos(decRad) * Math.sin(raRad)
    );
  }

  /**
   * B-V 颜色指数转 RGB 颜色
   */
  private bvToColor(bv: number): THREE.Color {
    // B-V 范围约 -0.4 到 +2.0
    const clampedBV = Math.max(-0.4, Math.min(2.0, bv));
    
    if (clampedBV < -0.2) {
      return new THREE.Color(0x9bb0ff); // O 型 - 蓝色
    } else if (clampedBV < 0.0) {
      return new THREE.Color(0xaabfff); // B 型 - 蓝白
    } else if (clampedBV < 0.15) {
      return new THREE.Color(0xcad7ff); // A 型 - 白色偏蓝
    } else if (clampedBV < 0.4) {
      return new THREE.Color(0xf8f7ff); // F 型 - 白色
    } else if (clampedBV < 0.6) {
      return new THREE.Color(0xfff4ea); // G 型 - 黄白
    } else if (clampedBV < 0.8) {
      return new THREE.Color(0xffd2a1); // K 型早期 - 橙色
    } else if (clampedBV < 1.2) {
      return new THREE.Color(0xffcc6f); // K 型晚期 - 橙黄
    } else {
      return new THREE.Color(0xff8844); // M 型 - 红色
    }
  }

  /**
   * 创建恒星点云
   */
  private createStarsCloud(): void {
    const count = this.stars.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      const star = this.stars[i];
      
      positions[i * 3] = star.position.x;
      positions[i * 3 + 1] = star.position.y;
      positions[i * 3 + 2] = star.position.z;
      
      colors[i * 3] = star.color.r;
      colors[i * 3 + 1] = star.color.g;
      colors[i * 3 + 2] = star.color.b;
      
      // 大小基于星等：越亮越大
      const sizeFactor = Math.pow(2.512, (6 - star.vmag) * 0.7);
      sizes[i] = BSC_CONFIG.basePointSize * sizeFactor * BSC_CONFIG.brightnessScale;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 1 },
        uMinSize: { value: BSC_CONFIG.minPointSize },
        uMaxSize: { value: BSC_CONFIG.maxPointSize },
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
          
          // 固定角大小（不随距离变化太多）
          float dist = -mvPosition.z;
          float pointSize = size * (50000.0 / max(dist, 100.0));
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
          
          // 核心白点（更亮）
          float core = 1.0 - smoothstep(0.0, 0.06, dist);
          float glow = 1.0 - smoothstep(0.03, 0.5, dist);
          
          // 四芒星光芒（亮星）
          float spikes = 0.0;
          if (vSize > 4.0) {
            vec2 absCoord = abs(center);
            float spike1 = max(0.0, 1.0 - absCoord.x * 8.0) * max(0.0, 1.0 - absCoord.y * 25.0);
            float spike2 = max(0.0, 1.0 - absCoord.y * 8.0) * max(0.0, 1.0 - absCoord.x * 25.0);
            
            float spikeIntensity = (vSize - 4.0) / 6.0;
            spikes = (spike1 + spike2) * spikeIntensity * 0.7;
          }
          
          float alpha = core + glow * 0.5 + spikes;
          float brightness = 1.0 + core * 3.0;
          
          gl_FragColor = vec4(vColor * brightness, alpha * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,  // 启用深度测试，不会覆盖太阳系物体
      blending: THREE.AdditiveBlending,
    });
    
    this.starsCloud = new THREE.Points(geometry, material);
    this.starsCloud.frustumCulled = false;
    this.starsCloud.renderOrder = 50;
    this.group.add(this.starsCloud);
  }

  /**
   * 创建星名标签
   */
  private createLabels(): void {
    // 只为亮星创建标签
    const brightStars = this.stars.filter(s => 
      s.vmag < BSC_CONFIG.labelMinMagnitude && s.name.length > 0
    );
    
    console.log(`[BSC] 创建 ${brightStars.length} 个星名标签`);
    
    for (const star of brightStars) {
      const sprite = this.createLabelSprite(star);
      if (sprite) {
        this.labelSprites.push(sprite);
        this.group.add(sprite);
      }
    }
  }

  /**
   * 创建单个标签精灵
   */
  private createLabelSprite(star: BSCStar): THREE.Sprite | null {
    // 获取显示名称
    const displayName = this.getDisplayName(star);
    if (!displayName) return null;
    
    // 创建 canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    const fontSize = BSC_CONFIG.labelFontSize * 2; // 2x 分辨率
    ctx.font = `${fontSize}px Arial, sans-serif`;
    const metrics = ctx.measureText(displayName);
    
    canvas.width = Math.ceil(metrics.width) + 8;
    canvas.height = fontSize + 8;
    
    // 重新设置字体（canvas 大小改变后需要重设）
    ctx.font = `${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = BSC_CONFIG.labelColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(displayName, 4, canvas.height / 2);
    
    // 创建纹理
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    // 创建精灵材质 - 启用深度测试
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: true,
      sizeAttenuation: false,
    });
    
    const sprite = new THREE.Sprite(material);
    
    // 标签放在星星右侧（屏幕空间偏移通过 center 实现）
    sprite.position.copy(star.position);
    sprite.center.set(-0.1, 0.5); // 左对齐，垂直居中，这样标签在星星右侧
    
    // 屏幕空间大小
    const screenScale = 0.018;
    sprite.scale.set(
      (canvas.width / canvas.height) * screenScale,
      screenScale,
      1
    );
    
    sprite.userData.star = star;
    sprite.renderOrder = 49;
    
    return sprite;
  }

  /**
   * 获取恒星显示名称
   */
  private getDisplayName(star: BSCStar): string {
    if (!star.name || star.name.length === 0) return '';
    
    const name = star.name.trim();
    
    // 希腊字母缩写映射
    const greekMap: Record<string, string> = {
      'Alp': 'α', 'Bet': 'β', 'Gam': 'γ', 'Del': 'δ', 'Eps': 'ε',
      'Zet': 'ζ', 'Eta': 'η', 'The': 'θ', 'Iot': 'ι', 'Kap': 'κ',
      'Lam': 'λ', 'Mu': 'μ', 'Nu': 'ν', 'Xi': 'ξ', 'Omi': 'ο',
      'Pi': 'π', 'Rho': 'ρ', 'Sig': 'σ', 'Tau': 'τ', 'Ups': 'υ',
      'Phi': 'φ', 'Chi': 'χ', 'Psi': 'ψ', 'Ome': 'ω',
    };
    
    // 格式1: "21Alp And" 或 "Alp And" (Bayer designation)
    // 格式2: "33    Psc" (Flamsteed number only)
    // 格式3: "Kap1Scl" (with superscript number)
    
    // 尝试匹配 Bayer 格式: 数字(可选) + 希腊字母缩写 + 星座缩写
    const bayerMatch = name.match(/^(\d*)\s*([A-Za-z]{2,3})(\d?)\s*([A-Za-z]{2,3})$/);
    if (bayerMatch) {
      const flamsteed = bayerMatch[1];
      const greekAbbr = bayerMatch[2];
      const superscript = bayerMatch[3];
      const constellation = bayerMatch[4];
      
      const greek = greekMap[greekAbbr] || greekAbbr;
      
      let result = greek;
      if (superscript) result += superscript;
      result += ' ' + constellation;
      if (flamsteed) result = flamsteed + ' ' + result;
      
      return result;
    }
    
    // 尝试匹配纯 Flamsteed 格式: 数字 + 星座
    const flamsteedMatch = name.match(/^(\d+)\s+([A-Za-z]{2,3})$/);
    if (flamsteedMatch) {
      return `${flamsteedMatch[1]} ${flamsteedMatch[2]}`;
    }
    
    // 返回原始名称
    return name;
  }

  /**
   * 更新渲染
   */
  update(cameraDistance: number, deltaTime: number): void {
    if (!this.isLoaded) return;
    
    // 计算目标透明度
    const cfg = BSC_CONFIG;
    if (cameraDistance < cfg.fadeStart) {
      this.targetOpacity = 1;
    } else if (cameraDistance < cfg.fadeEnd) {
      this.targetOpacity = 1 - (cameraDistance - cfg.fadeStart) / (cfg.fadeEnd - cfg.fadeStart);
    } else {
      this.targetOpacity = 0;
    }
    
    // 平滑过渡
    const fadeSpeed = 3.0;
    this.currentOpacity += (this.targetOpacity - this.currentOpacity) * Math.min(deltaTime * fadeSpeed, 1);
    
    // 更新可见性
    this.group.visible = this.currentOpacity > 0.01;
    
    if (!this.group.visible) return;
    
    // 更新点云透明度
    if (this.starsCloud) {
      const mat = this.starsCloud.material as THREE.ShaderMaterial;
      mat.uniforms.uOpacity.value = this.currentOpacity;
    }
    
    // 更新标签
    for (const sprite of this.labelSprites) {
      const mat = sprite.material as THREE.SpriteMaterial;
      mat.opacity = this.currentOpacity * 0.9;
    }
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  getStarCount(): number {
    return this.stars.length;
  }

  dispose(): void {
    if (this.starsCloud) {
      this.starsCloud.geometry.dispose();
      (this.starsCloud.material as THREE.Material).dispose();
    }
    
    for (const sprite of this.labelSprites) {
      (sprite.material as THREE.SpriteMaterial).map?.dispose();
      (sprite.material as THREE.Material).dispose();
    }
    
    this.group.clear();
  }
}
