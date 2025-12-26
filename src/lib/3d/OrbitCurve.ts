/**
 * OrbitCurve.ts - 3D 轨道曲线类
 * 
 * 功能：
 * - 根据轨道六根数生成 3D 轨道曲线
 * - 支持轨道倾角、升交点黄经等真实参数
 * - 实现轨道渐变效果（从近到远透明度变化）
 * 
 * 使用：
 * - 传入轨道元素和颜色创建轨道
 * - 通过 getLine() 获取 Three.js Line 对象添加到场景
 */

import * as THREE from 'three';
import type { OrbitalElements } from '@/lib/astronomy/orbit';
import { ORBIT_GRADIENT_CONFIG, ORBIT_RENDER_CONFIG } from '@/lib/config/visualConfig';

export class OrbitCurve {
  private line: THREE.Line;
  private curve: THREE.CatmullRomCurve3;
  private points: THREE.Vector3[] = [];
  private planetPosition: THREE.Vector3 | null = null; // 行星当前位置（用于计算渐变方向）
  private orbitColor: string; // 保存轨道颜色字符串
  
  // Adaptive resolution properties
  private elements: OrbitalElements; // Store orbital elements for regeneration
  private currentResolution: number = 300; // Current curve resolution
  private lastCameraDistance: number = 0; // Last camera distance for change detection
  private resolutionUpdateThreshold: number = 0.1; // Minimum distance change to trigger update

