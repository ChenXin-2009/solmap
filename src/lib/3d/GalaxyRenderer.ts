/**
 * GalaxyRenderer.ts - 银河系渲染器
 * 使用多层俯视图堆叠模拟银河系的立体厚度，包含翘曲效果和侧视图
 */

import * as THREE from 'three';
import { GALAXY_CONFIG, SCALE_VIEW_CONFIG, LIGHT_YEAR_TO_AU } from '../config/galaxyConfig';

export class GalaxyRenderer {
  private group: THREE.Group;
  private topPlanes: THREE.Mesh[] = [];
  private sidePlanes: THREE.Mesh[] = [];
  private currentOpacity = 0;
  private targetOpacity = 0;
  private isVisible = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Galaxy';
    this.group.visible = false;
    
    // 银河系平面相对于黄道面的旋转（从配置读取）
    const cfg = GALAXY_CONFIG;
    this.group.rotation.order = 'YXZ';
    this.group.rotation.x = cfg.rotationX * (Math.PI / 180);
    this.group.rotation.y = cfg.rotationY * (Math.PI / 180);
    this.group.rotation.z = cfg.rotationZ * (Math.PI / 180);
    
    this.createLayeredPlanes();
    this.createSidePlanes();
  }

  private createLayeredPlanes(): void {
    const cfg = GALAXY_CONFIG;
    const radiusAU = cfg.radius * LIGHT_YEAR_TO_AU * cfg.topViewScale;
    const planeSize = radiusAU * 2;
    const thicknessAU = cfg.layerThicknessLY * LIGHT_YEAR_TO_AU;
    
    // 太阳系在银河系图片中的位置偏移
    const imageSize = 2100;
    const sunPixelX = 1050;
    const sunPixelY = 1490;
    const offsetPixelX = sunPixelX - imageSize / 2;
    const offsetPixelY = sunPixelY - imageSize / 2;
    const offsetX = -(offsetPixelX / imageSize) * planeSize;
    const offsetZ = -(offsetPixelY / imageSize) * planeSize;
    
    // 使用固定种子的伪随机数生成器
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    
    const loader = new THREE.TextureLoader();
    
    loader.load(cfg.topViewTexturePath, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      
      for (let i = 0; i < cfg.layerCount; i++) {
        const layerCount = cfg.layerCount;
        const t = layerCount === 1 ? 0.5 : i / (layerCount - 1);
        const distFromCenterLayer = Math.abs(t - 0.5) * 2;
        
        const maxBulge = thicknessAU * cfg.bulgeFactor;
        const layerBulge = distFromCenterLayer * maxBulge;
        
        const jitterAmount = cfg.layerJitter * (thicknessAU / layerCount);
        const layerJitter = (seededRandom(i * 7.31) - 0.5) * 2 * jitterAmount;
        
        const segments = 64;
        const geometry = new THREE.PlaneGeometry(planeSize, planeSize, segments, segments);
        const posAttr = geometry.attributes.position;
        
        // 翘曲参数
        const warpAngleRad = cfg.warpAngle * (Math.PI / 180);
        const warpAmplitudeAU = cfg.warpAmplitude * radiusAU;
        
        for (let j = 0; j < posAttr.count; j++) {
          const x = posAttr.getX(j);
          const y = posAttr.getY(j);
          
          const radius = planeSize / 2;
          const distToCenter = Math.sqrt(x * x + y * y) / radius;
          
          // 银河系形状
          const scaledDist = distToCenter / cfg.coreRadius;
          const sechSquared = 1 / Math.pow(Math.cosh(scaledDist), 2);
          const edgeFalloff = Math.max(0, 1 - Math.pow(distToCenter, cfg.bulgeExponent));
          const minThickness = cfg.diskMinThickness;
          const coreContribution = sechSquared * cfg.coreThicknessFactor;
          const diskContribution = minThickness;
          const bulgeFactor = (coreContribution + diskContribution) * edgeFalloff;
          const bulge = bulgeFactor * layerBulge;
          
          // 翘曲效果：边缘一侧向上，另一侧向下
          let warp = 0;
          if (cfg.warpEnabled && distToCenter > cfg.warpStartRadius) {
            const warpProgress = (distToCenter - cfg.warpStartRadius) / (1 - cfg.warpStartRadius);
            const angle = Math.atan2(y, x);
            // 翘曲随角度变化，形成 S 形
            warp = Math.sin(angle - warpAngleRad) * warpProgress * warpProgress * warpAmplitudeAU;
          }
          
          const direction = t < 0.5 ? 1 : (t > 0.5 ? -1 : 0);
          const vertexJitter = (seededRandom(i * 13.7 + j * 0.01) - 0.5) * jitterAmount * 0.5;
          posAttr.setZ(j, bulge * direction + warp + layerJitter + vertexJitter);
        }
        
        geometry.computeVertexNormals();
        
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: cfg.layerOpacity,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        
        const plane = new THREE.Mesh(geometry, material);
        plane.rotation.x = -Math.PI / 2;
        plane.position.set(offsetX, 0, offsetZ);
        plane.renderOrder = 40 - i;
        
        this.topPlanes.push(plane);
        this.group.add(plane);
      }
    });
  }

  private createSidePlanes(): void {
    const cfg = GALAXY_CONFIG;
    if (!cfg.sideViewEnabled) return;
    
    const radiusAU = cfg.radius * LIGHT_YEAR_TO_AU * cfg.topViewScale;
    const planeWidth = radiusAU * 2;
    
    // 侧视图尺寸：5000x1593
    const sideImageWidth = 5000;
    const sideImageHeight = 1593;
    const planeHeight = planeWidth * (sideImageHeight / sideImageWidth);
    
    // 太阳系偏移
    const topImageSize = 2100;
    const sunPixelY = 1490;
    const sunOffsetRatio = (sunPixelY - topImageSize / 2) / topImageSize;
    const sunOffsetZ = -sunOffsetRatio * planeWidth;
    
    const loader = new THREE.TextureLoader();
    
    loader.load(cfg.sideViewTexturePath, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      
      for (let i = 0; i < cfg.sideViewCount; i++) {
        const angle = (i / cfg.sideViewCount) * Math.PI;
        
        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: cfg.sideViewOpacity,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        
        const plane = new THREE.Mesh(geometry, material);
        plane.rotation.y = angle;
        plane.position.set(0, 0, sunOffsetZ);
        plane.renderOrder = 39;
        
        this.sidePlanes.push(plane);
        this.group.add(plane);
      }
    });
  }

  update(cameraDistance: number, deltaTime: number): void {
    this.calculateTargetOpacity(cameraDistance);
    this.currentOpacity += (this.targetOpacity - this.currentOpacity) * Math.min(deltaTime * 1.5, 1);

    const visible = this.currentOpacity > 0.01;
    if (visible !== this.isVisible) {
      this.isVisible = visible;
      this.group.visible = visible;
    }

    const cfg = GALAXY_CONFIG;
    for (const plane of this.topPlanes) {
      const mat = plane.material as THREE.MeshBasicMaterial;
      mat.opacity = this.currentOpacity * cfg.topViewOpacity * cfg.layerOpacity;
    }
    
    for (const plane of this.sidePlanes) {
      const mat = plane.material as THREE.MeshBasicMaterial;
      mat.opacity = this.currentOpacity * cfg.sideViewOpacity;
    }
  }

  private calculateTargetOpacity(dist: number): void {
    const cfg = SCALE_VIEW_CONFIG;
    if (dist < cfg.galaxyShowStart) this.targetOpacity = 0;
    else if (dist < cfg.galaxyShowFull) this.targetOpacity = (dist - cfg.galaxyShowStart) / (cfg.galaxyShowFull - cfg.galaxyShowStart);
    else this.targetOpacity = 1;
  }

  getGroup(): THREE.Group { return this.group; }
  getOpacity(): number { return this.currentOpacity; }
  getIsVisible(): boolean { return this.isVisible; }

  dispose(): void {
    for (const plane of this.topPlanes) {
      plane.geometry.dispose();
      const mat = plane.material as THREE.MeshBasicMaterial;
      if (mat.map) mat.map.dispose();
      mat.dispose();
    }
    for (const plane of this.sidePlanes) {
      plane.geometry.dispose();
      const mat = plane.material as THREE.MeshBasicMaterial;
      if (mat.map) mat.map.dispose();
      mat.dispose();
    }
    this.topPlanes = [];
    this.sidePlanes = [];
    this.group.clear();
  }
}
