// visualConfig.ts - 集中可调视觉参数
// 目的：将常用的视觉/渲染参数集中到一个文件，方便快速调试、UI 绑定与文档化。
// 使用建议：
// - 在开发时可直接编辑这些常量来微调视觉效果；生产环境可通过环境或设置面板覆盖。
// - 高开销设置（如阴影、极高的轨道点数、非常大的阴影贴图）会影响性能，谨慎使用。
//
// ✨ 新特性：无限放大与防穿透约束
// 相机现在支持类似地图软件的无限放大功能，允许用户持续缩放直到接近行星表面查看细节。
// 核心特性：
// 1. 无限放大：CameraController.minDistance 设为极小值 (0.00001)
// 2. 防穿透约束：当相机穿过行星表面时，自动将焦点（OrbitControls.target）
//    沿着行星中心→相机的方向移动到行星表面，使用户始终可以看清行星表面而不会穿透。
// 3. 实现细节：
//    - focusOnTarget 保存行星半径和位置
//    - applyPenetrationConstraint 每帧检查并应用约束
//    - 当缩放或旋转时自动调整焦点位置以保持在行星表面外
// 4. 用户体验：点击行星后可继续滚轮放大，可以看清行星表面纹理和细节
//

// 🎯 相机配置已移至 cameraConfig.ts 文件，便于管理和调试
// 如需使用相机配置，请直接从 './cameraConfig' 导入

/**
 * 轨道颜色池
 * 用法：提供每个天体名称对应的轨道颜色（CSS 十六进制字符串）。
 * 建议：颜色尽量对比明显，便于在深色星空背景下区分。
 */
export const ORBIT_COLORS: Record<string, string> = {
  mercury: '#c4cbcf',
  venus: '#fcc307',
  earth: '#22a2c3',
  mars: '#f5391c',
  jupiter: '#D8CA9D',
  saturn: '#FAD5A5',
  uranus: '#4FD0E7',
  neptune: '#4B70DD',
};

/**
 * 太阳点光源（PointLight）配置
 * 说明：此光源用于模拟太阳的主要照明（非屏幕空间光晕），与 Planet 的 Sprite 光晕配合使用能得到更好的视觉效果。
 * 字段说明：
 * - color: 光颜色（数值或十六进制），例如 0xffffaa。可以使用更偏白或偏暖的色调。
 * - intensity: 光强度，数值越大越亮。建议范围：0.5 - 15（取决于场景缩放）。
 * - distance: 光照最大影响范围（world units），较大值会让光影响更远的物体，但会增加计算量。
 * - decay: 衰减指数（物理上 2 可模拟真实衰减），更低的值会使光照范围更线性。
 * - castShadow: 是否启用阴影（开启会显著增加渲染开销，建议仅用于高端展示模式）。
 * - shadowMapSize: 阴影贴图分辨率（开启阴影时控制质量，越大质量越好但消耗越多）。
 */
export const SUN_LIGHT_CONFIG = {
  color: 0xFFF4EA,
  intensity: 3,
  distance: 2000,
  decay: 2,
  castShadow: false,
  shadowMapSize: 1024,
};

/**
 * 轨道曲线参数
 * - ORBIT_CURVE_POINTS: 生成轨道时使用的采样点数。数值越大轨道越平滑，性能开销也越高。
 *   建议范围：100 - 2000。默认 300 在一般场景下是一个折中选择。
 */
export const ORBIT_CURVE_POINTS = 300;

/**
 * 标记圈（Marker）相关配置
 * 用于在小行星或小尺寸行星上显示 2D 标记圈（CSS2DObject）。
 * - size: 像素尺寸（直径），影响可点击区域。
 * - strokeWidth: 圈线宽（像素）。
 * - baseOpacity: 基础不透明度（用于叠加计算）。
 * - fadeSpeed: 透明度渐变速度（0-1，值越大越快）。
 * - minOpacity: 低于此阈值时隐藏 DOM，避免点击穿透问题。
 */
export const MARKER_CONFIG = {
  size: 20,
  strokeWidth: 2,
  baseOpacity: 1.0,
  fadeSpeed: 0.2,
  minOpacity: 0.1,
};

/**
 * 太阳屏幕空间光晕（Sprite）配置
 * 控制 Planet.ts 中创建的 Sprite 光晕行为（视觉上为太阳的辉光/光圈）。
 * - enabled: 是否启用该效果
 * - radiusMultiplier: 相对于太阳真实半径的倍数，用于计算初始 Sprite 大小
 * - color: 主光晕的颜色（数值或十六进制），大多数情况下材质使用渐变纹理，所以该字段可作为基色
 * - opacity: 基础不透明度（0-1）
 */
export const SUN_GLOW_CONFIG = {
  enabled: true,
  radiusMultiplier: 1.5,
  color: 0xFFF4EA,
  opacity: 0.6,
  
  // ==================== 远距离增强配置 ====================
  
  /** 远距离时光晕增强开始距离（AU） */
  farEnhanceStartDistance: 50,
  
  /** 远距离时光晕增强结束距离（AU）- 达到最大增强 */
  farEnhanceEndDistance: 200,
  
  /** 远距离时光晕大小倍数（相对于正常大小） */
  farEnhanceSizeMultiplier: 3.0,
  
  /** 远距离时光晕不透明度倍数 */
  farEnhanceOpacityMultiplier: 1.5,
  
  // ==================== 超远距离尺寸限制配置 ====================
  
  /** 超远距离限制开始距离（AU）- 超过此距离开始限制光晕增长 */
  veryFarLimitStartDistance: 5000,
  
  /** 光晕最大绝对尺寸（AU）- 无论距离多远，光晕不会超过此尺寸 */
  maxAbsoluteSize: 500000,
};

