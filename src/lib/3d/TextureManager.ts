/**
 * TextureManager.ts - 行星贴图管理器
 * 
 * Render Layer 私有单例服务，负责：
 * - 加载和缓存行星表面贴图
 * - 管理贴图引用计数
 * - 控制 GPU 资源释放
 * 
 * CRITICAL: 
 * - 此类仅供 Render Layer 使用
 * - 禁止被 Physical Layer 模块导入
 * - 贴图不参与任何物理计算
 * 
 * @see .kiro/specs/planet-texture-system/requirements.md
 */

import * as THREE from 'three';
import { 
  PLANET_TEXTURE_CONFIG, 
  TEXTURE_MANAGER_CONFIG,
  type PlanetTextureConfig 
} from '@/lib/config/visualConfig';

/**
 * 贴图加载状态枚举
 */
export enum TextureLoadState {
  NOT_STARTED = 'not_started',
  LOADING = 'loading',
  LOADED = 'loaded',
  FAILED = 'failed',
}

/**
 * 贴图缓存条目
 */
export interface TextureCacheEntry {
  /** 加载的贴图实例（加载失败时为 null） */
  texture: THREE.Texture | null;
  /** 当前加载状态 */
  state: TextureLoadState;
  /** 引用计数 */
  refCount: number;
  /** 加载失败时的错误信息 */
  error?: Error;
  /** 加载 Promise（用于等待加载完成） */
  loadPromise?: Promise<THREE.Texture | null>;
}

/**
 * 规范化 BodyId
 * 确保与 Physical Layer 定义一致（小写、去空格）
 * 
 * @param bodyId - 原始 BodyId
 * @returns 规范化后的 BodyId
 */
export function normalizeBodyId(bodyId: string): string {
  return bodyId.toLowerCase().trim();
}

/**
 * TextureManager - 行星贴图管理器单例
 * 
 * CRITICAL: Render Layer Private Service
 * - 不暴露构造函数
 * - 通过 getInstance() 获取单例
 * - 禁止被 Physical Layer 导入
 */
export class TextureManager {
  /** 单例实例 */
  private static instance: TextureManager | null = null;
  
  /** 贴图缓存 Map: path → TextureCacheEntry */
  private cache: Map<string, TextureCacheEntry> = new Map();
  
  /** BodyId → path 映射缓存（避免重复查找配置） */
  private bodyIdToPath: Map<string, string | null> = new Map();
  
  /** Three.js TextureLoader 实例 */
  private textureLoader: THREE.TextureLoader;
  
  /** 是否已销毁 */
  private disposed: boolean = false;

  /**
   * 私有构造函数 - 禁止外部实例化
   */
  private constructor() {
    this.textureLoader = new THREE.TextureLoader();
  }

  /**
   * 获取 TextureManager 单例实例
   * 
   * @returns TextureManager 单例
   */
  public static getInstance(): TextureManager {
    if (!TextureManager.instance) {
      TextureManager.instance = new TextureManager();
    }
    return TextureManager.instance;
  }

  /**
   * 重置单例（仅用于测试）
   */
  public static resetInstance(): void {
    if (TextureManager.instance) {
      TextureManager.instance.disposeAll();
      TextureManager.instance = null;
    }
  }

  /**
   * 获取 BodyId 对应的贴图路径
   * 
   * @param bodyId - 天体 ID（必须来自 Physical Layer）
   * @returns 贴图路径或 null（无配置）
   */
  private getTexturePath(bodyId: string): string | null {
    const normalized = normalizeBodyId(bodyId);
    
    // 检查缓存
    if (this.bodyIdToPath.has(normalized)) {
      return this.bodyIdToPath.get(normalized) ?? null;
    }
    
    // 查找配置
    const config = PLANET_TEXTURE_CONFIG[normalized];
    const path = config?.baseColor ?? null;
    
    // 缓存结果
    this.bodyIdToPath.set(normalized, path);
    
    return path;
  }

