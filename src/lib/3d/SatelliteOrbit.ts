import * as THREE from 'three';
import { ORBIT_RENDER_CONFIG, ORBIT_STYLE_CONFIG } from '@/lib/config/visualConfig';

/**
 * 卫星轨道渲染类（支持母行星轴倾角的动态轨道平面）
 * 
 * 关键物理原理：
 * - 卫星轨道平面相对于母行星的赤道面，而不是黄道面
 * - 当母行星有轴倾角时，卫星轨道平面必须跟随母行星的朝向变化
 * - 这确保了物理正确的卫星轨道表现
 */
export class SatelliteOrbit {
  private root: THREE.Group;
  private visualObjects: THREE.Object3D[] = [];
  private radius: number;
  private color: string;
  private inclination: number;  // 相对于母行星赤道面的轨道倾角（弧度）
  private Omega: number;         // 升交点黄经（弧度）
  private segments: number;
  private parentBodyName: string; // 母行星名称
  private isOrientationSet: boolean = false; // 是否已设置朝向
  private eclipticOrbit: boolean; // 是否相对于黄道面而非母行星赤道面
  private points: THREE.Vector3[] = []; // 轨道点

  // 静态渐变纹理缓存
  private static gradientTexture: THREE.Texture | null = null;

  constructor(
    radius: number,
    color: string = '#ffffff',
    segments: number = 128,
    inclination: number = 0,
    Omega: number = 0,
    parentBodyName: string = '',
    eclipticOrbit: boolean = false
  ) {
    this.root = new THREE.Group();
    this.radius = radius;
    this.color = color;
    this.inclination = inclination;
    this.Omega = Omega;
    this.segments = segments;
    this.parentBodyName = parentBodyName;
    this.eclipticOrbit = eclipticOrbit;

    // 生成轨道点
    this.generateOrbitPoints();
    
    // 创建可视化对象
    this.createVisualObjects();
    
    // 设置正确的朝向（一次性设置）
    this.setCorrectOrientation();
  }

