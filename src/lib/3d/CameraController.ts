/**
 * CameraController.ts - 3D 相机控制器
 *
 * 功能：
 * - 管理 Three.js PerspectiveCamera 和 OrbitControls
 * - 实现平滑缩放、聚焦、跟踪等功能
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  CAMERA_CONFIG,
  CAMERA_PENETRATION_CONFIG,
  QUICK_CAMERA_SETTINGS
} from '@/lib/config/cameraConfig';
import { cameraConfigManager, type CameraConfigType } from '@/lib/config/CameraConfigManager';

// Enhanced focus management
import { FocusManager, type CelestialObject, type FocusOptions } from './FocusManager';

// 兼容旧代码中对单一 CAMERA_CONFIG 的使用（现在直接使用新的统一配置）

export type CameraMode = 'free' | 'locked' | 'follow';

export class CameraController {
  private controls: OrbitControls;
  private camera: THREE.PerspectiveCamera;
  private mode: CameraMode = 'free';
  private targetBody: THREE.Object3D | null = null;
  private followSpeed: number = 0.1; // 跟随缓动速度
  
  // Enhanced focus management
  private focusManager: FocusManager;
  
  // 实时配置管理
  private currentConfig: CameraConfigType;
  private configUnsubscribe: (() => void) | null = null;
  
  // 平滑缩放相关
  private smoothDistance: number = 0; // 当前平滑的距离
  private targetDistance: number = 0; // 目标距离
  private isZooming: boolean = false; // 是否正在缩放
  private lastDistance: number = 0; // 上一帧的距离
  
  // 事件监听器引用，用于清理
  private wheelHandler: ((e: WheelEvent) => void) | null = null;
  private touchStartHandler: ((e: TouchEvent) => void) | null = null;
  private touchMoveHandler: ((e: TouchEvent) => void) | null = null;
  private touchEndHandler: ((e: TouchEvent) => void) | null = null;
  private domElement: HTMLElement;
  
  // 聚焦相关
  private targetCameraPosition: THREE.Vector3 | null = null;
  private targetControlsTarget: THREE.Vector3 | null = null;
  private isFocusing: boolean = false;
  // 当前聚焦目标的真实半径（AU），用于防穿透约束
  private currentTargetRadius: number | null = null;
  
  // 跟踪相关
  private isTracking: boolean = false; // 是否正在跟踪目标
  private trackingTargetGetter: (() => THREE.Vector3) | null = null; // 获取跟踪目标位置的函数
  private trackingDistance: number = 5; // 跟踪时的相机距离

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    
    // 初始化配置管理（但暂不设置监听器）
    this.currentConfig = cameraConfigManager.getConfig();
    
    // Initialize enhanced focus manager
    this.focusManager = new FocusManager();
    
    // 应用 FOV 配置
    this.camera.fov = CAMERA_CONFIG.fov;
    this.camera.updateProjectionMatrix();
    
    this.controls = new OrbitControls(camera, domElement);
    
    // ⚠️ 重要：在 OrbitControls 初始化后再设置配置监听器
    this.setupConfigListener();
    
    // 🐛 强制调试：显示当前配置
    console.log('🔧 CameraController 初始化 - 当前配置:', {
      largeZoomMaxSpeed: this.currentConfig.largeZoomMaxSpeed,
      smallZoomMaxSpeed: this.currentConfig.smallZoomMaxSpeed,
      zoomEasingSpeed: this.currentConfig.zoomEasingSpeed,
      zoomBaseFactor: this.currentConfig.zoomBaseFactor,
      configSource: 'CameraConfigManager'
    });
    
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
    
    // 距离限制（移除最小距离限制，允许更接近目标）
    // 将 minDistance 设为 0，避免在聚焦/滚轮时被瞬间限制回较远距离
    this.controls.minDistance = 0;
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
  setPolarAngle(angle: number, smooth = false) {
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
  setAzimuthalAngle(angle: number, smooth = false) {
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
  private setupWheelZoom(domElement: HTMLElement) {
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
  private setupTouchZoom(domElement: HTMLElement) {
    // 如果已经绑定过，先移除旧的监听器
    if (this.touchStartHandler) {
      domElement.removeEventListener('touchstart', this.touchStartHandler);
      domElement.removeEventListener('touchmove', this.touchMoveHandler!);
      domElement.removeEventListener('touchend', this.touchEndHandler!);
    }
    
    let initialDistance = 0;
    let initialSmoothDistance = 0;
    let isPinching = false; // 添加缩放状态标记
    let lastUpdateTime = 0; // 添加更新时间控制，优化性能

    this.touchStartHandler = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault(); // 阻止默认的缩放行为
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        initialSmoothDistance = this.smoothDistance;
        isPinching = true;
        lastUpdateTime = performance.now(); // 重置更新时间
        
        // ⚠️ 关键修复：双指缩放时的处理逻辑与滚轮保持一致
        // 如果正在聚焦，立即停止聚焦但允许缩放
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
        
        // 确保缩放功能启用
        this.isZooming = true;
      } else {
        // 非双指触摸时重置缩放状态
        isPinching = false;
        initialDistance = 0;
      }
    };

    this.touchMoveHandler = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinching && initialDistance > 0) {
        e.preventDefault(); // 阻止默认的缩放行为
        
        // ⚠️ 性能优化：限制更新频率，避免过于频繁的计算
        const currentTime = performance.now();
        if (currentTime - lastUpdateTime < 8) { // 提高到120fps，改善大范围缩放的平滑度
          return;
        }
        lastUpdateTime = currentTime;
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        // 添加最小距离检查，避免除零错误
        if (currentDistance > 10 && initialDistance > 10) {
          const scale = currentDistance / initialDistance;
          
          // ⚠️ 关键修复：使用更激进的触摸缩放算法，提供明显的缩放效果
          // 计算缩放增量，模拟滚轮的行为
          const scaleDiff = scale - 1.0;
          
          // 使用指数放大来增强小幅度的手指移动
          // 这样即使很小的手指移动也能产生明显的缩放效果
          let zoomDelta;
          if (Math.abs(scaleDiff) > 0.001) {
            // 使用指数函数来放大小的变化
            const sign = scaleDiff > 0 ? 1 : -1;
            const absScaleDiff = Math.abs(scaleDiff);
            // 使用平方根函数来放大小变化，但限制大变化
            zoomDelta = sign * Math.sqrt(absScaleDiff) * 3; // 大幅增加敏感度
          } else {
            zoomDelta = 0;
          }
          
          // 限制单次缩放的最大幅度，但允许更大的范围
          zoomDelta = Math.max(-6, Math.min(6, zoomDelta)); // 进一步增加到±6
          
          // 使用与滚轮相同的zoom方法
          this.zoom(zoomDelta);
          
          // 更新初始距离，实现连续缩放
          initialDistance = currentDistance;
          // 同步 initialSmoothDistance 以保持一致性
          initialSmoothDistance = this.smoothDistance;
        }
      } else if (e.touches.length !== 2) {
        // 触摸点数量变化时重置缩放状态
        isPinching = false;
        initialDistance = 0;
      }
    };

    this.touchEndHandler = (e: TouchEvent) => {
      // ⚠️ 修复触控缩放惯性问题：不要立即停止缩放状态
      // 让缩放继续进行直到自然完成，这样就有惯性效果
      if (e.touches.length < 2) {
        isPinching = false;
        initialDistance = 0;
        initialSmoothDistance = 0;
        lastUpdateTime = 0;
        // 注意：不要设置 this.isZooming = false，让缩放自然完成
      }
    };

    domElement.addEventListener('touchstart', this.touchStartHandler, { passive: false });
    domElement.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
    domElement.addEventListener('touchend', this.touchEndHandler);
  }

  setMode(mode: CameraMode) {
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

  setTarget(body: THREE.Object3D) {
    this.targetBody = body;
    if (body) {
      this.controls.target.copy(body.position);
      this.controls.update();
    }
  }
  
  /**
   * Enhanced focus on target with intelligent distance calculation
   * @param targetPosition 目标位置（初始位置）
   * @param celestialObject Target celestial object with properties
   * @param trackingTargetGetter 可选的跟踪目标位置获取函数，如果提供则持续跟踪目标
   * @param options Optional focus parameters
   */
  focusOnTarget(
    targetPosition: THREE.Vector3, 
    celestialObject?: CelestialObject, 
    trackingTargetGetter?: () => THREE.Vector3,
    options?: FocusOptions
  ): void {
    // Stop previous focus animation
    this.isFocusing = false;
    
    // Calculate optimal focus distance using enhanced system
    let targetDistance = 5; // Default fallback
    
    if (celestialObject) {
      targetDistance = this.focusManager.calculateFocusDistance(celestialObject, options);
      
      // Start focus transition tracking
      this.focusManager.startFocusTransition(celestialObject, options);
      
      // Store target radius for penetration prevention
      this.currentTargetRadius = celestialObject.radius;
    } else {
      // Legacy support - use provided distance or default
      targetDistance = options?.distance || 5;
      this.currentTargetRadius = null;
    }
    
    // Set tracking mode
    if (trackingTargetGetter) {
      this.isTracking = true;
      this.trackingTargetGetter = trackingTargetGetter;
      this.trackingDistance = targetDistance;
    } else {
      this.isTracking = false;
      this.trackingTargetGetter = null;
    }

    // Calculate camera direction (from target to camera)
    const currentDirection = new THREE.Vector3()
      .subVectors(this.camera.position, this.controls.target)
      .normalize();
    
    // Use default direction if invalid
    if (currentDirection.length() < 0.001) {
      currentDirection.set(0, 0.5, 1).normalize();
    }
    
    // Calculate safe camera position
    let newCameraPosition = new THREE.Vector3()
      .copy(targetPosition)
      .add(currentDirection.multiplyScalar(targetDistance));
    
    // Apply penetration constraints if object is provided
    if (celestialObject) {
      newCameraPosition = this.focusManager.applyPenetrationConstraints(
        newCameraPosition, 
        targetPosition, 
        celestialObject.radius
      );
      
      // Recalculate actual distance after constraint application
      targetDistance = newCameraPosition.distanceTo(targetPosition);
    }
    
    // Sync smooth distance for zoom continuity
    this.smoothDistance = targetDistance;
    this.targetDistance = targetDistance;
    
    // Set transition targets
    this.targetCameraPosition = newCameraPosition;
    this.targetControlsTarget = targetPosition.clone();
    this.isFocusing = true;
  }

  /**
   * Legacy focus method for backward compatibility
   */
  focusOnTargetLegacy(targetPosition: THREE.Vector3, targetDistance = 5, trackingTargetGetter?: () => THREE.Vector3, planetRadius?: number): void {
    const celestialObject: CelestialObject | undefined = planetRadius ? {
      name: 'unknown',
      radius: planetRadius
    } : undefined;
    
    this.focusOnTarget(targetPosition, celestialObject, trackingTargetGetter, { distance: targetDistance });
  }
  
  /**
   * 设置配置监听器（在 OrbitControls 初始化后调用）
   */
  private setupConfigListener() {
    // 监听配置变更
    this.configUnsubscribe = cameraConfigManager.addListener((newConfig) => {
      console.log('🔧 CameraController 收到配置更新:', newConfig);
      this.currentConfig = newConfig;
      this.applyConfigChanges(newConfig);
    });
  }

  /**
   * 应用配置变更
   */
  private applyConfigChanges(config: CameraConfigType) {
    // 检查 controls 是否已初始化
    if (!this.controls) {
      console.log('🔧 OrbitControls 尚未初始化，跳过配置应用');
      return;
    }
    
    // 更新 OrbitControls 的相关配置
    this.controls.dampingFactor = config.dampingFactor;
    
    console.log('🔧 配置已应用到 CameraController:', {
      dampingFactor: config.dampingFactor,
      largeZoomMaxSpeed: config.largeZoomMaxSpeed,
      smallZoomMaxSpeed: config.smallZoomMaxSpeed,
      zoomEasingSpeed: config.zoomEasingSpeed,
      zoomBaseFactor: config.zoomBaseFactor
    });
  }

  /**
   * 重置最小距离到默认值（用于取消聚焦时）
   */
  resetMinDistance() {
    // 将 minDistance 重置为 0（不再限制最小距离）
    this.controls.minDistance = 0;
  }

  /**
   * Enhanced penetration prevention system with real-time detection
   * @param deltaTime 时间步长（秒）
   */
  applyPenetrationConstraint(deltaTime: number) {
    // 仅在已知目标半径时启用防穿透逻辑
    if (!this.currentTargetRadius) return;

    // 确定参考中心（优先使用跟踪获取器，其次是设置的 targetBody，再次使用 controls.target）
    let center: THREE.Vector3 | null = null;
    if (this.trackingTargetGetter) {
      center = this.trackingTargetGetter();
    } else if (this.targetBody) {
      center = this.targetBody.position;
    } else if (this.targetControlsTarget) {
      center = this.targetControlsTarget.clone();
    } else {
      center = this.controls.target.clone();
    }

    if (!center) return;

    const camPos = this.camera.position.clone();
    const dir = new THREE.Vector3().subVectors(camPos, center);
    let distToCenter = dir.length();
    if (!isFinite(distToCenter) || distToCenter <= 0) return;

    const minAllowedFromCenter = this.currentTargetRadius * CAMERA_PENETRATION_CONFIG.safetyDistanceMultiplier;

    // Enhanced real-time penetration detection
    const penetrationDepth = Math.max(0, minAllowedFromCenter - distToCenter);
    const isPenetrating = penetrationDepth > 0;
    
    // 如果距离已经安全，则无需处理
    if (!isPenetrating) return;

    // Calculate penetration severity for adaptive response
    const penetrationRatio = penetrationDepth / minAllowedFromCenter;
    const isDeepPenetration = penetrationRatio > 0.7; // 提高深度穿透阈值

    // 计算安全的相机位置（保持当前方向，但调整距离）
    const dirNorm = dir.length() > 1e-6 ? dir.normalize() : new THREE.Vector3(0, 1, 0);
    
    // ⚠️ 关键修复：只调整相机位置，不修改 controls.target
    // 这样用户仍然可以自由旋转视角，只是不能穿透星球
    if (CAMERA_PENETRATION_CONFIG.forceSnap && isDeepPenetration) {
      // 立即修正：直接设置相机位置到安全距离
      const safeDistance = Math.max(minAllowedFromCenter, this.smoothDistance || minAllowedFromCenter);
      const safeCamPos = center.clone().add(dirNorm.clone().multiplyScalar(safeDistance));
      this.camera.position.copy(safeCamPos);
      this.smoothDistance = safeDistance;
      this.targetDistance = safeDistance;
      
      // 如果正在跟踪，同步跟踪距离
      if (this.isTracking) {
        this.trackingDistance = safeDistance;
      }
      
      this.controls.update();
    } else {
      // 平滑修正：逐渐将相机移动到安全距离
      const baseSmoothness = CAMERA_PENETRATION_CONFIG.constraintSmoothness;
      const adaptiveSmoothness = baseSmoothness * (1 + penetrationRatio);
      const factor = Math.min(1, adaptiveSmoothness * Math.max(0.0001, deltaTime * 60));
      
      const easedFactor = this.easeOutQuart(factor);
      const safeDistance = Math.max(minAllowedFromCenter, this.smoothDistance || minAllowedFromCenter);
      const safeCamPos = center.clone().add(dirNorm.clone().multiplyScalar(safeDistance));
      this.camera.position.lerp(safeCamPos, easedFactor);
      
      // Update smooth distance gradually
      const currentDist = this.camera.position.distanceTo(center);
      this.smoothDistance = THREE.MathUtils.lerp(this.smoothDistance, currentDist, easedFactor);
      this.targetDistance = Math.max(this.targetDistance, this.smoothDistance);
      
      // 如果正在跟踪，同步跟踪距离
      if (this.isTracking) {
        this.trackingDistance = this.smoothDistance;
      }

      this.controls.update();
    }

    if (CAMERA_PENETRATION_CONFIG.debugMode) {
      console.info('CameraController.applyPenetrationConstraint: applied', {
        distToCenter,
        minAllowedFromCenter,
        penetrationDepth,
        penetrationRatio,
        isDeepPenetration
      });
    }
  }

  /**
   * Easing function for smooth constraint application
   */
  private easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4);
  }

  /**
   * Real-time penetration detection during user input
   * Called during zoom and rotation operations to prevent penetration
   */
  private preventPenetrationDuringInput(proposedCameraPosition: THREE.Vector3, center: THREE.Vector3): THREE.Vector3 {
    if (!this.currentTargetRadius) return proposedCameraPosition;

    const minSafeDistance = this.currentTargetRadius * CAMERA_PENETRATION_CONFIG.safetyDistanceMultiplier;
    const distanceToCenter = proposedCameraPosition.distanceTo(center);

    if (distanceToCenter < minSafeDistance) {
      // Calculate safe position on the ray from center to proposed position
      const direction = new THREE.Vector3()
        .subVectors(proposedCameraPosition, center)
        .normalize();
      
      if (direction.length() < 0.001) {
        direction.set(0, 0.5, 1).normalize();
      }

      return center.clone().add(direction.multiplyScalar(minSafeDistance));
    }

    return proposedCameraPosition;
  }
  
  /**
   * 停止跟踪目标
   */
  stopTracking() {
    this.isTracking = false;
    this.trackingTargetGetter = null;
    // 在双指缩放时不重置最小距离，避免相机跳跃
    if (!this.isZooming) {
      this.resetMinDistance();
    }
  }

  // 手动缩放方法（带平滑效果和增强的防穿透）
  zoom(delta: number) {
    // 🐛 强制调试：每次缩放都显示配置
    console.log('🔧 zoom() 调用 - 滚轮敏感度测试:', {
      delta,
      '当前配置zoomBaseFactor': this.currentConfig.zoomBaseFactor,
      '硬编码测试值': 0.5,
      timestamp: Date.now()
    });
    
    // 如果正在聚焦，先停止聚焦
    if (this.isFocusing) {
      this.isFocusing = false;
      this.targetCameraPosition = null;
      this.targetControlsTarget = null;
      // 在缩放时不重置最小距离，避免相机跳跃
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
    
    // 计算缩放因子（更精细的控制）
    const baseFactor = this.currentConfig.zoomBaseFactor; // 🔧 使用实时配置
    console.log('🔧 baseFactor 实时配置测试:', {
      '当前配置值': this.currentConfig.zoomBaseFactor,
      '实际使用值': baseFactor
    });
    const scrollSpeed = Math.min(Math.abs(delta), 2); // 限制最大滚动速度影响
    // delta > 0 表示放大（拉近），delta < 0 表示缩小（拉远）
    // 在3D中，delta > 0 应该减小距离（拉近相机），delta < 0 应该增加距离（拉远相机）
    const zoomFactor = delta > 0 
      ? 1 - (baseFactor * scrollSpeed)  // 减小距离（拉近/放大）
      : 1 + (baseFactor * scrollSpeed);  // 增大距离（拉远/缩小）
    
    // 计算新的目标距离
    let newTargetDistance = currentDistance * zoomFactor;
    
    // 增强的防穿透检查：在缩放时始终检查最小安全距离
    if (this.currentTargetRadius) {
      const minSafeDistance = this.currentTargetRadius * CAMERA_PENETRATION_CONFIG.safetyDistanceMultiplier;
      
      // 无论是放大还是缩小，都确保不会低于最小安全距离
      newTargetDistance = Math.max(newTargetDistance, minSafeDistance);
      
      // 如果当前距离已经小于安全距离，强制设置为安全距离
      if (currentDistance < minSafeDistance) {
        newTargetDistance = minSafeDistance;
        this.smoothDistance = minSafeDistance;
      }
    }
    
    // 更新目标距离（限制在合理范围内）
    this.targetDistance = Math.max(
      CAMERA_CONFIG.minDistance,
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

  update(deltaTime: number) {
    // Update focus manager transitions
    const focusProgress = this.focusManager.updateFocusTransition(deltaTime);
    if (focusProgress >= 0 && focusProgress < 1) {
      // Apply easing to focus transition
      const easedProgress = FocusManager.easeInOutCubic(focusProgress);
      // Focus transition is handled by existing isFocusing logic below
    }
    
    // Handle user interruption of focus transitions
    if (this.focusManager.isCurrentlyTransitioning() && (this.isZooming || this.isTracking)) {
      this.focusManager.interruptTransition();
    }
    
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
    
    
    // 每帧应用防穿透约束，确保相机不会进入行星内部
    this.applyPenetrationConstraint(deltaTime);
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
    
    // ⚠️ 关键优化：只有在真正需要缩放时才执行缩放逻辑
    // 平滑缩放实现（类似2D版本的缓动效果）
    // ⚠️ 重要：缩放逻辑必须在跟踪逻辑之前执行，这样跟踪逻辑才能使用缩放后的距离
    if (this.isZooming) {
      const distanceDiff = this.targetDistance - this.smoothDistance;
      
      // ⚠️ 性能优化：使用自适应完成阈值，大距离时使用更大的阈值
      const adaptiveThreshold = Math.max(0.001, Math.min(0.1, this.smoothDistance * 0.001));
      
      if (Math.abs(distanceDiff) > adaptiveThreshold) {
        // ⚠️ 简化缩放算法：统一的缓动速度，不区分大小范围
        const baseSpeed = this.currentConfig.zoomEasingSpeed;
        
        // 🐛 调试：输出当前配置值
        if (Math.random() < 0.01) { // 偶尔输出，避免刷屏
          console.log('🔧 统一缩放配置调试:', {
            zoomEasingSpeed: this.currentConfig.zoomEasingSpeed,
            zoomBaseFactor: this.currentConfig.zoomBaseFactor,
            distanceDiff: Math.abs(distanceDiff),
            smoothDistance: this.smoothDistance
          });
        }
        
        // 使用统一的缓动速度，不区分大小范围
        const adaptiveSpeed = baseSpeed;
        
        this.smoothDistance += distanceDiff * adaptiveSpeed;
        
        // 如果正在跟踪，更新跟踪距离（让跟踪逻辑使用缩放后的距离）
        if (this.isTracking) {
          this.trackingDistance = this.smoothDistance;
        }
        
        // ⚠️ 性能优化：减少不必要的向量计算
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
        let newPosition = new THREE.Vector3()
          .copy(this.controls.target)
          .add(direction.multiplyScalar(this.smoothDistance));
        
        // Enhanced penetration prevention during smooth zoom
        if (this.currentTargetRadius) {
          const center = this.trackingTargetGetter ? this.trackingTargetGetter() : this.controls.target;
          newPosition = this.preventPenetrationDuringInput(newPosition, center);
          
          // Update smooth distance if position was corrected
          const correctedDistance = newPosition.distanceTo(this.controls.target);
          if (Math.abs(correctedDistance - this.smoothDistance) > 0.01) {
            this.smoothDistance = correctedDistance;
            this.targetDistance = Math.max(this.targetDistance, this.smoothDistance);
          }
        }
        
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
    
    // ⚠️ 性能优化：只在必要时同步距离
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
  setFov(fov: number, smooth = false) {
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
  getFov() {
    return this.camera.fov;
  }

  dispose(): void {
    // 清理配置监听器
    if (this.configUnsubscribe) {
      this.configUnsubscribe();
      this.configUnsubscribe = null;
    }
    
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