  /**
   * 获取 BodyId 对应的夜间贴图路径
   * 
   * @param bodyId - 天体 ID
   * @returns 夜间贴图路径或 null（无配置）
   */
  private getNightTexturePath(bodyId: string): string | null {
    const normalized = normalizeBodyId(bodyId);
    const config = PLANET_TEXTURE_CONFIG[normalized];
    return config?.nightMap ?? null;
  }

  /**
   * 异步获取天体夜间贴图
   * 
   * @param bodyId - 天体 ID
   * @returns Promise 解析为 THREE.Texture 或 null
   */
  public async getNightTexture(bodyId: string): Promise<THREE.Texture | null> {
    if (this.disposed) {
      this.log('warn', 'TextureManager is disposed, cannot get night texture');
      return null;
    }
    
    if (!TEXTURE_MANAGER_CONFIG.enabled) {
      return null;
    }
    
    const path = this.getNightTexturePath(bodyId);
    if (!path) {
      // 无夜间贴图配置
      return null;
    }
    
    // 检查缓存
    const cached = this.cache.get(path);
    if (cached) {
      cached.refCount++;
      
      if (cached.state === TextureLoadState.LOADED) {
        return cached.texture;
      }
      
      if (cached.state === TextureLoadState.FAILED) {
        return null;
      }
      
      if (cached.state === TextureLoadState.LOADING && cached.loadPromise) {
        return cached.loadPromise;
      }
    }
    
    return this.loadTexture(path);
  }

  /**
   * 异步获取天体贴图
   * 
   * @param bodyId - 天体 ID（必须来自 Physical Layer StateVector/BodyHierarchy）
   * @returns Promise 解析为 THREE.Texture 或 null（回退到纯色）
   */
  public async getTexture(bodyId: string): Promise<THREE.Texture | null> {
    if (this.disposed) {
      this.log('warn', 'TextureManager is disposed, cannot get texture');
      return null;
    }
    
    if (!TEXTURE_MANAGER_CONFIG.enabled) {
      return null;
    }
    
    const path = this.getTexturePath(bodyId);
    if (!path) {
      // 无配置 - 使用纯色回退（不是错误）
      return null;
    }
    
    // 检查缓存
    const cached = this.cache.get(path);
    if (cached) {
      // 增加引用计数
      cached.refCount++;
      
      // 如果已加载，直接返回
      if (cached.state === TextureLoadState.LOADED) {
        return cached.texture;
      }
      
      // 如果加载失败，返回 null
      if (cached.state === TextureLoadState.FAILED) {
        return null;
      }
      
      // 如果正在加载，等待加载完成
      if (cached.state === TextureLoadState.LOADING && cached.loadPromise) {
        return cached.loadPromise;
      }
    }
    
    // 创建新的缓存条目并开始加载
    return this.loadTexture(path);
  }

  /**
   * 同步检查贴图是否已加载
   * 
   * @param bodyId - 天体 ID
   * @returns 是否已加载
   */
  public hasTexture(bodyId: string): boolean {
    const path = this.getTexturePath(bodyId);
    if (!path) return false;
    
    const cached = this.cache.get(path);
    return cached?.state === TextureLoadState.LOADED && cached.texture !== null;
  }

  /**
   * 同步获取已缓存的贴图
   * 
   * @param bodyId - 天体 ID
   * @returns 已缓存的贴图或 null
   */
  public getCachedTexture(bodyId: string): THREE.Texture | null {
    const path = this.getTexturePath(bodyId);
    if (!path) return null;
    
    const cached = this.cache.get(path);
    if (cached?.state === TextureLoadState.LOADED) {
      return cached.texture;
    }
    return null;
  }

