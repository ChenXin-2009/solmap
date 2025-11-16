/**
 * 拖尾轨迹管理器
 * 用于跟踪和存储行星的历史位置，实现类似 NASA Eyes 的拖尾效果
 * 拖尾显示行星在过去一段时间内在轨道上走过的路径
 */

import type { CelestialBody } from './astronomy/orbit';

/**
 * 单个位置点（基于时间）
 */
export interface TrailPoint {
  x: number;
  y: number;
  julianDay: number; // 儒略日，用于基于时间跨度的拖尾
}

/**
 * 行星拖尾数据
 */
export interface PlanetTrail {
  name: string;
  points: TrailPoint[];
  color: string;
  orbitalPeriod: number; // 轨道周期（天）
}

/**
 * 拖尾管理器类
 */
export class TrailManager {
  private trails: Map<string, PlanetTrail> = new Map();
  private readonly maxPoints: number = 2000; // 最大存储点数
  private readonly trailTimeSpan: number = 90; // 默认显示过去90天的轨迹（天）

  /**
   * 更新行星位置
   * @param body - 天体对象
   * @param currentJulianDay - 当前儒略日
   */
  updatePosition(body: CelestialBody, currentJulianDay: number): void {
    if (body.isSun) return; // 太阳不需要拖尾

    let trail = this.trails.get(body.name);

    if (!trail) {
      // 创建新的拖尾
      const orbitalPeriod = this.calculateOrbitalPeriod(body);
      trail = {
        name: body.name,
        points: [],
        color: body.color,
        orbitalPeriod: orbitalPeriod
      };
      this.trails.set(body.name, trail);
    }

    // 检查是否需要添加新点
    // 只有当位置变化足够大时才添加（避免重复点）
    const minDistance = 0.0001; // 最小距离变化（AU）
    if (trail.points.length > 0) {
      const lastPoint = trail.points[trail.points.length - 1];
      const dx = body.x - lastPoint.x;
      const dy = body.y - lastPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 如果距离变化太小，不添加新点
      if (distance < minDistance) {
        return;
      }
    }

    // 添加新位置点
    trail.points.push({
      x: body.x,
      y: body.y,
      julianDay: currentJulianDay
    });

    // 限制存储的点数
    if (trail.points.length > this.maxPoints) {
      trail.points.shift();
    }

    // 清理过旧的点（保留在时间跨度内的点）
    const cutoffJulianDay = currentJulianDay - this.trailTimeSpan;
    trail.points = trail.points.filter(point => point.julianDay >= cutoffJulianDay);
  }

  /**
   * 计算轨道周期（天）
   */
  private calculateOrbitalPeriod(body: CelestialBody): number {
    if (!body.elements) return 365.25; // 默认一年

    // 使用开普勒第三定律：T² = 4π²a³/GM
    // 其中 a 是半长轴，GM = 4π² (AU³/day²)
    const a = body.elements.a; // 半长轴 (AU)
    const T = 2 * Math.PI * Math.sqrt(a * a * a); // 轨道周期（天）
    return T;
  }

  /**
   * 获取行星的拖尾数据（基于时间跨度）
   * @param planetName - 行星名称
   * @param currentJulianDay - 当前儒略日
   * @param timeSpanDays - 时间跨度（天），如果不提供则根据轨道周期自动计算
   */
  getTrail(
    planetName: string, 
    currentJulianDay: number, 
    timeSpanDays?: number
  ): PlanetTrail | undefined {
    const trail = this.trails.get(planetName);
    if (!trail) return undefined;

    // 如果没有指定时间跨度，根据轨道周期自动计算
    // 显示轨道周期的1/3，但至少30天，最多365天
    let timeSpan = timeSpanDays;
    if (timeSpan === undefined) {
      timeSpan = Math.max(30, Math.min(365, trail.orbitalPeriod / 3));
    }
    
    const cutoffJulianDay = currentJulianDay - timeSpan;

    // 返回在时间跨度内的点
    const filteredTrail: PlanetTrail = {
      ...trail,
      points: trail.points.filter(point => point.julianDay >= cutoffJulianDay)
    };

    return filteredTrail;
  }

  /**
   * 获取所有拖尾数据
   */
  getAllTrails(currentJulianDay: number, timeSpanDays?: number): PlanetTrail[] {
    return Array.from(this.trails.keys())
      .map(name => this.getTrail(name, currentJulianDay, timeSpanDays))
      .filter((trail): trail is PlanetTrail => trail !== undefined);
  }

  /**
   * 清除所有拖尾
   */
  clearAll(): void {
    this.trails.clear();
  }

  /**
   * 清除特定行星的拖尾
   */
  clearTrail(planetName: string): void {
    this.trails.delete(planetName);
  }

  /**
   * 设置拖尾时间跨度
   */
  setTrailTimeSpan(days: number): void {
    (this as any).trailTimeSpan = Math.max(1, Math.min(365 * 10, days)); // 限制在1天到10年之间
  }

  /**
   * 获取拖尾时间跨度
   */
  getTrailTimeSpan(): number {
    return this.trailTimeSpan;
  }
}
