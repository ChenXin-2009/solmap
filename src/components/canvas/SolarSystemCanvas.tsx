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
import { planetNames } from '@/lib/astronomy/names';

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
   * 绘制轨道
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
    lang: string
  ): void {
    this.clearCanvas();
    this.drawStarfield();

    this.ctx.save();

    // 绘制轨道
    bodies.forEach((body) => {
      if (body.isSun) return;
      const isSelected = body.name === selectedPlanet;
      this.drawOrbit(body, viewOffsetX, viewOffsetY, zoom, isSelected);
    });

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

  const {
    celestialBodies,
    selectedPlanet,
    viewOffset,
    zoom,
    lang,
    tick,
    setViewOffset,
    setZoom,
    selectPlanet,
    centerOnPlanet
  } = useSolarSystemStore();

  // 放大限制
  const MIN_ZOOM = 10;
  const MAX_ZOOM = 500; // 修改上限

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderer = new SolarSystemRenderer(ctx, canvas.width, canvas.height);
    renderer.render(celestialBodies, selectedPlanet, viewOffset.x, viewOffset.y, zoom, lang);
  }, [celestialBodies, selectedPlanet, viewOffset, zoom, lang]);

  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

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

      // 点击后自动放大到行星
      const targetZoom = Math.min(MAX_ZOOM, Math.max(zoom, 200)); // 可根据需要调整放大倍率
      setZoom(targetZoom);
      centerOnPlanet(clickedBody);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * zoomFactor)));
  };

  // 触摸逻辑保持不变
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      isMouseDownRef.current = true;
      isDraggingRef.current = false;
      dragStartRef.current = { x: touch.clientX, y: touch.clientY };
      lastPosRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1 && isMouseDownRef.current) {
      const touch = e.touches[0];
      if (!isDraggingRef.current) {
        const dx = touch.clientX - dragStartRef.current.x;
        const dy = touch.clientY - dragStartRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) isDraggingRef.current = true;
        else return;
      }
      const deltaX = touch.clientX - lastPosRef.current.x;
      const deltaY = touch.clientY - lastPosRef.current.y;
      setViewOffset({ x: viewOffset.x + deltaX / zoom, y: viewOffset.y + deltaY / zoom });
      lastPosRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchEnd = () => {
    isMouseDownRef.current = false;
    isDraggingRef.current = false;
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
