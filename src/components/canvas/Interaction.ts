import { MutableRefObject } from 'react';
import { useSolarSystemStore } from '../../lib/state';

type Point = { x: number; y: number };

/**
 * InteractionLLM
 * - 占位的交互逻辑实现，提供鼠标/触摸的平移与缩放支持。
 * - 设计目标：在缺少原始实现时保证应用能够编译并进行交互调试。
 * - 注意：这不是最终渲染器的精确交互实现，但对大多数调试场景足够。
 */
export class InteractionLLM {
  private canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  private isDragging = false;
  private lastMousePos: Point = { x: 0, y: 0 };
  private lastTouchCenter: Point | null = null;
  private lastTouchDistance = 0;

  constructor(canvasRef: MutableRefObject<HTMLCanvasElement | null>) {
    this.canvasRef = canvasRef;
  }

  // ---------- 鼠标事件 ----------
  handleMouseDown = (e: MouseEvent) => {
    // 仅响应左键
    if ('button' in e && e.button !== 0) return;
    this.isDragging = true;
    this.lastMousePos = { x: e.clientX, y: e.clientY };
    // 阻止可能的默认行为
    e.preventDefault();
  };

  handleMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    const cur = { x: e.clientX, y: e.clientY };
    const dx = cur.x - this.lastMousePos.x;
    const dy = cur.y - this.lastMousePos.y;
    this.lastMousePos = cur;

    // 简单的像素 -> 世界单位转换（可按需调整）
    const state = useSolarSystemStore.getState();
    const zoom = state.zoom || 50;
    const factor = 1 / zoom; // 经验值：缩放越大，每像素移动越小
    const newOffset = { x: state.viewOffset.x - dx * factor, y: state.viewOffset.y - dy * factor };
    state.setViewOffset(newOffset);
  };

  handleMouseUp = (e: MouseEvent) => {
    this.isDragging = false;
  };

  handleWheel = (e: WheelEvent) => {
    // 使用滚轮缩放；阻止默认以避免页面滚动
    e.preventDefault();
    const delta = -e.deltaY; // 向上滚动为正
    const state = useSolarSystemStore.getState();
    const curZoom = state.zoom || 50;
    // 缩放步长依据 delta 大小缩放
    const zoomFactor = Math.exp(delta * 0.001); // 平滑缩放
    const newZoom = Math.max(10, Math.min(200, curZoom * zoomFactor));
    state.setZoom(newZoom);
  };

  // ---------- 触摸事件（移动设备） ----------
  handleTouchStart = (e: TouchEvent) => {
    if (!e.touches) return;
    if (e.touches.length === 1) {
      const t = e.touches[0];
      this.lastMousePos = { x: t.clientX, y: t.clientY };
    } else if (e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      this.lastTouchCenter = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
      this.lastTouchDistance = this.getTouchDistance(t0, t1);
    }
    e.preventDefault();
  };

  handleTouchMove = (e: TouchEvent) => {
    if (!e.touches) return;
    const state = useSolarSystemStore.getState();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const cur = { x: t.clientX, y: t.clientY };
      const dx = cur.x - this.lastMousePos.x;
      const dy = cur.y - this.lastMousePos.y;
      this.lastMousePos = cur;
      const factor = 1 / (state.zoom || 50);
      state.setViewOffset({ x: state.viewOffset.x - dx * factor, y: state.viewOffset.y - dy * factor });
    } else if (e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const center = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
      const distance = this.getTouchDistance(t0, t1);

      // 处理双指平移（中心点移动）
      if (this.lastTouchCenter) {
        const dx = center.x - this.lastTouchCenter.x;
        const dy = center.y - this.lastTouchCenter.y;
        const factor = 1 / (state.zoom || 50);
        state.setViewOffset({ x: state.viewOffset.x - dx * factor, y: state.viewOffset.y - dy * factor });
      }

      // 处理捏合缩放
      if (this.lastTouchDistance > 0) {
        const ratio = distance / this.lastTouchDistance;
        const curZoom = state.zoom || 50;
        const newZoom = Math.max(10, Math.min(200, curZoom * ratio));
        state.setZoom(newZoom);
      }

      this.lastTouchCenter = center;
      this.lastTouchDistance = distance;
    }
    e.preventDefault();
  };

  handleTouchEnd = (e: TouchEvent) => {
    if (e.touches && e.touches.length === 0) {
      this.lastTouchCenter = null;
      this.lastTouchDistance = 0;
    }
  };

  handleTouchCancel = (e: TouchEvent) => {
    this.lastTouchCenter = null;
    this.lastTouchDistance = 0;
  };

  // ---------- 工具方法 ----------
  private getTouchDistance(a: Touch, b: Touch) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