/**
 * 太阳四芒星（Star Spikes）配置
 * 模拟望远镜/相机镜头产生的衍射尖峰效果
 * 在远距离时显示，让太阳看起来像真正的恒星
 */
export const SUN_STAR_SPIKES_CONFIG = {
  /** 是否启用四芒星效果 */
  enabled: true,
  
  /** 四芒星开始显示的距离（AU） */
  showStartDistance: 30,
  
  /** 四芒星完全显示的距离（AU） */
  showFullDistance: 80,
  
  /** 尖峰数量（4 = 四芒星，6 = 六芒星） */
  spikeCount: 4,
  
  /** 尖峰旋转角度（度）- 45度使其呈X形 */
  rotationAngle: 45,
  
  /** 尖峰长度倍数（相对于光晕大小） */
  lengthMultiplier: 2,
  
  /** 尖峰宽度（像素） */
  spikeWidth: 8,
  
  /** 尖峰颜色 */
  color: '#FFFAF0',
  
  /** 尖峰基础不透明度 */
  opacity: 0.6,
  
  /** 尖峰渐变衰减指数（值越大，尖峰越尖锐） */
  falloffExponent: 0.5,
  
  // ==================== 月牙光晕配置 ====================
  
  /** 是否启用月牙光晕 */
  crescentEnabled: true,
  
  /** 大圆半径（相对于画布大小，0-0.5） */
  crescentOuterRadius: 0.26,
  
  /** 小圆半径（相对于大圆半径，接近1表示小圆几乎和大圆一样大） */
  crescentInnerRadiusRatio: 0.75,
  
  /** 小圆圆心偏移（相对于大圆半径，正值向右偏移，形成左侧月牙） */
  crescentOffsetRatio: 0.15,
  
  /** 月牙光芒颜色 */
  crescentColor: '#FFF8E8',
  
  /** 月牙光芒不透明度 */
  crescentOpacity: 0.6,
  
  /** 月牙光芒渐变衰减指数（类似四芒星） */
  crescentFalloff: 1.5,
};

/**
 * 彩虹散射层（镜头色散）配置
 * 说明：外层为多层低不透明度的彩色 Sprite，模拟镜头在强光下产生的散射/色散现象。
 * 数组中每一项定义为：{ color: '#RRGGBB', radiusMultiplier: number, opacity: number }
 * - color: CSS 颜色字符串，用于该层的主色调
 * - radiusMultiplier: 相对于太阳半径的倍数，控制该层的相对大小
 * - opacity: 该层的基础不透明度（通常较低，例如 0.02 - 0.12）
 * 建议：根据场景缩放调整 radiusMultiplier，以避免在超远摄时层过大遮挡场景。
 */
export const SUN_RAINBOW_LAYERS = [
  { color: '#ff6b6b', radiusMultiplier: 1.9, opacity: 0.32 },
  { color: '#ffd56b', radiusMultiplier: 2.3, opacity: 0.25 },
  { color: '#6bd6ff', radiusMultiplier: 2.8, opacity: 0.2 },
];

/**
 * 远距离视图配置
 * 当相机距离太阳系中心足够远时，隐藏行星以优化性能
 */
export const FAR_VIEW_CONFIG = {
  /** 是否启用远距离行星隐藏 */
  enabled: true,
  
  /** 行星开始淡出的距离（AU）- 设置较大值，主要用于性能优化 */
  planetFadeStartDistance: 80,
  
  /** 行星完全隐藏的距离（AU） */
  planetFadeEndDistance: 300,
  
  /** 轨道开始淡出的距离（AU） */
  orbitFadeStartDistance: 800,
  
  /** 轨道完全隐藏的距离（AU） */
  orbitFadeEndDistance: 2000,
  
  /** 标签开始淡出的距离（AU）- 太阳标签除外 */
  labelFadeStartDistance: 500,
  
  /** 标签完全隐藏的距离（AU） */
  labelFadeEndDistance: 1000,
};

/**
 * 轨道渐变（Orbit Gradient）配置
 * - enabled: 是否启用基于行星位置的轨道渐变（通常用于强调行星运动方向）
 * - maxOpacity/minOpacity: 渐变两端的透明度范围
 */
export const ORBIT_GRADIENT_CONFIG = {
  enabled: false, // 禁用轨道渐变，避免黑色段问题
  maxOpacity: 1.0,
  minOpacity: 0.8, // 提高最小透明度，减少黑色段
};

/**
 * 行星轨道样式配置
 */
export const ORBIT_STYLE_CONFIG = {
  style: 'filled' as 'line' | 'filled',
  showLine: true,
  lineOpacity: 1,
  fillAlpha: 0.3,
  innerRadiusRatio: 0.5,
};

/**
 * 卫星轨道样式配置
 */
export const SATELLITE_ORBIT_STYLE_CONFIG = {
  style: 'filled' as 'line' | 'filled',
  showLine: true,
  lineOpacity: 0.8,
  fillAlpha: 0.25,
  innerRadiusRatio: 0.6,
};

/**
 * 轨道渲染配置
 */
export const ORBIT_RENDER_CONFIG = {
  lineWidth: 1,
};