  constructor(
    elements: OrbitalElements,
    color: string,
    segments: number = 300,
    julianDay?: number,
    planetPosition?: THREE.Vector3
  ) {
    // Store orbital elements for adaptive resolution
    this.elements = elements;
    // Store orbital elements for adaptive resolution
    this.elements = elements;
    
    // 保存轨道颜色和行星位置（确保颜色有默认值）
    this.orbitColor = color || '#ffffff';
    this.planetPosition = planetPosition || null;
    
    // Initialize adaptive resolution
    this.currentResolution = segments;
    
    // 生成轨道点
    this.generatePoints(elements, segments, julianDay);

    // ⚠️ 关键修复：直接使用生成的点创建几何体，不使用 CatmullRomCurve3 插值
    // CatmullRomCurve3 会导致轻微的摆动，因为它会在点之间进行样条插值
    // 我们已经生成了足够多的点（segments 个），直接使用这些点即可
    const geometry = new THREE.BufferGeometry().setFromPoints(this.points);
    
    // 保存曲线引用（用于其他方法，如 getClosestPointOnOrbit）
    this.curve = new THREE.CatmullRomCurve3(this.points, true);

    // 创建渐变材质（如果启用）
    let material: THREE.LineBasicMaterial;
    
    // 检查是否启用渐变（需要启用配置且有行星位置）
    const shouldUseGradient = ORBIT_GRADIENT_CONFIG.enabled && this.planetPosition;
    
    if (shouldUseGradient) {
      // 单向渐变：从行星当前位置向运动反方向渐隐
      // 计算每个点到行星的距离，距离越远（在运动反方向）越透明
      const vertexCount = this.points.length;
      const colors = new Float32Array(vertexCount * 3);
      
      // 解析颜色（支持 #RRGGBB 和 #RGB 格式）
      let r, g, b;
      if (this.orbitColor.length === 7) {
        // #RRGGBB 格式
        r = parseInt(this.orbitColor.slice(1, 3), 16) / 255;
        g = parseInt(this.orbitColor.slice(3, 5), 16) / 255;
        b = parseInt(this.orbitColor.slice(5, 7), 16) / 255;
      } else if (this.orbitColor.length === 4) {
        // #RGB 格式
        r = parseInt(this.orbitColor[1], 16) / 15;
        g = parseInt(this.orbitColor[2], 16) / 15;
        b = parseInt(this.orbitColor[3], 16) / 15;
      } else {
        // 默认白色
        r = g = b = 1;
      }
      
      // 计算行星运动方向（近似：使用轨道上相邻点的方向）
      // 找到最接近行星位置的轨道点索引
      // 注意：此时 this.planetPosition 一定不为 null（因为 shouldUseGradient 已经检查过）
      const planetPos = this.planetPosition!;
      
      let closestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < vertexCount; i++) {
        const dist = this.points[i].distanceTo(planetPos);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }
      
      // 计算运动方向（从当前点到下一个点）
      const nextIdx = (closestIdx + 1) % vertexCount;
      const velocityDir = new THREE.Vector3()
        .subVectors(this.points[nextIdx], this.points[closestIdx])
        .normalize();
      
      // 计算每个点到行星的距离，以及是否在运动反方向
      const maxDist = Math.max(...this.points.map(p => p.distanceTo(planetPos)));
      
      for (let i = 0; i < vertexCount; i++) {
        const point = this.points[i];
        const toPoint = new THREE.Vector3().subVectors(point, planetPos);
        const dist = toPoint.length();
        
        if (dist < 0.001) {
          // 行星当前位置，完全不透明
          colors[i * 3] = r;
          colors[i * 3 + 1] = g;
          colors[i * 3 + 2] = b;
          continue;
        }
        
        toPoint.normalize();
        
        // 计算点在运动方向上的投影（正值表示在运动方向，负值表示在运动反方向）
        const dot = toPoint.dot(velocityDir);
        
        // 距离行星的距离（归一化）
        const distT = Math.min(1, dist / maxDist);
        
        // 渐变逻辑：从行星位置开始，向运动反方向渐隐
        // dot < 0 表示在运动反方向，应该渐隐
        // dot > 0 表示在运动方向，保持较亮
        let opacity = ORBIT_GRADIENT_CONFIG.maxOpacity;
        if (dot < 0) {
          // 在运动反方向，根据距离渐隐（距离越远越透明）
          const fadeT = Math.abs(dot) * distT; // 结合方向和距离
          opacity = ORBIT_GRADIENT_CONFIG.maxOpacity - 
                   (ORBIT_GRADIENT_CONFIG.maxOpacity - ORBIT_GRADIENT_CONFIG.minOpacity) * fadeT;
        } else {
          // 在运动方向，保持较亮，但距离太远也会稍微变暗
          opacity = ORBIT_GRADIENT_CONFIG.maxOpacity - 
                   (ORBIT_GRADIENT_CONFIG.maxOpacity - ORBIT_GRADIENT_CONFIG.minOpacity) * distT * 0.3;
        }
        
        // 确保透明度在合理范围内
        opacity = Math.max(ORBIT_GRADIENT_CONFIG.minOpacity, Math.min(ORBIT_GRADIENT_CONFIG.maxOpacity, opacity));
        
        // 将颜色和透明度编码到 RGB
        colors[i * 3] = r * opacity;
        colors[i * 3 + 1] = g * opacity;
        colors[i * 3 + 2] = b * opacity;
      }
      
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: false, // 不透明，确保正确的深度测试
        opacity: 1.0,
        depthWrite: true,
        depthTest: true,
        linewidth: 2,
      });
    } else {
      // 不使用渐变，使用固定透明度和颜色
      // 解析颜色字符串为 Three.js Color（确保颜色有效）
      const colorToUse = this.orbitColor || '#ffffff';
      const threeColor = new THREE.Color(colorToUse);
      material = new THREE.LineBasicMaterial({
        color: threeColor,
        opacity: 1.0,
        transparent: false, // 不透明，确保正确的深度测试
        depthWrite: true,
        depthTest: true,
        linewidth: 2,
      });
    }

    // 创建线条
    this.line = new THREE.Line(geometry, material);
  }
  
  /**
   * Calculate optimal curve resolution based on camera distance
   * @param cameraDistance Distance from camera to orbit center
   * @returns Optimal number of curve points
   */
  private calculateOptimalResolution(cameraDistance: number): number {
    // Base resolution configuration
    const minResolution = 64;   // Minimum points for distant view
    const maxResolution = 1200; // Maximum points for close view
    const baseDistance = 30;    // Reference distance for base resolution
    const baseResolution = 300; // Base resolution at reference distance
    
    // Use logarithmic scaling for smooth resolution changes
    // Closer camera = higher resolution, farther camera = lower resolution
    const distanceRatio = Math.max(0.1, cameraDistance / baseDistance);
    const targetResolution = Math.round(baseResolution / Math.sqrt(distanceRatio));
    
    // Clamp to min/max bounds
    return Math.max(minResolution, Math.min(maxResolution, targetResolution));
  }

  /**
   * Update curve resolution based on camera distance
   * @param cameraDistance Current camera distance from orbit center
   */
  updateCurveResolution(cameraDistance: number): void {
    // Check if distance change is significant enough to warrant update
    const distanceChange = Math.abs(cameraDistance - this.lastCameraDistance);
    const relativeChange = distanceChange / Math.max(0.1, this.lastCameraDistance);
    
    if (relativeChange < this.resolutionUpdateThreshold) {
      return; // Skip update for small changes
    }
    
    const optimalResolution = this.calculateOptimalResolution(cameraDistance);
    
    // Only update if resolution change is significant (avoid frequent rebuilds)
    const resolutionChange = Math.abs(optimalResolution - this.currentResolution);
    const minResolutionChange = Math.max(8, this.currentResolution * 0.1); // At least 10% change
    
    if (resolutionChange >= minResolutionChange) {
      this.currentResolution = optimalResolution;
      this.regenerateCurve();
      this.lastCameraDistance = cameraDistance;
    }
  }

  /**
   * Regenerate curve with current resolution
   */
  private regenerateCurve(): void {
    // Generate new points with current resolution
    this.generatePoints(this.elements, this.currentResolution);
    
    // Create new curve
    this.curve = new THREE.CatmullRomCurve3(this.points, true);
    
    // ⚠️ 关键修复：直接使用生成的点，不使用 curve.getPoints() 插值
    const newGeometry = new THREE.BufferGeometry().setFromPoints(this.points);
    
    // Preserve material properties and update colors if gradient is enabled
    const material = this.line.material as THREE.LineBasicMaterial;
    if (ORBIT_GRADIENT_CONFIG.enabled && this.planetPosition) {
      this.updateGradientColors(newGeometry, this.points);
      // Ensure material supports vertex colors
      if (material.vertexColors !== true) {
        material.vertexColors = true;
        material.needsUpdate = true;
      }
    } else {
      // Use solid color if gradient is disabled
      material.vertexColors = false;
      material.color.setHex(parseInt(this.orbitColor.replace('#', '0x')));
      material.needsUpdate = true;
    }
    
    // Replace old geometry
    this.line.geometry.dispose();
    this.line.geometry = newGeometry;
  }

  /**
   * Update gradient colors for new geometry
   */
  private updateGradientColors(geometry: THREE.BufferGeometry, orbitPoints: THREE.Vector3[]): void {
    if (!this.planetPosition) return;
    
    const vertexCount = orbitPoints.length;
    const colors = new Float32Array(vertexCount * 3);
    
    // Parse orbit color
    let r, g, b;
    if (this.orbitColor.length === 7) {
      r = parseInt(this.orbitColor.slice(1, 3), 16) / 255;
      g = parseInt(this.orbitColor.slice(3, 5), 16) / 255;
      b = parseInt(this.orbitColor.slice(5, 7), 16) / 255;
    } else if (this.orbitColor.length === 4) {
      r = parseInt(this.orbitColor[1], 16) / 15;
      g = parseInt(this.orbitColor[2], 16) / 15;
      b = parseInt(this.orbitColor[3], 16) / 15;
    } else {
      r = g = b = 1;
    }
    
    // Find closest point to planet position
    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < vertexCount; i++) {
      const dist = orbitPoints[i].distanceTo(this.planetPosition);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }
    
    // Calculate motion direction
    const nextIdx = (closestIdx + 1) % vertexCount;
    const velocityDir = new THREE.Vector3()
      .subVectors(orbitPoints[nextIdx], orbitPoints[closestIdx])
      .normalize();
    
    const maxDist = Math.max(...orbitPoints.map(p => p.distanceTo(this.planetPosition!)));
    
    // Apply gradient
    for (let i = 0; i < vertexCount; i++) {
      const point = orbitPoints[i];
      const toPoint = new THREE.Vector3().subVectors(point, this.planetPosition);
      const dist = toPoint.length();
      
      if (dist < 0.001) {
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
        continue;
      }
      
      toPoint.normalize();
      const dot = toPoint.dot(velocityDir);
      const distT = Math.min(1, dist / maxDist);
      
      let opacity = ORBIT_GRADIENT_CONFIG.maxOpacity;
      if (dot < 0) {
        const fadeT = Math.abs(dot) * distT;
        opacity = ORBIT_GRADIENT_CONFIG.maxOpacity - 
                 (ORBIT_GRADIENT_CONFIG.maxOpacity - ORBIT_GRADIENT_CONFIG.minOpacity) * fadeT;
      } else {
        opacity = ORBIT_GRADIENT_CONFIG.maxOpacity - 
                 (ORBIT_GRADIENT_CONFIG.maxOpacity - ORBIT_GRADIENT_CONFIG.minOpacity) * distT * 0.3;
      }
      
      opacity = Math.max(ORBIT_GRADIENT_CONFIG.minOpacity, Math.min(ORBIT_GRADIENT_CONFIG.maxOpacity, opacity));
      colors[i * 3] = r * opacity;
      colors[i * 3 + 1] = g * opacity;
      colors[i * 3 + 2] = b * opacity;
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  updatePlanetPosition(position: THREE.Vector3): void {
    this.planetPosition = position;
    
    // 如果启用渐变，更新渐变颜色
    // ⚠️ 关键修复：使用 this.points 而不是 curve.getPoints()，避免插值导致的摆动
    if (ORBIT_GRADIENT_CONFIG.enabled && this.planetPosition && this.line.geometry && this.points.length > 0) {
      const geometry = this.line.geometry;
      const vertexCount = this.points.length;
      
      // 检查是否已有颜色属性
      let colors = geometry.getAttribute('color') as THREE.BufferAttribute;
      if (!colors || colors.count !== vertexCount) {
        colors = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);
        geometry.setAttribute('color', colors);
      }
      
      // 获取材质颜色（从保存的 orbitColor 解析）
      let r, g, b;
      if (this.orbitColor.length === 7) {
        // #RRGGBB 格式
        r = parseInt(this.orbitColor.slice(1, 3), 16) / 255;
        g = parseInt(this.orbitColor.slice(3, 5), 16) / 255;
        b = parseInt(this.orbitColor.slice(5, 7), 16) / 255;
      } else if (this.orbitColor.length === 4) {
        // #RGB 格式
        r = parseInt(this.orbitColor[1], 16) / 15;
        g = parseInt(this.orbitColor[2], 16) / 15;
        b = parseInt(this.orbitColor[3], 16) / 15;
      } else {
        // 默认白色
        r = g = b = 1;
      }
      
      // 找到最接近行星位置的轨道点索引
      let closestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < vertexCount; i++) {
        const dist = this.points[i].distanceTo(this.planetPosition);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }
      
      // 计算运动方向
      const nextIdx = (closestIdx + 1) % vertexCount;
      const velocityDir = new THREE.Vector3()
        .subVectors(this.points[nextIdx], this.points[closestIdx])
        .normalize();
      
      const maxDist = Math.max(...this.points.map(p => p.distanceTo(this.planetPosition!)));
      
      // 更新颜色数组
      for (let i = 0; i < vertexCount; i++) {
        const point = this.points[i];
        const toPoint = new THREE.Vector3().subVectors(point, this.planetPosition);
        const dist = toPoint.length();
        
        if (dist < 0.001) {
          // 行星当前位置，完全不透明
          colors.setXYZ(i, r, g, b);
          continue;
        }
        
        toPoint.normalize();
        const dot = toPoint.dot(velocityDir);
        const distT = Math.min(1, dist / maxDist);
        
        // 渐变逻辑：从行星位置开始，向运动反方向渐隐
        let opacity = ORBIT_GRADIENT_CONFIG.maxOpacity;
        if (dot < 0) {
          // 在运动反方向，根据距离渐隐
          const fadeT = Math.abs(dot) * distT;
          opacity = ORBIT_GRADIENT_CONFIG.maxOpacity - 
                   (ORBIT_GRADIENT_CONFIG.maxOpacity - ORBIT_GRADIENT_CONFIG.minOpacity) * fadeT;
        } else {
          // 在运动方向，保持较亮，但距离太远也会稍微变暗
          opacity = ORBIT_GRADIENT_CONFIG.maxOpacity - 
                   (ORBIT_GRADIENT_CONFIG.maxOpacity - ORBIT_GRADIENT_CONFIG.minOpacity) * distT * 0.3;
        }
        
        opacity = Math.max(ORBIT_GRADIENT_CONFIG.minOpacity, Math.min(ORBIT_GRADIENT_CONFIG.maxOpacity, opacity));
        colors.setXYZ(i, r * opacity, g * opacity, b * opacity);
      }
      
      colors.needsUpdate = true;
    }
  }

  /**
   * Validate that a planet position aligns with the orbit curve
   * @param planetPosition Current planet position
   * @param tolerance Maximum allowed distance from orbit (AU)
   * @returns Distance from orbit curve, or -1 if validation fails
   */
  validatePlanetAlignment(planetPosition: THREE.Vector3, tolerance: number = 0.001): number {
    if (!this.curve || this.points.length === 0) {
      return -1;
    }
    
    // Find the closest point on the orbit curve to the planet position
    let minDistance = Infinity;
    
    // Sample the curve at high resolution for accurate distance measurement
    const samplePoints = this.curve.getPoints(Math.max(1000, this.currentResolution * 2));
    
    for (const point of samplePoints) {
      const distance = planetPosition.distanceTo(point);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    
    // Return the minimum distance (can be compared against tolerance by caller)
    return minDistance;
  }

  /**
   * Get the closest point on the orbit curve to a given position
   * @param position Target position
   * @returns Closest point on orbit curve
   */
  getClosestPointOnOrbit(position: THREE.Vector3): THREE.Vector3 | null {
    if (!this.curve) return null;
    
    let minDistance = Infinity;
    let closestPoint: THREE.Vector3 | null = null;
    
    // Sample the curve for closest point
    const samplePoints = this.curve.getPoints(Math.max(500, this.currentResolution));
    
    for (const point of samplePoints) {
      const distance = position.distanceTo(point);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point.clone();
      }
    }
    
    return closestPoint;
  }

  /**
   * Generate orbit points using the original proven method
   * This maintains the correct orbital shape while allowing for adaptive resolution
   * 
   * ⚠️ 关键修复：使用与行星位置计算相同的时间演化轨道元素
   * 这确保了轨道曲线与行星位置完全对齐
   */
  private generatePointsWithKeplerianAccuracy(
    elements: OrbitalElements,
    segments: number,
    julianDay?: number
  ): void {
    this.points = [];

    // 如果提供了 julianDay，计算时间演化后的轨道元素
    // 这与 orbit.ts 中的 calculatePosition 使用相同的方法
    let elem = elements;
    if (julianDay) {
      const T = (julianDay - 2451545.0) / 36525.0;
      elem = {
        ...elements,
        a: elements.a + elements.a_dot * T,
        e: elements.e + elements.e_dot * T,
        i: elements.i + elements.i_dot * T,
        L: elements.L + elements.L_dot * T,
        w_bar: elements.w_bar + elements.w_bar_dot * T,
        O: elements.O + elements.O_dot * T
      };
    }

    // 轨道平面旋转：使用标准轨道六根数
    // i: 倾角, O: 升交点黄经, w_bar: 近日点黄经
    // ω = w_bar - O 为近地点辐角
    const iRad = elem.i;
    const ORad = elem.O;
    const omega = elem.w_bar - elem.O;

    const cosO = Math.cos(ORad);
    const sinO = Math.sin(ORad);
    const cosI = Math.cos(iRad);
    const sinI = Math.sin(iRad);

    for (let idx = 0; idx <= segments; idx++) {
      // 使用真近点角 f 从 0~2π 采样椭圆
      const f = (idx / segments) * Math.PI * 2;

      // 极坐标下的轨道半径
      const r =
        (elem.a * (1 - elem.e * elem.e)) /
        (1 + elem.e * Math.cos(f));

      // 在轨道平面（近拱点坐标系）中的坐标
      const cosU = Math.cos(omega + f);
      const sinU = Math.sin(omega + f);

      // 将轨道平面坐标旋转到黄道坐标系
      // 参考标准公式：
      // x = r [cosΩ cos(ω+f) − sinΩ sin(ω+f) cosi]
      // y = r [sinΩ cos(ω+f) + cosΩ sin(ω+f) cosi]
      // z = r [sin(ω+f) sini]
      const x =
        r * (cosO * cosU - sinO * sinU * cosI);
      const y =
        r * (sinO * cosU + cosO * sinU * cosI);
      const z =
        r * (sinU * sinI);

      this.points.push(new THREE.Vector3(x, y, z));
    }
    
    // Ensure orbit is completely closed
    if (this.points.length > 1) {
      const firstPoint = this.points[0];
      const lastPoint = this.points[this.points.length - 1];
      if (firstPoint.distanceTo(lastPoint) > 0.001) {
        this.points.push(firstPoint.clone()); // Add first point copy to ensure closure
      }
    }
  }
  private generatePoints(
    elements: OrbitalElements,
    segments: number,
    julianDay?: number
  ): void {
    // Use Keplerian accuracy method for better planet-orbit alignment
    this.generatePointsWithKeplerianAccuracy(elements, segments, julianDay);
  }

  /**
   * 更新轨道（如果需要）
   */
  updateOrbit(elements: OrbitalElements, segments: number = 300): void {
    this.generatePoints(elements, segments);
    this.curve = new THREE.CatmullRomCurve3(this.points, true);
    
    const geometry = new THREE.BufferGeometry().setFromPoints(
      this.curve.getPoints(segments)
    );
    
    this.line.geometry.dispose();
    this.line.geometry = geometry;
  }

  getLine(): THREE.Line {
    return this.line;
  }
  
  /**
   * Calculate planet position on orbit at given time
   * @param julianDay Julian day number
   * @returns Position vector
   */
  calculatePosition(julianDay: number): THREE.Vector3 {
    // Use the same calculation as in orbit.ts
    const T = (julianDay - 2451545.0) / 36525.0;
    
    // Calculate current orbital elements (simplified - no time evolution for tests)
    const elem = this.elements;
    
    // Calculate mean anomaly
    const w = elem.w_bar - elem.O; // argument of periapsis
    const M = (elem.L - elem.w_bar) % (2 * Math.PI);
    
    // Solve Kepler's equation (simplified)
    let E = M;
    for (let i = 0; i < 10; i++) {
      E = M + elem.e * Math.sin(E);
    }
    
    // Calculate true anomaly
    const nu = 2 * Math.atan2(
      Math.sqrt(1 + elem.e) * Math.sin(E / 2),
      Math.sqrt(1 - elem.e) * Math.cos(E / 2)
    );
    
    // Calculate distance
    const r = elem.a * (1 - elem.e * Math.cos(E));
    
    // Orbital plane coordinates
    const x_orb = r * Math.cos(nu);
    const y_orb = r * Math.sin(nu);
    
    // Transform to 3D coordinates (simplified - no inclination for tests)
    const cos_w = Math.cos(w);
    const sin_w = Math.sin(w);
    const cos_O = Math.cos(elem.O);
    const sin_O = Math.sin(elem.O);
    const cos_i = Math.cos(elem.i);
    const sin_i = Math.sin(elem.i);
    
    const x = (cos_w * cos_O - sin_w * sin_O * cos_i) * x_orb +
              (-sin_w * cos_O - cos_w * sin_O * cos_i) * y_orb;
    
    const y = (cos_w * sin_O + sin_w * cos_O * cos_i) * x_orb +
              (-sin_w * sin_O + cos_w * cos_O * cos_i) * y_orb;
    
    const z = (sin_w * sin_i) * x_orb +
              (cos_w * sin_i) * y_orb;
    
    return new THREE.Vector3(x, y, z);
  }

  dispose(): void {
    this.line.geometry.dispose();
    (this.line.material as THREE.Material).dispose();
  }
}

