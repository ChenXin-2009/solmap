/**
 * SolarSystemCanvas3D.tsx - 太阳系 3D Three.js 渲染组件
 * 
 * MVP 阶段：基础 3D 渲染
 * - SceneManager 核心渲染器
 * - CameraController 自由观察模式
 * - Planet.ts 基础行星
 * - OrbitCurve.ts 轨道线
 * - 视距裁剪
 * - 简化版对数缩放
 */

'use client';

import React, { useRef, useEffect, useLayoutEffect } from 'react';
import { useSolarSystemStore } from '@/lib/state';
import { SceneManager } from '@/lib/3d/SceneManager';
import { CameraController } from '@/lib/3d/CameraController';
import { Planet } from '@/lib/3d/Planet';
import { OrbitCurve } from '@/lib/3d/OrbitCurve';
import { dateToJulianDay } from '@/lib/astronomy/time';
import { ORBITAL_ELEMENTS } from '@/lib/astronomy/orbit';
import { planetNames } from '@/lib/astronomy/names';
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// 轨道颜色配置（与2D版本一致）
const ORBIT_COLORS: Record<string, string> = {
  mercury: '#c4cbcf',
  venus: '#fcc307',
  earth: '#22a2c3',
  mars: '#f5391c',
  jupiter: '#D8CA9D',
  saturn: '#FAD5A5',
  uranus: '#4FD0E7',
  neptune: '#4B70DD',
};

// 行星自转速度（弧度/秒，简化值）
const ROTATION_SPEEDS: Record<string, number> = {
  mercury: 0.000000124, // 约 58.6 天/转
  venus: 0.000000116,   // 约 243 天/转（逆行）
  earth: 0.0000727,     // 约 24 小时/转
  mars: 0.0000709,      // 约 24.6 小时/转
  jupiter: 0.000175,    // 约 9.9 小时/转
  saturn: 0.000164,     // 约 10.7 小时/转
  uranus: 0.000101,     // 约 17.2 小时/转
  neptune: 0.000108,    // 约 16.1 小时/转
  sun: 0.000000725,     // 约 27 天/转
};

