// visualConfig.ts - 集中可调视觉参数
// 目的：将常用的视觉/渲染参数集中到一个文件，方便快速调试、UI 绑定与文档化。
// 使用建议：
// - 在开发时可直接编辑这些常量来微调视觉效果；生产环境可通过环境或设置面板覆盖。
// - 高开销设置（如阴影、极高的轨道点数、非常大的阴影贴图）会影响性能，谨慎使用。

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
  { color: '#ff6b6b', radiusMultiplier: 1.9, opacity: 0.08 },
  { color: '#ffd56b', radiusMultiplier: 2.3, opacity: 0.06 },
  { color: '#6bd6ff', radiusMultiplier: 2.8, opacity: 0.05 },
];

/**
 * 轨道渐变（Orbit Gradient）配置
 * - enabled: 是否启用基于行星位置的轨道渐变（通常用于强调行星运动方向）
 * - maxOpacity/minOpacity: 渐变两端的透明度范围
 */
export const ORBIT_GRADIENT_CONFIG = {
  enabled: true,
  maxOpacity: 1.0,
  minOpacity: 0.1,
};

/**
 * 轨道渲染配置
 * - lineWidth: 轨道线宽（注意：WebGL/Three.js 在多数浏览器中对 lineWidth 支持受限，可能被忽略）
 *   如果需要在所有平台上可见的粗线效果，请考虑使用带宽度的 TubeGeometry 或平面条带替代。
 */
export const ORBIT_RENDER_CONFIG = {
  lineWidth: 2,
};
