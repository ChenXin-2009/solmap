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
import { Raycaster } from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import ScaleRuler from './ScaleRuler';

// ==================== 可调参数配置 ====================

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

// 标签配置
const LABEL_CONFIG = {
  offsetX: 25, // 标签相对于标记圈中心的X轴偏移（像素，右侧）
  offsetY: -8, // 标签相对于标记圈中心的Y轴偏移（像素，上方）
  sunOffsetY: 30, // 太阳标签的Y轴偏移（像素，太阳标签在太阳上方，值越大离太阳越远）
  fontSize: '16px',
  fontFamily: '"SmileySans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fadeSpeed: 0.2, // 渐隐速度（0-1，值越大变化越快）
  minZoomToShow: 10, // 最小缩放级别（低于此值不显示任何标签，除了选中的）
};

// 聚焦配置
const FOCUS_CONFIG = {
  distanceMultiplier: 20, // 聚焦距离倍数（相对于行星半径，值越大相机离行星越远）
  minDistance: 0.01, // 最小聚焦距离（AU，确保相机不会太近）
};

// 初始相机位置
const INITIAL_CAMERA_POSITION = {
  x: 0,
  y: 10,
  z: 30,
};

// 轨道曲线点数
const ORBIT_CURVE_POINTS = 300;

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
        sunMesh.userData.isSun = true; // 标记为太阳
        scene.add(sunMesh);
        planetsRef.current.set('sun', sunPlanet);
        
        // 为太阳创建标签
        if (!labelsRef.current.has('sun')) {
          const labelDiv = document.createElement('div');
          labelDiv.className = 'planet-label';
          labelDiv.textContent = planetNames[lang][sunBody.name] || sunBody.name;
          labelDiv.style.color = '#ffffff';
          labelDiv.style.fontSize = LABEL_CONFIG.fontSize;
          labelDiv.style.fontWeight = 'bold';
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
          label.position.set(0, LABEL_CONFIG.sunOffsetY, 0); // 太阳标签在太阳上方
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

        // 创建轨道
        const orbitColor = ORBIT_COLORS[body.name.toLowerCase()] || body.color;
        const orbit = new OrbitCurve(elements, orbitColor, ORBIT_CURVE_POINTS, julianDay);
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
          labelDiv.style.fontWeight = 'bold';
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
        sceneManager.render();
        
        // 渲染标签
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
    >
      <ScaleRuler 
        camera={cameraRef.current} 
        container={containerRef.current}
        controlsTarget={cameraControllerRef.current?.getControls()?.target || null}
      />
    </div>
  );
}

