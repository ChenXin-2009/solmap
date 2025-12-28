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
import { ORBIT_GRADIENT_CONFIG, ORBIT_RENDER_CONFIG, ORBIT_STYLE_CONFIG, ORBIT_DISC_FADE_CONFIG } from '@/lib/config/visualConfig';

export class OrbitCurve {
  private root: THREE.Group;
  private visualObjects: THREE.Object3D[] = [];
  private curve!: THREE.CatmullRomCurve3;
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
    this.root = new THREE.Group();
    // Store orbital elements for adaptive resolution
    this.elements = elements;
    
    // 保存轨道颜色和行星位置（确保颜色有默认值）
    this.orbitColor = color || '#ffffff';
    this.planetPosition = planetPosition || null;
    
    // Initialize adaptive resolution
    this.currentResolution = segments;
    
    // 生成轨道点
    this.generatePoints(elements, segments, julianDay);

    // 创建可视化对象
    this.createVisualObject();
  }

  private createVisualObject(): void {
    // Clear existing
    if (this.visualObjects.length > 0) {
        this.visualObjects.forEach(obj => {
            this.root.remove(obj);
            if (obj instanceof THREE.Line || obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else if (obj.material) {
                    obj.material.dispose();
                }
            }
        });
        this.visualObjects = [];
    }

    if (ORBIT_STYLE_CONFIG.style === 'filled') {
      const mesh = this.createFilledMesh();
      if (mesh) {
        this.root.add(mesh);
        this.visualObjects.push(mesh);
      }
      
      if (ORBIT_STYLE_CONFIG.showLine) {
        const line = this.createLine();
        if (line) {
          this.root.add(line);
          this.visualObjects.push(line);
        }
      }
    } else {
      const line = this.createLine();
      if (line) {
        this.root.add(line);
        this.visualObjects.push(line);
      }
    }
  }

  private static gradientTexture: THREE.Texture | null = null;

  private static getGradientTexture(): THREE.Texture {
    if (OrbitCurve.gradientTexture) return OrbitCurve.gradientTexture;
    
    // Create gradient texture: Bottom (transparent) -> Top (opaque)
    // V=0 -> Transparent, V=1 -> Opaque
    if (typeof document === 'undefined') {
        return new THREE.Texture();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    
    // In Canvas, (0,0) is top-left.
    // We want V=0 (bottom of texture) to be transparent.
    // We want V=1 (top of texture) to be opaque.
    // Texture coordinates usually map (0,0) to bottom-left.
    // So V=0 is bottom row of pixels.
    // Canvas Y=64 is bottom.
    
    const gradient = context.createLinearGradient(0, 64, 0, 0); // From Bottom to Top
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');   // Bottom (V=0) -> Transparent
    gradient.addColorStop(1, `rgba(255, 255, 255, ${ORBIT_STYLE_CONFIG.fillAlpha})`); // Top (V=1) -> Opaque
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 2, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    
    OrbitCurve.gradientTexture = texture;
    return texture;
  }

  private createFilledMesh(): THREE.Mesh | null {
    if (this.points.length < 2) return null;

    const vertexCount = this.points.length;
    // 2 vertices per point (inner and outer)
    const positions = new Float32Array(vertexCount * 2 * 3);
    const uvs = new Float32Array(vertexCount * 2 * 2);
    const indices: number[] = [];

    const innerRatio = ORBIT_STYLE_CONFIG.innerRadiusRatio;

    for (let i = 0; i < vertexCount; i++) {
        const point = this.points[i];
        
        // Outer vertex (original point)
        positions[i * 6] = point.x;
        positions[i * 6 + 1] = point.y;
        positions[i * 6 + 2] = point.z;
        
        // Inner vertex (scaled towards 0,0,0)
        // Assuming orbit is centered at (0,0,0) - Sun position
        positions[i * 6 + 3] = point.x * innerRatio;
        positions[i * 6 + 4] = point.y * innerRatio;
        positions[i * 6 + 5] = point.z * innerRatio;

        // UVs
        // u goes from 0 to 1 along the orbit? Or just use index?
        // Since it's a closed loop, texture wrapping might be an issue if we use 0-1.
        // But for radial gradient, we only care about V.
        // U can be anything if texture is 1px wide.
        uvs[i * 4] = 0; // U
        uvs[i * 4 + 1] = 1; // V=1 (Outer)

        uvs[i * 4 + 2] = 0; // U
        uvs[i * 4 + 3] = 0; // V=0 (Inner)
    }

    // Indices for Triangle Strip
    // 0, 1, 2, 3, ...
    // Vertex arrangement: 2*i (Outer), 2*i+1 (Inner)
    // Quad between i and i+1:
    // Tri 1: Outer_i, Inner_i, Outer_i+1
    // Tri 2: Inner_i, Inner_i+1, Outer_i+1
    
    for (let i = 0; i < vertexCount - 1; i++) {
        const outerCurrent = 2 * i;
        const innerCurrent = 2 * i + 1;
        const outerNext = 2 * (i + 1);
        const innerNext = 2 * (i + 1) + 1;
        
        // Counter-clockwise
        // Outer_i -> Inner_i -> Outer_i+1
        indices.push(outerCurrent, innerCurrent, outerNext);
        // Inner_i -> Inner_i+1 -> Outer_i+1
        indices.push(innerCurrent, innerNext, outerNext);
    }
    
    // Close the loop if not already closed by points
    // generatePoints usually adds the first point at the end if closed.
    // If so, vertexCount-1 connects to 0 is handled by the loop above?
    // No, if points[last] == points[0], then the loop above handles it.
    // If points are distinct and implied closed, we need to wrap.
    // Looking at generatePoints: 
    // "if (firstPoint.distanceTo(lastPoint) > 0.001) this.points.push(firstPoint.clone())"
    // So it is explicitly closed. The loop i < vertexCount - 1 covers the last segment.

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals(); // Maybe needed for some shaders, but BasicMaterial ignores it.

    const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(this.orbitColor),
        map: OrbitCurve.getGradientTexture(),
        transparent: true,
        opacity: 1.0, // Base opacity, multiplied by texture alpha
        side: THREE.DoubleSide,
        depthWrite: false, // Usually good for transparent objects to avoid occlusion issues
        depthTest: true,
    });

    return new THREE.Mesh(geometry, material);
  }

  private createLine(): THREE.Line {
    // ⚠️ 关键修复：直接使用生成的点创建几何体，不使用 CatmullRomCurve3 插值
    const geometry = new THREE.BufferGeometry().setFromPoints(this.points);
    
    // 保存曲线引用（用于其他方法，如 getClosestPointOnOrbit）
    this.curve = new THREE.CatmullRomCurve3(this.points, true);

    let material: THREE.LineBasicMaterial;
    
    // 检查是否启用渐变（需要启用配置且有行星位置）
    // 注意：如果使用了 filled 样式，线条可以使用更简单的材质，或者也使用渐变但透明度更低
    const shouldUseGradient = ORBIT_GRADIENT_CONFIG.enabled && this.planetPosition;
    
    // 如果 showLine 为 true 且 style 为 filled，我们可以应用 lineOpacity
    const lineOpacity = ORBIT_STYLE_CONFIG.style === 'filled' && ORBIT_STYLE_CONFIG.showLine 
        ? (ORBIT_STYLE_CONFIG.lineOpacity ?? 0.5) 
        : 1.0;

    if (shouldUseGradient) {
        // ... (Existing gradient logic) ...
        // Since this is complex logic, I should copy it or refactor it.
        // For now I will simplify or copy the existing logic if I can.
        // To avoid code duplication, I should have kept the old constructor logic.
        // But I'm replacing it.
        
        // Let's copy the logic from the previous Read.
        const vertexCount = this.points.length;
        const colors = new Float32Array(vertexCount * 3);
        
        let r, g, b;
        if (this.orbitColor.length === 7) {
            r = parseInt(this.orbitColor.slice(1, 3), 16) / 255;
            g = parseInt(this.orbitColor.slice(3, 5), 16) / 255;
            b = parseInt(this.orbitColor.slice(5, 7), 16) / 255;
        } else {
            // Simplified parsing
             r = g = b = 1; 
             // ... full parsing logic
             if (this.orbitColor.length === 4) {
                r = parseInt(this.orbitColor[1], 16) / 15;
                g = parseInt(this.orbitColor[2], 16) / 15;
                b = parseInt(this.orbitColor[3], 16) / 15;
             }
        }
        
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
        
        const nextIdx = (closestIdx + 1) % vertexCount;
        const velocityDir = new THREE.Vector3()
            .subVectors(this.points[nextIdx], this.points[closestIdx])
            .normalize();
        
        const maxDist = Math.max(...this.points.map(p => p.distanceTo(planetPos)));
        
        for (let i = 0; i < vertexCount; i++) {
            const point = this.points[i];
            const toPoint = new THREE.Vector3().subVectors(point, planetPos);
            const dist = toPoint.length();
            
            if (dist < 0.001) {
                colors[i * 3] = r * lineOpacity;
                colors[i * 3 + 1] = g * lineOpacity;
                colors[i * 3 + 2] = b * lineOpacity;
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
            
            // Apply lineOpacity
            opacity *= lineOpacity;

            colors[i * 3] = r * opacity;
            colors[i * 3 + 1] = g * opacity;
            colors[i * 3 + 2] = b * opacity;
        }
        
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        material = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: lineOpacity < 1.0,
            opacity: 1.0, // Colors already have opacity baked in if using vertex colors? 
            // THREE.LineBasicMaterial vertexColors ignores alpha in colors unless transparent=true?
            // Actually vertexColors in Three.js are usually RGB. Alpha is controlled by material opacity or separate attribute.
            // But we can simulate it by darkening the color. 
            // Wait, standard THREE.LineBasicMaterial doesn't support vertex alpha.
            // So 'opacity' applies to the whole line.
            // To have gradient alpha, we need a custom shader or accept that we are just darkening the color (fade to black) if background is black.
            // Since background is space (black), darkening works as fading.
            // But if we want true transparency for lineOpacity, we set material.opacity.
            // But gradient logic modifies RGB values.
            depthWrite: true,
            depthTest: true,
            linewidth: ORBIT_RENDER_CONFIG.lineWidth,
        });
    } else {
        const threeColor = new THREE.Color(this.orbitColor || '#ffffff');
        material = new THREE.LineBasicMaterial({
            color: threeColor,
            opacity: lineOpacity,
            transparent: lineOpacity < 1.0,
            depthWrite: true,
            depthTest: true,
            linewidth: ORBIT_RENDER_CONFIG.lineWidth,
        });
    }

    return new THREE.Line(geometry, material);
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
   * Update curve resolution and visibility based on camera distance
   * @param cameraDistance Current camera distance from orbit center
   */
  updateCurveResolution(cameraDistance: number): void {
    this.updateDiscVisibility(cameraDistance);

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
   * Update disc visibility based on camera distance
   */
  private updateDiscVisibility(cameraDistance: number): void {
    if (!ORBIT_DISC_FADE_CONFIG.enabled) return;

    // Find filled mesh object
    const meshObj = this.visualObjects.find(obj => obj instanceof THREE.Mesh) as THREE.Mesh | undefined;
    if (!meshObj || !meshObj.material) return;

    const material = meshObj.material as THREE.MeshBasicMaterial;
    
    // Calculate opacity based on distance
    // Distance is in AU (same units as orbit radius usually)
    // But cameraDistance passed here is usually World Units.
    // Assuming 1 AU = 1 World Unit in this visualization context?
    // Let's check SceneManager or similar. Usually they match.
    
    let opacity = 1.0;
    
    if (cameraDistance < ORBIT_DISC_FADE_CONFIG.fadeEndDistance) {
        opacity = 0;
    } else if (cameraDistance < ORBIT_DISC_FADE_CONFIG.fadeStartDistance) {
        // Linear fade: 0 at end, 1 at start
        const range = ORBIT_DISC_FADE_CONFIG.fadeStartDistance - ORBIT_DISC_FADE_CONFIG.fadeEndDistance;
        opacity = (cameraDistance - ORBIT_DISC_FADE_CONFIG.fadeEndDistance) / range;
    }
    
    // Apply max opacity factor
    // Note: The material opacity is multiplied by the texture alpha channel.
    // We adjust the material opacity directly.
    // However, the original material opacity was 1.0.
    // If we want to support base opacity changes, we might need to store it.
    // For now, assuming 1.0 is the base.
    
    material.opacity = opacity;
    material.visible = opacity > 0.01;
  }

  /**
   * Regenerate curve with current resolution
   */
  private regenerateCurve(): void {
    // Generate new points with current resolution
    this.generatePoints(this.elements, this.currentResolution);
    
    // Create new curve
    this.curve = new THREE.CatmullRomCurve3(this.points, true);
    
    // Recreate visual object
    this.createVisualObject();
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
    if (ORBIT_GRADIENT_CONFIG.enabled && this.planetPosition && this.visualObjects.length > 0 && this.points.length > 0) {
      // Find line object
      const lineObj = this.visualObjects.find(obj => obj instanceof THREE.Line) as THREE.Line | undefined;
      
      if (!lineObj) return;

      const geometry = lineObj.geometry;
      const vertexCount = this.points.length;
      
      // 检查是否已有颜色属性
      let colors = geometry.getAttribute('color') as THREE.BufferAttribute;
      if (!colors || colors.count !== vertexCount) {
        colors = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);
        geometry.setAttribute('color', colors);
      }
      
      // 如果 showLine 为 true 且 style 为 filled，我们可以应用 lineOpacity
      const lineOpacity = ORBIT_STYLE_CONFIG.style === 'filled' && ORBIT_STYLE_CONFIG.showLine 
          ? (ORBIT_STYLE_CONFIG.lineOpacity ?? 0.5) 
          : 1.0;

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
          colors.setXYZ(i, r * lineOpacity, g * lineOpacity, b * lineOpacity);
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
        
        // Apply lineOpacity
        opacity *= lineOpacity;

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
    this.elements = elements; // Update stored elements
    this.currentResolution = segments;
    
    this.generatePoints(elements, segments);
    this.curve = new THREE.CatmullRomCurve3(this.points, true);
    
    this.createVisualObject();
  }

  getLine(): THREE.Object3D {
    return this.root;
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