  /**
   * 生成轨道点
   */
  private generateOrbitPoints(): void {
    this.points = [];
    
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
      const x_1 = x_orb * cos_Om - y_orb * sin_Om;
      const y_1 = x_orb * sin_Om + y_orb * cos_Om;
      const z_1 = z_orb;

      const x_final = x_1;
      const y_final = y_1 * cos_i - z_1 * sin_i;
      const z_final = y_1 * sin_i + z_1 * cos_i;

      this.points.push(new THREE.Vector3(x_final, y_final, z_final));
    }
  }

  /**
   * 创建可视化对象（填充圆盘 + 线条）
   */
  private createVisualObjects(): void {
    // 清理现有对象
    this.visualObjects.forEach(obj => {
      this.root.remove(obj);
      if (obj instanceof THREE.Line || obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      }
    });
    this.visualObjects = [];

    if (ORBIT_STYLE_CONFIG.style === 'filled') {
      // 创建填充圆盘
      const mesh = this.createFilledMesh();
      if (mesh) {
        this.root.add(mesh);
        this.visualObjects.push(mesh);
      }
      
      // 如果配置了同时显示线条
      if (ORBIT_STYLE_CONFIG.showLine) {
        const line = this.createLine();
        if (line) {
          this.root.add(line);
          this.visualObjects.push(line);
        }
      }
    } else {
      // 仅线条模式
      const line = this.createLine();
      if (line) {
        this.root.add(line);
        this.visualObjects.push(line);
      }
    }
  }

  /**
   * 创建渐变纹理（静态缓存）
   */
  private static getGradientTexture(): THREE.Texture {
    if (SatelliteOrbit.gradientTexture) return SatelliteOrbit.gradientTexture;
    
    if (typeof document === 'undefined') {
      return new THREE.Texture();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    
    const gradient = context.createLinearGradient(0, 64, 0, 0);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(1, `rgba(255, 255, 255, ${ORBIT_STYLE_CONFIG.fillAlpha})`);
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 2, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    
    SatelliteOrbit.gradientTexture = texture;
    return texture;
  }

  /**
   * 创建填充圆盘网格
   */
  private createFilledMesh(): THREE.Mesh | null {
    if (this.points.length < 2) return null;

    const vertexCount = this.points.length;
    const positions = new Float32Array(vertexCount * 2 * 3);
    const uvs = new Float32Array(vertexCount * 2 * 2);
    const indices: number[] = [];

    const innerRatio = ORBIT_STYLE_CONFIG.innerRadiusRatio;

    for (let i = 0; i < vertexCount; i++) {
      const point = this.points[i];
      
      // 外顶点（原始点）
      positions[i * 6] = point.x;
      positions[i * 6 + 1] = point.y;
      positions[i * 6 + 2] = point.z;
      
      // 内顶点（向中心缩放）
      positions[i * 6 + 3] = point.x * innerRatio;
      positions[i * 6 + 4] = point.y * innerRatio;
      positions[i * 6 + 5] = point.z * innerRatio;

      // UV 坐标
      uvs[i * 4] = 0;
      uvs[i * 4 + 1] = 1; // V=1 (外边缘)
      uvs[i * 4 + 2] = 0;
      uvs[i * 4 + 3] = 0; // V=0 (内边缘)
    }

    // 创建三角形索引
    for (let i = 0; i < vertexCount - 1; i++) {
      const outerCurrent = 2 * i;
      const innerCurrent = 2 * i + 1;
      const outerNext = 2 * (i + 1);
      const innerNext = 2 * (i + 1) + 1;
      
      indices.push(outerCurrent, innerCurrent, outerNext);
      indices.push(innerCurrent, innerNext, outerNext);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    const material = new THREE.MeshBasicMaterial({
      map: SatelliteOrbit.getGradientTexture(),
      color: new THREE.Color(this.color),
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
    });

    return new THREE.Mesh(geometry, material);
  }

  /**
   * 创建线条
   */
  private createLine(): THREE.Line | null {
    if (this.points.length < 2) return null;

    const geometry = new THREE.BufferGeometry().setFromPoints(this.points);
    
    const lineOpacity = ORBIT_STYLE_CONFIG.style === 'filled' && ORBIT_STYLE_CONFIG.showLine 
      ? (ORBIT_STYLE_CONFIG.lineOpacity ?? 0.5) 
      : 1.0;

    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.color),
      transparent: lineOpacity < 1.0,
      opacity: lineOpacity,
      linewidth: ORBIT_RENDER_CONFIG.lineWidth,
      depthWrite: true,
      depthTest: true,
    });

    return new THREE.Line(geometry, material);
  }

  /**
   * 设置正确的轨道朝向（基于母行星轴倾角，一次性设置）
   */
  private setCorrectOrientation(): void {
    if (this.isOrientationSet || !this.parentBodyName) return;
    
    if (this.eclipticOrbit) {
      this.isOrientationSet = true;
      return;
    }
    
    try {
      const { CELESTIAL_BODIES } = require('@/lib/types/celestialTypes');
      const parentConfig = CELESTIAL_BODIES[this.parentBodyName];
      
      if (parentConfig && parentConfig.orientation && parentConfig.orientation.spinAxis) {
        const [x, y, z] = parentConfig.orientation.spinAxis;
        
        const spinAxisICRF = new THREE.Vector3(x, y, z);
        const spinAxisRender = new THREE.Vector3(
          spinAxisICRF.x,
          spinAxisICRF.z,
          -spinAxisICRF.y
        );
        
        const defaultNormal = new THREE.Vector3(0, 0, 1);
        const targetNormal = spinAxisRender.normalize();
        
        const parentAxisQuaternion = new THREE.Quaternion();
        parentAxisQuaternion.setFromUnitVectors(defaultNormal, targetNormal);
        
        // 应用变换到整个组
        this.root.quaternion.copy(parentAxisQuaternion);
        this.isOrientationSet = true;
      }
    } catch (error) {
      console.warn(`Failed to set orbit orientation for ${this.parentBodyName}:`, error);
    }
  }

  /**
   * 获取轨道组（用于添加到场景）
   */
  getLine(): THREE.Group {
    return this.root;
  }

  /**
   * 将轨道中心移动到给定世界坐标位置
   */
  updatePlanetPosition(position: THREE.Vector3): void {
    this.root.position.copy(position);
  }

  /**
   * 更新轨道透明度（用于渐隐效果）
   */
  setOpacity(opacity: number): void {
    this.visualObjects.forEach(obj => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
        const material = obj.material as THREE.Material;
        if (material && 'opacity' in material) {
          material.opacity = opacity;
          material.transparent = opacity < 1.0;
        }
      }
    });
  }

  dispose(): void {
    this.visualObjects.forEach(obj => {
      if (obj instanceof THREE.Line || obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      }
    });
    this.visualObjects = [];
  }
}