/**
 * 行星轨道渐隐配置
 * 当相机靠近任意行星时，所有行星轨道逐渐变透明
 */
export const ORBIT_FADE_CONFIG = {
  enabled: true,
  fadeStartDistance: 0.005,
  fadeEndDistance: 0.0005,
  discMinOpacity: 0,       // 圆盘完全隐藏
  lineMinOpacity: 0.3,    // 线条保持可见
};

/**
 * 卫星轨道渐隐配置
 */
export const SATELLITE_ORBIT_FADE_CONFIG = {
  enabled: true,
  fadeStartDistance: 0.001,
  fadeEndDistance: 0.00005,
  discMinOpacity: 0,
  lineMinOpacity: 0.2,
};

// 向后兼容
export const ORBIT_DISC_FADE_CONFIG = ORBIT_FADE_CONFIG;

/**
 * 相机相关配置
 */
export const CAMERA_CONFIG = {
  minDistanceToBody: 0.002,
  initialTiltDeg: 30,
  initialTransitionSec: 1.2,
};

/**
 * 卫星相关全局配置
 * - enabled: 是否显示并模拟卫星
 * - defaultScale: 卫星相对于真实半径的渲染缩放因子（可用于放大小卫星以便可视化）
 * - visibilityThreshold: 相机到母行星距离小于此值时才显示卫星（AU 单位）
 *   防止卫星文字与行星文字重叠遮挡。建议范围：0.1-0.5
 * - fadeOutDistance: 卫星开始渐隐的距离（AU）。当相机距离大于此值时卫星逐步淡出
 */
export const SATELLITE_CONFIG = {
  enabled: true,
  defaultScale: 1.0,
  // 当选中父行星并聚焦时，摄像机与父行星的距离小于 (parentRadius * showOnFocusMultiplier) 才显示卫星
  // 值越大需要更靠近父行星才会显示卫星
  showOnFocusMultiplier: 15,
  // 卫星可见性阈值（AU）：相机到母行星距离小于此值时卫星才显示
  visibilityThreshold: 0.15,
  // 卫星开始淡出的距离（AU）
  fadeOutDistance: 0.25,
};

// 相机配置已移至 cameraConfig.ts
// 以下导出保持向后兼容性
export const HEADER_CONFIG = {
  // 是否启用Header
  enabled: true,
  
  // LOGO图片路径
  logoPath: '/CX.svg',
  
  // LOGO大小（像素）
  logoSize: 55,
  
  // 左边距（像素）
  paddingLeft: 10,
  
  // Header高度（像素）
  height: 80,

  // 是否使用浮动 Logo/Header（无顶栏布局）
  // true = 使用小型浮动 logo（默认）; false = 使用传统顶栏
  floatingMode: true,

  // 浮动 Header 位置（像素）
  floatingPosition: {
    top: 12,
    left: 12,
  },

  // 浮动 Header 样式（可选）
  floatingStyle: {
    transitionDuration: 180,
    backgroundColor: 'transparent',
    hoverBackgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    boxShadow: 'none',
    backdropFilter: 'none',
  },
  
  // Logo 透明度（0-1）
  logoOpacity: 0.6,
  
  // Header背景颜色（CSS颜色值）
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  
  // Header边框颜色
  borderColor: 'rgba(255, 255, 255, 0.1)',
  
  // 网站标题文本
  titleText: 'CXIN',
  
  // 网站副标题文本
  subtitleText: 'solmap.cxin.tech',
  
  // 标题字体大小（像素）
  titleFontSize: 24,
  
  // 副标题字体大小（像素）
  subtitleFontSize: 14,
  
  // 标题字体粗细
  titleFontWeight: 600,
  
  // 副标题字体粗细
  subtitleFontWeight: 400,
  
  // 文字颜色
  textColor: '#ffffff',
  
  // 副标题文字颜色（可与标题不同）
  subtitleColor: '#b0b0b0',
  
  // 标题和副标题之间的间距（像素）
  textSpacing: 4,
  
  // 文字区域与LOGO的间距（像素）
  contentGap: 20,
};

/**
 * 星球 LOD（Level of Detail）动态细节配置
 * 
 * 功能：根据相机距离动态调整星球的几何体面数（分段数）
 * - 远距离时使用较少分段数，优化渲染性能
 * - 近距离时增加分段数，显示更多细节以消除棱角感
 * 
 * 原理：
 * - baseSegments: 基础分段数（相机距离约为 30 AU 时的分段数）
 * - minSegments: 最少分段数（即使相机很远也不会低于此值）
 * - maxSegments: 最多分段数（即使相机很近也不会超过此值）
 * - transitionDistance: 控制LOD过渡速度的参考距离
 *   - 每 1 个 transitionDistance 的接近，分段数会增加相应倍数
 * - smoothness: 分段数变化的平滑度（0-1），值越大越平滑但变化越慢
 */
export const PLANET_LOD_CONFIG = {
  // 基础分段数（用于中等距离）
  baseSegments: 32,
  
  // 最小分段数（远距离时的下限，降低资源消耗）
  minSegments: 16,
  
  // 最大分段数（近距离时的上限，防止过度细分）
  maxSegments: 128,
  
  // LOD 过渡参考距离（决定分段数随距离变化的速率）
  // 越小越敏感：相机每靠近一个单位分段数增加越多
  // 建议范围：5-20
  transitionDistance: 10,
  
  // 分段数平滑过渡速度（0-1，值越大变化越快）
  // 越小越平滑但反应越慢。建议范围：0.1-0.3
  smoothness: 0.15,
};

