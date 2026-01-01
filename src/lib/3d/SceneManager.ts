/**
 * SceneManager.ts - Three.js 场景管理器
 * 
 * 功能：
 * - 初始化和管理 Three.js 场景、渲染器、相机
 * - 处理窗口大小变化
 * - 动态调整相机视距裁剪（防止近远平面裁切问题）
 * - 管理场景背景（银河系天空盒）
 * - 多尺度宇宙视图（太阳系 → 近邻恒星 → 银河系）
 * 
 * 使用：
 * - 在组件中创建 SceneManager 实例
 * - 通过 getScene()、getCamera()、getRenderer() 获取对象
 * - 在动画循环中调用 render() 渲染场景
 */

import * as THREE from 'three';
import { VIEW_SETTINGS } from '../config/cameraConfig';
import { NearbyStars } from './NearbyStars';
import { GalaxyRenderer } from './GalaxyRenderer';
import { SCALE_VIEW_CONFIG, NEARBY_STARS_CONFIG, GALAXY_CONFIG } from '../config/galaxyConfig';

// 银河系背景图片路径（圆柱投影/equirectangular）
const MILKY_WAY_TEXTURE_PATH = '/textures/planets/8k_stars_milky_way.jpg';

// 🔧 银河系天空盒方位配置（度）
// 银道面与黄道面（太阳系轨道平面）之间约有 60° 夹角
// 调整这些值可以改变银河系在场景中的方位
const MILKY_WAY_ORIENTATION = {
  // X轴旋转（俯仰）：控制银河系平面的倾斜角度
  // 约 60° 是银道面与黄道面的真实夹角
  rotationX: 60,
  
  // Y轴旋转（偏航）：控制银河系中心的水平方向
  // 银河系中心大约在人马座方向
  rotationY: 0,
  
  // Z轴旋转（滚转）：控制银河系的滚动角度
  rotationZ: 0,
};

