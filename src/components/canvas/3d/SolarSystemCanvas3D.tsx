/**
 * SolarSystemCanvas3D.tsx - 太阳系 3D Three.js 渲染组件
 * 
 * 功能：
 * - 使用 Three.js 渲染 3D 太阳系场景
 * - 管理行星、轨道、标签的创建和更新
 * - 实现点击聚焦、跟踪、缩放等交互功能
 * - 处理重叠检测和标签显示逻辑
 * - 集成星空背景、轨道渐变、太阳光晕等视觉效果
 * 
 * 主要组件：
 * - SceneManager: 场景、渲染器、相机管理
 * - CameraController: 相机控制和交互
 * - Planet: 行星网格和标记圈
 * - OrbitCurve: 3D 轨道曲线
 * - CSS2DRenderer: 2D 标签渲染
 */

'use client';

import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { useSolarSystemStore } from '@/lib/state';
import { SceneManager } from '@/lib/3d/SceneManager';
import { CameraController } from '@/lib/3d/CameraController';
import { Planet } from '@/lib/3d/Planet';
import { OrbitCurve } from '@/lib/3d/OrbitCurve';
import { dateToJulianDay } from '@/lib/astronomy/time';
import { ORBITAL_ELEMENTS } from '@/lib/astronomy/orbit';
import { planetNames } from '@/lib/astronomy/names';
import * as THREE from 'three';
import { Raycaster } from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import ScaleRuler from './ScaleRuler';
import SettingsMenu from '@/components/SettingsMenu';
import { ORBIT_COLORS, SUN_LIGHT_CONFIG, ORBIT_CURVE_POINTS } from '@/lib/config/visualConfig';

// ==================== 可调参数配置 ====================
// ⚙️ 以下参数可在文件顶部调整，影响 3D 场景显示效果

// 轨道颜色使用集中配置 `ORBIT_COLORS`（位于 src/lib/config/visualConfig.ts）

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

// 标签配置（字体粗细通过 CSS 变量可调）
const LABEL_CONFIG = {
  // 🔧 行星标签相对于标记圈中心的X轴偏移（像素，右侧）
  offsetX: 25,
  
  // 🔧 行星标签相对于标记圈中心的Y轴偏移（像素，上方）
  offsetY: -8,
  
  // 🔧 太阳标签在太阳上方的像素偏移（CSS 像素，而不是 3D 空间单位）
  sunOffsetY: -20,
  
  // 🔧 字体大小
  fontSize: '16px',
  
  // 🔧 字体族（全站统一使用思源宋体 CN 可变字体）
  fontFamily: '"SourceHanSerifCN", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  
  // 🔧 字体粗细（行星/太阳标签字重，可在 globals.css 中调整）
  fontWeight: 'var(--font-weight-label)',
  
  // 🔧 渐隐速度（0-1，值越大变化越快）
  fadeSpeed: 0.2,
  
  // 🔧 最小缩放级别（低于此值不显示任何标签，除了选中的）
  minZoomToShow: 10,
};

// 聚焦配置
const FOCUS_CONFIG = {
  // 🔧 聚焦距离倍数（相对于行星半径，值越大相机离行星越远）
  distanceMultiplier: 20,
  
  // 🔧 最小聚焦距离（AU，确保相机不会太近）
  minDistance: 0.01,
};

// 初始相机位置
const INITIAL_CAMERA_POSITION = {
  x: 0,
  y: 10,
  z: 30,
};

// 🔧 相机初始角度配置（度）
// 注意：
// - 上下角度（polarAngle）：0度 = 俯视（垂直于轨道平面），90度 = 水平视角，180度 = 仰视
// - 左右角度（azimuthalAngle）：0度 = 正前方，90度 = 右侧，-90度 = 左侧，180度/-180度 = 正后方
const CAMERA_ANGLE_CONFIG = {
  initialPolarAngle: 90,
  
  // 🔧 初始左右角度（度）：页面加载时的相机左右角度，0度 = 正前方
  initialAzimuthalAngle: 90,
  
  // 🔧 过渡目标上下角度（度）：从初始角度平滑过渡到的上下角度，45度 = 从俯视倾斜45度
  targetPolarAngle: 160,
  
  // 🔧 过渡目标左右角度（度）：从初始角度平滑过渡到的左右角度，0度 = 保持正前方
  targetAzimuthalAngle: 0,
  
  // 🔧 过渡延迟时间（毫秒）：页面加载后多久开始角度过渡
  transitionDelay: 500,
  
  // 🔧 是否启用平滑过渡（true = 平滑过渡，false = 立即切换）
  smoothTransition: true,
};

