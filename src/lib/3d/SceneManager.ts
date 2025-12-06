/**
 * SceneManager.ts - Three.js 场景管理器
 * 
 * 功能：
 * - 初始化和管理 Three.js 场景、渲染器、相机
 * - 处理窗口大小变化
 * - 动态调整相机视距裁剪（防止近远平面裁切问题）
 * - 管理场景背景（星空效果）
 * 
 * 使用：
 * - 在组件中创建 SceneManager 实例
 * - 通过 getScene()、getCamera()、getRenderer() 获取对象
 * - 在动画循环中调用 render() 渲染场景
 */

import * as THREE from 'three';
import { CAMERA_VIEW_CONFIG } from '../config/visualConfig';

export class SceneManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    // 初始化渲染器
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true, // 防止深度闪烁（太阳系尺度很大）
    });

    // 物理光照（某些版本可能不支持，使用可选链）
    if ('physicallyCorrectLights' in this.renderer) {
      (this.renderer as any).physicallyCorrectLights = true;
    }
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制最大像素比
    this.renderer.setClearColor(0x000000, 1); // 明确设置清除颜色为黑色
    
    // ⚠️ 修复：在 Canvas 元素上设置 touchAction，而不是在容器上
    // 这样可以避免影响 fixed 定位的按钮（Firefox 特别敏感）
    this.renderer.domElement.style.touchAction = 'none';
    
    container.appendChild(this.renderer.domElement);

    // 初始化场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000); // 黑色背景
    
    // 添加星空背景
    this.createStarfield();

    // 初始化相机（必须在 updateSize 之前）
    // 使用更小的 near 值（0.01）和更大的 far 值（1e12）以适应太阳系的大尺度
    // FOV 从 CameraController 配置中读取（如果可用），否则使用默认值 75
    const aspect = container.clientWidth / container.clientHeight || 1;
    const fov = 75; // 默认 FOV，实际值由 CameraController 管理
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.01, 1e12);
    this.camera.position.set(0, 0, 10);

    // 设置渲染器尺寸（在相机初始化之后）
    this.updateSize();

    // 光照将在 SolarSystemCanvas3D 中添加，这里不添加
    // 注意：窗口大小变化监听器由 SolarSystemCanvas3D 统一管理，避免重复绑定
  }

  /**
   * 创建星空背景（固定在相机空间，不随太阳系缩放）
   */
  private createStarfield(): void {
    // 创建星空几何体（使用 Points 系统）
    // 星星应该固定在相机空间，而不是世界空间
    const starCount = 2000;
    const stars = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    
    for (let i = 0; i < starCount; i++) {
      // 在单位球面上随机分布星星（归一化方向向量）
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      
      // 使用单位向量，星星位置相对于相机固定
      stars[i * 3] = Math.sin(phi) * Math.cos(theta);
      stars[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
      stars[i * 3 + 2] = Math.cos(phi);
      
      // 随机星星大小（0.5-2像素）
      starSizes[i] = Math.random() * 1.5 + 0.5;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    
    // 使用 PointsMaterial 渲染星星
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1,
      sizeAttenuation: false, // 星星大小不随距离变化
      transparent: true,
      opacity: 0.8,
    });
    
    const starfield = new THREE.Points(geometry, material);
    
    // 将星空添加到场景，但使用特殊的渲染方式
    // 在动画循环中，我们需要将星空位置更新为相机位置
    starfield.userData.isStarfield = true; // 标记为星空
    starfield.userData.fixedToCamera = true; // 固定在相机空间
    
    this.scene.add(starfield);
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
    const suggestedNear = Math.max(CAMERA_VIEW_CONFIG.minNearPlane, Math.min(0.01, currentObjectRadius * 0.001));

    // 仅当当前 camera.near 比建议值大时，才将其缩小到建议值；否则保持当前（以保留动态调整）
    if (this.camera.near > suggestedNear) {
      this.camera.near = suggestedNear;
    }

    // far 值：确保足够大，覆盖整个太阳系
    const far = Math.max(100, Math.min(CAMERA_VIEW_CONFIG.maxFarPlane || 1e12, distanceToSun * 10));
    this.camera.far = far;

    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    // 注意：resize 监听器由 SolarSystemCanvas3D 统一管理，这里不需要移除
    // 清理 WebGL 资源
    this.renderer.dispose();
    // 从 DOM 中移除 canvas
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