/**
 * 行星经纬线网格（Lat/Lon grid）配置
 * - enabled: 是否显示经纬线
 * - meridians: 经线数量
 * - parallels: 纬线数量
 * - color: 线颜色（CSS 颜色或十六进制）
 * - opacity: 线不透明度
 * - segments: 每条线的分段数
 * - outwardOffset: 将线稍微向外偏移（相对于星球半径的比例）以减少 Z-fighting
 */
export const PLANET_GRID_CONFIG = {
  enabled: true,
  meridians: 12,
  parallels: 6,
  color: '#ffffff',
  opacity: 0.2, // 增加不透明度以提高可见性
  segments: 96,
  outwardOffset: 0.002, // 使用相对于半径的比例（0.2%），而不是绝对值
};

/**
 * ==================== 行星贴图系统配置 ====================
 * 
 * 行星表面贴图（Base Color / Albedo）配置
 * 
 * CRITICAL: 此配置仅用于 Render Layer，不影响 Physical Layer 计算
 * - 贴图不参与物理计算
 * - 贴图尺寸不影响碰撞/拾取半径
 * - BodyId 必须与 Physical Layer 定义一致（小写）
 */

/**
 * 行星贴图配置接口
 * 
 * 支持多层贴图：
 * - baseColor: 基础颜色贴图（Albedo）- ✅ 已实现
 * - nightMap: 夜面灯光贴图 - ✅ 已实现（地球）
 * - normalMap: 法线贴图 - 预留
 */
export interface PlanetTextureConfig {
  /** Base color / albedo map path (equirectangular projection) */
  baseColor?: string;
  
  /** Reserved for future: normal map */
  normalMap?: string;
  
  /** Reserved for future: night lights */
  nightMap?: string;
}

/**
 * 行星贴图映射配置
 * 
 * BodyId → 贴图路径映射
 * 
 * 注意：
 * - BodyId 必须与 Physical Layer 定义一致（小写）
 * - Sun 不配置贴图（Phase 1 保持 emissive-only）
 * - 使用 2K 分辨率以优化内存
 * - 贴图格式：Equirectangular projection（等距圆柱投影）
 */
export const PLANET_TEXTURE_CONFIG: Record<string, PlanetTextureConfig> = {
  // Sun: NO texture in Phase 1 (emissive-only)
  // sun: undefined,
  
  // 八大行星
  mercury: {
    baseColor: '/textures/planets/2k_mercury.jpg',
  },
  venus: {
    baseColor: '/textures/planets/2k_venus_surface.jpg',
  },
  earth: {
    baseColor: '/textures/planets/2k_earth_daymap.jpg',
    nightMap: '/textures/planets/2k_earth_nightmap.jpg',
  },
  mars: {
    baseColor: '/textures/planets/2k_mars.jpg',
  },
  jupiter: {
    baseColor: '/textures/planets/2k_jupiter.jpg',
  },
  saturn: {
    baseColor: '/textures/planets/2k_saturn.jpg',
  },
  uranus: {
    baseColor: '/textures/planets/2k_uranus.jpg',
  },
  neptune: {
    baseColor: '/textures/planets/2k_neptune.jpg',
  },
  
  // 卫星
  moon: {
    baseColor: '/textures/planets/2k_moon.jpg',
  },
  
  // 矮行星（虚构贴图）
  ceres: {
    baseColor: '/textures/planets/2k_ceres_fictional.jpg',
  },
  eris: {
    baseColor: '/textures/planets/2k_eris_fictional.jpg',
  },
  haumea: {
    baseColor: '/textures/planets/2k_haumea_fictional.jpg',
  },
  makemake: {
    baseColor: '/textures/planets/2k_makemake_fictional.jpg',
  },
};

/**
 * TextureManager 配置
 * 
 * 控制贴图加载行为
 */
export const TEXTURE_MANAGER_CONFIG = {
  /** 是否启用贴图加载（可用于测试时禁用） */
  enabled: true,
  
  /** 默认贴图分辨率后缀（用于内存优化） */
  defaultResolution: '2k',
  
  /** 是否在控制台输出贴图加载日志 */
  debugLogging: false,
  
  /** 贴图加载超时时间（毫秒） */
  loadTimeout: 30000,
};

/**
 * 行星光照配置
 * 控制行星表面的光照效果
 */
