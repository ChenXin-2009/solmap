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
import { SatelliteOrbit } from '@/lib/3d/SatelliteOrbit';
import { SATELLITE_DEFINITIONS } from '@/lib/astronomy/orbit';
import { dateToJulianDay } from '@/lib/astronomy/time';
import { ORBITAL_ELEMENTS } from '@/lib/astronomy/orbit';
import { planetNames } from '@/lib/astronomy/names';
import { CELESTIAL_BODIES } from '@/lib/types/celestialTypes';
import * as THREE from 'three';
import { Raycaster } from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import ScaleRuler from './ScaleRuler';
import SettingsMenu from '@/components/SettingsMenu';
import { ORBIT_COLORS, SUN_LIGHT_CONFIG, ORBIT_CURVE_POINTS, SATELLITE_CONFIG, ORBIT_FADE_CONFIG } from '@/lib/config/visualConfig';
import { TextureManager } from '@/lib/3d/TextureManager';

// ==================== 可调参数配置 ====================
// ⚙️ 以下参数可在文件顶部调整，影响 3D 场景显示效果

// 轨道颜色使用集中配置 `ORBIT_COLORS`（位于 src/lib/config/visualConfig.ts）

// 行星自转速度（弧度/秒，简化值）
const ROTATION_SPEEDS: Record<string, number> = {
  mercury: 0.000000124, // 约 58.6 天/转
  venus: -0.000000116,  // 约 243 天/转（逆行，负值表示反向旋转）
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
  // 🔧 聚焦距离倍数（相对于行星半径，值越小越接近行星表面）
  // 设置为 0.5 允许用户缩放到行星表面查看细节（类似地图软件无限放大）
  distanceMultiplier: 0.5,
  
  // 🔧 最小聚焦距离（AU，支持极小值以实现无限放大）
  minDistance: 0.00001,
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
      
      // 移除环境光 - 使用自定义着色器实现真实光照
      // 环境光会导致背阳面也被照亮，不符合真实物理效果
      // const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
      // scene.add(ambientLight);

      // 初始化行星和轨道
      // 从 store 获取初始值，而不是订阅它们
      const initialState = useSolarSystemStore.getState();
      const julianDay = dateToJulianDay(initialState.currentTime);
      const elementsMap = ORBITAL_ELEMENTS;

      // 创建太阳
      const sunBody = initialState.celestialBodies.find((b: any) => b.isSun);
      if (sunBody) {
        const sunConfig = CELESTIAL_BODIES.sun;
        const sunPlanet = new Planet({
          body: sunBody,
          config: sunConfig,
          rotationSpeed: ROTATION_SPEEDS.sun || 0, // Fallback to old system
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

      // 创建行星和轨道（含卫星）
      initialState.celestialBodies.forEach((body: any) => {
        if (body.isSun) return;

        // 卫星（有 parent 字段）与行星采用统一的 Planet 类来渲染
        const isSatellite = !!body.parent;

        // 创建天体（行星或卫星）
        const bodyKey = body.name.toLowerCase();
        const celestialConfig = CELESTIAL_BODIES[bodyKey];
        const planet = new Planet({
          body,
          config: celestialConfig,
          rotationSpeed: ROTATION_SPEEDS[bodyKey] || 0, // Fallback to old system
        });
        planet.updatePosition(body.x, body.y, body.z);
        const planetMesh = planet.getMesh();
        scene.add(planetMesh);
        // 暴露真实半径，供相机约束或其他逻辑使用（单位：AU）
        (planetMesh as any).userData = (planetMesh as any).userData || {};
        (planetMesh as any).userData.radius = planet.getRealRadius();
        planetsRef.current.set(body.name.toLowerCase(), planet);

        // 异步加载并应用贴图（Render Layer only - 不影响物理计算）
        const textureManager = TextureManager.getInstance();
        textureManager.getTexture(bodyKey).then((texture) => {
          if (texture && !planet.getIsSun()) {
            planet.applyTexture(texture, bodyKey);
          }
        });
        
        // 加载夜间贴图（用于昼夜渐变效果）
        textureManager.getNightTexture(bodyKey).then((nightTexture) => {
          if (nightTexture) {
            planet.applyNightTexture(nightTexture);
          }
        });

        // 创建标记圈（2D）
        planet.createMarkerCircle(CSS2DObject);

        // 创建轨道
        if (isSatellite) {
          // 查找卫星定义以获取轨道半径、颜色、倾角和升交点黄经
          const parentKey = body.parent as string;
          const defs = SATELLITE_DEFINITIONS[parentKey];
          const def = defs ? defs.find((s) => s.name === body.name) : null;
          const orbitRadius = def ? def.a : 0.001;
          const orbitColor = def ? def.color : body.color;
          const inclination = def ? def.i : 0;
          const Omega = def ? def.Omega : 0;
          const eclipticOrbit = def ? def.eclipticOrbit || false : false;
          const orbit = new SatelliteOrbit(orbitRadius, orbitColor, 128, inclination, Omega, parentKey, eclipticOrbit);
          scene.add(orbit.getLine());
          orbitsRef.current.set(body.name.toLowerCase(), orbit as unknown as OrbitCurve);
        } else {
          const elements = elementsMap[body.name.toLowerCase() as keyof typeof elementsMap];
          if (!elements) return;

          const orbitColor = ORBIT_COLORS[body.name.toLowerCase()] || body.color;
          const planetPosition = new THREE.Vector3(body.x, body.y, body.z);
          const orbit = new OrbitCurve(elements, orbitColor, ORBIT_CURVE_POINTS, julianDay, planetPosition);
          scene.add(orbit.getLine());
          orbitsRef.current.set(body.name.toLowerCase(), orbit);
        }

        // 创建文字标签（确保每个行星/卫星只创建一个标签）
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

        // 太阳位置（用于光照计算）
        const sunPosition = new THREE.Vector3(0, 0, 0);
        
        // 更新行星位置、自转和 LOD
        currentBodies.forEach((body: any) => {
          const key = body.name.toLowerCase();
          const planet = planetsRef.current.get(key);
          if (planet) {
            planet.updatePosition(body.x, body.y, body.z);
            
            // 更新太阳位置（用于光照计算）
            planet.updateSunPosition(sunPosition);
            
            // 更新星球自转 - 使用当前时间和时间速度
            const currentTimeInDays = dateToJulianDay(currentState.currentTime) - 2451545.0; // Days since J2000.0
            planet.updateRotation(currentTimeInDays, currentState.timeSpeed);
            
            // 计算相机到星球的距离并更新 LOD
            const planetWorldPos = new THREE.Vector3(body.x, body.y, body.z);
            const cameraPos = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);
            const distance = planetWorldPos.distanceTo(cameraPos);
            planet.updateLOD(distance);
            
            // 更新网格可见性
            planet.updateGridVisibility(distance);
            
            // 更新轨道渐变和自适应分辨率（如果轨道存在）
            const orbit = orbitsRef.current.get(key);
            if (orbit) {
              const planetPosition = new THREE.Vector3(body.x, body.y, body.z);
              orbit.updatePlanetPosition(planetPosition);
              
              // Update adaptive orbit curve resolution based on camera distance
              const orbitCenterDistance = cameraPos.distanceTo(planetPosition);
              if (orbit.updateCurveResolution) {
                orbit.updateCurveResolution(orbitCenterDistance);
              }
            }
          }
        });

        // 播放时的相机跟踪逻辑：同时更新相机和目标点位置，保持相对偏移
        // 这样在播放时，行星始终保持在屏幕中心，且视角不会被锁定
        // 注意：必须在计算轨道透明度之前更新相机位置，否则快速转动时轨道隐藏会失效
        if (state.isPlaying && state.selectedPlanet) {
          const selectedBody = currentBodies.find((b: any) => b.name === state.selectedPlanet);
          if (selectedBody && cameraControllerRef.current) {
            const controls = cameraControllerRef.current.getControls();
            const targetPos = new THREE.Vector3(selectedBody.x, selectedBody.y, selectedBody.z);
            
            // 计算相机相对于当前目标的偏移向量（保持距离和方向）
            const cameraOffset = new THREE.Vector3()
              .subVectors(camera.position, controls.target);
            
            // 同时更新目标和相机位置，保持相对关系
            controls.target.copy(targetPos);
            camera.position.copy(targetPos).add(cameraOffset);
            controls.update();
          }
        }
        
        // 播放时降低阻尼因子获得更敏锐的相机响应，非播放时恢复正常值
        if (cameraControllerRef.current) {
          const controls = cameraControllerRef.current.getControls();
          // 播放时使用较低的阻尼（0.02）以获得敏捷的跟踪，保持缓动但响应更快
          // 非播放时使用正常阻尼（0.04）以保留平滑的交互感
          controls.dampingFactor = state.isPlaying ? 0.02 : 0.04;
        }

        // 计算相机到最近行星的距离，用于所有轨道的渐隐
        // 注意：此计算必须在相机跟踪逻辑之后，确保使用更新后的相机位置
        let minDistanceToAnyPlanet = Infinity;
        currentBodies.forEach((body: any) => {
          if (body.isSun) return;
          const planetPos = new THREE.Vector3(body.x, body.y, body.z);
          const dist = camera.position.distanceTo(planetPos);
          if (dist < minDistanceToAnyPlanet) {
            minDistanceToAnyPlanet = dist;
          }
        });

        // 根据最近距离计算圆盘和线条的透明度
        let discOpacity = 1.0;
        let lineOpacity = 1.0;
        if (ORBIT_FADE_CONFIG.enabled) {
          const cfg = ORBIT_FADE_CONFIG;
          let t = 1.0;
          if (minDistanceToAnyPlanet <= cfg.fadeEndDistance) {
            t = 0;
          } else if (minDistanceToAnyPlanet < cfg.fadeStartDistance) {
            const range = cfg.fadeStartDistance - cfg.fadeEndDistance;
            t = (minDistanceToAnyPlanet - cfg.fadeEndDistance) / range;
          }
          const discMin = (cfg as any).discMinOpacity ?? 0;
          const lineMin = (cfg as any).lineMinOpacity ?? 0;
          discOpacity = discMin + t * (1.0 - discMin);
          lineOpacity = lineMin + t * (1.0 - lineMin);
        }

        // 应用透明度到所有行星轨道
        orbitsRef.current.forEach((orbit) => {
          if (orbit && orbit.setOpacity) {
            orbit.setOpacity(discOpacity, lineOpacity);
          }
        });

        // 更新太阳位置
        const sunPlanet = planetsRef.current.get('sun');
        if (sunPlanet) {
          sunPlanet.updatePosition(0, 0, 0);
          sunPlanet.updateRotation(deltaTime);
          
          // 计算相机到太阳的距离并更新 LOD
          const sunWorldPos = new THREE.Vector3(0, 0, 0);
          const cameraPos = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);
          const sunDistance = sunWorldPos.distanceTo(cameraPos);
          sunPlanet.updateLOD(sunDistance);
          
          // 更新网格可见性（太阳通常不显示网格，但保持一致性）
          sunPlanet.updateGridVisibility(sunDistance);
          
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

        // 更新天空盒/星空位置（固定在相机空间）
        scene.traverse((object) => {
          if (object.userData.fixedToCamera) {
            // 将天空盒/星空位置设置为相机位置
            object.position.copy(camera.position);
            
            // 对于旧的星空点系统，需要缩放
            if (object.userData.isStarfield) {
              const scale = Math.max(100, camera.position.length() * 10);
              object.scale.set(scale, scale, scale);
            }
          }
        });
        
        // 同时调用 SceneManager 的天空盒更新方法（如果存在）
        if (sceneManagerRef.current) {
          sceneManagerRef.current.updateSkyboxPosition(camera.position);
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
          
          // 跳过不可见的卫星（不在重叠检测中考虑它们）
          if (body.isSatellite) {
            const parentKey = body.parent as string;
            const parentPlanet = planetsRef.current.get(parentKey.toLowerCase());
            if (!parentPlanet) return;
            const parentPos = new THREE.Vector3();
            parentPlanet.getMesh().getWorldPosition(parentPos);
            const cameraPosVec = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);
            const distanceToParent = cameraPosVec.distanceTo(parentPos);
            // 卫星不可见时，跳过重叠检测
            if (distanceToParent >= SATELLITE_CONFIG.visibilityThreshold) {
              return;
            }
          }
          
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

        // 5. 更新卫星轨道的中心（使卫星轨道跟随母行星位置）并控制卫星可见性
        currentBodies.forEach((body: any) => {
          if (!body.isSatellite) return;
          
          const satelliteKey = body.name.toLowerCase();
          const orbit = orbitsRef.current.get(satelliteKey);
          if (!orbit) return;
          
          const parentKey = body.parent as string;
          const parentPlanet = planetsRef.current.get(parentKey.toLowerCase());
          if (!parentPlanet) return;
          
          const parentPos = new THREE.Vector3();
          parentPlanet.getMesh().getWorldPosition(parentPos);
          const cameraPosVec = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);
          const distanceToParent = cameraPosVec.distanceTo(parentPos);
          
          // 计算卫星的可见性（基于相机到母行星的距离）
          const isVisible = distanceToParent < SATELLITE_CONFIG.visibilityThreshold;
          const fadeThreshold = SATELLITE_CONFIG.fadeOutDistance;
          
          // 计算淡出的透明度（从 fadeThreshold 到 visibilityThreshold）
          let satelliteOpacity = 1.0;
          if (distanceToParent > SATELLITE_CONFIG.visibilityThreshold) {
            satelliteOpacity = 0;
          } else if (distanceToParent > (SATELLITE_CONFIG.visibilityThreshold - (fadeThreshold - SATELLITE_CONFIG.visibilityThreshold))) {
            // 在可见阈值附近渐隐
            const fadeRange = fadeThreshold - SATELLITE_CONFIG.visibilityThreshold;
            const fadeDistance = Math.max(0, distanceToParent - (SATELLITE_CONFIG.visibilityThreshold - fadeRange));
            satelliteOpacity = 1 - (fadeDistance / fadeRange);
          }
          
          // 更新卫星网格、轨道、标记圈和标签的可见性
          const satelliteMesh = planetsRef.current.get(satelliteKey)?.getMesh();
          if (satelliteMesh) {
            satelliteMesh.visible = isVisible;
          }
          
          // 更新卫星轨道可见性
          orbit.getLine().visible = isVisible;
          
          // 更新卫星标记圈可见性
          const satellite = planetsRef.current.get(satelliteKey);
          if (satellite) {
            satellite.setMarkerTargetOpacity(isVisible ? satelliteOpacity : 0);
          }
          
          // 更新卫星标签可见性和交互
          const satelliteLabel = labelsRef.current.get(satelliteKey);
          if (satelliteLabel && satelliteLabel.element) {
            satelliteLabel.element.style.opacity = isVisible ? satelliteOpacity.toString() : '0';
            satelliteLabel.element.style.display = isVisible ? 'block' : 'none';
            // 关键：不可见时禁用指针事件，防止 DOM 元素阻挡行星标签
            satelliteLabel.element.style.pointerEvents = isVisible ? 'auto' : 'none';
          }
          
          // 更新轨道中心位置
          try {
            // @ts-ignore
            orbit.updatePlanetPosition(parentPos);
            
            // 注意：轨道朝向在创建时已设置，不需要每帧更新
            // 这避免了轨道持续旋转的问题
          } catch (err) {
            // 忽略错误
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
      
      // 拖动检测变量
      let isDragging = false;
      let mouseDownPosition = { x: 0, y: 0 };
      let mouseDownTime = 0;
      const dragThreshold = 5; // 像素阈值，超过此距离认为是拖动
      const clickTimeThreshold = 300; // 毫秒阈值，超过此时间认为是长按
      
      // 处理鼠标按下（开始拖动检测）
      const handleMouseDown = (event: MouseEvent) => {
        isDragging = false;
        mouseDownPosition.x = event.clientX;
        mouseDownPosition.y = event.clientY;
        mouseDownTime = Date.now();
      };
      
      // 处理鼠标移动（检测拖动）
      const handleMouseMove = (event: MouseEvent) => {
        if (mouseDownTime > 0) {
          const deltaX = event.clientX - mouseDownPosition.x;
          const deltaY = event.clientY - mouseDownPosition.y;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          if (distance > dragThreshold) {
            isDragging = true;
          }
        }
      };
      
      // 处理鼠标抬起（重置拖动状态）
      const handleMouseUp = () => {
        // 延迟重置，确保 click 事件能正确检测到拖动状态
        setTimeout(() => {
          isDragging = false;
          mouseDownTime = 0;
        }, 10);
      };
      
      // 处理鼠标点击（聚焦到行星）
      const handleClick = (event: MouseEvent) => {
        if (!containerRef.current || !raycasterRef.current || !sceneManagerRef.current || !cameraControllerRef.current) return;
        
        // 如果是拖动操作，不执行聚焦
        if (isDragging) {
          console.log('Click ignored: detected as drag operation');
          return;
        }
        
        // 如果是长按操作，不执行聚焦
        const clickDuration = Date.now() - mouseDownTime;
        if (clickDuration > clickTimeThreshold) {
          console.log('Click ignored: detected as long press');
          return;
        }
        
        const rect = containerRef.current.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const camera = sceneManagerRef.current.getCamera();
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        
        // 检测所有行星（包括标记圈和标签）
        const intersects: Array<{ planet: Planet; body: any; distance: number; type: 'mesh' | 'marker' | 'label'; isSatellite: boolean }> = [];
        const currentBodies = useSolarSystemStore.getState().celestialBodies;
        
        // 检测所有天体：行星和卫星
        currentBodies.forEach((body: any) => {
          // 检查是否为卫星
          const isSatellite = Object.values(SATELLITE_DEFINITIONS).some((sats: any) => 
            sats.some((sat: any) => sat.name.toLowerCase() === body.name.toLowerCase())
          ) || body.parentBody;
          
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
                isSatellite,
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
                  isSatellite,
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
                  isSatellite,
                });
              }
            }
          }
        });
        
        // 选择最近的行星（只接受标记圈、标签或星球网格的直接点击）
        if (intersects.length > 0) {
          // 优先选择标记圈或标签点击，这些是用户明确想要聚焦的
          const markerOrLabelClick = intersects.find(i => i.type === 'marker' || i.type === 'label');
          
          // 如果没有标记圈或标签点击，检查是否有星球网格的直接点击
          const meshClick = intersects.find(i => i.type === 'mesh');
          
          // 只有在点击了标记圈、标签或星球网格时才聚焦
          const target = markerOrLabelClick || meshClick;
          
          if (target) {
            // 选中行星
            const selectedPlanetName = target.body.name;
            useSolarSystemStore.getState().selectPlanet(selectedPlanetName);
            
            // Log the type of object clicked
            const objectType = target.isSatellite ? 'satellite' : 'planet';
            console.log(`Focusing on ${objectType}: ${selectedPlanetName} (clicked ${target.type})`);
            
            // 平滑移动相机到行星位置（放大显示）
            const targetPosition = new THREE.Vector3(target.body.x, target.body.y, target.body.z);
            
            // 创建天体对象用于FocusManager
            const planetRadius = target.planet.getRealRadius();
            const celestialObject = {
              name: selectedPlanetName,
              radius: planetRadius,
              type: selectedPlanetName.toLowerCase() === 'sun' ? 'star' as const : 'planet' as const
            };
            
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
            
            // 使用新的FocusManager API进行聚焦
            cameraControllerRef.current.focusOnTarget(
              targetPosition, 
              celestialObject, 
              trackingTargetGetter
            );
          }
          // 如果没有有效的点击目标（比如点击了空白区域），不执行任何操作
        }
      };
      
      // 使用已经声明的 renderer 变量
      renderer.domElement.addEventListener('mousedown', handleMouseDown);
      renderer.domElement.addEventListener('mousemove', handleMouseMove);
      renderer.domElement.addEventListener('mouseup', handleMouseUp);
      renderer.domElement.addEventListener('click', handleClick);
      
      // 也在 labelRenderer 的 DOM 元素上添加点击事件（用于点击标签和标记圈）
      if (labelRendererRef.current) {
        labelRendererRef.current.domElement.addEventListener('mousedown', handleMouseDown);
        labelRendererRef.current.domElement.addEventListener('mousemove', handleMouseMove);
        labelRendererRef.current.domElement.addEventListener('mouseup', handleMouseUp);
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
          renderer.domElement.removeEventListener('mousedown', handleMouseDown);
          renderer.domElement.removeEventListener('mousemove', handleMouseMove);
          renderer.domElement.removeEventListener('mouseup', handleMouseUp);
          renderer.domElement.removeEventListener('click', handleClick);
        }
        if (labelRendererRef.current) {
          labelRendererRef.current.domElement.removeEventListener('mousedown', handleMouseDown);
          labelRendererRef.current.domElement.removeEventListener('mousemove', handleMouseMove);
          labelRendererRef.current.domElement.removeEventListener('mouseup', handleMouseUp);
          labelRendererRef.current.domElement.removeEventListener('click', handleClick);
        }
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();

        // 清理资源
        // 释放贴图引用（TextureManager 管理实际 GPU 资源）
        const textureManager = TextureManager.getInstance();
        planetsRef.current.forEach((planet) => {
          const bodyId = planet.getTextureBodyId();
          if (bodyId) {
            textureManager.releaseTexture(bodyId);
          }
          planet.dispose();
        });
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
        // 让相机控制器完全处理所有触摸事件
        // 不在这里阻止默认行为，避免与相机控制器冲突
      }}
      onTouchMove={(e) => {
        // 让相机控制器完全处理所有触摸事件
      }}
      onTouchEnd={(e) => {
        // 让相机控制器完全处理所有触摸事件
      }}
    >
      <ScaleRuler 
        camera={cameraRef.current} 
        container={containerRef.current}
        controlsTarget={cameraControllerRef.current?.getControls()?.target || null}
      />
      {/* 设置菜单（仅在 3D 模式下显示） */}
      {isCameraControllerReady && cameraControllerRef.current && (
        <SettingsMenu 
          cameraController={cameraControllerRef.current} 
        />
      )}
    </div>
  );
}

