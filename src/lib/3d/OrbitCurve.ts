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

// ==================== 可调参数配置 ====================
// ⚙️ 以下参数可在文件顶部调整，影响轨道显示效果

// ==================== 可调参数配置 ====================
// ⚙️ 以下参数可在文件顶部调整，影响轨道渐变效果

// 轨道渐变配置
const ORBIT_GRADIENT_CONFIG = {
  // 🔧 是否启用渐变效果（从行星位置向运动反方向渐隐）
  enabled: true,
  
  // 🔧 最亮点透明度（行星位置附近，0-1，值越大越亮）
  maxOpacity: 1.0,
  
  // 🔧 最暗点透明度（运动反方向远处，0-1，值越小越透明）
  minOpacity: 0.1,
};

export class OrbitCurve {
  private line: THREE.Line;
  private curve: THREE.CatmullRomCurve3;
  private points: THREE.Vector3[] = [];
  private planetPosition: THREE.Vector3 | null = null; // 行星当前位置（用于计算渐变方向）
  private orbitColor: string; // 保存轨道颜色字符串

  constructor(
    elements: OrbitalElements,
    color: string,
    segments: number = 300,
    julianDay?: number,
    planetPosition?: THREE.Vector3
  ) {
    // 保存轨道颜色和行星位置（确保颜色有默认值）
    this.orbitColor = color || '#ffffff';
    this.planetPosition = planetPosition || null;
    
    // 生成轨道点
    this.generatePoints(elements, segments, julianDay);

    // 创建曲线
    this.curve = new THREE.CatmullRomCurve3(this.points, true); // true = 闭合曲线

    // 创建几何体
    const curvePoints = this.curve.getPoints(segments);
    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);

    // 创建渐变材质（如果启用）
    let material: THREE.LineBasicMaterial;
    
    // 检查是否启用渐变（需要启用配置且有行星位置）
    const shouldUseGradient = ORBIT_GRADIENT_CONFIG.enabled && this.planetPosition;
    
    if (shouldUseGradient) {
      // 单向渐变：从行星当前位置向运动反方向渐隐
      // 计算每个点到行星的距离，距离越远（在运动反方向）越透明
      const vertexCount = curvePoints.length;
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
        const dist = curvePoints[i].distanceTo(planetPos);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }
      
      // 计算运动方向（从当前点到下一个点）
      const nextIdx = (closestIdx + 1) % vertexCount;
      const velocityDir = new THREE.Vector3()
        .subVectors(curvePoints[nextIdx], curvePoints[closestIdx])
        .normalize();
      
      // 计算每个点到行星的距离，以及是否在运动反方向
      const maxDist = Math.max(...curvePoints.map(p => p.distanceTo(planetPos)));
      
      for (let i = 0; i < vertexCount; i++) {
        const point = curvePoints[i];
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
        transparent: true,
        opacity: 1.0,
        linewidth: 1,
      });
    } else {
      // 不使用渐变，使用固定透明度和颜色
      // 解析颜色字符串为 Three.js Color（确保颜色有效）
      const colorToUse = this.orbitColor || '#ffffff';
      const threeColor = new THREE.Color(colorToUse);
      material = new THREE.LineBasicMaterial({
        color: threeColor,
        opacity: 0.4,
        transparent: true,
        linewidth: 1,
      });
    }

    // 创建线条
    this.line = new THREE.Line(geometry, material);
  }
  
  /**
   * 更新行星位置（用于更新渐变方向）
   */
  updatePlanetPosition(position: THREE.Vector3): void {
    this.planetPosition = position;
    
    // 如果启用渐变，更新渐变颜色
    if (ORBIT_GRADIENT_CONFIG.enabled && this.planetPosition && this.line.geometry && this.curve) {
      const geometry = this.line.geometry;
      const curvePoints = this.curve.getPoints(300); // 使用默认分段数
      const vertexCount = curvePoints.length;
      
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
        const dist = curvePoints[i].distanceTo(this.planetPosition);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }
      
      // 计算运动方向
      const nextIdx = (closestIdx + 1) % vertexCount;
      const velocityDir = new THREE.Vector3()
        .subVectors(curvePoints[nextIdx], curvePoints[closestIdx])
        .normalize();
      
      const maxDist = Math.max(...curvePoints.map(p => p.distanceTo(this.planetPosition!)));
      
      // 更新颜色数组
      for (let i = 0; i < vertexCount; i++) {
        const point = curvePoints[i];
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
   * 生成轨道点
   */
  private generatePoints(
    elements: OrbitalElements,
    segments: number,
    julianDay?: number
  ): void {
    this.points = [];

    // 轨道平面旋转：使用标准轨道六根数
    // i: 倾角, O: 升交点黄经, w_bar: 近日点黄经
    // ω = w_bar - O 为近地点辐角
    const iRad = elements.i;
    const ORad = elements.O;
    const omega = elements.w_bar - elements.O;

    const cosO = Math.cos(ORad);
    const sinO = Math.sin(ORad);
    const cosI = Math.cos(iRad);
    const sinI = Math.sin(iRad);

    for (let idx = 0; idx <= segments; idx++) {
      // 使用真近点角 f 从 0~2π 采样椭圆
      const f = (idx / segments) * Math.PI * 2;

      // 极坐标下的轨道半径
      const r =
        (elements.a * (1 - elements.e * elements.e)) /
        (1 + elements.e * Math.cos(f));

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

  dispose(): void {
    this.line.geometry.dispose();
    (this.line.material as THREE.Material).dispose();
  }
}

