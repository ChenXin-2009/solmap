/**
 * 相机控制器专用配置
 * 从 visualConfig.ts 中提取，便于快速调整和查找
 */

// 🐛 立即调试：文件加载时输出配置
console.log('🔧 cameraConfig.ts 加载 - 配置值:', {
  timestamp: new Date().toISOString(),
  file: 'cameraConfig.ts'
});

/**
 * 🎯 快速调整区域 - 常用参数
 * 这些是最常调整的参数，放在文件顶部便于快速找到
 */
export const QUICK_CAMERA_SETTINGS = {
  // ==================== 缩放速度控制 ====================
  
  /** 🔧 基础缩放缓动速度 (0-1)
   * 值越大缩放越快，建议范围：0.1-0.5
   * 统一的缓动速度，适用于所有缩放范围
   */
  zoomEasingSpeed: 0.2,
  
  /** 🔧 滚轮缩放敏感度
   * 每次滚轮滚动的缩放幅度，建议范围：0.1-0.25
   * 当前值：0.15 = 适中敏感度
   */
  zoomBaseFactor: 0.6,
  
  // ==================== 其他常用设置 ====================
  
  /** 🔧 相机阻尼系数 (0-1)
   * 控制旋转/平移的惯性，值越小惯性越强
   * 建议范围：0.01-0.1
   */
  dampingFactor: 0.1,
  
  /** 🔧 聚焦动画速度 (0-1)
   * 点击行星后的聚焦速度，建议范围：0.2-0.5
   */
  focusLerpSpeed: 0.3,
  
  /** 🔧 跟踪平滑度 (0-1)
   * 跟踪行星运动的平滑程度，建议范围：0.1-0.25
   */
  trackingLerpSpeed: 0.18,
};

// 🐛 立即调试：配置定义后输出值
console.log('🔧 QUICK_CAMERA_SETTINGS 定义完成:', {
  zoomEasingSpeed: QUICK_CAMERA_SETTINGS.zoomEasingSpeed,
  zoomBaseFactor: QUICK_CAMERA_SETTINGS.zoomBaseFactor,
  timestamp: new Date().toISOString()
});

/**
 * 🔧 缩放范围控制
 */
export const ZOOM_LIMITS = {
  /** 最小缩放距离（支持无限放大） */
  minDistance: 0.00001,
  
  /** 最大缩放距离 */
  maxDistance: 1000,
  
  /** 缩放速度因子（OrbitControls 使用） */
  zoomSpeed: 1.5,
};

/**
 * 🔧 防穿透设置
 */
export const PENETRATION_PREVENTION = {
  /** 安全距离倍数（相对于行星半径） */
  safetyDistanceMultiplier: 3,
  
  /** 约束平滑度 */
  constraintSmoothness: 0.15,
  
  /** 是否强制立即修正 */
  forceSnap: false,
  
  /** 调试模式 */
  debugMode: false,
};

/**
 * 🔧 视角控制
 */
export const VIEW_SETTINGS = {
  /** 视野角度（FOV，度） */
  fov: 45,
  
  /** 动态近平面调整倍数 */
  dynamicNearPlaneMultiplier: 0.01,
  
  /** 最小近平面距离 */
  minNearPlane: 0.000001,
  
  /** 最大远平面距离 */
  maxFarPlane: 1e12,
};

/**
 * 🔧 操作响应设置
 */
export const INPUT_SETTINGS = {
  /** 平移速度 */
  panSpeed: 0.8,
  
  /** 旋转速度 */
  rotateSpeed: 0.8,
  
  /** 角度过渡速度 */
  polarAngleTransitionSpeed: 0.08,
  azimuthalAngleTransitionSpeed: 0.1,
};

/**
 * 🔧 聚焦行为设置
 */
export const FOCUS_SETTINGS = {
  /** 聚焦完成阈值 */
  focusThreshold: 0.01,
  
  /** 聚焦距离倍数（相对于行星半径） */
  focusDistanceMultiplier: 5,
  
  /** 最小距离倍数 */
  minDistanceMultiplier: 1.5,
};

// ==================== 合并配置（向后兼容） ====================

/**
 * 统一的相机配置对象（向后兼容）
 * 自动合并所有设置，供现有代码使用
 */
export const CAMERA_CONFIG = {
  // 快速设置
  ...QUICK_CAMERA_SETTINGS,
  
  // 缩放限制
  ...ZOOM_LIMITS,
  
  // 视角设置
  ...VIEW_SETTINGS,
  
  // 输入设置
  ...INPUT_SETTINGS,
  
  // 聚焦设置
  ...FOCUS_SETTINGS,
};

/**
 * 防穿透配置（向后兼容）
 */
export const CAMERA_PENETRATION_CONFIG = PENETRATION_PREVENTION;

/**
 * 分离的配置对象（向后兼容）
 */
export const CAMERA_VIEW_CONFIG = VIEW_SETTINGS;
export const CAMERA_OPERATION_CONFIG = INPUT_SETTINGS;
export const CAMERA_ZOOM_CONFIG = { ...ZOOM_LIMITS, ...QUICK_CAMERA_SETTINGS };
export const CAMERA_FOCUS_CONFIG = FOCUS_SETTINGS;
export const CAMERA_TRACKING_CONFIG = { trackingLerpSpeed: QUICK_CAMERA_SETTINGS.trackingLerpSpeed };