export const PLANET_LIGHTING_CONFIG = {
  // ==================== 基础光照参数 ====================
  
  // 环境光强度（用于照亮背面，模拟大气散射和反射光）
  // 范围：0-1，0 = 完全黑暗的夜面，1 = 与白天一样亮
  // 建议：0.05-0.2
  ambientIntensity: 0.08,
  
  // 昼夜过渡区域宽度（弧度）
  // 控制明暗交界处的渐变宽度，值越大过渡越平滑
  // 范围：0.05-0.5，0.1 ≈ 5.7° 的过渡带
  // 建议：0.1-0.25
  terminatorWidth: 0.15,
  
  // ==================== 对比度和亮度参数 ====================
  
  // 向阳面的最大亮度（防止过曝）
  // 范围：0.5-2.0，1.0 = 原始贴图亮度
  // 建议：0.9-1.2
  maxDaylightIntensity: 1.3,
  
  // 背阳面的最小亮度
  // 范围：0-0.2，0 = 完全黑暗
  // 建议：0.01-0.05
  minNightIntensity: 0.05,
  
  // 对比度增强系数
  // 范围：0.5-2.0，1.0 = 无变化，>1 = 增加对比度
  // 建议：1.0-1.5
  contrastBoost: 1.1,
  
  // 饱和度增强系数
  // 范围：0-2.0，1.0 = 无变化，>1 = 增加饱和度
  // 建议：0.8-1.3
  saturationBoost: 1.1,
  
  // 伽马校正值
  // 范围：0.5-2.5，1.0 = 无校正，<1 = 变亮，>1 = 变暗
  // 建议：0.9-1.2
  gamma: 1.0,
  
  // ==================== 地球夜间贴图参数 ====================
  
  // 是否启用地球夜间贴图
  enableEarthNightMap: true,
  
  // 夜间贴图的最大亮度（0-1）
  // 控制城市灯光的亮度
  // 建议：0.5-1.5
  nightMapIntensity: 1.2,
  
  // ==================== 边缘光照参数（菲涅尔效果） ====================
  
  // 是否启用边缘光照（模拟大气散射）
  enableFresnelEffect: true,
  
  // 边缘光照强度
  // 范围：0-1，0 = 无边缘光
  // 建议：0.1-0.4
  fresnelIntensity: 0.15,
  
  // 边缘光照颜色（十六进制）
  fresnelColor: 0x88ccff,
  
  // 边缘光照指数（控制边缘光的锐利程度）
  // 范围：1-10，值越大边缘越锐利
  // 建议：2-5
  fresnelPower: 3.0,
  
  // ==================== 极点修复参数 ====================
  
  // 极点混合开始距离（0-1，基于 Y 坐标）
  // 值越小，混合区域越大
  poleBlendStart: 0.9,
  
  // 极点混合结束距离
  poleBlendEnd: 0.99,
  
  // 极点采样数量（用于消除条纹）
  poleSampleCount: 8,
  
  // 极点采样半径（UV 空间）
  poleSampleRadius: 0.02,
};

/**
 * 天体材质参数接口
 * 每个天体可以覆盖 PLANET_LIGHTING_CONFIG 中的任意参数
 */
export interface CelestialMaterialParams {
  ambientIntensity?: number;
  terminatorWidth?: number;
  maxDaylightIntensity?: number;
  minNightIntensity?: number;
  contrastBoost?: number;
  saturationBoost?: number;
  gamma?: number;
  nightMapIntensity?: number;
  enableFresnelEffect?: boolean;
  fresnelIntensity?: number;
  fresnelColor?: number;
  fresnelPower?: number;
}

/**
 * 每个天体的独立材质参数
 * 
 * 设计原则：
 * - 岩石天体：高对比、低饱和、弱边缘光
 * - 气态巨行星：低对比、高饱和、强终止线过渡
 * - 有大气的岩石行星：柔和 terminator + 边缘光
 * - 冰质天体：高 gamma + 高 fresnel + 偏冷色
 * - 卫星：比母星"更硬、更干、更无大气"
 * 
 * 未列出的参数使用 PLANET_LIGHTING_CONFIG 默认值
 */
