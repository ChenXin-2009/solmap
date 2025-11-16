/**
 * SolarSystemCanvas.tsx - 太阳系 Canvas 渲染组件 v4
 *
 * 修改内容：
 * 1. ✅ 背景颜色改为纯黑色，写实风格
 * 2. ✅ 放大限制增大，上限从 200 改为 500
 * 3. ✅ 行星按真实比例渲染，半径过小时加小圈标记提高可视性
 * 4. ✅ 点击行星自动放大到该行星，保持原有选中逻辑
 * 5. ✅ 保留名字显示逻辑（缩小时隐藏名字）
 * 6. ✅ 保留原有拖拽、缩放、时间控制功能
 */

'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useSolarSystemStore } from '@/lib/state';
import type { CelestialBody } from '@/lib/astronomy/orbit';
import type { ViewOffset } from '@/lib/state';
import { planetNames } from '@/lib/astronomy/names';
import { dateToJulianDay } from '@/lib/astronomy/time';

/**
 * Canvas 渲染器类
 */
class SolarSystemRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private centerX: number;
  private centerY: number;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.centerX = width / 2;
    this.centerY = height / 2;
  }

  /**
   * 清空画布，背景为黑色
   */
  clearCanvas(): void {
    this.ctx.fillStyle = '#000000'; // 修改背景为黑色
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * 绘制星空背景
   */
  drawStarfield(): void {
    this.ctx.fillStyle = '#ffffff';
    const starCount = 150;
    for (let i = 0; i < starCount; i++) {
      const seed = i * 2654435761;
      const x = seed % this.width;
      const y = ((seed * 2654435761) % this.height);
      const size = ((seed * 48271) % 100) / 100 * 1.5;
      const alpha = 0.3 + ((seed * 69621) % 100) / 100 * 0.7;

      this.ctx.globalAlpha = alpha;
      this.ctx.fillRect(x, y, size, size);
    }
    this.ctx.globalAlpha = 1.0;
  }

  /**
   * 将十六进制颜色转换为RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : null;
  }

  /**
   * 计算行星当前在轨道上的真近点角
   */
  private calculateTrueAnomaly(body: CelestialBody, julianDay: number): number | null {
    if (!body.elements) return null;

    const elements = body.elements;
    const T = (julianDay - 2451545.0) / 36525.0;
    
    // 计算当前时刻的轨道元素
    const a = elements.a + elements.a_dot * T;
    const e = elements.e + elements.e_dot * T;
    const L = elements.L + elements.L_dot * T;
    const w_bar = elements.w_bar + elements.w_bar_dot * T;
    const O = elements.O + elements.O_dot * T;
    
    // 计算平近点角
    const w = w_bar - O;
    let M = (L - w_bar) % (2 * Math.PI);
    // 确保M在0到2π之间
    if (M < 0) M += 2 * Math.PI;
    
    // 求解偏近点角（使用牛顿迭代法）
    let E = M;
    for (let i = 0; i < 20; i++) {
      const delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= delta;
      if (Math.abs(delta) < 1e-8) break;
    }
    
    // 计算真近点角
    const nu = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    );
    
    return nu;
  }

  /**
   * 绘制渐变轨道（从行星当前位置沿运动方向渐变）
   */
  drawGradientOrbit(
    body: CelestialBody,
    viewOffsetX: number,
    viewOffsetY: number,
    zoom: number,
    julianDay: number
  ): void {
    if (!body.elements || body.isSun) return;

    const elements = body.elements;
    
    // 计算当前真近点角
    const currentNu = this.calculateTrueAnomaly(body, julianDay);
    if (currentNu === null) return;

    // 计算轨道参数
    const T = (julianDay - 2451545.0) / 36525.0;
    const a = elements.a + elements.a_dot * T;
    const e = elements.e + elements.e_dot * T;
    const w = (elements.w_bar + elements.w_bar_dot * T) - (elements.O + elements.O_dot * T);
    const O = elements.O + elements.O_dot * T;
    const i = elements.i + elements.i_dot * T;

    // 解析颜色
    const rgb = this.hexToRgb(body.color);
    if (!rgb) return;

    // 计算轨道上的点，从当前位置开始，沿着运动方向
    const startAngle = currentNu;
    const trailLength = Math.PI * 2; // 显示一圈轨道
    
    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    // 启用抗锯齿，使线条更平滑
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    // 使用更高效的方式：减少分段数量，使用更平滑的渐变
    // 根据缩放级别动态调整分段数量，平衡性能和质量
    const baseSegmentCount = 150; // 基础分段数量（减少以提高性能）
    const segmentCount = Math.min(baseSegmentCount, Math.max(80, Math.floor(baseSegmentCount * (zoom / 50))));
    
    // 渐变透明度参数
    const minOpacity = 0.15; // 最低透明度（15%）
    const maxOpacity = 0.8; // 最大透明度（80%）
    
    // 预计算三角函数值以提高性能
    const cos_w = Math.cos(w);
    const sin_w = Math.sin(w);
    const cos_O = Math.cos(O);
    const sin_O = Math.sin(O);
    const cos_i = Math.cos(i);
    const sin_i = Math.sin(i);
    
    // 先计算所有轨道点
    const points: Array<{ x: number; y: number }> = [];
    for (let seg = 0; seg <= segmentCount; seg++) {
      const progress = seg / segmentCount;
      const angleOffset = progress * trailLength;
      const angle = startAngle + angleOffset;
      
      // 计算轨道半径
      const r = a * (1 - e * e) / (1 + e * Math.cos(angle));
      
      // 转换到黄道坐标系
      const x_orb = r * Math.cos(angle);
      const y_orb = r * Math.sin(angle);
      
      const x = (cos_w * cos_O - sin_w * sin_O * cos_i) * x_orb +
                (-sin_w * cos_O - cos_w * sin_O * cos_i) * y_orb;
      const y = (cos_w * sin_O + sin_w * cos_O * cos_i) * x_orb +
                (-sin_w * sin_O + cos_w * cos_O * cos_i) * y_orb;
      
      const screenX = this.centerX + (x + viewOffsetX) * zoom;
      const screenY = this.centerY + (y + viewOffsetY) * zoom;
      
      points.push({ x: screenX, y: screenY });
    }
    
    // 使用更少的绘制调用，将相近透明度的段合并
    // 减少绘制调用次数以提高性能，同时保持平滑渐变
    const gradientSteps = 50; // 渐变步数（减少绘制调用）
    const stepSize = (points.length - 1) / gradientSteps;
    
    for (let step = 0; step < gradientSteps; step++) {
      // 让每段之间有轻微重叠，避免间隙
      const overlap = 2; // 重叠点数
      const startIdx = Math.max(0, Math.floor(step * stepSize) - (step > 0 ? overlap : 0));
      const endIdx = Math.min(points.length - 1, Math.floor((step + 1) * stepSize) + (step < gradientSteps - 1 ? overlap : 0));
      
      if (startIdx >= endIdx) continue;
      
      // 计算这段的平均进度（使用中点）
      const midIdx = Math.floor((startIdx + endIdx) / 2);
      const progress = midIdx / (points.length - 1);
      const opacity = Math.max(minOpacity, maxOpacity * (1 - progress * 0.85));
      const minLineWidth = 1;
      const maxLineWidth = 3;
      const lineWidth = Math.max(minLineWidth, maxLineWidth * (1 - progress * 0.6));
      
      // 绘制这一段（使用连续路径，避免小点）
      this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
      this.ctx.lineWidth = lineWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(points[startIdx].x, points[startIdx].y);
      
      for (let i = startIdx + 1; i <= endIdx; i++) {
        this.ctx.lineTo(points[i].x, points[i].y);
      }
      
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  /**
   * 绘制轨道（传统方式，用于对比或未选中时）
   */
  drawOrbit(
    body: CelestialBody,
    viewOffsetX: number,
    viewOffsetY: number,
    zoom: number,
    isSelected: boolean
  ): void {
    if (!body.elements) return;

    const elements = body.elements;
    const steps = 120;

    this.ctx.strokeStyle = isSelected ? body.color : 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = isSelected ? 2 : 1;
    this.ctx.beginPath();

    let isFirst = true;
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const r = elements.a * (1 - elements.e * elements.e) / (1 + elements.e * Math.cos(angle));
      const w = elements.w_bar - elements.O;
      const x = (r * Math.cos(angle + w) + viewOffsetX) * zoom;
      const y = (r * Math.sin(angle + w) + viewOffsetY) * zoom;

      const screenX = this.centerX + x;
      const screenY = this.centerY + y;

      if (isFirst) {
        this.ctx.moveTo(screenX, screenY);
        isFirst = false;
      } else {
        this.ctx.lineTo(screenX, screenY);
      }
    }

    this.ctx.closePath();
    this.ctx.stroke();
  }

  /**
   * 绘制天体
   */
  drawBody(
    body: CelestialBody,
    viewOffsetX: number,
    viewOffsetY: number,
    zoom: number,
    isSelected: boolean,
    lang: string
  ): void {
    const x = this.centerX + (body.x + viewOffsetX) * zoom;
    const y = this.centerY + (body.y + viewOffsetY) * zoom;
    // 保留真实比例，如果太小加最小可视半径
    const radius = Math.max(body.radius * zoom, body.isSun ? 8 : 3);

    // 太阳光晕
    if (isSelected && !body.isSun) {
      const gradient = this.ctx.createRadialGradient(x, y, radius, x, y, radius * 3);
      gradient.addColorStop(0, body.color + '60');
      gradient.addColorStop(1, 'transparent');
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius * 3, 0, 2 * Math.PI);
      this.ctx.fill();
    }

    // 天体本体
    if (body.isSun) {
      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius * 1.5);
      gradient.addColorStop(0, '#FFFFFF');
      gradient.addColorStop(0.4, body.color);
      gradient.addColorStop(1, '#FFA500');
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius * 1.5, 0, 2 * Math.PI);
      this.ctx.fill();
    } else {
      this.ctx.fillStyle = body.color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
      this.ctx.fill();

      // 小圈标记，增强可视性
      if (radius < 4) {
        this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
        this.ctx.stroke();
      }

      // 高光
      const highlight = this.ctx.createRadialGradient(
        x - radius * 0.3,
        y - radius * 0.3,
        0,
        x,
        y,
        radius
      );
      highlight.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      highlight.addColorStop(1, 'transparent');
      this.ctx.fillStyle = highlight;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
      this.ctx.fill();
    }

    // 标签显示逻辑
    const shouldShowLabel = body.isSun || isSelected || zoom > 30;
    if (shouldShowLabel) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 13px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
      this.ctx.shadowBlur = 4;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;

      const displayName = planetNames[lang as 'en' | 'zh'][body.name] ?? body.name;
      this.ctx.fillText(displayName, x, y + radius + 8);

      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowBlur = 0;
    }
  }

  /**
   * 渲染整个场景
   */
  render(
    bodies: CelestialBody[],
    selectedPlanet: string | null,
    viewOffsetX: number,
    viewOffsetY: number,
    zoom: number,
    lang: string,
    currentJulianDay?: number
  ): void {
    this.clearCanvas();
    this.drawStarfield();

    this.ctx.save();

    // 绘制渐变轨道（从行星当前位置沿运动方向）
    if (currentJulianDay !== undefined) {
      bodies.forEach((body) => {
        if (body.isSun) return;
        this.drawGradientOrbit(body, viewOffsetX, viewOffsetY, zoom, currentJulianDay);
      });
    } else {
      // 如果没有儒略日，使用传统轨道绘制
      bodies.forEach((body) => {
        if (body.isSun) return;
        const isSelected = body.name === selectedPlanet;
        this.drawOrbit(body, viewOffsetX, viewOffsetY, zoom, isSelected);
      });
    }

    // 绘制天体
    const sortedBodies = [...bodies].sort((a, b) => {
      if (a.isSun) return -1;
      if (b.isSun) return 1;
      return a.r - b.r;
    });

    sortedBodies.forEach((body) => {
      const isSelected = body.name === selectedPlanet;
      this.drawBody(body, viewOffsetX, viewOffsetY, zoom, isSelected, lang);
    });

    this.ctx.restore();
  }
}

