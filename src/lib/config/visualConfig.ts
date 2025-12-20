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
  enabled: false, // 禁用轨道渐变，避免黑色段问题
  maxOpacity: 1.0,
  minOpacity: 0.8, // 提高最小透明度，减少黑色段
};

/**
 * 轨道渲染配置
 * - lineWidth: 轨道线宽（注意：WebGL/Three.js 在多数浏览器中对 lineWidth 支持受限，可能被忽略）
 *   如果需要在所有平台上可见的粗线效果，请考虑使用带宽度的 TubeGeometry 或平面条带替代。
 */
export const ORBIT_RENDER_CONFIG = {
  lineWidth: 2,
};

/**
 * 轨道可见性与遮挡控制
 * - hideAtScale: 当场景缩放（或世界单位缩放因子）小于此阈值时隐藏轨道（避免在极小尺度下大量轨道遮挡）
 * - preventOrbitOverSun: 当轨道与太阳视线重叠时尝试降低轨道不透明度或隐藏，防止遮挡太阳视觉效果
 */
export const ORBIT_VISIBILITY_CONFIG = {
  hideAtScale: 0.0005,
  preventOrbitOverSun: true,
  fadeDuration: 0.6, // 秒，轨道显示/隐藏的渐变时长
};

// 轨道屏幕空间可见性阈值（以像素为单位）
// 当轨道在屏幕上的投影半径小于 `pixelHideThreshold` 时，会开始淡出；
// 在 `pixelHideThreshold + pixelFadeRange` 之外完全隐藏。
export const ORBIT_SCREEN_THRESHOLD = {
  pixelHideThreshold: 5,
  pixelFadeRange: 50,
};

/**
 * 相机相关配置
 * - minDistanceToBody: 距行星/卫星的最小安全距离（世界单位），防止相机穿透天体导致黑圆
 * - initialTiltDeg: 初始视角俯仰角（度），默认从接近垂直俯视过渡到此角度
 * - initialTransitionSec: 首次加载时从俯视到斜视的动画时长（秒）
 */
export const CAMERA_CONFIG = {
  minDistanceToBody: 0.002, // 以天体半径为参考的比例（在代码中会乘以目标半径）
  initialTiltDeg: 30,
  initialTransitionSec: 1.2,
};

/**
 * 标尺（ScaleRuler）配置
 */
export const SCALE_RULER_CONFIG = {
  enabled: true,
  unit: 'km',
  // 屏幕上最小/最大像素长度用于缩放显示（避免太小或太大）
  minPx: 40,
  maxPx: 220,
};

/**
 * 纹理加载策略
 * - lowResPlaceholder: 本地或打包的低分辨率占位图（用于默认展示）
 * - highResDistanceThreshold: 当相机距离目标小于该值时开始加载高分辨率 NASA 纹理
 *   距离单位与 CameraController 距离计算保持一致
 */
export const TEXTURE_LOADING_CONFIG = {
  lowResPlaceholder: '/textures/placeholder-lowres.jpg',
  highResDistanceThreshold: 0.8, // 当相机相对目标距离小于此值时加载高分辨率贴图
  preferGPU: true,
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

/**
 * ==================== 相机控制器配置（CameraController） ====================
 * 防穿透与无限放大相关参数
 */

/**
 * Header（页头）配置
 * 左侧LOGO和右侧网站信息的显示参数
 */
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    hoverBackgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: 8,
    boxShadow: '0 6px 18px rgba(0,0,0,0.6)',
    backdropFilter: 'blur(6px)',
  },
  
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
 * 相机防穿透约束配置
 * 当相机接近或穿过行星表面时的约束行为
 */
export const CAMERA_PENETRATION_CONFIG = {
  // 防穿透安全距离倍数：相对于行星半径的倍数。
  // 当相机距离 < 行星半径 * 此倍数时，触发防穿透约束
  // 值越大，约束触发越早；设为 1.2 确保相机始终在表面外
  safetyDistanceMultiplier: 1.6,
  
  // 防穿透约束的平滑过渡速度（0-1），用于平滑调整焦点位置
  // 值越大约束响应越快，值越小约束更平缓。建议范围：0.05-0.3
  constraintSmoothness: 0.25,
  
  // 约束应用时是否同时调整相机距离以避免跳跃
  // true：焦点和相机都调整；false：仅调整焦点
  adjustCameraDistance: true,
  
  // 当检测到穿透时是否立即强制修正位置（true 会把相机和焦点直接设置到安全位置以防止继续穿透）
  // false 则使用平滑 lerp 过渡（可能在快速滚轮操作下无法完全阻止穿透）
  forceSnap: true,
  
  // 启用防穿透约束的调试模式
  // true：会在控制台打印约束触发和参数信息
  debugMode: false,
};