export const CELESTIAL_MATERIAL_PARAMS: Record<string, CelestialMaterialParams> = {
  // ==================== 岩石行星 ====================
  
  // Mercury - 极端岩石，无大气，硬阴影
  mercury: {
    ambientIntensity: 0.04,
    terminatorWidth: 0.06,
    contrastBoost: 1.6,
    saturationBoost: 0.9,
    gamma: 0.9,
    enableFresnelEffect: false,
  },
  
  // Venus - 厚大气，朦胧，对比低
  venus: {
    ambientIntensity: 0.18,
    terminatorWidth: 0.3,
    contrastBoost: 1.0,
    saturationBoost: 1.1,
    gamma: 1.15,
    enableFresnelEffect: true,
    fresnelIntensity: 0.3,
    fresnelColor: 0xffddaa,
    fresnelPower: 2.0,
  },
  
  // Earth - 有大气、有水，柔和真实
  earth: {
    ambientIntensity: 0.12,
    terminatorWidth: 0.22,
    contrastBoost: 1.15,
    saturationBoost: 1.15,
    gamma: 1.05,
    nightMapIntensity: 1.3,
    enableFresnelEffect: true,
    fresnelIntensity: 0.22,
    fresnelColor: 0x88ccff,
    fresnelPower: 2.5,
  },
  
  // Mars - 稀薄大气，红色调
  mars: {
    ambientIntensity: 0.07,
    terminatorWidth: 0.14,
    contrastBoost: 1.35,
    saturationBoost: 1.2,
    gamma: 1.0,
    enableFresnelEffect: true,
    fresnelIntensity: 0.1,
    fresnelColor: 0xffaa88,
    fresnelPower: 3.0,
  },
  
  // ==================== 气态巨行星 ====================
  
  // Jupiter - 气态巨行星，条纹明显
  jupiter: {
    ambientIntensity: 0.15,
    terminatorWidth: 0.35,
    contrastBoost: 1.0,
    saturationBoost: 1.25,
    gamma: 1.1,
    enableFresnelEffect: true,
    fresnelIntensity: 0.18,
    fresnelColor: 0xffeedd,
    fresnelPower: 2.0,
  },
  
  // Saturn - 气态巨行星，柔和
  saturn: {
    ambientIntensity: 0.14,
    terminatorWidth: 0.33,
    contrastBoost: 1.0,
    saturationBoost: 1.15,
    gamma: 1.1,
    enableFresnelEffect: true,
    fresnelIntensity: 0.2,
    fresnelColor: 0xffeedd,
    fresnelPower: 2.0,
  },
  
  // ==================== 冰巨星 ====================
  
  // Uranus - 冰巨星，偏冷色
  uranus: {
    ambientIntensity: 0.16,
    terminatorWidth: 0.32,
    contrastBoost: 1.0,
    saturationBoost: 1.3,
    gamma: 1.15,
    enableFresnelEffect: true,
    fresnelIntensity: 0.25,
    fresnelColor: 0x99ddff,
    fresnelPower: 2.5,
  },
  
  // Neptune - 冰巨星，深蓝
  neptune: {
    ambientIntensity: 0.16,
    terminatorWidth: 0.32,
    contrastBoost: 1.0,
    saturationBoost: 1.3,
    gamma: 1.15,
    enableFresnelEffect: true,
    fresnelIntensity: 0.25,
    fresnelColor: 0x99ddff,
    fresnelPower: 2.5,
  },
  
  // ==================== 卫星 ====================
  
  // Moon - 干燥岩石卫星，硬阴影，无大气
  moon: {
    ambientIntensity: 0.03,
    terminatorWidth: 0.08,
    contrastBoost: 1.45,
    saturationBoost: 0.95,
    gamma: 0.95,
    enableFresnelEffect: false,
  },
  
  // Io - 火山活跃，硫磺色
  io: {
    ambientIntensity: 0.04,
    terminatorWidth: 0.1,
    contrastBoost: 1.4,
    saturationBoost: 1.1,
    gamma: 0.95,
    enableFresnelEffect: false,
  },
  
  // Europa - 冰质卫星
  europa: {
    ambientIntensity: 0.1,
    terminatorWidth: 0.18,
    contrastBoost: 1.2,
    saturationBoost: 0.9,
    gamma: 1.2,
    enableFresnelEffect: true,
    fresnelIntensity: 0.3,
    fresnelColor: 0xccffff,
    fresnelPower: 3.0,
  },
  
  // Ganymede - 岩石冰混合
  ganymede: {
    ambientIntensity: 0.06,
    terminatorWidth: 0.12,
    contrastBoost: 1.3,
    saturationBoost: 0.95,
    gamma: 1.0,
    enableFresnelEffect: true,
    fresnelIntensity: 0.15,
    fresnelColor: 0xddddff,
    fresnelPower: 3.0,
  },
  
  // Callisto - 古老岩石冰
  callisto: {
    ambientIntensity: 0.05,
    terminatorWidth: 0.1,
    contrastBoost: 1.35,
    saturationBoost: 0.9,
    gamma: 1.0,
    enableFresnelEffect: false,
  },
  
  // Titan - 厚大气卫星
  titan: {
    ambientIntensity: 0.2,
    terminatorWidth: 0.35,
    contrastBoost: 1.0,
    saturationBoost: 1.0,
    gamma: 1.2,
    enableFresnelEffect: true,
    fresnelIntensity: 0.35,
    fresnelColor: 0xffcc88,
    fresnelPower: 2.0,
  },
  
  // Enceladus - 冰质喷泉卫星
  enceladus: {
    ambientIntensity: 0.1,
    terminatorWidth: 0.18,
    contrastBoost: 1.2,
    saturationBoost: 0.85,
    gamma: 1.25,
    enableFresnelEffect: true,
    fresnelIntensity: 0.35,
    fresnelColor: 0xccffff,
    fresnelPower: 2.5,
  },
  
  // Triton - 海王星逆行卫星，冰质
  triton: {
    ambientIntensity: 0.08,
    terminatorWidth: 0.15,
    contrastBoost: 1.25,
    saturationBoost: 0.9,
    gamma: 1.2,
    enableFresnelEffect: true,
    fresnelIntensity: 0.3,
    fresnelColor: 0xaaddff,
    fresnelPower: 3.0,
  },
  
  // ==================== 矮行星 ====================
  
  // Ceres - 小行星带最大天体
  ceres: {
    ambientIntensity: 0.04,
    terminatorWidth: 0.1,
    contrastBoost: 1.4,
    saturationBoost: 0.9,
    gamma: 0.95,
    enableFresnelEffect: false,
  },
  
  // Pluto - 冰质矮行星
  pluto: {
    ambientIntensity: 0.06,
    terminatorWidth: 0.12,
    contrastBoost: 1.3,
    saturationBoost: 0.95,
    gamma: 1.15,
    enableFresnelEffect: true,
    fresnelIntensity: 0.2,
    fresnelColor: 0xddccaa,
    fresnelPower: 3.0,
  },
  
  // Eris - 远日冰质矮行星
  eris: {
    ambientIntensity: 0.05,
    terminatorWidth: 0.1,
    contrastBoost: 1.35,
    saturationBoost: 0.85,
    gamma: 1.2,
    enableFresnelEffect: true,
    fresnelIntensity: 0.25,
    fresnelColor: 0xccddff,
    fresnelPower: 3.0,
  },
  
  // Haumea - 快速自转椭球
  haumea: {
    ambientIntensity: 0.06,
    terminatorWidth: 0.12,
    contrastBoost: 1.3,
    saturationBoost: 0.9,
    gamma: 1.15,
    enableFresnelEffect: true,
    fresnelIntensity: 0.2,
    fresnelColor: 0xddddff,
    fresnelPower: 3.0,
  },
  
  // Makemake - 红色冰质矮行星
  makemake: {
    ambientIntensity: 0.05,
    terminatorWidth: 0.1,
    contrastBoost: 1.35,
    saturationBoost: 1.0,
    gamma: 1.1,
    enableFresnelEffect: true,
    fresnelIntensity: 0.2,
    fresnelColor: 0xffccaa,
    fresnelPower: 3.0,
  },
};

