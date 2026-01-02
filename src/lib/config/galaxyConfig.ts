/**
 * galaxyConfig.ts - 银河系和近邻恒星配置
 */

// ==================== 单位转换常量 ====================
export const LIGHT_YEAR_TO_AU = 63241.077;
export const PARSEC_TO_LIGHT_YEAR = 3.26156;
export const PARSEC_TO_AU = 206265;

// ==================== 视图切换阈值配置 ====================
export const SCALE_VIEW_CONFIG = {
  solarSystemFadeStart: 500,
  solarSystemFadeEnd: 2000,
  nearbyStarsShowStart: 30000,
  nearbyStarsShowFull: LIGHT_YEAR_TO_AU,
  nearbyStarsFadeStart: 500 * LIGHT_YEAR_TO_AU,
  nearbyStarsFadeEnd: 1000 * LIGHT_YEAR_TO_AU,
  galaxyShowStart: 1000 * LIGHT_YEAR_TO_AU,    // 1000光年开始显示
  galaxyShowFull: 2000 * LIGHT_YEAR_TO_AU,    // 2000光年完全显示
  milkyWayBackgroundFadeStart: 50 * LIGHT_YEAR_TO_AU,
  milkyWayBackgroundFadeEnd: 200 * LIGHT_YEAR_TO_AU,
};

// ==================== 近邻恒星配置 ====================
export const NEARBY_STARS_CONFIG = {
  enabled: true,
  maxDistance: 300,
  basePointSize: 6.0,
  brightnessScale: 2.0,
  useSpheres: false,
  sphereBaseRadius: 0.01 * LIGHT_YEAR_TO_AU,
  colorTemperatureEnabled: true,
  labelShowDistance: 20,
  twinkleEnabled: true,
  twinkleSpeed: 0.5,
  twinkleIntensity: 0.3,
};

// ==================== 银河系配置 ====================
export const GALAXY_CONFIG = {
  enabled: true,
  radius: 50000,
  thickness: 1000,
  diskThickness: 300,
  sunDistanceFromCenter: 26000,
  topViewTexturePath: '/textures/planets/MilkyWayTop_Gaia_2100.jpg',
  topViewOpacity: 1.0,
  topViewScale: 1.0,
  // 立体厚度配置
  layerCount: 50,             // 层数（更多层减少分层感）
  layerThicknessLY: 2000,     // 总厚度（光年）
  layerOpacity: 0.03,         // 每层透明度
  bulgeFactor: 2,             // 凸起强度系数（相对于厚度）
  bulgeExponent: 4,           // 圆盘区域衰减指数
  coreRadius: 0.15,           // 核球半径（相对于银河系半径）
  coreThicknessFactor: 1.001,   // 核球厚度倍数
  diskMinThickness: 0.2,     // 圆盘最小厚度（相对于最大厚度）
  layerJitter: 5,             // 层高度随机抖动（减少分层感）
  coreBrightness: 1,          // 核心亮度倍数
  // 翘曲配置（银河系边缘一侧向上翘，另一侧向下弯）
  warpEnabled: true,          // 是否启用翘曲
  warpAmplitude: 0.08,        // 翘曲幅度（相对于半径）
  warpStartRadius: 0.4,       // 翘曲开始位置（相对于半径）
  warpAngle: 0,               // 翘曲方向角度（度）
  // 侧视图配置
  sideViewEnabled: true,      // 是否启用侧视图
  sideViewTexturePath: '/textures/planets/MilkyWaySide_Gaia_5000_2.jpg',
  sideViewOpacity: 0.03,       // 侧视图透明度
  sideViewCount: 30,           // 侧视图数量（均匀分布）
  // 旋转配置（度）
  rotationX: -90,
  rotationY: 30,
  rotationZ: 90,
  // 其他配置
  particleCount: 100000,
  particleBaseSize: 1.0,
  coreColor: '#fffaf0',
  armColor: '#aaccff',
  outerColor: '#8899bb',
  lodLevels: 4,
  lodDistances: [100, 500, 2000, 10000],
  lodParticleRatios: [1.0, 0.5, 0.2, 0.05],
  armCount: 4,
  armWindingAngle: 12,
  armWidth: 0.15,
  armBrightnessBoost: 1.5,
};

// ==================== 恒星数据接口 ====================
export interface StarData {
  name: string;
  distance: number;
  ra: number;
  dec: number;
  apparentMagnitude: number;
  absoluteMagnitude: number;
  spectralType: string;
  color: number;
}