// 太阳光与轨道点数配置已集中到 `src/lib/config/visualConfig.ts`

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
  const raycasterRef = useRef<Raycaster | null>(null);
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  
  // 用于触发设置菜单的重新渲染
  const [isCameraControllerReady, setIsCameraControllerReady] = useState(false);
  // 用于控制渐显效果
  const [opacity, setOpacity] = useState(0);

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
      cameraRef.current = camera; // 保存相机引用用于标尺
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

      // 创建相机控制器（不要手动设置 camera.position，让 OrbitControls 控制）
      const cameraController = new CameraController(camera, renderer.domElement);
      cameraControllerRef.current = cameraController;
      
      // 设置相机控制器的目标点（使用 controls API，不要直接设置 camera.position）
      const controls = cameraController.getControls();
      controls.target.set(0, 0, 0);
      
      // 设置初始相机位置（通过 OrbitControls 控制）
      // 先设置一个合理的距离，让 OrbitControls 自动计算位置
      const initialDistance = 30;
      camera.position.set(0, initialDistance, 0);
      controls.update();

      
      
      // 设置初始相机角度（使用配置中的角度）
      cameraController.setPolarAngle(CAMERA_ANGLE_CONFIG.initialPolarAngle, false);
      cameraController.setAzimuthalAngle(CAMERA_ANGLE_CONFIG.initialAzimuthalAngle, false);
      /*
      // 延迟后平滑过渡到目标角度
      setTimeout(() => {
        if (cameraControllerRef.current) {
          cameraControllerRef.current.setPolarAngle(
            CAMERA_ANGLE_CONFIG.targetPolarAngle,
            CAMERA_ANGLE_CONFIG.smoothTransition
          );
          cameraControllerRef.current.setAzimuthalAngle(
            CAMERA_ANGLE_CONFIG.targetAzimuthalAngle,
            CAMERA_ANGLE_CONFIG.smoothTransition
          );
        }
      }, CAMERA_ANGLE_CONFIG.transitionDelay);
      */


      // 触发设置菜单的重新渲染
      setIsCameraControllerReady(true);
      
      // 渐显效果
      setTimeout(() => {
        setOpacity(1);
      }, 100);
      
      controls.enabled = true;

      // 添加点光源（太阳光）- 使用顶部的 SUN_LIGHT_CONFIG 可快速调整
      const sunLight = new THREE.PointLight(
        SUN_LIGHT_CONFIG.color,
        SUN_LIGHT_CONFIG.intensity,
        SUN_LIGHT_CONFIG.distance,
        SUN_LIGHT_CONFIG.decay
      );
      sunLight.position.set(0, 0, 0);
      sunLight.castShadow = !!SUN_LIGHT_CONFIG.castShadow;
      if (SUN_LIGHT_CONFIG.castShadow && sunLight.shadow) {
        sunLight.shadow.mapSize.width = SUN_LIGHT_CONFIG.shadowMapSize;
        sunLight.shadow.mapSize.height = SUN_LIGHT_CONFIG.shadowMapSize;
        sunLight.shadow.bias = -0.0001;
      }
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
        sunMesh.userData.isSun = true; // 标记为太阳
        scene.add(sunMesh);
        planetsRef.current.set('sun', sunPlanet);
        
        // 为太阳创建标签（使用 CSS2D + 像素偏移，避免用 3D 空间单位把文字推到行星轨道附近）
        if (!labelsRef.current.has('sun')) {
          const labelDiv = document.createElement('div');
          labelDiv.className = 'planet-label';
          labelDiv.textContent = planetNames[lang][sunBody.name] || sunBody.name;
          labelDiv.style.color = '#ffffff';
          labelDiv.style.fontSize = LABEL_CONFIG.fontSize;
          labelDiv.style.fontWeight = LABEL_CONFIG.fontWeight;
          labelDiv.style.fontFamily = LABEL_CONFIG.fontFamily;
          labelDiv.style.pointerEvents = 'auto'; // 允许点击标签
          labelDiv.style.cursor = 'pointer'; // 鼠标悬停时显示手型光标
          labelDiv.style.userSelect = 'none';
          labelDiv.style.textShadow = '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.6)';
          labelDiv.style.whiteSpace = 'nowrap';
          labelDiv.style.opacity = '1';
          labelDiv.style.transition = 'opacity 0.1s';
          labelDiv.style.display = 'block';
          
          const label = new CSS2DObject(labelDiv);
          // 太阳标签锚点放在太阳中心，通过 CSS 像素偏移控制具体显示位置
          label.position.set(0, 0, 0);
          labelDiv.style.position = 'absolute';
          labelDiv.style.left = `${LABEL_CONFIG.offsetX}px`;
          labelDiv.style.top = `${LABEL_CONFIG.sunOffsetY}px`;
          // 覆盖 CSS2DObject 默认 transform，避免重复偏移
          labelDiv.style.transform = 'translate(0, 0)';
          sunMesh.add(label);
          labelsRef.current.set('sun', label);
        }
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
        
        // 创建标记圈（2D）
        planet.createMarkerCircle(CSS2DObject);

        // 创建轨道（传入行星当前位置用于渐变计算）
        const orbitColor = ORBIT_COLORS[body.name.toLowerCase()] || body.color;
        const planetPosition = new THREE.Vector3(body.x, body.y, body.z);
        const orbit = new OrbitCurve(elements, orbitColor, ORBIT_CURVE_POINTS, julianDay, planetPosition);
        scene.add(orbit.getLine());
        orbitsRef.current.set(body.name.toLowerCase(), orbit);
        
        // 创建文字标签（确保每个行星只创建一个标签）
        // 标签位置在标记圈的右上角
        if (!labelsRef.current.has(body.name.toLowerCase())) {
          const labelDiv = document.createElement('div');
          labelDiv.className = 'planet-label';
          labelDiv.textContent = planetNames[lang][body.name] || body.name;
          labelDiv.style.color = '#ffffff';
          labelDiv.style.fontSize = LABEL_CONFIG.fontSize;
          labelDiv.style.fontWeight = LABEL_CONFIG.fontWeight;
          labelDiv.style.fontFamily = LABEL_CONFIG.fontFamily;
          labelDiv.style.pointerEvents = 'auto'; // 允许点击标签
          labelDiv.style.cursor = 'pointer'; // 鼠标悬停时显示手型光标
          labelDiv.style.userSelect = 'none';
          labelDiv.style.textShadow = '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.6)';
          labelDiv.style.whiteSpace = 'nowrap';
          labelDiv.style.opacity = '1'; // 初始显示，由重叠检测控制
          labelDiv.style.transition = 'opacity 0.1s';
          labelDiv.style.display = 'block'; // 默认显示
          
          const label = new CSS2DObject(labelDiv);
          // 标签位置在标记圈的右侧（与标记圈在同一位置，通过CSS偏移）
          label.position.set(0, 0, 0);
          // 使用CSS定位来设置标签相对于标记圈的位置
          labelDiv.style.position = 'absolute';
          labelDiv.style.left = `${LABEL_CONFIG.offsetX}px`;
          labelDiv.style.top = `${LABEL_CONFIG.offsetY}px`;
          labelDiv.style.transform = 'translate(0, 0)'; // 覆盖CSS2DObject的默认transform
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
            
            // 更新轨道渐变（如果轨道存在）
            const orbit = orbitsRef.current.get(key);
            if (orbit) {
              const planetPosition = new THREE.Vector3(body.x, body.y, body.z);
              orbit.updatePlanetPosition(planetPosition);
            }
          }
        });
        
        // 更新太阳位置
        const sunPlanet = planetsRef.current.get('sun');
        if (sunPlanet) {
          sunPlanet.updatePosition(0, 0, 0);
          sunPlanet.updateRotation(deltaTime);
          
          // 太阳标签始终显示（不参与重叠检测）
          const sunLabel = labelsRef.current.get('sun');
          if (sunLabel && sunLabel.element) {
            sunLabel.element.style.opacity = '1';
            sunLabel.element.style.display = 'block';
          }
          
          // 每帧更新太阳的屏幕空间光晕（如果 Planet 实例提供该方法）
          try {
            // @ts-ignore - updateGlow 可能未在类型定义中声明
            sunPlanet.updateGlow(camera);
          } catch (err) {
            // 忽略错误，保持渲染循环稳定
          }
        }

        // 更新星空位置（固定在相机空间）
        scene.traverse((object) => {
          if (object.userData.isStarfield && object.userData.fixedToCamera) {
            // 将星空位置设置为相机位置，但保持方向不变
            // 这样星星会始终在视野中，不会随太阳系缩放
            object.position.copy(camera.position);
            // 使用一个很大的缩放因子，确保星星始终在视野内
            const scale = Math.max(100, camera.position.length() * 10);
            object.scale.set(scale, scale, scale);
          }
        });
        
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
        
        // 重叠检测和标记圈/标签显示逻辑（类似2D版本）
        // 1. 收集所有标签信息（屏幕坐标）
        const labelInfos: Array<{
          body: any;
          planet: Planet;
          label: any;
          screenX: number;
          screenY: number;
          text: string;
          isSelected: boolean;
        }> = [];
        
        currentBodies.forEach((body: any) => {
          // 太阳也显示标签
          const key = body.name.toLowerCase();
          const planet = planetsRef.current.get(key);
          const label = labelsRef.current.get(key);
          
          // 只要有 planet 就收集信息（即使没有 label）
          if (planet) {
            // 将3D位置转换为屏幕坐标
            const worldPos = new THREE.Vector3(body.x, body.y, body.z);
            worldPos.project(camera);
            
            // 安全检查 containerRef.current
            if (!containerRef.current) return;
            
            const screenX = (worldPos.x * 0.5 + 0.5) * containerRef.current.clientWidth;
            const screenY = (worldPos.y * -0.5 + 0.5) * containerRef.current.clientHeight;
            
            const selectedPlanet = useSolarSystemStore.getState().selectedPlanet;
            const isSelected = body.name === selectedPlanet;
            const displayName = planetNames[lang][body.name] || body.name;
            
            labelInfos.push({
              body,
              planet,
              label: label || null,
              screenX,
              screenY,
              text: displayName,
              isSelected,
            });
          }
        });
        
        // 2. 检测重叠并设置目标透明度
        // 获取选中状态
        const selectedPlanet = useSolarSystemStore.getState().selectedPlanet;
        
        for (let i = 0; i < labelInfos.length; i++) {
          const info1 = labelInfos[i];
          const isSelected = info1.body.name === selectedPlanet;
          
          // 太阳标签始终显示，不参与重叠检测
          if (info1.body.isSun) {
            if (info1.planet) {
              info1.planet.setMarkerTargetOpacity(1.0);
            }
            continue;
          }
          
          if (isSelected) {
            info1.planet.setMarkerTargetOpacity(1.0);
            continue;
          }
          
          let hasOverlap = false;
          // 检查与所有其他标签的重叠
          for (let j = 0; j < labelInfos.length; j++) {
            if (i === j) continue;
            const info2 = labelInfos[j];
            
            // 简单的重叠检测（基于屏幕坐标和标签大小）
            const labelWidth = info1.text.length * 10; // 估算标签宽度
            const labelHeight = 20; // 标签高度
            const markerSize = 20; // 标记圈大小
            const totalWidth = labelWidth + markerSize;
            const distanceX = Math.abs(info1.screenX - info2.screenX);
            const distanceY = Math.abs(info1.screenY - info2.screenY);
            
            if (distanceX < totalWidth && distanceY < labelHeight) {
              // 如果与选中的行星重叠，隐藏当前标签
              const isInfo2Selected = info2.body.name === selectedPlanet;
              if (isInfo2Selected) {
                hasOverlap = true;
                break;
              }
              // 如果两个都未选中，根据距离中心的距离决定隐藏哪个
              const centerX = containerRef.current!.clientWidth / 2;
              const centerY = containerRef.current!.clientHeight / 2;
              const dist1 = Math.sqrt(
                Math.pow(info1.screenX - centerX, 2) + 
                Math.pow(info1.screenY - centerY, 2)
              );
              const dist2 = Math.sqrt(
                Math.pow(info2.screenX - centerX, 2) + 
                Math.pow(info2.screenY - centerY, 2)
              );
              // 距离中心更远的隐藏
              if (dist1 > dist2 || (Math.abs(dist1 - dist2) < 1 && i > j)) {
                hasOverlap = true;
                break;
              }
            }
          }
          
          info1.planet.setMarkerTargetOpacity(hasOverlap ? 0.0 : 1.0);
        }
        
        // 3. 更新所有标记圈和标签的透明度（平滑渐隐）
        labelInfos.forEach((info) => {
          // 太阳标签始终显示，不参与透明度更新
          if (info.body.isSun) {
            if (info.label && info.label.element) {
              info.label.element.style.opacity = '1';
              info.label.element.style.display = 'block';
            }
            return;
          }
          
          info.planet.updateMarkerOpacity();
          const opacity = info.planet.getMarkerOpacity();
          
          // 更新标签的透明度
          if (info.label && info.label.element) {
            info.label.element.style.opacity = opacity.toString();
            // 确保标签在可见时显示
            const minOpacity = 0.01; // 最小透明度阈值
            if (opacity > minOpacity) {
              info.label.element.style.display = 'block';
            } else {
              info.label.element.style.display = 'none';
            }
          }
        });
        
        // 4. 确保所有标记圈都被更新（即使没有标签或不在 labelInfos 中）
        currentBodies.forEach((body: any) => {
          if (body.isSun) return;
          const key = body.name.toLowerCase();
          const planet = planetsRef.current.get(key);
          if (planet) {
            // 如果这个行星不在 labelInfos 中，确保标记圈仍然显示
            const inLabelInfos = labelInfos.some(info => info.body.name === body.name);
            if (!inLabelInfos) {
              // 不在 labelInfos 中的行星，标记圈应该显示
              planet.setMarkerTargetOpacity(1.0);
            }
            // 确保标记圈的透明度被更新
            planet.updateMarkerOpacity();
          }
        });

        // 渲染顺序：先更新 controls，再渲染场景
        // 确保 OrbitControls 的 update() 在 render() 之前调用
        // 主渲染器和标签渲染器必须在同一帧同步执行，避免闪烁
        sceneManager.render();
        
        // 立即在同一帧渲染标签（确保与主渲染器同步）
        if (labelRendererRef.current) {
          labelRendererRef.current.render(scene, camera);
        }

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      // 创建射线投射器（用于点击检测）
      raycasterRef.current = new Raycaster();
      
      // 处理鼠标点击（聚焦到行星）
      const handleClick = (event: MouseEvent) => {
        if (!containerRef.current || !raycasterRef.current || !sceneManagerRef.current || !cameraControllerRef.current) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const camera = sceneManagerRef.current.getCamera();
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        
        // 检测所有行星（包括标记圈和标签）
        const intersects: Array<{ planet: Planet; body: any; distance: number; type: 'mesh' | 'marker' | 'label' }> = [];
        const currentBodies = useSolarSystemStore.getState().celestialBodies;
        
        currentBodies.forEach((body: any) => {
          // 太阳也可以点击聚焦
          
          const key = body.name.toLowerCase();
          const planet = planetsRef.current.get(key);
          if (planet) {
            // 1. 检测行星网格
            const mesh = planet.getMesh();
            const meshIntersect = raycasterRef.current!.intersectObject(mesh);
            if (meshIntersect.length > 0) {
              intersects.push({
                planet,
                body,
                distance: meshIntersect[0].distance,
                type: 'mesh',
              });
            }
            
            // 2. 检测标记圈（CSS2DObject）- 使用屏幕坐标
            const markerObject = planet.getMarkerObject();
            if (markerObject && containerRef.current) {
              const worldPos = new THREE.Vector3(body.x, body.y, body.z);
              worldPos.project(camera);
              const screenX = (worldPos.x * 0.5 + 0.5) * containerRef.current.clientWidth;
              const screenY = (worldPos.y * -0.5 + 0.5) * containerRef.current.clientHeight;
              
              const clickX = event.clientX - rect.left;
              const clickY = event.clientY - rect.top;
              
              // 标记圈大小（像素）
              const markerSize = 20; // 与 MARKER_CONFIG.size 一致
              const distance = Math.sqrt(
                Math.pow(clickX - screenX, 2) + 
                Math.pow(clickY - screenY, 2)
              );
              
              if (distance <= markerSize / 2) {
                intersects.push({
                  planet,
                  body,
                  distance: 0, // 标记圈点击优先级最高
                  type: 'marker',
                });
              }
            }
            
            // 3. 检测标签（CSS2DObject）- 使用屏幕坐标
            const label = labelsRef.current.get(key);
            if (label && label.element && containerRef.current) {
              const worldPos = new THREE.Vector3(body.x, body.y, body.z);
              worldPos.project(camera);
              const screenX = (worldPos.x * 0.5 + 0.5) * containerRef.current.clientWidth;
              const screenY = (worldPos.y * -0.5 + 0.5) * containerRef.current.clientHeight;
              
              const clickX = event.clientX - rect.left;
              const clickY = event.clientY - rect.top;
              
              // 标签位置（考虑偏移）
              const labelX = screenX + LABEL_CONFIG.offsetX;
              const labelY = screenY + LABEL_CONFIG.offsetY;
              
              // 估算标签大小
              const displayName = planetNames[lang][body.name] || body.name;
              const labelWidth = displayName.length * 10;
              const labelHeight = 20;
              
              if (
                clickX >= labelX - labelWidth / 2 &&
                clickX <= labelX + labelWidth / 2 &&
                clickY >= labelY - labelHeight / 2 &&
                clickY <= labelY + labelHeight / 2
              ) {
                intersects.push({
                  planet,
                  body,
                  distance: 0, // 标签点击优先级最高
                  type: 'label',
                });
              }
            }
          }
        });
        
        // 选择最近的行星（优先选择标记圈或标签）
        if (intersects.length > 0) {
          // 优先选择标记圈或标签点击
          const markerOrLabelClick = intersects.find(i => i.type === 'marker' || i.type === 'label');
          const target = markerOrLabelClick || intersects.sort((a, b) => a.distance - b.distance)[0];
          
          // 选中行星
          const selectedPlanetName = target.body.name;
          useSolarSystemStore.getState().selectPlanet(selectedPlanetName);
          
          // 平滑移动相机到行星位置（放大显示）
          const targetPosition = new THREE.Vector3(target.body.x, target.body.y, target.body.z);
          // 根据行星大小计算合适的观察距离（确保相机不会进入行星内部）
          const planetRadius = target.planet.getRealRadius();
          // 使用配置的倍数以确保相机不会进入行星内部，同时能看清细节
          const minDistance = Math.max(planetRadius * FOCUS_CONFIG.distanceMultiplier, FOCUS_CONFIG.minDistance);
          const targetDistance = minDistance;
          
          // 创建跟踪函数，用于获取行星的实时位置
          const trackingTargetGetter = () => {
            const currentBodies = useSolarSystemStore.getState().celestialBodies;
            const currentBody = currentBodies.find((b: any) => b.name === selectedPlanetName);
            if (currentBody) {
              return new THREE.Vector3(currentBody.x, currentBody.y, currentBody.z);
            }
            // 如果找不到行星，返回当前位置（不应该发生）
            return targetPosition.clone();
          };
          
          // 传入行星半径，让 CameraController 动态调整最小距离防止穿模
          cameraControllerRef.current.focusOnTarget(targetPosition, targetDistance, trackingTargetGetter, planetRadius);
        }
      };
      
      // 使用已经声明的 renderer 变量
      renderer.domElement.addEventListener('click', handleClick);
      
      // 也在 labelRenderer 的 DOM 元素上添加点击事件（用于点击标签和标记圈）
      if (labelRendererRef.current) {
        labelRendererRef.current.domElement.addEventListener('click', handleClick);
      }

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
        if (sceneManagerRef.current && renderer) {
          renderer.domElement.removeEventListener('click', handleClick);
        }
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
      className="w-full h-full relative"
      style={{ 
        // ⚠️ 修复：移除 touchAction: 'none'（已在 Canvas 元素上设置）
        // ⚠️ 修复：移除 transform: 'translateZ(0)'（会创建新的 stacking context，导致 fixed 定位失效）
        // ⚠️ 修复：移除 isolation: 'isolate'（会创建新的 stacking context，导致 fixed 定位的 z-index 失效，Firefox 平板特别敏感）
        // 防止移动端默认手势干扰
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        // 性能优化：使用GPU加速（但不用 transform，避免破坏 fixed 定位）
        willChange: 'opacity',
        // 渐显效果
        opacity: opacity,
        transition: 'opacity 1s ease-in-out',
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
    >
      <ScaleRuler 
        camera={cameraRef.current} 
        container={containerRef.current}
        controlsTarget={cameraControllerRef.current?.getControls()?.target || null}
      />
      {/* 设置菜单（仅在 3D 模式下显示） */}
      {isCameraControllerReady && cameraControllerRef.current && (
        <SettingsMenu cameraController={cameraControllerRef.current} />
      )}
    </div>
  );
}

