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

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.controls = new OrbitControls(camera, domElement);
    
    // 配置 OrbitControls - 优化缓动效果
    this.controls.enableDamping = true; // 启用阻尼（惯性效果）
    // 阻尼系数：值越小，缓动越明显（每次只衰减一小部分速度，所以会持续更久）
    // 0.05 表示每帧保留 95% 的速度，衰减 5%，会产生明显的惯性效果
    this.controls.dampingFactor = 0.05; // 阻尼系数（0-1，值越小缓动越明显，惯性越强）
    
    // 确保每帧都更新阻尼（即使没有输入）
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    
    // 初始化距离
    this.smoothDistance = this.camera.position.distanceTo(this.controls.target);
    this.targetDistance = this.smoothDistance;
    this.lastDistance = this.smoothDistance;
    
    // 距离限制
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 1000;
    
    // 启用各种操作
    this.controls.enablePan = true; // 启用平移
    this.controls.enableRotate = true; // 启用旋转
    
    // 缩放平滑度配置
    this.controls.zoomSpeed = 1.5; // 缩放速度（提高滚轮灵敏度）
    this.controls.panSpeed = 0.5; // 平移速度（降低以减少移动端飘走）
    this.controls.rotateSpeed = 0.5; // 旋转速度
    
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
      
      // 计算缩放增量（与2D版本一致）
      const scrollSpeed = Math.min(Math.abs(e.deltaY) / 100, 3);
      // 反转缩放方向：向上滚动放大（deltaY < 0），向下滚动缩小（deltaY > 0）
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
        this.targetDistance = Math.max(
          this.controls.minDistance,
          Math.min(this.controls.maxDistance, initialSmoothDistance * scale)
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
    }
  }

  // 手动缩放方法（带平滑效果）
  zoom(delta: number): void {
    const currentDistance = this.camera.position.distanceTo(this.controls.target);
    // 计算缩放因子（类似2D版本，根据滚动速度调整）
    const baseFactor = 0.15; // 基础缩放因子（提高灵敏度）
    const scrollSpeed = Math.min(Math.abs(delta), 3); // 限制最大滚动速度影响
    // delta > 0 表示放大（向上滚动），delta < 0 表示缩小（向下滚动）
    const zoomFactor = delta > 0 
      ? 1 + (baseFactor * scrollSpeed)  // 放大
      : 1 - (baseFactor * scrollSpeed);  // 缩小
    // 更新目标距离
    this.targetDistance = Math.max(
      this.controls.minDistance,
      Math.min(this.controls.maxDistance, currentDistance * zoomFactor)
    );
    this.isZooming = true;
  }

  update(deltaTime: number): void {
    if (this.mode === 'follow' && this.targetBody) {
      // 跟随模式：平滑移动相机到目标位置
      const targetPos = this.targetBody.position.clone();
      this.camera.position.lerp(targetPos.clone().add(new THREE.Vector3(0, 0, 10)), this.followSpeed);
      this.controls.target.lerp(targetPos, this.followSpeed);
    }
    
    // 平滑缩放实现（类似2D版本的缓动效果）
    if (this.isZooming) {
      const distanceDiff = this.targetDistance - this.smoothDistance;
      
      if (Math.abs(distanceDiff) > 0.01) {
        // 使用缓动函数实现平滑过渡（ease-out），与2D版本一致
        // 使用更快的缓动速度，让缩放更流畅
        const speed = 0.2; // 缓动速度（0-1之间，越大越快，提高响应性）
        this.smoothDistance += distanceDiff * speed;
        
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