/**
 * 相机缩放配置
 * 控制相机缩放行为和速度
 */
export const CAMERA_ZOOM_CONFIG = {
  // 最小缩放距离（极小值以支持无限放大如地图软件）
  // 更小的值允许更接近天体。建议：0.00001-0.0001
  minDistance: 0.00001,
  
  // 最大缩放距离
  // 更大的值允许更远距离观看。建议：500-2000
  maxDistance: 1000,
  
  // 缩放速度因子（OrbitControls 内部使用）
  // 值越大鼠标滚轮缩放越敏感。建议范围：1.0-2.5
  zoomSpeed: 1.5,
  
  // 基础缩放因子（滚轮缩放的基础倍数）
  // 影响每次滚轮事件的缩放幅度。建议范围：0.2-0.6
  zoomBaseFactor: 0.4,
  
  // 缩放缓动速度（0-1之间，越大越快）
  // 用于平滑过渡缩放效果。建议范围：0.1-0.3
  zoomEasingSpeed: 0.2,
};

/**
 * 相机聚焦配置
 * 点击行星聚焦时的行为
 */
export const CAMERA_FOCUS_CONFIG = {
  // 聚焦动画的插值速度（0-1，越大越快）
  // 控制相机平滑移动到聚焦位置的速度。建议范围：0.1-0.3
  focusLerpSpeed: 0.2,
  
  // 聚焦动画完成阈值（距离小于此值认为完成）
  // 用于判断聚焦动画是否完成。建议：0.001-0.05
  focusThreshold: 0.01,
  
  // 聚焦后初始相机距离相对于行星半径的倍数
  // 值越大相机离行星越远。建议范围：3-8
  focusDistanceMultiplier: 8,
  
  // 防穿透时的最小距离倍数（相对于行星半径）
  // 当相机缩放时不会穿过此距离。建议范围：0.1-0.5
  minDistanceMultiplier: 1.2,
};

/**
 * 相机跟踪配置
 * 聚焦后跟踪行星运动的行为
 */
export const CAMERA_TRACKING_CONFIG = {
  // 跟踪时的插值速度（0-1，越大越快，值越大跟随越紧密）
  // 用于平滑跟踪行星运动。建议范围：0.05-0.25
  trackingLerpSpeed: 0.15,
};

/**
 * 相机视角配置
 * 相机的投影和视角参数
 */
export const CAMERA_VIEW_CONFIG = {
  // 相机视野角度（FOV，度），值越大视野越广，边缘畸变越明显
  // 建议范围：45-75
  fov: 45,
  
  // 视角平滑过渡速度（0-1，越大越快）
  // 用于平滑修改相机视野角度。建议范围：0.1-0.25
  fovTransitionSpeed: 0.15,
  
  // 动态近平面调整倍数：当相机靠近行星时，近平面 = 距离 * 此倍数
  // 防止相机靠近时因近平面裁剪而导致行星消失
  // ⚠️ 关键参数：值越小近平面调整越激进，允许更接近行星
  // 0.01 = 当距离为1时近平面为0.01，非常接近（推荐用于无限放大）
  dynamicNearPlaneMultiplier: 0.01,
  
  // 最小近平面距离（绝对值）
  // 防止近平面过小导致深度精度问题，但要足够小以支持极近距离观看
  // ⚠️ 关键参数：0.00001 = 10纳米级，足够支持接近观看
  minNearPlane: 0.00001,
  
  // 最大远平面距离（绝对值）
  // 太阳系超大尺度需要很大的远平面。建议：1e10-1e12
  maxFarPlane: 1e12,
};

/**
 * 相机操作配置
 * 控制各种输入操作的响应
 */