export class SceneManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private container: HTMLElement;
  private skybox: THREE.Mesh | null = null;
  
  // 多尺度宇宙视图组件
  private nearbyStars: NearbyStars | null = null;
  private galaxyRenderer: GalaxyRenderer | null = null;
  private skyboxOpacity: number = 1;
  private skyboxTargetOpacity: number = 1;

  constructor(container: HTMLElement) {
    this.container = container;

    // 初始化渲染器
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true, // 防止深度闪烁（太阳系尺度很大）
      alpha: false, // 禁用 alpha 通道，确保背景不透明
    });

    // 物理光照（某些版本可能不支持，使用可选链）
    if ('physicallyCorrectLights' in this.renderer) {
      (this.renderer as any).physicallyCorrectLights = true;
    }
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制最大像素比
    this.renderer.setClearColor(0x000000, 1); // 明确设置清除颜色为黑色
    
    // ⚠️ 修复：在 Canvas 元素上设置 touchAction，允许自定义触摸处理
    // 这样可以避免影响 fixed 定位的按钮（Firefox 特别敏感）
    this.renderer.domElement.style.touchAction = 'none';
    
    container.appendChild(this.renderer.domElement);

    // 初始化场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000); // 黑色背景（图片加载前显示）
    
    // 添加银河系天空盒背景
    this.createMilkyWaySkybox();

    // 初始化相机（必须在 updateSize 之前）
    // 使用更小的 near 值（0.01）和更大的 far 值（1e12）以适应太阳系的大尺度
    // FOV 从 CameraController 配置中读取（如果可用），否则使用默认值 75
    const aspect = container.clientWidth / container.clientHeight || 1;
    const fov = 75; // 默认 FOV，实际值由 CameraController 管理
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.01, 1e12);
    this.camera.position.set(0, 0, 10);

    // 设置渲染器尺寸（在相机初始化之后）
    this.updateSize();
    
    // 初始化多尺度宇宙视图组件
    this.initializeMultiScaleView();

    // 光照将在 SolarSystemCanvas3D 中添加，这里不添加
    // 注意：窗口大小变化监听器由 SolarSystemCanvas3D 统一管理，避免重复绑定
  }
  
  /**
   * 初始化多尺度宇宙视图组件
   */
  private initializeMultiScaleView(): void {
    // 初始化近邻恒星
    if (NEARBY_STARS_CONFIG.enabled) {
      this.nearbyStars = new NearbyStars();
      this.scene.add(this.nearbyStars.getGroup());
    }
    
    // 初始化银河系渲染器
    if (GALAXY_CONFIG.enabled) {
      this.galaxyRenderer = new GalaxyRenderer();
      this.scene.add(this.galaxyRenderer.getGroup());
    }
  }

  /**
   * 创建银河系天空盒背景（使用圆柱投影图片）
   * 使用内翻球体 + equirectangular 贴图实现
   */
  private createMilkyWaySkybox(): void {
    const textureLoader = new THREE.TextureLoader();
    
    textureLoader.load(
      MILKY_WAY_TEXTURE_PATH,
      (texture) => {
        // 设置贴图参数
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.mapping = THREE.EquirectangularReflectionMapping;
        
        // 创建一个超大球体作为天空盒（确保在任何距离都不会被裁剪）
        // 使用相对较大但固定的尺寸，避免动态缩放导致的抖动
        const skyboxGeometry = new THREE.SphereGeometry(5e5, 64, 32);
        
        // 创建材质（内翻球体，从内部看）
        const skyboxMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide, // 从内部渲染
          depthWrite: false,
          depthTest: false,
        });
        
        this.skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
        this.skybox.renderOrder = -1000; // 最先渲染（在最后面）
        this.skybox.userData.isSkybox = true;
        this.skybox.userData.fixedToCamera = true; // 标记为跟随相机
        
        // 设置银河系方位（将度转换为弧度）
        const degToRad = Math.PI / 180;
        this.skybox.rotation.x = MILKY_WAY_ORIENTATION.rotationX * degToRad;
        this.skybox.rotation.y = MILKY_WAY_ORIENTATION.rotationY * degToRad;
        this.skybox.rotation.z = MILKY_WAY_ORIENTATION.rotationZ * degToRad;
        
        this.scene.add(this.skybox);
      },
      undefined,
      (error) => {
        console.warn('Failed to load Milky Way texture, falling back to starfield:', error);
        // 加载失败时回退到简单星空
        this.createFallbackStarfield();
      }
    );
  }

  /**
   * 创建备用星空背景（当银河系图片加载失败时使用）
   */
  private createFallbackStarfield(): void {
    const starCount = 2000;
    const stars = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      
      stars[i * 3] = Math.sin(phi) * Math.cos(theta);
      stars[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
      stars[i * 3 + 2] = Math.cos(phi);
      
      starSizes[i] = Math.random() * 1.5 + 0.5;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1,
      sizeAttenuation: false,
      transparent: false,
      depthWrite: false,
      depthTest: false,
    });
    
    const starfield = new THREE.Points(geometry, material);
    starfield.renderOrder = -1000;
    starfield.userData.isStarfield = true;
    starfield.userData.fixedToCamera = true;
    
    this.scene.add(starfield);
  }

  /**
   * 更新天空盒位置（跟随相机）
   */
  updateSkyboxPosition(cameraPosition: THREE.Vector3): void {
    if (this.skybox) {
      this.skybox.position.copy(cameraPosition);
    }
  }
  
  /**
   * 更新多尺度宇宙视图（每帧调用）
   * @param cameraDistance 相机到太阳系中心的距离（AU）
   * @param deltaTime 帧间隔时间（秒）
   */
  updateMultiScaleView(cameraDistance: number, deltaTime: number): void {
    // 更新近邻恒星
    if (this.nearbyStars) {
      this.nearbyStars.update(cameraDistance, deltaTime);
    }
    
    // 更新银河系
    if (this.galaxyRenderer) {
      this.galaxyRenderer.update(cameraDistance, deltaTime);
    }
    
    // 更新银河系背景透明度（当显示银河系粒子时淡出背景）
    this.updateSkyboxOpacity(cameraDistance, deltaTime);
  }
  
  /**
   * 更新银河系背景透明度
   */
  private updateSkyboxOpacity(cameraDistance: number, deltaTime: number): void {
    const config = SCALE_VIEW_CONFIG;
    
    // 计算目标透明度
    if (cameraDistance < config.milkyWayBackgroundFadeStart) {
      this.skyboxTargetOpacity = 1;
    } else if (cameraDistance < config.milkyWayBackgroundFadeEnd) {
      const range = config.milkyWayBackgroundFadeEnd - config.milkyWayBackgroundFadeStart;
      this.skyboxTargetOpacity = 1 - (cameraDistance - config.milkyWayBackgroundFadeStart) / range;
    } else {
      this.skyboxTargetOpacity = 0;
    }
    
    // 直接应用透明度（无延迟）
    this.skyboxOpacity = this.skyboxTargetOpacity;
    
    // 应用透明度到天空盒
    if (this.skybox) {
      const material = this.skybox.material as THREE.MeshBasicMaterial;
      material.opacity = this.skyboxOpacity;
      material.transparent = this.skyboxOpacity < 1;
      this.skybox.visible = this.skyboxOpacity > 0.01;
    }
  }
  
  /**
   * 获取近邻恒星渲染器
   */
  getNearbyStars(): NearbyStars | null {
    return this.nearbyStars;
  }
  
  /**
   * 获取银河系渲染器
   */
  getGalaxyRenderer(): GalaxyRenderer | null {
    return this.galaxyRenderer;
  }

  updateSize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;

    if (this.camera) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    }

    this.renderer.setSize(width, height);
  }
  
  /**
   * 更新相机 FOV（视野角度）
   */
  updateFOV(fov: number): void {
    if (this.camera) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 动态调整相机视距裁剪
   * 根据当前观察对象自动调整 near 和 far，防止裁切问题
   */
  updateCameraClipping(currentObjectRadius: number, distanceToSun: number): void {
    // 兼容 CameraController 的动态 near 调整：
    // - 不强行覆盖更小的 near（例如 CameraController 为避免剔除而设置的值）
    // - 建议 near 基于配置的最小值
    const suggestedNear = Math.max(VIEW_SETTINGS.minNearPlane, Math.min(0.01, currentObjectRadius * 0.001));

    // 仅当当前 camera.near 比建议值大时，才将其缩小到建议值；否则保持当前（以保留动态调整）
    if (this.camera.near > suggestedNear) {
      this.camera.near = suggestedNear;
    }

    // far 值：确保足够大，覆盖整个太阳系
    const far = Math.max(100, Math.min(VIEW_SETTINGS.maxFarPlane || 1e12, distanceToSun * 10));
    this.camera.far = far;

    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    // 注意：resize 监听器由 SolarSystemCanvas3D 统一管理，这里不需要移除
    
    // 清理多尺度宇宙视图组件
    if (this.nearbyStars) {
      this.nearbyStars.dispose();
      this.nearbyStars = null;
    }
    
    if (this.galaxyRenderer) {
      this.galaxyRenderer.dispose();
      this.galaxyRenderer = null;
    }
    
    // 清理 WebGL 资源
    this.renderer.dispose();
    // 从 DOM 中移除 canvas
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
