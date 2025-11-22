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
 * ============================================================================
 * 可调整参数配置（方便调试）
 * ============================================================================
 */
const ORBIT_CONFIG = {
  // 轨道颜色（十六进制，每个行星可以单独设置）
  colors: {
    mercury: '#c4cbcf',
    venus: '#fcc307',
    earth: '#22a2c3',
    mars: '#f5391c',
    jupiter: '#aa6a4c',
    saturn: '#be7e4a',
    uranus: '#4FD0E7',
    neptune: '#4B70DD',
  },
  // 轨道线宽
  minLineWidth: 1,      // 最小线宽（像素）
  maxLineWidth: 1,      // 最大线宽（像素）
  // 轨道透明度
  minOpacity: 0.2,     // 最低透明度（0-1）
  maxOpacity: 0.8,      // 最大透明度（0-1）
  // 轨道分段
  baseSegmentCount: 300, // 基础分段数量
  segmentSize: 20,      // 每段包含的点数
  overlap: 0,          // 段之间的重叠点数
};

/**
 * 文字标签配置
 */
const LABEL_CONFIG = {
  // 字体设置
  fontSize: 16,        // 字体大小（像素）
  fontFamily: '"SmileySans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontWeight: 'bold',  // 字体粗细
  
  // 文字位置
  offsetY: 8,          // 文字距离行星的垂直偏移（像素）
  
  // 重叠检测
  charWidth: 10,      // 每个字符的估算宽度（像素，用于重叠检测）
  charHeight: 20,      // 文字高度（像素，用于重叠检测）
  overlapPadding: 2,   // 重叠检测的额外边距（像素）
  
  // 渐隐效果
  fadeSpeed: 0.2,     // 渐隐速度（0-1，值越大变化越快，建议 0.1-0.3）
  minOpacity: 0.01,    // 最小透明度（低于此值不绘制）
  
  // 显示条件
  minZoomToShow: 10,   // 最小缩放级别（低于此值不显示任何标签，除了选中的）
};

/**
 * Canvas 渲染器类
 */