export const CAMERA_OPERATION_CONFIG = {
  // 阻尼系数（0-1，值越小缓动越明显，惯性越强）
  // 控制相机旋转/平移的惯性效果。建议范围：0.01-0.1
  dampingFactor: 0.04,
  
  // 平移速度因子
  // 值越大鼠标/触摸平移越敏感。建议范围：0.3-1.0
  panSpeed: 0.6,
  
  // 旋转速度因子
  // 值越大鼠标/触摸旋转越敏感。建议范围：0.5-1.5
  rotateSpeed: 0.8,
  
  // 极角平滑过渡速度（0-1，越大越快）
  // 用于平滑调整相机的上下视角。建议范围：0.05-0.15
  polarAngleTransitionSpeed: 0.08,
  
  // 方位角平滑过渡速度（0-1，越大越快）
  // 用于平滑调整相机的左右视角。建议范围：0.05-0.15
  azimuthalAngleTransitionSpeed: 0.08,
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
 * 行星轴倾角配置（Axial Tilt / Obliquity）
 * 
 * 定义每个行星相对于黄道面的轴倾角（度）
 * 用于正确显示行星贴图的南北极方向
 * 
 * 注意：
 * - 正值表示北极向黄道面北方倾斜
 * - 负值或大于90度表示逆行自转（如金星、天王星）
 * - 这是渲染层配置，不影响物理计算
 * 
 * 数据来源：NASA Planetary Fact Sheet
 */
export const PLANET_AXIAL_TILT: Record<string, number> = {
  // 太阳轴倾角约 7.25°（相对于黄道面）
  sun: 7.25,
  
  // 八大行星
  mercury: 0.034,    // 几乎无倾斜
  venus: 177.4,      // 逆行自转，几乎倒置
  earth: 23.44,      // 地球轴倾角
  mars: 25.19,       // 与地球相似
  jupiter: 3.13,     // 几乎直立
  saturn: 26.73,     // 与地球相似
  uranus: 97.77,     // 几乎躺着转
  neptune: 28.32,    // 与地球相似
  
  // 卫星（相对于其轨道面）
  moon: 6.68,        // 月球轴倾角
  io: 0.05,          // 潮汐锁定，几乎无倾斜
  europa: 0.1,
  ganymede: 0.33,
  callisto: 0.0,
  titan: 0.3,
  enceladus: 0.0,
  miranda: 0.0,
  ariel: 0.0,
  umbriel: 0.0,
  titania: 0.0,
  
  // 矮行星
  ceres: 4.0,
  eris: 78.0,        // 高倾角
  haumea: 126.0,     // 逆行
  makemake: 0.0,     // 未知，假设为 0
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
 * ==================== 贴图策略约束（Phase 1 锁定） ====================
 * 
 * ⚠️ LOCKED: 以下约束在 Phase 1 期间不可更改
 * 
 * 这些约束是系统稳定性的"护城河"，防止后续开发破坏系统边界。
 * 任何修改必须经过完整的设计评审。
 */
export const TEXTURE_STRATEGY_CONSTRAINTS = {
  /**
   * ✅ 允许的贴图类型
   * Phase 1 仅支持 BaseColor（Albedo）贴图
   */
  ALLOWED_TEXTURE_TYPES: ['baseColor'] as const,
  
  /**
   * ✅ 允许的分辨率
   * Low (2K) 和 High (4K) 两档，不支持 8K
   */
  ALLOWED_RESOLUTIONS: ['2k', '4k'] as const,
  
  /**
   * ❌ 明确禁止的功能（Phase 1）
   * 这些功能在 Phase 1 期间绝对不实现
   */
  FORBIDDEN_FEATURES: [
    '8k_textures',      // 8K 分辨率 - 内存开销过大
    'normal_maps',      // 法线贴图 - 增加复杂度
    'height_maps',      // 高程贴图 - 增加复杂度
    'cloud_layers',     // 云层动画 - 增加复杂度
    'specular_maps',    // 高光贴图 - 增加复杂度
    'night_lights',     // 夜面灯光 - 增加复杂度
    'auto_download',    // 自动下载贴图 - 网络依赖
    'svg_textures',     // SVG/矢量贴图 - 不适用
    'terrain_detail',   // 地形细节 - 超出范围
  ] as const,
  
  /**
   * ✅ Sun 永远 emissive-only
   * Sun 在 Phase 1 期间不使用任何贴图
   */
  SUN_EMISSIVE_ONLY: true,
  
  /**
   * ✅ 默认分辨率
   * 使用 2K 以优化内存
   */
  DEFAULT_RESOLUTION: '2k' as const,
  
  /**
   * Phase 1 版本标识
   */
  PHASE: 1,
  VERSION: '3.1.0',
} as const;

/**
 * 行星贴图配置接口
 * 
 * 支持多层贴图（为未来扩展预留）：
 * - baseColor: 基础颜色贴图（Albedo）- Phase 1 实现
 * - normalMap: 法线贴图 - 预留
 * - cloudMap: 云层贴图 - 预留
 * - nightMap: 夜面灯光贴图 - 预留
 */
export interface PlanetTextureConfig {
  /** Base color / albedo map path (equirectangular projection) */
  baseColor?: string;
  
  /** Reserved for future: normal map */
  normalMap?: string;
  
  /** Reserved for future: cloud layer */
  cloudMap?: string;
  
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
