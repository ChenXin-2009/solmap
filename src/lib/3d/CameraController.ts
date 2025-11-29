/**
 * CameraController.ts - 3D 相机控制器
 * 
 * 功能：
 * - 管理 Three.js PerspectiveCamera 和 OrbitControls
 * - 实现平滑缩放、聚焦、跟踪等功能
 * - 支持鼠标滚轮和触摸手势缩放
 * - 防止相机穿模（根据行星半径动态调整最小距离）
 * 
 * 使用模式：
 * - 自由观察模式：用户可以自由平移、旋转、缩放
 * - 聚焦模式：点击行星后平滑移动到目标位置
 * - 跟踪模式：聚焦后持续跟踪行星运动
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ==================== 可调参数配置 ====================
// ⚙️ 以下参数可在文件顶部调整，影响相机行为

// 相机控制配置
const CAMERA_CONFIG = {
  // 🔧 阻尼系数（0-1，值越小缓动越明显，惯性越强）
  dampingFactor: 0.04,
  
  // 🔧 最小缩放距离（默认值，会根据行星半径动态调整）
  minDistance: 0.001,
  
  // 🔧 最大缩放距离
  maxDistance: 1000,
  
  // 🔧 缩放速度（OrbitControls 内部使用）
  zoomSpeed: 1.5,
  
  // 🔧 平移速度
  panSpeed: 0.6,
  
  // 🔧 旋转速度
  rotateSpeed: 0.8,
  
  // 🔧 基础缩放因子（滚轮缩放的基础倍数）
  zoomBaseFactor: 0.4,
  
  // 🔧 缩放缓动速度（0-1之间，越大越快）
  zoomEasingSpeed: 0.2,
  
  // 🔧 聚焦动画的插值速度（0-1，越大越快）
  focusLerpSpeed: 0.2,
  
  // 🔧 聚焦动画完成阈值（距离小于此值认为完成）
  focusThreshold: 0.01,
  
  // 🔧 跟踪时的插值速度（0-1，越大越快，值越大跟随越紧密）
  trackingLerpSpeed: 0.15,
  
  // 🔧 最小距离倍数（相对于行星半径，防止穿模）
  minDistanceMultiplier: 4,
  
  // 🔧 相机视野角度（FOV，度），值越大视野越广，边缘畸变越明显
  // 建议范围：50-90，默认 75
  fov: 45,
};

export type CameraMode = 'free' | 'locked' | 'follow';

export class CameraController {
  private controls: OrbitControls;
  private camera: THREE.PerspectiveCamera;
  private mode: CameraMode = 'free';
  private targetBody: THREE.Object3D | null = null;
  private followSpeed: number = 0.1; // 跟随缓动速度
  
  // 平滑缩放相关
  private smoothDistance: number = 0; // 当前平滑的距离
  private targetDistance: number = 0; // 目标距离
  private isZooming: boolean = false; // 是否正在缩放
  private lastDistance: number = 0; // 上一帧的距离
  
  // 事件监听器引用，用于清理
  private wheelHandler: ((e: WheelEvent) => void) | null = null;
  private touchStartHandler: ((e: TouchEvent) => void) | null = null;
  private touchMoveHandler: ((e: TouchEvent) => void) | null = null;
  private touchEndHandler: (() => void) | null = null;
  private domElement: HTMLElement;
  
  // 聚焦相关
  private targetCameraPosition: THREE.Vector3 | null = null;
  private targetControlsTarget: THREE.Vector3 | null = null;
  private isFocusing: boolean = false;
  
  // 跟踪相关
  private isTracking: boolean = false; // 是否正在跟踪目标
  private trackingTargetGetter: (() => THREE.Vector3) | null = null; // 获取跟踪目标位置的函数
  private trackingDistance: number = 5; // 跟踪时的相机距离

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    
    // 应用 FOV 配置
    this.camera.fov = CAMERA_CONFIG.fov;
    this.camera.updateProjectionMatrix();
    
    this.controls = new OrbitControls(camera, domElement);
    
    // 配置 OrbitControls - 优化缓动效果
    this.controls.enableDamping = true; // 启用阻尼（惯性效果）
    // 阻尼系数：值越小，缓动越明显（每次只衰减一小部分速度，所以会持续更久）
    // 0.05 表示每帧保留 95% 的速度，衰减 5%，会产生明显的惯性效果
    this.controls.dampingFactor = CAMERA_CONFIG.dampingFactor;
    
    // 确保每帧都更新阻尼（即使没有输入）
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    
    // 初始化距离
    this.smoothDistance = this.camera.position.distanceTo(this.controls.target);
    this.targetDistance = this.smoothDistance;
    this.lastDistance = this.smoothDistance;
    
    // 距离限制
    this.controls.minDistance = CAMERA_CONFIG.minDistance;
    this.controls.maxDistance = CAMERA_CONFIG.maxDistance;
    
    // 启用各种操作
    this.controls.enablePan = true; // 启用平移
    this.controls.enableRotate = true; // 启用旋转
    
    // 缩放平滑度配置
    this.controls.zoomSpeed = CAMERA_CONFIG.zoomSpeed;
    this.controls.panSpeed = CAMERA_CONFIG.panSpeed;
    this.controls.rotateSpeed = CAMERA_CONFIG.rotateSpeed;
    
    // 禁用 OrbitControls 的自动缩放，我们将手动实现平滑缩放
    this.controls.enableZoom = false;
    
    // 移动端优化：防止缩放时视角飘走
    // 由于禁用了自动缩放，我们需要手动处理触摸缩放
    // 但保留触摸配置以便 OrbitControls 能正确处理旋转和平移
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE, // 单指旋转
      TWO: THREE.TOUCH.DOLLY_PAN, // 双指缩放+平移（防止视角飘走）
    };
    
    // 立即绑定事件监听器（不延迟，确保事件监听器始终存在）
    // 即使 DOM 元素还没有连接到 DOM，事件监听器也会在元素准备好后自动生效
    this.setupWheelZoom(domElement);
    this.setupTouchZoom(domElement);
    
    // 如果 DOM 元素还没有连接到 DOM，使用 requestAnimationFrame 确保绑定
    // 这是一个备用方案，因为事件监听器已经在上面绑定了
    if (!domElement.isConnected) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // 确保事件监听器已绑定（如果还没有绑定）
          if (domElement.isConnected) {
            if (!this.wheelHandler) {
              this.setupWheelZoom(domElement);
            }
            if (!this.touchStartHandler) {
              this.setupTouchZoom(domElement);
            }
          }
        });
      });
    }
    
    // 平滑缩放（使用平滑插值）
    this.controls.screenSpacePanning = false; // 使用球面平移，更自然
    
    // 完全移除旋转角度限制，允许自由旋转（包括上下翻转）
    // 明确设置为 0 和 Math.PI 允许从上方到下方的完整旋转（180度）
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI;
    
    // ⚠️ 关键修复：禁用 OrbitControls 的 azimuthalAngle 范围限制，避免双重 wrap
    // 防止 OrbitControls 自己 wrap 一次，我们再 wrap 一次导致角度跳跃
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
    
    // 自动旋转（可选，如果需要）
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 2.0;
    
    // 相机角度平滑过渡相关
    this.isPolarAngleTransitioning = false;
    this.targetPolarAngle = 0;
    this.currentPolarAngle = 0;
    this.polarAngleTransitionSpeed = 0.08; // 角度过渡速度（0-1，越大越快）
  }
  
  // 相机角度平滑过渡相关
  private isPolarAngleTransitioning: boolean = false;
  private targetPolarAngle: number = 0;
  private currentPolarAngle: number = 0;
  private polarAngleTransitionSpeed: number = 0.08; // 角度过渡速度（0-1，越大越快）
  
  // 左右角度（azimuthalAngle）平滑过渡相关
  private isAzimuthalAngleTransitioning: boolean = false;
  private targetAzimuthalAngle: number = 0;
  private currentAzimuthalAngle: number = 0;
  private azimuthalAngleTransitionSpeed: number = 0.08; // 角度过渡速度（0-1，越大越快）

  /**
   * 设置相机垂直角度（polarAngle）
   * @param angle 角度（度），0度 = 俯视（垂直于轨道平面），45度 = 45度视角
   * @param smooth 是否平滑过渡（默认 false，立即切换）
   * 
   * 注意：OrbitControls 的 polarAngle 定义：
   * - polarAngle = 0° → 从 +Y 轴往下看（纯俯视）
   * - polarAngle = 90° → 在地平线上（水平视角）
   * - polarAngle > 90° → 仰视
   */
  setPolarAngle(angle: number, smooth: boolean = false): void {
    // 将角度转换为弧度
    // 允许任意角度值（包括负数），但最终会转换为 0 到 Math.PI 的范围
    // 负数角度会被转换为对应的正角度（例如 -45° = 135°）
    let normalizedAngle = angle;
    // 将角度标准化到 0-180 度范围
    if (normalizedAngle < 0) {
      // 负数角度：-45° 转换为 135°（从下方看）
      normalizedAngle = 180 + normalizedAngle;
    }
    if (normalizedAngle >= 360) {
      normalizedAngle = normalizedAngle % 360;
    }
    if (normalizedAngle > 180) {
      normalizedAngle = 360 - normalizedAngle;
    }
    
    const angleRad = normalizedAngle * (Math.PI / 180);
    
    // 移除角度范围限制，允许任意值
    if (!isFinite(angleRad)) {
      console.warn('CameraController.setPolarAngle: Invalid angle value', angle);
      return;
    }
    
    // 先调用 update() 确保 spherical 被初始化
    this.controls.update();
    
    // 使用类型断言访问 spherical（OrbitControls 内部属性）
    const controlsAnyPol1 = this.controls as any;
    
    if (!smooth) {
      // 立即切换模式：直接修改 OrbitControls 的 spherical.phi（phi 就是 polarAngle）
      if (controlsAnyPol1.spherical) {
        controlsAnyPol1.spherical.phi = angleRad;
        this.controls.update();
      } else {
        // 如果 spherical 不存在，使用备用方法：通过设置相机位置
        const currentDistance = this.camera.position.distanceTo(this.controls.target);
        const currentAzimuthalAngle = this.controls.getAzimuthalAngle();
        const newPosition = new THREE.Vector3();
        newPosition.x = currentDistance * Math.sin(angleRad) * Math.cos(currentAzimuthalAngle);
        newPosition.y = currentDistance * Math.cos(angleRad);
        newPosition.z = currentDistance * Math.sin(angleRad) * Math.sin(currentAzimuthalAngle);
        newPosition.add(this.controls.target);
        this.camera.position.copy(newPosition);
        this.camera.lookAt(this.controls.target);
        this.controls.update();
      }
      this.currentPolarAngle = angleRad;
      this.targetPolarAngle = angleRad;
      this.isPolarAngleTransitioning = false;
      return;
    }
    
    // 平滑过渡模式
    this.targetPolarAngle = angleRad;
    this.isPolarAngleTransitioning = true;
    // 直接从 spherical.phi 读取当前角度（更准确）
    const controlsAnyPol2 = this.controls as any;
    this.currentPolarAngle = controlsAnyPol2.spherical ? controlsAnyPol2.spherical.phi : this.controls.getPolarAngle();
  }

  /**
   * 设置相机左右角度（azimuthalAngle）
   * @param angle 角度（度），0度 = 正前方，90度 = 右侧，-90度 = 左侧
   * @param smooth 是否平滑过渡（默认 false，立即切换）
   */
  setAzimuthalAngle(angle: number, smooth: boolean = false): void {
    // 将角度转换为弧度
    // 允许任意角度值（包括负数），转换为 -Math.PI 到 Math.PI 的范围
    let normalizedAngle = angle;
    // 将角度标准化到 -180 到 180 度范围
    while (normalizedAngle < -180) normalizedAngle += 360;
    while (normalizedAngle >= 180) normalizedAngle -= 360;
    
    const angleRad = normalizedAngle * (Math.PI / 180);
    
    if (!isFinite(angleRad)) {
      console.warn('CameraController.setAzimuthalAngle: Invalid angle value', angle);
      return;
    }
    
    // 先调用 update() 确保 spherical 被初始化
    this.controls.update();
    
    // 使用类型断言访问 spherical（OrbitControls 内部属性）
    const controlsAnyAz1 = this.controls as any;
    
    if (!smooth) {
      // 立即切换模式：计算最短路径，然后设置角度
      // ⚠️ 关键修复：即使立即切换，也要选择最短路径，避免旋转方向错误
      if (controlsAnyAz1.spherical) {
        // 读取当前角度
        const currentAngle = controlsAnyAz1.spherical.theta;
        // 标准化当前角度到 -π 到 π 范围
        let normalizedCurrent = currentAngle;
        while (normalizedCurrent > Math.PI) normalizedCurrent -= 2 * Math.PI;
        while (normalizedCurrent < -Math.PI) normalizedCurrent += 2 * Math.PI;
        
        // 计算角度差值，选择最短路径
        let angleDiff = angleRad - normalizedCurrent;
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        // 使用最短路径的目标角度
        const finalAngle = normalizedCurrent + angleDiff;
        
        // ⚠️ 关键修复：临时禁用阻尼，避免与自定义角度设置冲突
        const oldEnableDamping = this.controls.enableDamping;
        this.controls.enableDamping = false;
        
        controlsAnyAz1.spherical.theta = finalAngle;
        this.controls.update();
        
        // 恢复阻尼设置
        this.controls.enableDamping = oldEnableDamping;
      } else {
        // 如果 spherical 不存在，使用备用方法：通过设置相机位置
        // 也需要计算最短路径
        const currentAngle = this.controls.getAzimuthalAngle();
        let normalizedCurrent = currentAngle;
        while (normalizedCurrent > Math.PI) normalizedCurrent -= 2 * Math.PI;
        while (normalizedCurrent < -Math.PI) normalizedCurrent += 2 * Math.PI;
        
        let angleDiff = angleRad - normalizedCurrent;
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        const finalAngle = normalizedCurrent + angleDiff;
        
        const currentDistance = this.camera.position.distanceTo(this.controls.target);
        const currentPolarAngle = this.controls.getPolarAngle();
        const newPosition = new THREE.Vector3();
        newPosition.x = currentDistance * Math.sin(currentPolarAngle) * Math.cos(finalAngle);
        newPosition.y = currentDistance * Math.cos(currentPolarAngle);
        newPosition.z = currentDistance * Math.sin(currentPolarAngle) * Math.sin(finalAngle);
        newPosition.add(this.controls.target);
        this.camera.position.copy(newPosition);
        this.camera.lookAt(this.controls.target);
        this.controls.update();
      }
      this.currentAzimuthalAngle = angleRad;
      this.targetAzimuthalAngle = angleRad;
      this.isAzimuthalAngleTransitioning = false;
      return;
    }
    
    // 平滑过渡模式
    this.targetAzimuthalAngle = angleRad;
    this.isAzimuthalAngleTransitioning = true;
    // 获取当前角度，直接从 spherical.theta 读取（更准确）
    this.controls.update();
    const controlsAnyAz2 = this.controls as any;
    const currentAngle = controlsAnyAz2.spherical ? controlsAnyAz2.spherical.theta : this.controls.getAzimuthalAngle();
    // 标准化当前角度到 -π 到 π 范围
    let normalizedCurrent = currentAngle;
    while (normalizedCurrent > Math.PI) normalizedCurrent -= 2 * Math.PI;
    while (normalizedCurrent < -Math.PI) normalizedCurrent += 2 * Math.PI;
    // 计算角度差值，选择最短路径
    let angleDiff = angleRad - normalizedCurrent;
    // 如果差值超过180度，选择另一条路径
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    // 从标准化后的当前角度开始
    this.currentAzimuthalAngle = normalizedCurrent;
  }

  // 设置滚轮缩放处理
  private setupWheelZoom(domElement: HTMLElement): void {
    // 如果已经绑定过，先移除旧的监听器
    if (this.wheelHandler) {
      domElement.removeEventListener('wheel', this.wheelHandler);
    }
    
    this.wheelHandler = (e: WheelEvent) => {
      // ⚠️ 关键：确保事件被正确处理
      e.preventDefault();
      e.stopPropagation();
      
      // 如果正在聚焦动画，立即停止，允许用户立即控制缩放
      if (this.isFocusing) {
        this.isFocusing = false;
        this.targetCameraPosition = null;
        this.targetControlsTarget = null;
        // 同步当前距离，确保缩放从当前位置开始
        const currentDist = this.camera.position.distanceTo(this.controls.target);
        if (isFinite(currentDist) && currentDist > 0) {
          this.smoothDistance = currentDist;
          this.targetDistance = currentDist;
        }
        // 重置最小距离（允许用户自由缩放）
        this.resetMinDistance();
      }
      
      // ⚠️ 关键修复：不要停止跟踪，允许在跟踪的同时缩放
      // 如果正在跟踪，同步当前距离（使用 smoothDistance 如果存在，否则使用实际距离）
      if (this.isTracking) {
        const currentDist = this.smoothDistance || this.camera.position.distanceTo(this.controls.target);
        if (isFinite(currentDist) && currentDist > 0) {
          this.smoothDistance = currentDist;
          this.targetDistance = currentDist;
          // 同步 trackingDistance，确保跟踪逻辑使用正确的距离
          this.trackingDistance = currentDist;
        }
      }
      
      // 确保缩放功能启用（聚焦后可能被禁用）
      this.isZooming = true;
      
      // 计算缩放增量（与2D版本一致）
      const scrollSpeed = Math.min(Math.abs(e.deltaY) / 100, 3);
      // 向下滚动缩小（deltaY > 0），向上滚动放大（deltaY < 0）
      // 注意：向下滚动应该拉远（缩小），向上滚动应该拉近（放大）
      const zoomDelta = e.deltaY > 0 ? -scrollSpeed : scrollSpeed;
      this.zoom(zoomDelta);
    };
    
    // 绑定到 canvas 元素（renderer.domElement）
    domElement.addEventListener('wheel', this.wheelHandler, { passive: false });
  }

  // 设置触摸缩放处理
  private setupTouchZoom(domElement: HTMLElement): void {
    // 如果已经绑定过，先移除旧的监听器
    if (this.touchStartHandler) {
      domElement.removeEventListener('touchstart', this.touchStartHandler);
      domElement.removeEventListener('touchmove', this.touchMoveHandler!);
      domElement.removeEventListener('touchend', this.touchEndHandler!);
    }
    
    let initialDistance = 0;
    let initialSmoothDistance = 0;

    this.touchStartHandler = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        initialSmoothDistance = this.smoothDistance;
      }
    };

    this.touchMoveHandler = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance > 0) {
        // 如果正在聚焦或跟踪，立即停止
        if (this.isFocusing) {
          this.isFocusing = false;
          this.targetCameraPosition = null;
          this.targetControlsTarget = null;
          this.resetMinDistance();
        }
        if (this.isTracking) {
          this.stopTracking();
        }
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        const scale = currentDistance / initialDistance;
        // 手指张开（scale > 1）应该放大（减小距离），手指合拢（scale < 1）应该缩小（增大距离）
        // 所以应该是 initialSmoothDistance / scale（与鼠标滚轮逻辑一致）
        this.targetDistance = Math.max(
          this.controls.minDistance,
          Math.min(this.controls.maxDistance, initialSmoothDistance / scale)
        );
        this.isZooming = true;
      }
    };

    this.touchEndHandler = () => {
      initialDistance = 0;
    };

    domElement.addEventListener('touchstart', this.touchStartHandler, { passive: false });
    domElement.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
    domElement.addEventListener('touchend', this.touchEndHandler);
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    
    switch (mode) {
      case 'free':
        this.controls.enabled = true;
        break;
      case 'locked':
        this.controls.enabled = true;
        // TODO: 锁定到目标天体
        break;
      case 'follow':
        this.controls.enabled = false;
        // TODO: 跟随目标
        break;
    }
  }

  setTarget(body: THREE.Object3D | null): void {
    this.targetBody = body;
    if (body) {
      this.controls.target.copy(body.position);
      this.controls.update();
    }
  }
  
  /**
   * 平滑移动到目标位置（用于点击聚焦）
   * @param targetPosition 目标位置（初始位置）
   * @param targetDistance 目标距离
   * @param trackingTargetGetter 可选的跟踪目标位置获取函数，如果提供则持续跟踪目标
   * @param planetRadius 可选的行星半径，用于动态调整最小距离防止穿模
   */
  focusOnTarget(targetPosition: THREE.Vector3, targetDistance: number = 5, trackingTargetGetter?: () => THREE.Vector3, planetRadius?: number): void {
    // 停止之前的聚焦动画（如果正在运行）
    this.isFocusing = false;
    
    // 根据行星半径动态调整最小距离，防止穿模
    if (planetRadius !== undefined && planetRadius > 0) {
      // 最小距离 = 行星半径 * 倍数，确保相机不会进入行星内部
      const minSafeDistance = planetRadius * CAMERA_CONFIG.minDistanceMultiplier;
      // 确保目标距离不小于最小安全距离
      targetDistance = Math.max(targetDistance, minSafeDistance);
      // 更新 OrbitControls 的最小距离
      this.controls.minDistance = minSafeDistance;
    } else {
      // 如果没有提供行星半径，使用默认最小距离
      this.controls.minDistance = CAMERA_CONFIG.minDistance;
    }
    
    // 设置跟踪模式
    if (trackingTargetGetter) {
      this.isTracking = true;
      this.trackingTargetGetter = trackingTargetGetter;
      this.trackingDistance = targetDistance;
    } else {
      this.isTracking = false;
      this.trackingTargetGetter = null;
    }
    
    // 计算相机应该移动到的位置
    // 使用从目标指向相机的方向，确保相机在目标外部
    const currentDirection = new THREE.Vector3()
      .subVectors(this.camera.position, this.controls.target)
      .normalize();
    
    // 如果方向无效（例如相机和目标在同一位置），使用默认方向（从上方观察）
    if (currentDirection.length() < 0.001) {
      currentDirection.set(0, 0.5, 1).normalize();
    }
    
    // 确保距离足够大，避免相机进入目标内部
    const safeDistance = Math.max(targetDistance, this.controls.minDistance);
    
    const newCameraPosition = new THREE.Vector3()
      .copy(targetPosition)
      .add(currentDirection.multiplyScalar(safeDistance));
    
    // 同步平滑距离，确保缩放从正确的位置开始
    this.smoothDistance = safeDistance;
    this.targetDistance = safeDistance;
    
    // 平滑移动相机和目标（在update中处理）
    this.targetCameraPosition = newCameraPosition;
    this.targetControlsTarget = targetPosition.clone();
    this.isFocusing = true;
  }
  
  /**
   * 重置最小距离到默认值（用于取消聚焦时）
   */
  resetMinDistance(): void {
    this.controls.minDistance = CAMERA_CONFIG.minDistance;
  }
  
  /**
   * 停止跟踪目标
   */
  stopTracking(): void {
    this.isTracking = false;
    this.trackingTargetGetter = null;
    // 重置最小距离到默认值
    this.resetMinDistance();
  }

  // 手动缩放方法（带平滑效果）
  zoom(delta: number): void {
    // 如果正在聚焦，先停止聚焦
    if (this.isFocusing) {
      this.isFocusing = false;
      this.targetCameraPosition = null;
      this.targetControlsTarget = null;
      this.resetMinDistance();
    }
    
    // ⚠️ 关键修复：缩放时不要停止跟踪，而是让跟踪使用缩放后的距离
    // 这样用户可以在跟踪行星的同时缩放
    
    // 获取当前距离（如果正在跟踪，使用 smoothDistance；否则使用实际距离）
    const currentDistance = this.isTracking 
      ? this.smoothDistance || this.camera.position.distanceTo(this.controls.target)
      : this.camera.position.distanceTo(this.controls.target);
    
    // 防止 NaN 和无效值
    if (!isFinite(currentDistance) || currentDistance <= 0) {
      console.warn('CameraController.zoom: Invalid currentDistance', currentDistance);
      return;
    }
    
    // 计算缩放因子（类似2D版本，根据滚动速度调整）
    const baseFactor = CAMERA_CONFIG.zoomBaseFactor;
    const scrollSpeed = Math.min(Math.abs(delta), 3); // 限制最大滚动速度影响
    // delta > 0 表示放大（拉近），delta < 0 表示缩小（拉远）
    // 在3D中，delta > 0 应该减小距离（拉近相机），delta < 0 应该增加距离（拉远相机）
    const zoomFactor = delta > 0 
      ? 1 - (baseFactor * scrollSpeed)  // 减小距离（拉近/放大）
      : 1 + (baseFactor * scrollSpeed);  // 增大距离（拉远/缩小）
    
    // 计算新的目标距离
    const newTargetDistance = currentDistance * zoomFactor;
    
    // 更新目标距离（限制在合理范围内）
    // ⚠️ 重要：允许稍微小于 minDistance，但不要太小（防止穿模）
    const minAllowedDistance = this.controls.minDistance * 0.8; // 允许稍微小于 minDistance
    this.targetDistance = Math.max(
      minAllowedDistance,
      Math.min(this.controls.maxDistance, newTargetDistance)
    );
    
    // 同步平滑距离，确保缩放从当前位置开始
    this.smoothDistance = currentDistance;
    this.isZooming = true;
    
    // 如果正在跟踪，立即更新跟踪距离，这样跟踪逻辑会使用新的距离
    if (this.isTracking) {
      this.trackingDistance = this.targetDistance;
    }
  }

  update(deltaTime: number): void {
    // 处理 FOV 平滑过渡
    if (this.isFovTransitioning) {
      const fovDiff = this.targetFov - this.currentFov;
      if (Math.abs(fovDiff) > 0.1) {
        // 使用缓动函数实现平滑过渡
        this.currentFov += fovDiff * this.fovTransitionSpeed;
        this.camera.fov = this.currentFov;
        this.camera.updateProjectionMatrix();
      } else {
        // 过渡完成
        this.currentFov = this.targetFov;
        this.camera.fov = this.targetFov;
        this.isFovTransitioning = false;
        this.camera.updateProjectionMatrix();
      }
    }
    
    // 处理相机左右角度平滑过渡
    if (this.isAzimuthalAngleTransitioning) {
      // ⚠️ 重要：不要在每帧都从 spherical.theta 同步角度，这会导致振荡
      // 只在开始时读取一次，然后使用我们自己的插值逻辑
      
      // 计算角度差值，选择最短路径（处理角度环绕）
      let angleDiff = this.targetAzimuthalAngle - this.currentAzimuthalAngle;
      // 处理角度环绕：如果差值超过180度，选择另一条路径
      if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      
      if (Math.abs(angleDiff) > 0.01) {
        // 使用缓动函数实现平滑过渡
        this.currentAzimuthalAngle += angleDiff * this.azimuthalAngleTransitionSpeed;
        // 保持角度在 -Math.PI 到 Math.PI 范围内
        if (this.currentAzimuthalAngle > Math.PI) this.currentAzimuthalAngle -= 2 * Math.PI;
        if (this.currentAzimuthalAngle < -Math.PI) this.currentAzimuthalAngle += 2 * Math.PI;
        
        // 使用类型断言访问 spherical（OrbitControls 内部属性）
        const controlsAnyAz = this.controls as any;
        if (controlsAnyAz.spherical) {
          // ⚠️ 关键修复：临时禁用阻尼，避免与自定义插值冲突
          const oldEnableDamping = this.controls.enableDamping;
          this.controls.enableDamping = false;
          
          controlsAnyAz.spherical.theta = this.currentAzimuthalAngle;
          
          // 更新但不允许阻尼修改角度
          this.controls.update();
          
          // 恢复阻尼设置
          this.controls.enableDamping = oldEnableDamping;
        } else {
          // 如果 spherical 不存在，使用备用方法
          const currentDistance = this.camera.position.distanceTo(this.controls.target);
          const currentPolarAngle = this.controls.getPolarAngle();
          const newPosition = new THREE.Vector3();
          newPosition.x = currentDistance * Math.sin(currentPolarAngle) * Math.cos(this.currentAzimuthalAngle);
          newPosition.y = currentDistance * Math.cos(currentPolarAngle);
          newPosition.z = currentDistance * Math.sin(currentPolarAngle) * Math.sin(this.currentAzimuthalAngle);
          newPosition.add(this.controls.target);
          this.camera.position.copy(newPosition);
          this.camera.lookAt(this.controls.target);
          this.controls.update();
        }
      } else {
        // 过渡完成
        this.currentAzimuthalAngle = this.targetAzimuthalAngle;
        const controlsAnyAz = this.controls as any;
        if (controlsAnyAz.spherical) {
          // ⚠️ 关键修复：临时禁用阻尼，避免与自定义插值冲突
          const oldEnableDamping = this.controls.enableDamping;
          this.controls.enableDamping = false;
          
          controlsAnyAz.spherical.theta = this.targetAzimuthalAngle;
          
          // 更新但不允许阻尼修改角度
          this.controls.update();
          
          // 恢复阻尼设置
          this.controls.enableDamping = oldEnableDamping;
        } else {
          // 如果 spherical 不存在，使用备用方法
          const currentDistance = this.camera.position.distanceTo(this.controls.target);
          const currentPolarAngle = this.controls.getPolarAngle();
          const newPosition = new THREE.Vector3();
          newPosition.x = currentDistance * Math.sin(currentPolarAngle) * Math.cos(this.targetAzimuthalAngle);
          newPosition.y = currentDistance * Math.cos(currentPolarAngle);
          newPosition.z = currentDistance * Math.sin(currentPolarAngle) * Math.sin(this.targetAzimuthalAngle);
          newPosition.add(this.controls.target);
          this.camera.position.copy(newPosition);
          this.camera.lookAt(this.controls.target);
          this.controls.update();
        }
        this.isAzimuthalAngleTransitioning = false;
      }
    }
    
    // 处理相机上下角度平滑过渡
    if (this.isPolarAngleTransitioning) {
      // ⚠️ 重要：不要在每帧都从 spherical.phi 同步角度，这会导致振荡
      // 只在开始时读取一次，然后使用我们自己的插值逻辑
      
      const angleDiff = this.targetPolarAngle - this.currentPolarAngle;
      if (Math.abs(angleDiff) > 0.01) {
        // 使用缓动函数实现平滑过渡
        this.currentPolarAngle += angleDiff * this.polarAngleTransitionSpeed;
        // 确保角度在有效范围内（0 到 Math.PI），允许上下翻转
        this.currentPolarAngle = Math.max(0, Math.min(Math.PI, this.currentPolarAngle));
        
        // 使用类型断言访问 spherical（OrbitControls 内部属性）
        const controlsAnyPol = this.controls as any;
        if (controlsAnyPol.spherical) {
          // ⚠️ 关键修复：临时禁用阻尼，避免与自定义插值冲突
          const oldEnableDamping = this.controls.enableDamping;
          this.controls.enableDamping = false;
          
          controlsAnyPol.spherical.phi = this.currentPolarAngle;
          
          // 更新但不允许阻尼修改角度
          this.controls.update();
          
          // 恢复阻尼设置
          this.controls.enableDamping = oldEnableDamping;
        } else {
          // 如果 spherical 不存在，使用备用方法：通过设置相机位置
          const currentDistance = this.camera.position.distanceTo(this.controls.target);
          const currentAzimuthalAngle = this.controls.getAzimuthalAngle();
          const newPosition = new THREE.Vector3();
          newPosition.x = currentDistance * Math.sin(this.currentPolarAngle) * Math.cos(currentAzimuthalAngle);
          newPosition.y = currentDistance * Math.cos(this.currentPolarAngle);
          newPosition.z = currentDistance * Math.sin(this.currentPolarAngle) * Math.sin(currentAzimuthalAngle);
          newPosition.add(this.controls.target);
          this.camera.position.copy(newPosition);
          this.camera.lookAt(this.controls.target);
          this.controls.update();
        }
      } else {
        // 过渡完成
        this.currentPolarAngle = this.targetPolarAngle;
        const controlsAnyPol3 = this.controls as any;
        if (controlsAnyPol3.spherical) {
          // ⚠️ 关键修复：临时禁用阻尼，避免与自定义插值冲突
          const oldEnableDamping = this.controls.enableDamping;
          this.controls.enableDamping = false;
          
          controlsAnyPol3.spherical.phi = this.targetPolarAngle;
          
          // 更新但不允许阻尼修改角度
          this.controls.update();
          
          // 恢复阻尼设置
          this.controls.enableDamping = oldEnableDamping;
        } else {
          // 如果 spherical 不存在，使用备用方法
          const currentDistance = this.camera.position.distanceTo(this.controls.target);
          const currentAzimuthalAngle = this.controls.getAzimuthalAngle();
          const newPosition = new THREE.Vector3();
          newPosition.x = currentDistance * Math.sin(this.targetPolarAngle) * Math.cos(currentAzimuthalAngle);
          newPosition.y = currentDistance * Math.cos(this.targetPolarAngle);
          newPosition.z = currentDistance * Math.sin(this.targetPolarAngle) * Math.sin(currentAzimuthalAngle);
          newPosition.add(this.controls.target);
          this.camera.position.copy(newPosition);
          this.camera.lookAt(this.controls.target);
          this.controls.update();
        }
        this.isPolarAngleTransitioning = false;
      }
    }
    
    // 处理聚焦动画（仅在非跟踪模式下）
    if (!this.isTracking && this.isFocusing && this.targetCameraPosition && this.targetControlsTarget) {
      const cameraLerpSpeed = CAMERA_CONFIG.focusLerpSpeed;
      const targetLerpSpeed = CAMERA_CONFIG.focusLerpSpeed;
      
      this.camera.position.lerp(this.targetCameraPosition, cameraLerpSpeed);
      this.controls.target.lerp(this.targetControlsTarget, targetLerpSpeed);
      
      // 检查是否到达目标位置
      const cameraDist = this.camera.position.distanceTo(this.targetCameraPosition);
      const targetDist = this.controls.target.distanceTo(this.targetControlsTarget);
      
      if (cameraDist < CAMERA_CONFIG.focusThreshold && targetDist < CAMERA_CONFIG.focusThreshold) {
        // 到达目标位置后，停止聚焦动画，允许用户自由移动视角
        this.isFocusing = false;
        this.targetCameraPosition = null;
        this.targetControlsTarget = null;
        // 同步平滑距离，确保缩放从当前位置开始
        this.smoothDistance = this.camera.position.distanceTo(this.controls.target);
        this.targetDistance = this.smoothDistance;
        // 如果正在跟踪，同步跟踪距离
        if (this.isTracking) {
          this.trackingDistance = this.smoothDistance;
        }
        // 确保缩放功能启用（重置缩放状态，允许新的缩放操作）
        this.isZooming = false;
        // 更新 controls 以确保相机位置正确
        this.controls.update();
        // 继续执行后续逻辑，允许缩放和旋转（不返回，继续执行）
      } else {
        // 聚焦动画中，更新 controls
        this.controls.update();
        // 聚焦动画中，仍然允许缩放（滚轮事件已经在 wheelHandler 中处理了停止聚焦）
        // 不返回，继续执行后续的缩放逻辑，这样滚轮缩放才能正常工作
      }
    }
    
    if (this.mode === 'follow' && this.targetBody) {
      // 跟随模式：平滑移动相机到目标位置
      const targetPos = this.targetBody.position.clone();
      this.camera.position.lerp(targetPos.clone().add(new THREE.Vector3(0, 0, 10)), this.followSpeed);
      this.controls.target.lerp(targetPos, this.followSpeed);
    }
    
    // 平滑缩放实现（类似2D版本的缓动效果）
    // ⚠️ 重要：缩放逻辑必须在跟踪逻辑之前执行，这样跟踪逻辑才能使用缩放后的距离
    if (this.isZooming) {
      const distanceDiff = this.targetDistance - this.smoothDistance;
      
      if (Math.abs(distanceDiff) > 0.01) {
        // 使用缓动函数实现平滑过渡（ease-out），与2D版本一致
        // 使用更快的缓动速度，让缩放更流畅
        const speed = CAMERA_CONFIG.zoomEasingSpeed;
        this.smoothDistance += distanceDiff * speed;
        
        // 如果正在跟踪，更新跟踪距离（让跟踪逻辑使用缩放后的距离）
        if (this.isTracking) {
          this.trackingDistance = this.smoothDistance;
        }
        
        // 应用平滑缩放：调整相机位置以匹配平滑距离
        const direction = new THREE.Vector3()
          .subVectors(this.camera.position, this.controls.target);
        
        const directionLength = direction.length();
        
        // 如果方向无效，使用默认方向
        if (directionLength < 0.001 || !isFinite(directionLength)) {
          direction.set(0, 0.5, 1).normalize();
        } else {
          direction.normalize();
        }
        
        // 防止 NaN 和无效值
        if (!isFinite(this.smoothDistance) || this.smoothDistance <= 0) {
          console.warn('CameraController.update: Invalid smoothDistance', this.smoothDistance);
          this.isZooming = false;
          return;
        }
        
        // 计算新的相机位置
        const newPosition = new THREE.Vector3()
          .copy(this.controls.target)
          .add(direction.multiplyScalar(this.smoothDistance));
        
        // ⚠️ 关键修复：如果正在跟踪，直接设置位置（不使用 lerp，避免被跟踪逻辑覆盖）
        // 如果不在跟踪，也可以直接设置（因为我们已经有平滑距离）
        this.camera.position.copy(newPosition);
        
        // 如果正在跟踪，同步更新 trackingDistance，确保跟踪逻辑使用正确的距离
        if (this.isTracking) {
          this.trackingDistance = this.smoothDistance;
        }
      } else {
        // 缩放完成
        this.isZooming = false;
        this.smoothDistance = this.targetDistance;
        // 如果正在跟踪，同步跟踪距离
        if (this.isTracking) {
          this.trackingDistance = this.smoothDistance;
        }
      }
    }
    
    // 处理跟踪模式（如果正在跟踪目标）
    // ⚠️ 重要：跟踪逻辑在缩放逻辑之后执行，使用缩放后的距离
    if (this.isTracking && this.trackingTargetGetter) {
      const currentTargetPosition = this.trackingTargetGetter();
      if (currentTargetPosition) {
        // ⚠️ 关键修复：如果正在缩放，不要用 lerp 覆盖缩放效果
        // 直接使用缩放后的位置，只更新目标位置
        if (this.isZooming) {
          // 缩放中：只更新 controls.target，保持相机位置不变（由缩放逻辑控制）
          this.controls.target.lerp(currentTargetPosition, CAMERA_CONFIG.trackingLerpSpeed);
          // 同步更新 trackingDistance，确保缩放完成后使用正确的距离
          this.trackingDistance = this.smoothDistance;
        } else {
          // 缩放完成：正常跟踪，使用 trackingDistance
          // 计算相机应该保持的方向（从目标指向相机）
          const currentDirection = new THREE.Vector3()
            .subVectors(this.camera.position, this.controls.target)
            .normalize();
          
          // 如果方向无效，使用默认方向
          if (currentDirection.length() < 0.001 || !isFinite(currentDirection.x)) {
            currentDirection.set(0, 0.5, 1).normalize();
          }
          
          // 使用 trackingDistance（如果缩放完成，应该等于 smoothDistance）
          const trackingDist = this.trackingDistance || this.smoothDistance;
          
          // 防止 NaN 和无效值
          if (!isFinite(trackingDist) || trackingDist <= 0) {
            console.warn('CameraController.update: Invalid trackingDistance', trackingDist);
            this.controls.update();
            return;
          }
          
          // 计算新的相机位置（保持距离和方向）
          const newCameraPosition = new THREE.Vector3()
            .copy(currentTargetPosition)
            .add(currentDirection.multiplyScalar(trackingDist));
          
          // 平滑移动相机和目标（跟随目标）
          this.camera.position.lerp(newCameraPosition, CAMERA_CONFIG.trackingLerpSpeed);
          this.controls.target.lerp(currentTargetPosition, CAMERA_CONFIG.trackingLerpSpeed);
        }
        
        // 更新 controls
        this.controls.update();
        // 继续执行后续逻辑，允许缩放和旋转
      }
    }
    
    // 确保平滑距离始终与当前距离同步（防止累积误差）
    if (!this.isZooming && !this.isTracking) {
      const currentDistance = this.camera.position.distanceTo(this.controls.target);
      if (Math.abs(currentDistance - this.smoothDistance) > 0.1) {
        this.smoothDistance = currentDistance;
        this.targetDistance = currentDistance;
      }
    }
    
    // 更新 OrbitControls（这会应用旋转和平移的阻尼效果）
    this.controls.update();
  }

  getControls(): OrbitControls {
    return this.controls;
  }

  // FOV 平滑过渡相关
  private targetFov: number = CAMERA_CONFIG.fov;
  private currentFov: number = CAMERA_CONFIG.fov;
  private isFovTransitioning: boolean = false;
  private fovTransitionSpeed: number = 0.15; // FOV 过渡速度（0-1，越大越快）

  /**
   * 设置相机视野角度（FOV）
   * @param fov 视野角度（度）
   * @param smooth 是否平滑过渡（默认 false，立即切换）
   */
  setFov(fov: number, smooth: boolean = false): void {
    if (!isFinite(fov) || fov <= 0 || fov >= 180) {
      console.warn('CameraController.setFov: Invalid FOV value', fov);
      return;
    }
    
    if (smooth) {
      // 平滑过渡模式
      this.targetFov = fov;
      this.isFovTransitioning = true;
      this.currentFov = this.camera.fov; // 从当前 FOV 开始过渡
    } else {
      // 立即切换模式
      this.camera.fov = fov;
      this.currentFov = fov;
      this.targetFov = fov;
      this.isFovTransitioning = false;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * 获取当前相机视野角度（FOV）
   */
  getFov(): number {
    return this.camera.fov;
  }

  dispose(): void {
    // 清理事件监听器
    if (this.wheelHandler && this.domElement) {
      this.domElement.removeEventListener('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
    
    if (this.touchStartHandler && this.domElement) {
      this.domElement.removeEventListener('touchstart', this.touchStartHandler);
      this.domElement.removeEventListener('touchmove', this.touchMoveHandler!);
      this.domElement.removeEventListener('touchend', this.touchEndHandler!);
      this.touchStartHandler = null;
      this.touchMoveHandler = null;
      this.touchEndHandler = null;
    }
    
    // OrbitControls 会自动处理其内部的事件监听器
    this.controls.dispose();
  }
}