/**
 * 太阳系 Canvas 组件
 */
export default function SolarSystemCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(Date.now());

  // 拖拽状态
  const isMouseDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastPosRef = useRef({ x: 0, y: 0 });

  // 平滑缩放状态
  const smoothZoomRef = useRef<number>(50); // 当前显示的缩放值
  const targetZoomRef = useRef<number>(50); // 目标缩放值

  // 多点触摸缩放状态
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number | null>(null);
  const initialViewOffsetRef = useRef<ViewOffset | null>(null);
  const pinchCenterRef = useRef<{ x: number; y: number } | null>(null);

  const {
    celestialBodies,
    selectedPlanet,
    viewOffset,
    zoom,
    lang,
    currentTime,
    tick,
    setViewOffset,
    setZoom,
    selectPlanet,
    centerOnPlanet
  } = useSolarSystemStore();

  // 放大限制
  const MIN_ZOOM = 10;
  const MAX_ZOOM = 500; // 修改上限

  // 初始化平滑缩放值
  useEffect(() => {
    smoothZoomRef.current = zoom;
    targetZoomRef.current = zoom;
  }, []);

  // 更新目标缩放值
  useEffect(() => {
    targetZoomRef.current = zoom;
  }, [zoom]);

  // 计算两点之间的距离
  const getDistance = (touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 获取两点中心坐标
  const getCenter = (touch1: React.Touch, touch2: React.Touch): { x: number; y: number } => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 获取当前儒略日
    const currentJulianDay = dateToJulianDay(currentTime);

    // 使用平滑后的缩放值
    const currentZoom = smoothZoomRef.current;
    const renderer = new SolarSystemRenderer(ctx, canvas.width, canvas.height);
    renderer.render(celestialBodies, selectedPlanet, viewOffset.x, viewOffset.y, currentZoom, lang, currentJulianDay);
  }, [celestialBodies, selectedPlanet, viewOffset, lang, currentTime]);

  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // 平滑缩放更新
      const current = smoothZoomRef.current;
      const target = targetZoomRef.current;
      const diff = target - current;
      
      if (Math.abs(diff) > 0.01) {
        // 使用缓动函数实现平滑过渡（ease-out）
        const speed = 0.15; // 调整这个值可以改变平滑速度（0-1之间，越小越慢）
        smoothZoomRef.current += diff * speed;
      } else {
        smoothZoomRef.current = target;
      }

      tick(delta);
      draw();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [tick, draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isMouseDownRef.current = true;
    isDraggingRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMouseDownRef.current) return;

    if (!isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) isDraggingRef.current = true;
      else return;
    }

    const deltaX = e.clientX - lastPosRef.current.x;
    const deltaY = e.clientY - lastPosRef.current.y;

    setViewOffset({ x: viewOffset.x + deltaX / zoom, y: viewOffset.y + deltaY / zoom });
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isMouseDownRef.current && !isDraggingRef.current) handleClick(e);

    isMouseDownRef.current = false;
    isDraggingRef.current = false;
  };

  const handleMouseLeave = () => {
    isMouseDownRef.current = false;
    isDraggingRef.current = false;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left - canvas.width / 2;
    const clickY = e.clientY - rect.top - canvas.height / 2;

    let clickedBody: string | null = null;
    let minDistance = Infinity;

    celestialBodies.forEach((body) => {
      const bodyX = (body.x + viewOffset.x) * zoom;
      const bodyY = (body.y + viewOffset.y) * zoom;
      const distance = Math.sqrt((clickX - bodyX) ** 2 + (clickY - bodyY) ** 2);
      const hitRadius = Math.max(body.radius * zoom, body.isSun ? 15 : 10);

      if (distance < hitRadius && distance < minDistance) {
        clickedBody = body.name;
        minDistance = distance;
      }
    });

    if (clickedBody) {
      selectPlanet(clickedBody === selectedPlanet ? null : clickedBody);

      // 点击后自动放大到行星（使用平滑缩放）
      const targetZoom = Math.min(MAX_ZOOM, Math.max(smoothZoomRef.current, 200)); // 可根据需要调整放大倍率
      setZoom(targetZoom);
      centerOnPlanet(clickedBody);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    // 增加缩放灵敏度：根据滚轮滚动距离调整缩放因子
    // 使用更敏感的缩放因子，并考虑滚动速度
    const baseFactor = 0.25; // 基础缩放因子（每次滚动5%）
    const scrollSpeed = Math.min(Math.abs(e.deltaY) / 100, 3); // 限制最大滚动速度影响
    const zoomFactor = e.deltaY > 0 
      ? 1 - (baseFactor * scrollSpeed)  // 缩小：0.95, 0.90, 0.85...
      : 1 + (baseFactor * scrollSpeed); // 放大：1.05, 1.10, 1.15...
    // 使用当前平滑缩放值计算新的目标缩放值
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, smoothZoomRef.current * zoomFactor));
    setZoom(newZoom);
  };

  // 触摸逻辑
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      // 两点触摸 - 开始缩放
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      initialPinchDistanceRef.current = getDistance(touch1, touch2);
      initialZoomRef.current = smoothZoomRef.current;
      initialViewOffsetRef.current = { ...viewOffset }; // 保存初始视图偏移
      pinchCenterRef.current = getCenter(touch1, touch2);
      isMouseDownRef.current = false; // 禁用单点拖拽
      isDraggingRef.current = false;
    } else if (e.touches.length === 1) {
      // 单点触摸 - 开始拖拽
      const touch = e.touches[0];
      isMouseDownRef.current = true;
      isDraggingRef.current = false;
      dragStartRef.current = { x: touch.clientX, y: touch.clientY };
      lastPosRef.current = { x: touch.clientX, y: touch.clientY };
      // 重置缩放状态
      initialPinchDistanceRef.current = null;
      initialZoomRef.current = null;
      initialViewOffsetRef.current = null;
      pinchCenterRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    if (e.touches.length === 2) {
      // 两点触摸 - 缩放
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = getDistance(touch1, touch2);
      const currentCenter = getCenter(touch1, touch2);

      if (
        initialPinchDistanceRef.current !== null && 
        initialZoomRef.current !== null && 
        initialViewOffsetRef.current !== null &&
        pinchCenterRef.current !== null
      ) {
        // 计算缩放比例
        const scale = currentDistance / initialPinchDistanceRef.current;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialZoomRef.current * scale));

        // 计算缩放中心在画布坐标系中的位置（相对于画布中心）
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          // 初始触摸中心相对于画布中心的位置（这是缩放中心）
          const initialScreenX = pinchCenterRef.current.x - rect.left - canvas.width / 2;
          const initialScreenY = pinchCenterRef.current.y - rect.top - canvas.height / 2;

          // 使用初始视图偏移计算初始缩放中心在世界坐标系中的位置
          const worldX = (initialScreenX / initialZoomRef.current) - initialViewOffsetRef.current.x;
          const worldY = (initialScreenY / initialZoomRef.current) - initialViewOffsetRef.current.y;

          // 应用新缩放后，调整视图偏移以保持该世界坐标点在屏幕上的位置不变
          const newOffsetX = (initialScreenX / newZoom) - worldX;
          const newOffsetY = (initialScreenY / newZoom) - worldY;

          setZoom(newZoom);
          setViewOffset({ x: newOffsetX, y: newOffsetY });
        }
      }
    } else if (e.touches.length === 1 && isMouseDownRef.current) {
      // 单点触摸 - 拖拽
      const touch = e.touches[0];
      if (!isDraggingRef.current) {
        const dx = touch.clientX - dragStartRef.current.x;
        const dy = touch.clientY - dragStartRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) isDraggingRef.current = true;
        else return;
      }
      const deltaX = touch.clientX - lastPosRef.current.x;
      const deltaY = touch.clientY - lastPosRef.current.y;
      setViewOffset({ x: viewOffset.x + deltaX / smoothZoomRef.current, y: viewOffset.y + deltaY / smoothZoomRef.current });
      lastPosRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // 如果还有触摸点，检查是单点还是两点
    if (e.touches.length === 1) {
      // 从两点变为单点，切换到单点拖拽模式
      const touch = e.touches[0];
      isMouseDownRef.current = true;
      isDraggingRef.current = false;
      dragStartRef.current = { x: touch.clientX, y: touch.clientY };
      lastPosRef.current = { x: touch.clientX, y: touch.clientY };
      // 重置缩放状态
      initialPinchDistanceRef.current = null;
      initialZoomRef.current = null;
      initialViewOffsetRef.current = null;
      pinchCenterRef.current = null;
    } else if (e.touches.length === 0) {
      // 所有触摸点都离开
      isMouseDownRef.current = false;
      isDraggingRef.current = false;
      initialPinchDistanceRef.current = null;
      initialZoomRef.current = null;
      initialViewOffsetRef.current = null;
      pinchCenterRef.current = null;
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onContextMenu={(e) => e.preventDefault()} // 禁用右键菜单
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        display: 'block',
        cursor: isDraggingRef.current ? 'grabbing' : 'grab',
        touchAction: 'none'
      }}
    />
  );
}
