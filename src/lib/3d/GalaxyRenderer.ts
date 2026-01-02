/**
 * GalaxyRenderer.ts - 银河系渲染器
 * 简单的平面贴图显示
 */

import * as THREE from 'three';
import { GALAXY_CONFIG, SCALE_VIEW_CONFIG, LIGHT_YEAR_TO_AU } from '../config/galaxyConfig';

export class GalaxyRenderer {
  private group: THREE.Group;
  private plane: THREE.Mesh | null = null;
  private currentOpacity = 0;
  private targetOpacity = 0;
  private isVisible = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Galaxy';
    this.group.visible = false;
    this.createPlane();
  }

  private createPlane(): void {
    const cfg = GALAXY_CONFIG;
    const radiusAU = cfg.radius * LIGHT_YEAR_TO_AU * cfg.topViewScale;
    const planeSize = radiusAU * 2;
    
    console.log('[GalaxyRenderer] createPlane 开始执行, 配置:', {
      radius: cfg.radius,
      topViewScale: cfg.topViewScale,
      planeSize,
      texturePath: cfg.topViewTexturePath
    });
    
    const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
    
    const loader = new THREE.TextureLoader();
    loader.load(
      cfg.topViewTexturePath,
      (texture) => {
        console.log('[GalaxyRenderer] 贴图加载成功!');
        
        texture.colorSpace = THREE.SRGBColorSpace;
        
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 1.0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        
        this.plane = new THREE.Mesh(geometry, material);
        this.plane.rotation.x = -Math.PI / 2;
        
        // 太阳系在银河系图片中的位置 (1050, 1490)，图片尺寸 2100x2100
        // 图片中心 (1050, 1050)，太阳系偏移: x=0, y=440 像素
        // 将像素偏移转换为 3D 空间偏移（图片 Y 轴对应 3D Z 轴）
        const imageSize = 2100;
        const sunPixelX = 1050;
        const sunPixelY = 1490;
        const offsetPixelX = sunPixelX - imageSize / 2; // 0
        const offsetPixelY = sunPixelY - imageSize / 2; // 440
        const offsetX = -(offsetPixelX / imageSize) * planeSize;
        const offsetZ = -(offsetPixelY / imageSize) * planeSize;
        this.plane.position.set(offsetX, 0, offsetZ);
        
        this.plane.renderOrder = 40;
        this.group.add(this.plane);
      },
      (progress) => {
        console.log('[GalaxyRenderer] 贴图加载进度:', progress);
      },
      (error) => {
        console.error('[GalaxyRenderer] 贴图加载失败:', error);
      }
    );
  }

  update(cameraDistance: number, deltaTime: number): void {
    this.calculateTargetOpacity(cameraDistance);
    this.currentOpacity += (this.targetOpacity - this.currentOpacity) * Math.min(deltaTime * 1.5, 1);

    const visible = this.currentOpacity > 0.01;
    if (visible !== this.isVisible) {
      this.isVisible = visible;
      this.group.visible = visible;
    }

    if (this.plane) {
      const mat = this.plane.material as THREE.MeshBasicMaterial;
      mat.opacity = this.currentOpacity * GALAXY_CONFIG.topViewOpacity;
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
    if (this.plane) {
      this.plane.geometry.dispose();
      const mat = this.plane.material as THREE.MeshBasicMaterial;
      if (mat.map) mat.map.dispose();
      mat.dispose();
    }
    this.group.clear();
  }
}