export default function SolarSystemCanvas3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const cameraControllerRef = useRef<CameraController | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const planetsRef = useRef<Map<string, Planet>>(new Map());
  const orbitsRef = useRef<Map<string, OrbitCurve>>(new Map());
  const labelsRef = useRef<Map<string, CSS2DObject>>(new Map());
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(Date.now());

  // 使用选择器避免不必要的重渲染
  // 3D组件不需要订阅这些状态，因为我们在动画循环中直接使用 getState()
  // 这样可以避免每次状态更新都触发组件重渲染
  // 但初始化时需要获取初始值
  const lang = useSolarSystemStore((state) => state.lang);

  // 初始化场景 - 使用 useLayoutEffect 确保 DOM 准备好
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    
    // 确保容器有尺寸
    let checkAndInitFrameId: number | null = null;
    let isInitialized = false; // 防止重复初始化
    
    const checkAndInit = () => {
      if (!containerRef.current || isInitialized) return;
      if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) {
        checkAndInitFrameId = requestAnimationFrame(checkAndInit);
        return;
      }
      
      isInitialized = true; // 标记已初始化，防止重复
      
      // 容器有尺寸，开始初始化
      const sceneManager = new SceneManager(containerRef.current);
      sceneManagerRef.current = sceneManager;

      const scene = sceneManager.getScene();
      const camera = sceneManager.getCamera();
      const renderer = sceneManager.getRenderer();
      
      // 创建 CSS2DRenderer 用于显示文字标签
      // 确保只创建一次，避免重复添加
      if (!labelRendererRef.current) {
        const labelRenderer = new CSS2DRenderer();
        labelRenderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.top = '0';
        labelRenderer.domElement.style.left = '0';
        labelRenderer.domElement.style.pointerEvents = 'none';
        labelRenderer.domElement.style.zIndex = '1';
        containerRef.current.appendChild(labelRenderer.domElement);
        labelRendererRef.current = labelRenderer;
      }

      // 设置初始相机位置（更远的距离以便看到整个太阳系）
      camera.position.set(0, 10, 30);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      
      // 创建相机控制器（必须在设置相机位置之后）
      const cameraController = new CameraController(camera, renderer.domElement);
      cameraControllerRef.current = cameraController;
      
      // 设置相机控制器的目标点
      const controls = cameraController.getControls();
      controls.target.set(0, 0, 0);
      controls.update();
      controls.enabled = true;

      // 添加点光源（太阳光）
      const sunLight = new THREE.PointLight(0xffffff, 3, 200);
      sunLight.position.set(0, 0, 0);
      scene.add(sunLight);
      
      // 添加环境光，使行星更清晰可见
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
      scene.add(ambientLight);

      // 初始化行星和轨道
      // 从 store 获取初始值，而不是订阅它们
      const initialState = useSolarSystemStore.getState();
      const julianDay = dateToJulianDay(initialState.currentTime);
      const elementsMap = ORBITAL_ELEMENTS;

      // 创建太阳
      const sunBody = initialState.celestialBodies.find((b: any) => b.isSun);
      if (sunBody) {
        const sunPlanet = new Planet({
          body: sunBody,
          rotationSpeed: ROTATION_SPEEDS.sun || 0,
        });
        const sunMesh = sunPlanet.getMesh();
        sunMesh.position.set(0, 0, 0);
        scene.add(sunMesh);
        planetsRef.current.set('sun', sunPlanet);
      }

      // 创建行星和轨道
      initialState.celestialBodies.forEach((body: any) => {
        if (body.isSun) return;

        const elements = elementsMap[body.name.toLowerCase() as keyof typeof elementsMap];
        if (!elements) return;

        // 创建行星
        const planet = new Planet({
          body,
          rotationSpeed: ROTATION_SPEEDS[body.name.toLowerCase()] || 0,
        });
        planet.updatePosition(body.x, body.y, body.z);
        const planetMesh = planet.getMesh();
        scene.add(planetMesh);
        planetsRef.current.set(body.name.toLowerCase(), planet);

        // 创建轨道
        const orbitColor = ORBIT_COLORS[body.name.toLowerCase()] || body.color;
        const orbit = new OrbitCurve(elements, orbitColor, 300, julianDay);
        scene.add(orbit.getLine());
        orbitsRef.current.set(body.name.toLowerCase(), orbit);
        
        // 创建文字标签（确保每个行星只创建一个标签）
        if (!labelsRef.current.has(body.name.toLowerCase())) {
          const labelDiv = document.createElement('div');
          labelDiv.className = 'planet-label';
          labelDiv.textContent = planetNames[lang][body.name] || body.name;
          labelDiv.style.color = '#ffffff';
          labelDiv.style.fontSize = '16px';
          labelDiv.style.fontWeight = 'bold';
          labelDiv.style.fontFamily = '"SmileySans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
          labelDiv.style.pointerEvents = 'none';
          labelDiv.style.userSelect = 'none';
          labelDiv.style.textShadow = '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.6)';
          labelDiv.style.whiteSpace = 'nowrap';
          
          const label = new CSS2DObject(labelDiv);
          label.position.set(0, 0.5, 0);
          planetMesh.add(label);
          labelsRef.current.set(body.name.toLowerCase(), label);
        }
      });

      // 动画循环
      const animate = () => {
        const now = Date.now();
        const deltaTime = Math.min((now - lastTimeRef.current) / 1000, 0.1);
        lastTimeRef.current = now;

        const state = useSolarSystemStore.getState();
        
        // 如果正在播放，更新时间和天体位置
        if (state.isPlaying && deltaTime > 0) {
          state.tick(deltaTime);
        }
        
        // 获取最新的天体数据（tick 会更新 celestialBodies）
        const currentState = useSolarSystemStore.getState();
        const currentBodies = currentState.celestialBodies;

        // 更新行星位置和自转
        currentBodies.forEach((body: any) => {
          const key = body.name.toLowerCase();
          const planet = planetsRef.current.get(key);
          if (planet) {
            planet.updatePosition(body.x, body.y, body.z);
            planet.updateRotation(deltaTime);
          }
        });
        
        // 更新太阳位置
        const sunPlanet = planetsRef.current.get('sun');
        if (sunPlanet) {
          sunPlanet.updatePosition(0, 0, 0);
          sunPlanet.updateRotation(deltaTime);
        }

        // 更新相机控制器（必须在渲染前调用，以应用阻尼效果）
        if (cameraControllerRef.current) {
          cameraControllerRef.current.update(deltaTime);
        }

        // 动态调整视距裁剪
        const cameraDistance = Math.sqrt(
          Math.pow(camera.position.x, 2) +
          Math.pow(camera.position.y, 2) +
          Math.pow(camera.position.z, 2)
        );
        const maxDistance = Math.max(cameraDistance * 3, 50);
        sceneManager.updateCameraClipping(0.01, maxDistance);

        // 渲染顺序：先更新 controls，再渲染场景
        // 确保 OrbitControls 的 update() 在 render() 之前调用
        sceneManager.render();
        
        // 渲染标签
        if (labelRendererRef.current) {
          labelRendererRef.current.render(scene, camera);
        }

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      // 启动动画循环
      animationFrameRef.current = requestAnimationFrame(animate);

      // 处理窗口大小变化
      const handleResize = () => {
        if (sceneManagerRef.current) {
          sceneManagerRef.current.updateSize();
        }
        if (labelRendererRef.current && containerRef.current) {
          labelRendererRef.current.setSize(
            containerRef.current.clientWidth,
            containerRef.current.clientHeight
          );
        }
      };

      window.addEventListener('resize', handleResize);
      const resizeObserver = new ResizeObserver(handleResize);
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      // 清理函数（在 checkAndInit 内部，确保能访问所有局部变量）
      return () => {
        // 取消 checkAndInit 的递归检查（如果还在等待初始化）
        if (checkAndInitFrameId !== null) {
          cancelAnimationFrame(checkAndInitFrameId);
          checkAndInitFrameId = null;
        }
        
        // 取消动画循环
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        
        // 清理事件监听器
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();

        // 清理资源
        planetsRef.current.forEach((planet) => planet.dispose());
        orbitsRef.current.forEach((orbit) => orbit.dispose());
        
        // 清理标签（从场景中移除）
        labelsRef.current.forEach((label) => {
          if (label.parent) {
            label.parent.remove(label);
          }
        });
        labelsRef.current.clear();
        
        // 清理标签渲染器
        if (labelRendererRef.current && containerRef.current && containerRef.current.contains(labelRendererRef.current.domElement)) {
          containerRef.current.removeChild(labelRendererRef.current.domElement);
        }
        labelRendererRef.current = null;
        if (cameraControllerRef.current) {
          cameraControllerRef.current.dispose();
        }
        if (sceneManagerRef.current) {
          sceneManagerRef.current.dispose();
        }
      };
    };
    
    checkAndInit();
  }, []); // 只在挂载时初始化

  // 注意：行星位置更新已经在动画循环中处理，这里不需要额外的 useEffect
  // 这样可以避免不必要的重渲染和性能开销

  // 注意：滚轮缩放现在由 CameraController 的 setupWheelZoom 处理
  // 这里不再需要额外的监听器，避免重复处理

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ 
        touchAction: 'none',
        // 防止移动端默认手势干扰
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        // 性能优化：使用GPU加速
        willChange: 'transform',
        transform: 'translateZ(0)',
        isolation: 'isolate',
      } as React.CSSProperties}
      onTouchStart={(e) => {
        // 防止移动端缩放时页面滚动
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }}
      onTouchMove={(e) => {
        // 双指操作时防止页面滚动
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }}
    />
  );
}

