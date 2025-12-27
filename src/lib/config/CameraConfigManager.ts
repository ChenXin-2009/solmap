/**
 * 相机配置管理器 - 支持实时配置更新
 */

import { QUICK_CAMERA_SETTINGS } from './cameraConfig';

export type CameraConfigType = typeof QUICK_CAMERA_SETTINGS;

class CameraConfigManager {
  private config: CameraConfigType;
  private listeners: Set<(config: CameraConfigType) => void> = new Set();

  constructor() {
    // 初始化为默认配置
    this.config = { ...QUICK_CAMERA_SETTINGS };
    
    // 调试输出
    console.log('🔧 CameraConfigManager 初始化:', this.config);
  }

  /**
   * 获取当前配置
   */
  getConfig(): CameraConfigType {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CameraConfigType>): void {
    this.config = { ...this.config, ...newConfig };
    
    console.log('🔧 配置已更新:', {
      updated: newConfig,
      current: this.config
    });
    
    // 通知所有监听器
    this.listeners.forEach(listener => {
      try {
        listener(this.config);
      } catch (error) {
        console.error('配置监听器错误:', error);
      }
    });
  }

  /**
   * 添加配置变更监听器
   */
  addListener(listener: (config: CameraConfigType) => void): () => void {
    this.listeners.add(listener);
    
    // 立即调用一次，传递当前配置
    listener(this.config);
    
    // 返回取消监听的函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 重置为默认配置
   */
  resetToDefaults(): void {
    this.updateConfig(QUICK_CAMERA_SETTINGS);
  }
}

// 创建全局单例
export const cameraConfigManager = new CameraConfigManager();