class SolarSystemRenderer {
  private ctx: CanvasRenderingContext2D;
  public width: number;  // 改为 public，方便外部检查
  public height: number; // 改为 public，方便外部检查
  private centerX: number;
  private centerY: number;
  // 存储标签透明度状态，用于平滑渐隐
  private labelStates: Map<string, { opacity: number; targetOpacity: number }> = new Map();

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.centerX = width / 2;
    this.centerY = height / 2;
  }
  
  // 更新尺寸（当窗口大小改变时）
  updateSize(width: number, height: number): void {
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

    // 解析颜色（优先使用配置中的颜色，如果没有则使用 body.color）
    const orbitColor = ORBIT_CONFIG.colors[body.name.toLowerCase() as keyof typeof ORBIT_CONFIG.colors] || body.color;
    const rgb = this.hexToRgb(orbitColor);
    if (!rgb) return;

    // 计算轨道上的点，从当前位置开始，沿着运动方向
    const startAngle = currentNu;
    const trailLength = Math.PI * 2; // 显示一圈轨道
    
    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    // 启用抗锯齿，使线条更平滑清晰
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    // 确保线段之间没有间隙
    this.ctx.miterLimit = 10;
    // 使用 source-over 混合模式，确保轨道完全覆盖背景
    this.ctx.globalCompositeOperation = 'source-over';

    // 增加分段数量，消除纹理感，使用更平滑的绘制
    // 根据缩放级别动态调整分段数量，确保轨道平滑
    const baseSegmentCount = ORBIT_CONFIG.baseSegmentCount;
    const segmentCount = Math.min(baseSegmentCount, Math.max(150, Math.floor(baseSegmentCount * (zoom / 50))));
    
    // 渐变透明度参数（从配置读取）
    const minOpacity = ORBIT_CONFIG.minOpacity;
    const maxOpacity = ORBIT_CONFIG.maxOpacity;
    
    // 预计算三角函数值以提高性能
    const cos_w = Math.cos(w);
    const sin_w = Math.sin(w);
    const cos_O = Math.cos(O);
    const sin_O = Math.sin(O);
    const cos_i = Math.cos(i);
    const sin_i = Math.sin(i);
    
    // 先计算所有轨道点
    // 调转渐变方向：从当前位置开始，沿着运动方向绘制
    const points: Array<{ x: number; y: number }> = [];
    for (let seg = 0; seg <= segmentCount; seg++) {
      const progress = seg / segmentCount;
      // 沿着运动方向绘制
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
    
    // 使用更平滑的渐变绘制，使用单一路径分段设置样式，完全避免白点
    const minLineWidth = ORBIT_CONFIG.minLineWidth;
    const maxLineWidth = ORBIT_CONFIG.maxLineWidth;
    
    // 使用更大的段，减少绘制调用，同时保持平滑
    // 段之间重叠以确保完全连续，避免白点
    const segmentSize = ORBIT_CONFIG.segmentSize;
    const overlap = ORBIT_CONFIG.overlap;
    
    for (let i = 0; i < points.length - 1; i += segmentSize - overlap) {
      const endIdx = Math.min(i + segmentSize, points.length - 1);
      
      // 计算这段的中间点进度
      const midIdx = Math.floor((i + endIdx) / 2);
      const progress = midIdx / (points.length - 1);
      
      const opacity = minOpacity + (maxOpacity - minOpacity) * progress;
      const lineWidth = minLineWidth + (maxLineWidth - minLineWidth) * progress;
      
      // 使用连续路径绘制这一段
      this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
      this.ctx.lineWidth = lineWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(points[i].x, points[i].y);
      
      // 绘制连续路径，确保线段之间没有间隙
      for (let j = i + 1; j <= endIdx; j++) {
        this.ctx.lineTo(points[j].x, points[j].y);
      }
      
      this.ctx.stroke();
      
      // 如果已经到达末尾，退出循环
      if (endIdx >= points.length - 1) break;
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
    lang: string,
    labelOpacity: number = 1.0
  ): void {
    const x = this.centerX + (body.x + viewOffsetX) * zoom;
    const y = this.centerY + (body.y + viewOffsetY) * zoom;
    // 保留真实比例，如果太小加最小可视半径
    const radius = Math.max(body.radius * zoom, body.isSun ? 8 : 3);

    // 选中时的扁平化标记（可选：简单的边框或外圈）
    if (isSelected && !body.isSun) {
      // 扁平化设计：使用简单的边框而不是渐变光晕
      this.ctx.strokeStyle = body.color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius + 3, 0, 2 * Math.PI);
      this.ctx.stroke();
    }

    // 天体本体 - 扁平化设计，无渐变
    if (body.isSun) {
      // 太阳使用纯色，无渐变
      this.ctx.fillStyle = body.color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
      this.ctx.fill();
    } else {
      // 行星使用纯色，无渐变和高光
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
    }

    // 标签显示逻辑 - 太阳不显示文字
    if (body.isSun) {
      return; // 太阳不显示标签
    }
    
    // 使用传入的透明度（由 render 方法根据重叠情况计算）
    if (labelOpacity > LABEL_CONFIG.minOpacity) {
      // 优化字体渲染，确保清晰
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.fillStyle = `rgba(255, 255, 255, ${labelOpacity})`;
      // 使用配置的字体设置
      this.ctx.font = `${LABEL_CONFIG.fontWeight} ${LABEL_CONFIG.fontSize}px ${LABEL_CONFIG.fontFamily}`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      // 使用更清晰的文字阴影
      this.ctx.shadowColor = `rgba(0,0,0,${0.8 * labelOpacity})`;
      this.ctx.shadowBlur = 3;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;

      const displayName = planetNames[lang as 'en' | 'zh'][body.name] ?? body.name;
      this.ctx.fillText(displayName, x, y + radius + LABEL_CONFIG.offsetY);

      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowBlur = 0;
    }
  }

  /**
   * 检测两个文字标签是否重叠
   */
  private checkLabelOverlap(
    x1: number, y1: number, text1: string,
    x2: number, y2: number, text2: string
  ): boolean {
    // 估算文字尺寸（使用配置参数）
    const textWidth1 = text1.length * LABEL_CONFIG.charWidth;
    const textWidth2 = text2.length * LABEL_CONFIG.charWidth;
    const textHeight = LABEL_CONFIG.charHeight;
    const padding = LABEL_CONFIG.overlapPadding;
    
    // 计算两个标签的边界框（添加边距）
    const left1 = x1 - textWidth1 / 2 - padding;
    const right1 = x1 + textWidth1 / 2 + padding;
    const top1 = y1 - padding;
    const bottom1 = y1 + textHeight + padding;
    
    const left2 = x2 - textWidth2 / 2 - padding;
    const right2 = x2 + textWidth2 / 2 + padding;
    const top2 = y2 - padding;
    const bottom2 = y2 + textHeight + padding;
    
    // 检测边界框是否重叠
    return !(right1 < left2 || left1 > right2 || bottom1 < top2 || top1 > bottom2);
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

    // 先收集所有需要显示的文字标签信息
    const labelInfos: Array<{
      body: CelestialBody;
      x: number;
      y: number;
      text: string;
      isSelected: boolean;
    }> = [];

    sortedBodies.forEach((body) => {
      if (body.isSun) return; // 太阳不显示标签
      
      const isSelected = body.name === selectedPlanet;
      const x = this.centerX + (body.x + viewOffsetX) * zoom;
      const y = this.centerY + (body.y + viewOffsetY) * zoom;
      const radius = Math.max(body.radius * zoom, body.isSun ? 8 : 3);
      const displayName = planetNames[lang as 'en' | 'zh'][body.name] ?? body.name;
      
      // 如果缩放太小，只显示选中的行星标签
      if (zoom < LABEL_CONFIG.minZoomToShow && !isSelected) {
        // 不添加到 labelInfos，这样就不会显示
        return;
      }
      
      // 选中的行星始终显示
      if (isSelected) {
        labelInfos.push({ body, x, y: y + radius + LABEL_CONFIG.offsetY, text: displayName, isSelected: true });
      } else {
        // 其他行星根据重叠情况决定是否显示
        labelInfos.push({ body, x, y: y + radius + LABEL_CONFIG.offsetY, text: displayName, isSelected: false });
      }
    });

    // 初始化状态（如果不存在）
    labelInfos.forEach((info) => {
      if (!this.labelStates.has(info.body.name)) {
        this.labelStates.set(info.body.name, { opacity: 1.0, targetOpacity: 1.0 });
      }
    });

    // 检测重叠并设置目标透明度
    for (let i = 0; i < labelInfos.length; i++) {
      const info1 = labelInfos[i];
      if (info1.isSelected) {
        this.labelStates.get(info1.body.name)!.targetOpacity = 1.0;
        continue;
      }
      
      let hasOverlap = false;
      // 检查与所有其他标签的重叠（包括已处理的标签）
      for (let j = 0; j < labelInfos.length; j++) {
        if (i === j) continue;
        const info2 = labelInfos[j];
        if (this.checkLabelOverlap(info1.x, info1.y, info1.text, info2.x, info2.y, info2.text)) {
          // 如果与选中的行星重叠，隐藏当前标签
          if (info2.isSelected) {
            hasOverlap = true;
            break;
          }
          // 如果两个都未选中，根据距离中心的距离决定隐藏哪个
          const dist1 = Math.sqrt(Math.pow(info1.x - this.centerX, 2) + Math.pow(info1.y - this.centerY, 2));
          const dist2 = Math.sqrt(Math.pow(info2.x - this.centerX, 2) + Math.pow(info2.y - this.centerY, 2));
          // 距离中心更远的隐藏，如果距离相同，隐藏索引更大的（后绘制的）
          if (dist1 > dist2 || (Math.abs(dist1 - dist2) < 1 && i > j)) {
            hasOverlap = true;
            break;
          }
        }
      }
      
      this.labelStates.get(info1.body.name)!.targetOpacity = hasOverlap ? 0.0 : 1.0;
    }

    // 平滑过渡透明度（渐隐效果）
    // 使用线性插值实现平滑渐隐，类似 NASA JPL Eyes
    // 每帧都会更新，确保平滑过渡
    const labelOpacities = new Map<string, number>();
    this.labelStates.forEach((state, name) => {
      const diff = state.targetOpacity - state.opacity;
      // 使用更小的阈值，确保渐隐更平滑
      if (Math.abs(diff) > 0.001) {
        // 使用线性插值，确保平滑过渡
        // fadeSpeed 越大，变化越快（每帧移动的距离）
        state.opacity += diff * LABEL_CONFIG.fadeSpeed;
        // 限制透明度范围
        state.opacity = Math.max(0, Math.min(1, state.opacity));
      } else {
        // 接近目标值时，直接设置为目标值
        state.opacity = state.targetOpacity;
      }
      labelOpacities.set(name, state.opacity);
    });

    // 绘制天体和标签
    sortedBodies.forEach((body) => {
      const isSelected = body.name === selectedPlanet;
      this.drawBody(body, viewOffsetX, viewOffsetY, zoom, isSelected, lang, labelOpacities.get(body.name) ?? 1.0);
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

  // 使用 useRef 存储绘制函数和渲染器实例，确保引用稳定
  const drawRef = useRef<() => void>(() => {});
  const rendererRef = useRef<SolarSystemRenderer | null>(null);

  // 初始化绘制函数
  useEffect(() => {
    drawRef.current = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 直接获取 store 的最新状态
      const state = useSolarSystemStore.getState();
      const currentJulianDay = dateToJulianDay(state.currentTime);
      const currentZoom = smoothZoomRef.current;
      
      // 使用显示尺寸（CSS 尺寸），因为 context 已经按 DPR 缩放
      const displayWidth = canvas.clientWidth || canvas.width / (window.devicePixelRatio || 1);
      const displayHeight = canvas.clientHeight || canvas.height / (window.devicePixelRatio || 1);
      
      // 重用渲染器实例，保持 labelStates 状态
      if (!rendererRef.current) {
        rendererRef.current = new SolarSystemRenderer(ctx, displayWidth, displayHeight);
      } else if (rendererRef.current.width !== displayWidth || rendererRef.current.height !== displayHeight) {
        // 尺寸改变时更新，但保持 labelStates
        rendererRef.current.updateSize(displayWidth, displayHeight);
      }
      
      rendererRef.current.render(
        state.celestialBodies,
        state.selectedPlanet,
        state.viewOffset.x,
        state.viewOffset.y,
        currentZoom,
        state.lang,
        currentJulianDay
      );
    };
  }); // 每次渲染后更新绘制函数，但不作为依赖

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

      // 在动画循环内部直接访问 store 的最新值，避免依赖数组导致的无限循环
      const state = useSolarSystemStore.getState();
      state.tick(delta);

      // 绘制
      drawRef.current();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, []); // 空依赖数组，只在组件挂载时运行一次

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const resize = () => {
      // 使用容器的实际尺寸
      const container = canvas.parentElement;
      let displayWidth: number;
      let displayHeight: number;
      
      if (container) {
        displayWidth = container.clientWidth;
        displayHeight = container.clientHeight;
      } else {
        displayWidth = window.innerWidth;
        displayHeight = window.innerHeight;
      }
      
      // 获取设备像素比，处理高 DPR 设备（如 Retina 显示器）
      const dpr = window.devicePixelRatio || 1;
      
      // 设置 canvas 的实际尺寸（考虑 DPR）
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      
      // 设置 canvas 的 CSS 显示尺寸
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      
      // 使用 setTransform 设置缩放，确保每次都是正确的缩放值（不累积）
      // 注意：设置 canvas.width/height 会重置 context，所以这里需要重新设置 transform
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      // 更新 renderer 的尺寸（使用显示尺寸，因为 context 已经缩放）
      drawRef.current();
    };
    resize();
    window.addEventListener('resize', resize);
    // 使用 ResizeObserver 监听容器尺寸变化
    const resizeObserver = new ResizeObserver(resize);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    return () => {
      window.removeEventListener('resize', resize);
      resizeObserver.disconnect();
    };
  }, []); // 空依赖数组，drawRef.current 始终是最新的

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
    // 使用显示尺寸（CSS 尺寸）计算点击坐标，因为绘制也使用显示尺寸
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const clickX = e.clientX - rect.left - displayWidth / 2;
    const clickY = e.clientY - rect.top - displayHeight / 2;

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
    const baseFactor = 0.5; // 基础缩放因子（每次滚动5%）
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
          // 使用显示尺寸计算坐标
          const displayWidth = canvas.clientWidth;
          const displayHeight = canvas.clientHeight;
          // 初始触摸中心相对于画布中心的位置（这是缩放中心）
          const initialScreenX = pinchCenterRef.current.x - rect.left - displayWidth / 2;
          const initialScreenY = pinchCenterRef.current.y - rect.top - displayHeight / 2;

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
        width: '100%',
        height: '100%',
        cursor: isDraggingRef.current ? 'grabbing' : 'grab',
        touchAction: 'none'
      }}
    />
  );
}
