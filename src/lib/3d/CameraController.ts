/**
 * CameraController.ts - 相机控制器
 * 
 * 推荐使用 OrbitControls + 自定义扩展：
 * - 模式 A：自由观察模式（平移、旋转、缩放）
 * - 模式 B：锁定某个星球（绕星球转圈、跟随公转）
 * - 模式 C：跟随火箭/卫星（根据目标速度调整相机缓动）
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ==================== 可调参数配置 ====================

  // 相机控制配置
const CAMERA_CONFIG = {
  dampingFactor: 0.05, // 阻尼系数（0-1，值越小缓动越明显，惯性越强）
  minDistance: 0.001, // 最小缩放距离（默认值，会根据行星半径动态调整）
  maxDistance: 1000, // 最大缩放距离
  zoomSpeed: 1.5, // 缩放速度
  panSpeed: 0.5, // 平移速度
  rotateSpeed: 0.5, // 旋转速度
  zoomBaseFactor: 0.3, // 基础缩放因子
  zoomEasingSpeed: 0.2, // 缩放缓动速度（0-1之间，越大越快）
  // 聚焦动画配置
  focusLerpSpeed: 0.1, // 聚焦动画的插值速度（0-1，越大越快）
  focusThreshold: 0.01, // 聚焦动画完成阈值（距离小于此值认为完成）
  // 跟踪配置
  trackingLerpSpeed: 0.15, // 跟踪时的插值速度（0-1，越大越快，值越大跟随越紧密）
  // 防穿模配置
  minDistanceMultiplier: 1.5, // 最小距离倍数（相对于行星半径，防止穿模）
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
    
    // 延迟绑定事件监听器，确保 DOM 元素完全准备好
    // 使用双重 requestAnimationFrame 确保在渲染后绑定，此时 canvas 肯定已经在 DOM 中
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // 再次检查 domElement 是否还在 DOM 中
        if (domElement.isConnected) {
          this.setupWheelZoom(domElement);
          this.setupTouchZoom(domElement);
        }
      });
    });
    
    // 平滑缩放（使用平滑插值）
    this.controls.screenSpacePanning = false; // 使用球面平移，更自然
    
    // 限制旋转角度（可选，防止翻转）
    this.controls.minPolarAngle = 0; // 最小垂直角度（0度 = 从上方看）
    this.controls.maxPolarAngle = Math.PI; // 最大垂直角度（180度 = 从下方看）
    
    // 自动旋转（可选，如果需要）
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 2.0;
  }

  // 设置滚轮缩放处理
  private setupWheelZoom(domElement: HTMLElement): void {
    // 如果已经绑定过，先移除旧的监听器
    if (this.wheelHandler) {
      domElement.removeEventListener('wheel', this.wheelHandler);
    }
    
    this.wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // 如果正在聚焦或跟踪，立即停止，允许用户立即控制缩放
      if (this.isFocusing) {
        this.isFocusing = false;
        this.targetCameraPosition = null;
        this.targetControlsTarget = null;
        // 同步当前距离，确保缩放从当前位置开始
        this.smoothDistance = this.camera.position.distanceTo(this.controls.target);
        this.targetDistance = this.smoothDistance;
        // 重置最小距离（允许用户自由缩放）
        this.resetMinDistance();
      }
      
      // 如果正在跟踪，停止跟踪
      if (this.isTracking) {
        this.stopTracking();
        // 同步当前距离
        this.smoothDistance = this.camera.position.distanceTo(this.controls.target);
        this.targetDistance = this.smoothDistance;
      }
      
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
    const currentDistance = this.camera.position.distanceTo(this.controls.target);
    // 计算缩放因子（类似2D版本，根据滚动速度调整）
    const baseFactor = CAMERA_CONFIG.zoomBaseFactor;
    const scrollSpeed = Math.min(Math.abs(delta), 3); // 限制最大滚动速度影响
    // delta > 0 表示放大（拉近），delta < 0 表示缩小（拉远）
    // 在3D中，delta > 0 应该减小距离（拉近相机），delta < 0 应该增加距离（拉远相机）
    const zoomFactor = delta > 0 
      ? 1 - (baseFactor * scrollSpeed)  // 减小距离（拉近/放大）
      : 1 + (baseFactor * scrollSpeed);  // 增大距离（拉远/缩小）
    // 更新目标距离
    this.targetDistance = Math.max(
      this.controls.minDistance,
      Math.min(this.controls.maxDistance, currentDistance * zoomFactor)
    );
    this.isZooming = true;
  }

  update(deltaTime: number): void {
    // 处理跟踪模式（如果正在跟踪目标）
    if (this.isTracking && this.trackingTargetGetter) {
      const currentTargetPosition = this.trackingTargetGetter();
      if (currentTargetPosition) {
        // 计算相机应该保持的方向（从目标指向相机）
        const currentDirection = new THREE.Vector3()
          .subVectors(this.camera.position, this.controls.target)
          .normalize();
        
        // 如果方向无效，使用默认方向
        if (currentDirection.length() < 0.001) {
          currentDirection.set(0, 0.5, 1).normalize();
        }
        
        // 计算新的相机位置（保持距离和方向）
        const newCameraPosition = new THREE.Vector3()
          .copy(currentTargetPosition)
          .add(currentDirection.multiplyScalar(this.trackingDistance));
        
        // 平滑移动相机和目标（跟随目标）
        this.camera.position.lerp(newCameraPosition, CAMERA_CONFIG.trackingLerpSpeed);
        this.controls.target.lerp(currentTargetPosition, CAMERA_CONFIG.trackingLerpSpeed);
        
        // 更新 controls
        this.controls.update();
        // 继续执行后续逻辑，允许缩放和旋转
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
        // 更新 controls 以确保相机位置正确
        this.controls.update();
        // 继续执行后续逻辑，允许缩放和旋转（不返回，继续执行）
      } else {
        // 聚焦动画中，更新 controls
        this.controls.update();
        // 聚焦动画中，不执行缩放逻辑，但允许用户通过滚轮停止聚焦
        return;
      }
    }
    
    if (this.mode === 'follow' && this.targetBody) {
      // 跟随模式：平滑移动相机到目标位置
      const targetPos = this.targetBody.position.clone();
      this.camera.position.lerp(targetPos.clone().add(new THREE.Vector3(0, 0, 10)), this.followSpeed);
      this.controls.target.lerp(targetPos, this.followSpeed);
    }
    
    // 平滑缩放实现（类似2D版本的缓动效果）
    // 如果正在跟踪，缩放时更新跟踪距离
    if (this.isZooming) {
      const distanceDiff = this.targetDistance - this.smoothDistance;
      
      if (Math.abs(distanceDiff) > 0.01) {
        // 使用缓动函数实现平滑过渡（ease-out），与2D版本一致
        // 使用更快的缓动速度，让缩放更流畅
        const speed = CAMERA_CONFIG.zoomEasingSpeed;
        this.smoothDistance += distanceDiff * speed;
        
        // 如果正在跟踪，更新跟踪距离
        if (this.isTracking) {
          this.trackingDistance = this.smoothDistance;
        }
        
        // 应用平滑缩放：调整相机位置以匹配平滑距离
        const direction = new THREE.Vector3()
          .subVectors(this.camera.position, this.controls.target)
          .normalize();
        
        // 计算新的相机位置
        const newPosition = new THREE.Vector3()
          .copy(this.controls.target)
          .add(direction.multiplyScalar(this.smoothDistance));
        
        // 直接设置相机位置（不使用lerp，因为我们已经有了平滑距离）
        this.camera.position.copy(newPosition);
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
    
    // 确保平滑距离始终与当前距离同步（防止累积误差）
    if (!this.isZooming) {
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