  /**
   * 释放贴图引用
   * 
   * 注意：实际 GPU 资源释放由引用计数控制
   * 只有当 refCount 降为 0 时才释放 GPU 资源
   * 
   * @param bodyId - 天体 ID
   */
  public releaseTexture(bodyId: string): void {
    const path = this.getTexturePath(bodyId);
    if (!path) return;
    
    const cached = this.cache.get(path);
    if (!cached) return;
    
    cached.refCount--;
    
    // 当引用计数降为 0 时，释放 GPU 资源
    if (cached.refCount <= 0) {
      this.disposeTexture(path);
    }
  }

  /**
   * 释放所有贴图资源
   * 
   * 用于应用关闭时的清理
   */
  public disposeAll(): void {
    this.log('info', 'Disposing all textures');
    
    for (const [path, entry] of this.cache.entries()) {
      if (entry.texture) {
        entry.texture.dispose();
        this.log('debug', `Disposed texture: ${path}`);
      }
    }
    
    this.cache.clear();
    this.bodyIdToPath.clear();
    this.disposed = true;
  }

  /**
   * 获取缓存统计信息（用于调试）
   */
  public getCacheStats(): {
    totalEntries: number;
    loadedCount: number;
    failedCount: number;
    loadingCount: number;
    totalRefCount: number;
  } {
    let loadedCount = 0;
    let failedCount = 0;
    let loadingCount = 0;
    let totalRefCount = 0;
    
    for (const entry of this.cache.values()) {
      totalRefCount += entry.refCount;
      switch (entry.state) {
        case TextureLoadState.LOADED:
          loadedCount++;
          break;
        case TextureLoadState.FAILED:
          failedCount++;
          break;
        case TextureLoadState.LOADING:
          loadingCount++;
          break;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      loadedCount,
      failedCount,
      loadingCount,
      totalRefCount,
    };
  }

  /**
   * 加载贴图
   * 
   * @param path - 贴图路径
   * @returns Promise 解析为贴图或 null
   */
  private loadTexture(path: string): Promise<THREE.Texture | null> {
    // 创建缓存条目
    const entry: TextureCacheEntry = {
      texture: null,
      state: TextureLoadState.LOADING,
      refCount: 1,
    };
    
    // 创建加载 Promise
    const loadPromise = new Promise<THREE.Texture | null>((resolve) => {
      this.log('info', `Loading texture: ${path}`);
      
      this.textureLoader.load(
        path,
        // 成功回调
        (texture) => {
          entry.texture = texture;
          entry.state = TextureLoadState.LOADED;
          this.log('info', `Texture loaded: ${path}`);
          resolve(texture);
        },
        // 进度回调（可选）
        undefined,
        // 错误回调
        (error) => {
          entry.state = TextureLoadState.FAILED;
          entry.error = error instanceof Error ? error : new Error(String(error));
          this.log('error', `Failed to load texture: ${path}`, entry.error);
          resolve(null);
        }
      );
    });
    
    entry.loadPromise = loadPromise;
    this.cache.set(path, entry);
    
    return loadPromise;
  }

  /**
   * 释放单个贴图的 GPU 资源
   * 
   * @param path - 贴图路径
   */
  private disposeTexture(path: string): void {
    const entry = this.cache.get(path);
    if (!entry) return;
    
    if (entry.texture) {
      entry.texture.dispose();
      this.log('debug', `Disposed texture: ${path}`);
    }
    
    this.cache.delete(path);
  }

  /**
   * 日志输出
   * 
   * @param level - 日志级别
   * @param message - 日志消息
   * @param error - 可选错误对象
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, error?: Error): void {
    if (!TEXTURE_MANAGER_CONFIG.debugLogging && level !== 'error') {
      return;
    }
    
    const prefix = '[TextureManager]';
    switch (level) {
      case 'debug':
        console.debug(prefix, message);
        break;
      case 'info':
        console.info(prefix, message);
        break;
      case 'warn':
        console.warn(prefix, message);
        break;
      case 'error':
        console.error(prefix, message, error);
        break;
    }
  }
}