// ==================== 近邻恒星数据 ====================
export const NEARBY_STARS_DATA: StarData[] = [
  // 10光年内
  { name: '比邻星', distance: 4.24, ra: 217.42, dec: -62.68, apparentMagnitude: 11.13, absoluteMagnitude: 15.53, spectralType: 'M5.5Ve', color: 0xff6644 },
  { name: '半人马座α A', distance: 4.37, ra: 219.90, dec: -60.83, apparentMagnitude: -0.01, absoluteMagnitude: 4.38, spectralType: 'G2V', color: 0xfff4ea },
  { name: '半人马座α B', distance: 4.37, ra: 219.90, dec: -60.83, apparentMagnitude: 1.33, absoluteMagnitude: 5.71, spectralType: 'K1V', color: 0xffd2a1 },
  { name: '巴纳德星', distance: 5.96, ra: 269.45, dec: 4.69, apparentMagnitude: 9.54, absoluteMagnitude: 13.22, spectralType: 'M4Ve', color: 0xff7755 },
  { name: '天狼星 A', distance: 8.60, ra: 101.29, dec: -16.72, apparentMagnitude: -1.46, absoluteMagnitude: 1.42, spectralType: 'A1V', color: 0xaaccff },
  { name: '天狼星 B', distance: 8.60, ra: 101.29, dec: -16.72, apparentMagnitude: 8.44, absoluteMagnitude: 11.34, spectralType: 'DA2', color: 0xffffff },
  // 10-20光年
  { name: '南河三', distance: 11.46, ra: 114.83, dec: 5.22, apparentMagnitude: 0.34, absoluteMagnitude: 2.66, spectralType: 'F5IV-V', color: 0xfff8f0 },
  { name: '波江座ε', distance: 10.52, ra: 53.23, dec: -9.46, apparentMagnitude: 3.73, absoluteMagnitude: 6.19, spectralType: 'K2V', color: 0xffc78e },
  { name: '鲸鱼座τ', distance: 11.91, ra: 26.02, dec: -15.94, apparentMagnitude: 3.50, absoluteMagnitude: 5.68, spectralType: 'G8.5V', color: 0xffe8c8 },
  { name: '牛郎星', distance: 16.73, ra: 297.70, dec: 8.87, apparentMagnitude: 0.76, absoluteMagnitude: 2.21, spectralType: 'A7V', color: 0xddeeff },
  { name: '天仓五', distance: 18.69, ra: 13.03, dec: 5.24, apparentMagnitude: 4.83, absoluteMagnitude: 5.92, spectralType: 'K0V', color: 0xffd4a8 },
  // 20-50光年
  { name: '织女星', distance: 25.04, ra: 279.23, dec: 38.78, apparentMagnitude: 0.03, absoluteMagnitude: 0.58, spectralType: 'A0V', color: 0xaaccff },
  { name: '北落师门', distance: 25.13, ra: 344.41, dec: -29.62, apparentMagnitude: 1.16, absoluteMagnitude: 1.72, spectralType: 'A4V', color: 0xccddff },
  { name: '北河二', distance: 33.78, ra: 113.65, dec: 31.89, apparentMagnitude: 1.14, absoluteMagnitude: -0.49, spectralType: 'A2Vm', color: 0xccddff },
  { name: '北河三', distance: 33.78, ra: 116.33, dec: 28.03, apparentMagnitude: 1.93, absoluteMagnitude: 0.59, spectralType: 'K0III', color: 0xffd4a8 },
  { name: '大角星', distance: 36.66, ra: 213.92, dec: 19.18, apparentMagnitude: -0.05, absoluteMagnitude: -0.31, spectralType: 'K1.5III', color: 0xffb870 },
  { name: '五车二', distance: 42.92, ra: 79.17, dec: 45.99, apparentMagnitude: 0.08, absoluteMagnitude: -0.48, spectralType: 'G3III', color: 0xfff4d4 },
  // 50-100光年
  { name: '毕宿五', distance: 65.30, ra: 68.98, dec: 16.51, apparentMagnitude: 0.85, absoluteMagnitude: -0.63, spectralType: 'K5III', color: 0xffaa55 },
  { name: '轩辕十四', distance: 79.30, ra: 152.09, dec: 11.97, apparentMagnitude: 1.40, absoluteMagnitude: -0.52, spectralType: 'B8IVn', color: 0xaabbff },
  { name: '天枢', distance: 123.00, ra: 165.93, dec: 61.75, apparentMagnitude: 1.79, absoluteMagnitude: -1.08, spectralType: 'K0III', color: 0xffd4a8 },
  // 100光年以上亮星
  { name: '角宿一', distance: 250.00, ra: 201.30, dec: -11.16, apparentMagnitude: 0.97, absoluteMagnitude: -3.55, spectralType: 'B1III-IV', color: 0x99aaff },
  { name: '心宿二', distance: 550.00, ra: 247.35, dec: -26.43, apparentMagnitude: 0.96, absoluteMagnitude: -5.28, spectralType: 'M1.5Iab', color: 0xff4422 },
  { name: '参宿四', distance: 700.00, ra: 88.79, dec: 7.41, apparentMagnitude: 0.42, absoluteMagnitude: -5.85, spectralType: 'M1-2Ia-ab', color: 0xff3311 },
  { name: '参宿七', distance: 860.00, ra: 78.63, dec: -8.20, apparentMagnitude: 0.13, absoluteMagnitude: -7.84, spectralType: 'B8Ia', color: 0xaabbff },
  { name: '天津四', distance: 2615.00, ra: 310.36, dec: 45.28, apparentMagnitude: 1.25, absoluteMagnitude: -8.38, spectralType: 'A2Ia', color: 0xccddff },
  { name: '老人星', distance: 310.00, ra: 95.99, dec: -52.70, apparentMagnitude: -0.74, absoluteMagnitude: -5.53, spectralType: 'A9II', color: 0xfff8f0 },
];

// ==================== 工具函数 ====================
export function getStarColorFromSpectralType(spectralType: string): number {
  const type = spectralType.charAt(0).toUpperCase();
  const colors: Record<string, number> = {
    'O': 0x9bb0ff, 'B': 0xaabfff, 'A': 0xcad7ff, 'F': 0xf8f7ff,
    'G': 0xfff4ea, 'K': 0xffd2a1, 'M': 0xffcc6f, 'L': 0xff8844,
    'T': 0xff6633, 'D': 0xffffff,
  };
  return colors[type] || 0xffffff;
}

export function equatorialToCartesian(ra: number, dec: number, distance: number): { x: number; y: number; z: number } {
  const raRad = (ra * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;
  const distanceAU = distance * LIGHT_YEAR_TO_AU;
  return {
    x: distanceAU * Math.cos(decRad) * Math.cos(raRad),
    y: distanceAU * Math.cos(decRad) * Math.sin(raRad),
    z: distanceAU * Math.sin(decRad),
  };
}