/**
 * 获取天体的材质参数（合并默认值和天体特定值）
 */
export function getCelestialMaterialParams(bodyName: string): Required<CelestialMaterialParams> {
  const defaults: Required<CelestialMaterialParams> = {
    ambientIntensity: PLANET_LIGHTING_CONFIG.ambientIntensity,
    terminatorWidth: PLANET_LIGHTING_CONFIG.terminatorWidth,
    maxDaylightIntensity: PLANET_LIGHTING_CONFIG.maxDaylightIntensity,
    minNightIntensity: PLANET_LIGHTING_CONFIG.minNightIntensity,
    contrastBoost: PLANET_LIGHTING_CONFIG.contrastBoost,
    saturationBoost: PLANET_LIGHTING_CONFIG.saturationBoost,
    gamma: PLANET_LIGHTING_CONFIG.gamma,
    nightMapIntensity: PLANET_LIGHTING_CONFIG.nightMapIntensity,
    enableFresnelEffect: PLANET_LIGHTING_CONFIG.enableFresnelEffect,
    fresnelIntensity: PLANET_LIGHTING_CONFIG.fresnelIntensity,
    fresnelColor: PLANET_LIGHTING_CONFIG.fresnelColor,
    fresnelPower: PLANET_LIGHTING_CONFIG.fresnelPower,
  };
  
  const specific = CELESTIAL_MATERIAL_PARAMS[bodyName.toLowerCase()];
  if (!specific) {
    return defaults;
  }
  
  return { ...defaults, ...specific };
}

/**
 * 土星环配置
 * 
 * 土星环的几何和渲染参数
 * 真实数据：
 * - D环内边界: 66,900 km (1.11 Rs)
 * - C环: 74,658 - 92,000 km
 * - B环: 92,000 - 117,580 km
 * - A环: 122,170 - 136,775 km (2.27 Rs)
 * - F环: 140,180 km
 * 
 * Rs = 土星半径 ≈ 60,268 km
 */
export const SATURN_RING_CONFIG = {
  /** 是否启用土星环 */
  enabled: true,
  
  /** 环内半径（相对于土星半径的倍数） */
  innerRadius: 1.2,
  
  /** 环外半径（相对于土星半径的倍数） */
  outerRadius: 2.3,
  
  /** 环贴图路径（带 alpha 通道） */
  texturePath: '/textures/planets/2k_saturn_ring_alpha.png',
  
  /** 环的不透明度 */
  opacity: 3,
  
  /** 环的分段数（影响圆滑度） */
  segments: 128,
  
  /** 环的倾斜角度（度）- 相对于土星赤道面，通常为 0 */
  tiltAngle: 0,
  
  /** 环的颜色调整（用于无贴图时的回退） */
  fallbackColor: 0xc4a66a,
  
  /** 环是否接收阴影（性能开销较大） */
  receiveShadow: false,
  
  /** 环是否投射阴影（性能开销较大） */
  castShadow: false,
};


/**
 * 距离显示组件配置
 * 
 * 控制左侧距离地球显示面板的样式
 */
export const DISTANCE_DISPLAY_CONFIG = {
  // ==================== 位置配置 ====================
  
  /** 距离左边的距离（像素） */
  left: 5,
  
  /** 垂直位置：'center' = 垂直居中，或具体像素值 */
  verticalPosition: 'center' as 'center' | number,
  
  // ==================== 样式配置 ====================
  
  /** 背景颜色（支持 rgba），设为 'transparent' 去掉背景 */
  backgroundColor: 'transparent',
  
  /** 背景模糊程度（像素），设为 0 去掉模糊 */
  backdropBlur: 0,
  
  /** 圆角大小（像素） */
  borderRadius: 0,
  
  /** 内边距（像素） */
  padding: {
    vertical: 0,
    horizontal: 0,
  },
  
  // ==================== 文字配置 ====================
  
  /** 标题文字（第一行） */
  titleText: '您现在距离地球',
  
  /** 标题字体大小（像素） */
  titleFontSize: 12,
  
  /** 标题透明度（0-1） */
  titleOpacity: 0.8,
  
  /** 数值字体大小（像素） */
  valueFontSize: 16,
  
  /** 数值字体粗细 */
  valueFontWeight: 'bold' as string,
  
  /** 单位字体大小（像素） */
  unitFontSize: 15,
  
  /** 单位透明度（0-1） */
  unitOpacity: 0.9,
  
  /** 行间距（像素） */
  lineGap: 1,
  
  /** 文字颜色 */
  textColor: '#ffffff',
  
  /** 字体族 */
  fontFamily: '"SourceHanSerifCN", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  
  /** 文字阴影 */
  textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.6)',
  
  // ==================== 层级配置 ====================
  
  /** z-index 层级 */
  zIndex: 10,
};


/**
 * 时间滑块组件配置
 * 
 * 控制底部弧形时间滑块的样式和行为
 */
