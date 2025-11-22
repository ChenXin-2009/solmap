/**
 * SceneManager.ts - Three.js 场景管理器
 * 
 * 负责初始化：
 * - WebGL2Renderer（抗锯齿、色彩空间、高分屏支持）
 * - Scene（全局光、空间背景）
 * - Camera（PerspectiveCamera）
 * - Resize 处理
 */

import * as THREE from 'three';

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
    
    container.appendChild(this.renderer.domElement);

    // 初始化场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000); // 黑色背景

    // 初始化相机（必须在 updateSize 之前）
    // 使用更小的 near 值（0.01）和更大的 far 值（1e12）以适应太阳系的大尺度
    const aspect = container.clientWidth / container.clientHeight || 1;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.01, 1e12);
    this.camera.position.set(0, 0, 10);

    // 设置渲染器尺寸（在相机初始化之后）
    this.updateSize();

    // 光照将在 SolarSystemCanvas3D 中添加，这里不添加
    // 注意：窗口大小变化监听器由 SolarSystemCanvas3D 统一管理，避免重复绑定
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
    // near 值：确保足够小，避免近距离裁切
    // 使用当前对象半径的 0.001 倍，但最小为 0.001（防止过小导致精度问题）
    const near = Math.max(0.001, Math.min(0.01, currentObjectRadius * 0.001));
    
    // far 值：确保足够大，覆盖整个太阳系
    // 使用距离太阳的距离的 10 倍，但最小为 100，最大为 1e12
    const far = Math.max(100, Math.min(1e12, distanceToSun * 10));
    
    this.camera.near = near;
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