export const TIME_SLIDER_CONFIG = {
  // ==================== 尺寸配置 ====================
  
  /** 滑块宽度（像素）- 同时控制弧线长度 */
  width: 600,
  
  /** 滑块高度（像素） */
  height: 35,
  
  /** 弧线深度比例（相对于高度，0-1，值越大弧度越深） */
  arcDepthRatio: 0.6,
  
  /** 滑块圆圈半径（像素） */
  sliderRadius: 10,
  
  /** 轨道两端留白（像素） */
  trackPadding: 4,
  
  /** 弧线最小宽度（像素，两端） */
  trackMinWidth: 1,
  
  /** 弧线最大宽度（像素，中间） */
  trackMaxWidth: 4,
  
  // ==================== 速度配置 ====================
  
  /** 最大速度（天/秒）- 滑块在最边缘时的速度 */
  maxSpeed: 365,
  
  /** 速度曲线指数 - 值越大，边缘加速越明显 */
  speedExponent: 2.5,
  
  /** 死区比例 - 中心多大范围内视为暂停（0-1） */
  deadZone: 0.05,
  
  // ==================== 颜色配置 ====================
  
  /** 弧线轨道颜色（两端） */
  trackColorEnd: 'rgba(255, 255, 255, 0.1)',
  
  /** 弧线轨道颜色（中间） */
  trackColorCenter: 'rgba(255, 255, 255, 0.4)',
  
  /** 前进时的高亮颜色（两端） */
  forwardColorEnd: 'rgba(34, 197, 94, 0.1)',
  
  /** 前进时的高亮颜色（中间） */
  forwardColorCenter: 'rgba(28, 66, 255, 0.6)',
  
  /** 后退时的高亮颜色（两端） */
  backwardColorEnd: 'rgba(239, 68, 68, 0.1)',
  
  /** 后退时的高亮颜色（中间） */
  backwardColorCenter: 'rgba(239, 68, 68, 0.6)',
  
  /** 滑块默认边框颜色 */
  sliderBorderColor: 'rgba(255, 255, 255, 0.8)',
  
  /** 滑块前进时边框颜色 */
  sliderForwardColor: '#4e5dffff',
  
  /** 滑块后退时边框颜色 */
  sliderBackwardColor: '#ef4444',
  
  /** 滑块边框宽度（像素） */
  sliderBorderWidth: 2,
  
  /** 滑块发光半径（像素） */
  sliderGlowRadius: 12,
  
  // ==================== 速度文字配置 ====================
  
  /** 速度文字前进颜色 */
  speedTextForwardColor: '#3799e9ff',
  
  /** 速度文字后退颜色 */
  speedTextBackwardColor: '#ef4444',
  
  /** 速度文字大小（像素） */
  speedTextSize: 15,
  
  /** 速度文字底部偏移（像素） */
  speedTextBottom: -5,
};

/**
 * 时间控件组件配置
 * 
 * 控制底部时间显示区域的样式
 */
export const TIME_CONTROL_CONFIG = {
  // ==================== 文字颜色 ====================
  
  /** 日期/时间文字颜色 */
  textColor: '#ffffff',
  
  /** 未来时间差颜色 */
  futureColor: '#60a5fa',
  
  /** 过去时间差颜色 */
  pastColor: '#fb923c',
  
  /** 当前时间（"现在"）颜色 */
  nowColor: '#ffffffff',
  
  /** 精度警告颜色 */
  warningColor: '#facc15',
  
  // ==================== 文字大小 ====================
  
  /** 日期/时间文字大小 - 移动端（像素） */
  dateTimeSizeMobile: 20,
  
  /** 日期/时间文字大小 - 桌面端（像素） */
  dateTimeSizeDesktop: 20,
  
  /** 时间差文字大小 - 移动端（像素） */
  timeDiffSizeMobile: 14,
  
  /** 时间差文字大小 - 桌面端（像素） */
  timeDiffSizeDesktop: 14,
  
  /** 警告文字大小（像素） */
  warningSize: 14,
  
  // ==================== 按钮配置 ====================
  
  /** "现在"按钮背景色 */
  nowButtonBg: 'rgba(59, 130, 246, 0.8)',
  
  /** "现在"按钮悬停背景色 */
  nowButtonHoverBg: '#3b82f6',
  
  /** "现在"按钮文字颜色 */
  nowButtonTextColor: '#ffffff',
  
  /** "现在"按钮文字大小（像素） */
  nowButtonTextSize: 12,
  
  /** "现在"按钮圆角（像素） */
  nowButtonRadius: 4,
  
  /** "现在"按钮内边距 */
  nowButtonPadding: '2px 8px',
  
  /** 日历按钮颜色 */
  calendarButtonColor: 'rgba(255, 255, 255, 0.6)',
  
  /** 日历按钮悬停颜色 */
  calendarButtonHoverColor: '#ffffff',
  
  /** 日历按钮大小（像素） */
  calendarButtonSize: 16,
  
  // ==================== 布局配置 ====================
  
  /** 底部距离（像素） */
  bottomOffset: 20,
  
  /** 元素间距 - 移动端（像素） */
  gapMobile: 12,
  
  /** 元素间距 - 桌面端（像素） */
  gapDesktop: 30,
  
  /** 日期/时间区域固定宽度（像素） */
  dateTimeWidth: 110,
  
  /** 中间区域（时间差/现在）固定宽度（像素） */
  middleSectionWidth: 250,
};
