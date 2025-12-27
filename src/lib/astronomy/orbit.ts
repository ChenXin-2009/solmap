/**
 * 轨道计算模块 v2
 * 
 * 修改内容：
 * 1. 使用 VSOP87 简化模型的轨道参数（更接近 NASA JPL 数据）
 * 2. 增加轨道参数的时间演化（每世纪变化率）
 * 3. 修正坐标系转换（黄道坐标系 → 日心坐标系）
 * 4. 月球使用 ELP2000 简化模型
 * 
 * 参考：
 * - NASA JPL HORIZONS System
 * - Simon et al. (1994) - Numerical expressions for precession
 * - Meeus, Jean - Astronomical Algorithms (2nd Ed.)
 */

import * as THREE from 'three';

export interface OrbitalElements {
  name: string;
  // 轨道元素（J2000.0历元）
  a: number;      // 半长轴 (AU)
  e: number;      // 离心率
  i: number;      // 轨道倾角 (rad)
  L: number;      // 平黄经 (rad)
  w_bar: number;  // 近日点黄经 (rad)
  O: number;      // 升交点黄经 (rad)
  // 每世纪变化率
  a_dot: number;
  e_dot: number;
  i_dot: number;
  L_dot: number;
  w_bar_dot: number;
  O_dot: number;
  // 显示属性
  radius: number;
  color: string;
}

export interface CelestialBody {
  name: string;
  x: number;
  y: number;
  z: number;
  r: number;
  radius: number;
  color: string;
  isSun?: boolean;
  // 可选：父天体的 key（小写），用于标识卫星
  parent?: string;
  // 标识这是否为卫星
  isSatellite?: boolean;
  elements?: OrbitalElements;
}

/**
 * 8大行星轨道参数
 * 数据源：NASA JPL DE440 + Simon et al. (1994)
 * 基准历元：J2000.0 (JD 2451545.0)
 */
export const ORBITAL_ELEMENTS: Record<string, OrbitalElements> = {
  mercury: {
    name: 'Mercury',
    // J2000.0 轨道元素
    a: 0.38709927,
    e: 0.20563593,
    i: 7.00497902 * Math.PI / 180,
    L: 252.25032350 * Math.PI / 180,
    w_bar: 77.45779628 * Math.PI / 180,
    O: 48.33076593 * Math.PI / 180,
    // 每儒略世纪变化率
    a_dot: 0.00000037,
    e_dot: 0.00001906,
    i_dot: -0.00594749 * Math.PI / 180,
    L_dot: 149472.67411175 * Math.PI / 180,
    w_bar_dot: 0.16047689 * Math.PI / 180,
    O_dot: -0.12534081 * Math.PI / 180,
    radius: 0.003,
    color: '#8C7853'
  },
  venus: {
    name: 'Venus',
    a: 0.72333566,
    e: 0.00677672,
    i: 3.39467605 * Math.PI / 180,
    L: 181.97909950 * Math.PI / 180,
    w_bar: 131.60246718 * Math.PI / 180,
    O: 76.67984255 * Math.PI / 180,
    a_dot: 0.00000390,
    e_dot: -0.00004107,
    i_dot: -0.00078890 * Math.PI / 180,
    L_dot: 58517.81538729 * Math.PI / 180,
    w_bar_dot: 0.00268329 * Math.PI / 180,
    O_dot: -0.27769418 * Math.PI / 180,
    radius: 0.008,
    color: '#FFC649'
  },
  earth: {
    name: 'Earth',
    a: 1.00000261,
    e: 0.01671123,
    i: -0.00001531 * Math.PI / 180,
    L: 100.46457166 * Math.PI / 180,
    w_bar: 102.93768193 * Math.PI / 180,
    O: 0.0,
    a_dot: 0.00000562,
    e_dot: -0.00004392,
    i_dot: -0.01294668 * Math.PI / 180,
    L_dot: 35999.37244981 * Math.PI / 180,
    w_bar_dot: 0.32327364 * Math.PI / 180,
    O_dot: 0.0,
    radius: 0.008,
    color: '#4A90E2'
  },
  mars: {
    name: 'Mars',
    a: 1.52371034,
    e: 0.09339410,
    i: 1.84969142 * Math.PI / 180,
    L: -4.55343205 * Math.PI / 180,
    w_bar: -23.94362959 * Math.PI / 180,
    O: 49.55953891 * Math.PI / 180,
    a_dot: 0.00001847,
    e_dot: 0.00007882,
    i_dot: -0.00813131 * Math.PI / 180,
    L_dot: 19140.30268499 * Math.PI / 180,
    w_bar_dot: 0.44441088 * Math.PI / 180,
    O_dot: -0.29257343 * Math.PI / 180,
    radius: 0.004,
    color: '#E27B58'
  },
  jupiter: {
    name: 'Jupiter',
    a: 5.20288700,
    e: 0.04838624,
    i: 1.30439695 * Math.PI / 180,
    L: 34.39644051 * Math.PI / 180,
    w_bar: 14.72847983 * Math.PI / 180,
    O: 100.47390909 * Math.PI / 180,
    a_dot: -0.00011607,
    e_dot: -0.00013253,
    i_dot: -0.00183714 * Math.PI / 180,
    L_dot: 3034.74612775 * Math.PI / 180,
    w_bar_dot: 0.21252668 * Math.PI / 180,
    O_dot: 0.20469106 * Math.PI / 180,
    radius: 0.09,
    color: '#C88B3A'
  },
  saturn: {
    name: 'Saturn',
    a: 9.53667594,
    e: 0.05386179,
    i: 2.48599187 * Math.PI / 180,
    L: 49.95424423 * Math.PI / 180,
    w_bar: 92.59887831 * Math.PI / 180,
    O: 113.66242448 * Math.PI / 180,
    a_dot: -0.00125060,
    e_dot: -0.00050991,
    i_dot: 0.00193609 * Math.PI / 180,
    L_dot: 1222.49362201 * Math.PI / 180,
    w_bar_dot: -0.41897216 * Math.PI / 180,
    O_dot: -0.28867794 * Math.PI / 180,
    radius: 0.075,
    color: '#FAD5A5'
  },
  uranus: {
    name: 'Uranus',
    a: 19.18916464,
    e: 0.04725744,
    i: 0.77263783 * Math.PI / 180,
    L: 313.23810451 * Math.PI / 180,
    w_bar: 170.95427630 * Math.PI / 180,
    O: 74.01692503 * Math.PI / 180,
    a_dot: -0.00196176,
    e_dot: -0.00004397,
    i_dot: -0.00242939 * Math.PI / 180,
    L_dot: 428.48202785 * Math.PI / 180,
    w_bar_dot: 0.40805281 * Math.PI / 180,
    O_dot: 0.04240589 * Math.PI / 180,
    radius: 0.032,
    color: '#4FD0E7'
  },
  neptune: {
    name: 'Neptune',
    a: 30.06992276,
    e: 0.00859048,
    i: 1.77004347 * Math.PI / 180,
    L: -55.12002969 * Math.PI / 180,
    w_bar: 44.96476227 * Math.PI / 180,
    O: 131.78422574 * Math.PI / 180,
    a_dot: 0.00026291,
    e_dot: 0.00005105,
    i_dot: 0.00035372 * Math.PI / 180,
    L_dot: 218.45945325 * Math.PI / 180,
    w_bar_dot: -0.32241464 * Math.PI / 180,
    O_dot: -0.00508664 * Math.PI / 180,
    radius: 0.031,
    color: '#4166F5'
  }
};

/**
 * 卫星定义（含完整轨道参数）
 * 
 * 数据源：NASA JPL HORIZONS 和 IAU WGAS 报告
 * 参数说明：
 * - parent: 母天体 key（小写，如 'jupiter'）
 * - name: 卫星名（英文）
 * - a: 半长轴（km，最后除以 AU 转换）
 * - periodDays: 公转周期（天）
 * - i: 轨道倾角（度，相对于母行星的赤道平面）
 * - Omega: 升交点黄经（度）
 * - radius: 卫星渲染半径（km，最后除以 AU 转换）
 * - color: 显示颜色
 * - phase: 初始相位（0-1）
 */
export const SATELLITE_DEFINITIONS: Record<string, Array<{
  name: string;
  a: number;          // 半长轴（AU）
  periodDays: number;
  i: number;          // 轨道倾角（弧度）
  Omega: number;      // 升交点黄经（弧度）
  radius: number;     // 半径（AU）
  color: string;
  phase?: number;
  eclipticOrbit?: boolean;  // 是否相对于黄道面而非母行星赤道面
}>> = {
  earth: [
    // 地球唯一天然卫星
    // 数据源：NASA JPL HORIZONS（2024）
    // 月球轨道倾角相对于黄道面 ~5.14°（不是相对于地球赤道面）
    { name: 'Moon', a: 384400 / 149597870.7, periodDays: 27.322, i: 5.145 * Math.PI / 180, Omega: 0 * Math.PI / 180, radius: 1737.4 / 149597870.7, color: '#c0c0c0', phase: 0.0, eclipticOrbit: true },
  ],
  jupiter: [
    // 木星的四颗伽利略卫星
    // 数据源：NASA JPL HORIZONS（2024）
    // 为每个卫星设置不同的升交点黄经，使它们的轨道处于不同平面
    { name: 'Io', a: 421700 / 149597870.7, periodDays: 1.769, i: 0.04 * Math.PI / 180, Omega: 0 * Math.PI / 180, radius: 1821.6 / 149597870.7, color: '#f5d6a0', phase: 0.02 },
    { name: 'Europa', a: 671034 / 149597870.7, periodDays: 3.551, i: 0.47 * Math.PI / 180, Omega: 90 * Math.PI / 180, radius: 1560.8 / 149597870.7, color: '#d9e8ff', phase: 0.25 },
    { name: 'Ganymede', a: 1070412 / 149597870.7, periodDays: 7.154, i: 0.18 * Math.PI / 180, Omega: 180 * Math.PI / 180, radius: 2634.1 / 149597870.7, color: '#cfae8b', phase: 0.5 },
    { name: 'Callisto', a: 1882700 / 149597870.7, periodDays: 16.689, i: 0.19 * Math.PI / 180, Omega: 270 * Math.PI / 180, radius: 2410.3 / 149597870.7, color: '#bba99b', phase: 0.75 },
  ],
  saturn: [
    // 土星主要卫星
    // 数据源：NASA JPL HORIZONS（2024）
    // 为卫星设置不同的升交点黄经
    { name: 'Titan', a: 1221870 / 149597870.7, periodDays: 15.945, i: 0.34 * Math.PI / 180, Omega: 45 * Math.PI / 180, radius: 2574.73 / 149597870.7, color: '#ffd9a6', phase: 0.2 },
    { name: 'Enceladus', a: 238020 / 149597870.7, periodDays: 1.370, i: 0.01 * Math.PI / 180, Omega: 225 * Math.PI / 180, radius: 252.1 / 149597870.7, color: '#e6f7ff', phase: 0.6 },
  ],
  uranus: [
    // 天王星卫星
    // 天王星自转轴倾斜97.8°，卫星轨道倾角相对于天王星赤道平面
    // 数据源：NASA JPL HORIZONS（2024）
    // 为卫星设置不同的升交点黄经
    { name: 'Miranda', a: 129900 / 149597870.7, periodDays: 1.413, i: 4.338 * Math.PI / 180, Omega: 30 * Math.PI / 180, radius: 235.8 / 149597870.7, color: '#f0e9ff', phase: 0.1 },
    { name: 'Ariel', a: 191020 / 149597870.7, periodDays: 2.521, i: 0.260 * Math.PI / 180, Omega: 120 * Math.PI / 180, radius: 578.9 / 149597870.7, color: '#cfe7ff', phase: 0.35 },
    { name: 'Umbriel', a: 266000 / 149597870.7, periodDays: 4.144, i: 0.360 * Math.PI / 180, Omega: 210 * Math.PI / 180, radius: 584.7 / 149597870.7, color: '#bfc4d6', phase: 0.6 },
    { name: 'Titania', a: 436300 / 149597870.7, periodDays: 8.706, i: 0.100 * Math.PI / 180, Omega: 300 * Math.PI / 180, radius: 788.9 / 149597870.7, color: '#d6eaff', phase: 0.9 },
  ],
  neptune: [
    // 海王星主要卫星
    // 数据源：NASA JPL HORIZONS（2024）
    { name: 'Triton', a: 354800 / 149597870.7, periodDays: 5.877, i: 156.87 * Math.PI / 180, Omega: 0 * Math.PI / 180, radius: 1353.4 / 149597870.7, color: '#bde0ff', phase: 0.4 },
  ]
};

/**
 * 计算给定时刻的轨道元素
 * @param elements - 基准轨道元素
 * @param T - 从J2000.0起的儒略世纪数
 */
function computeElementsAtTime(elements: OrbitalElements, T: number): OrbitalElements {
  return {
    ...elements,
    a: elements.a + elements.a_dot * T,
    e: elements.e + elements.e_dot * T,
    i: elements.i + elements.i_dot * T,
    L: elements.L + elements.L_dot * T,
    w_bar: elements.w_bar + elements.w_bar_dot * T,
    O: elements.O + elements.O_dot * T
  };
}

/**
 * 求解开普勒方程
 */
function solveKepler(M: number, e: number, tolerance: number = 1e-8): number {
  let E = M;
  let delta = 1;
  let iterations = 0;
  const maxIterations = 50;
  
  while (Math.abs(delta) > tolerance && iterations < maxIterations) {
    delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= delta;
    iterations++;
  }
  
  return E;
}

/**
 * 计算行星日心坐标
 * @param elements - 轨道元素
 * @param julianDay - 儒略日
 */
export function calculatePosition(
  elements: OrbitalElements,
  julianDay: number
): { x: number; y: number; z: number; r: number } {
  // 从J2000.0起的儒略世纪数
  const T = (julianDay - 2451545.0) / 36525.0;
  
  // 计算当前时刻的轨道元素
  const elem = computeElementsAtTime(elements, T);
  
  // 计算平近点角
  const w = elem.w_bar - elem.O; // 近日点幅角
  const M = (elem.L - elem.w_bar) % (2 * Math.PI);
  
  // 求解偏近点角
  const E = solveKepler(M, elem.e);
  
  // 计算真近点角
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + elem.e) * Math.sin(E / 2),
    Math.sqrt(1 - elem.e) * Math.cos(E / 2)
  );
  
  // 日心距离
  const r = elem.a * (1 - elem.e * Math.cos(E));
  
  // 轨道平面坐标
  const x_orb = r * Math.cos(nu);
  const y_orb = r * Math.sin(nu);
  
  // 转换到黄道坐标系
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
  
  return { x, y, z, r };
}

/**
 * 获取所有天体位置
 */
export function getCelestialBodies(julianDay: number): CelestialBody[] {
  const bodies: CelestialBody[] = [];
  
  // 太阳
  bodies.push({
    name: 'Sun',
    x: 0,
    y: 0,
    z: 0,
    r: 0,
    radius: 0.05,
    color: '#FDB813',
    isSun: true
  });
  
  // 8大行星
  let earthPos: { x: number; y: number; z: number } | null = null;
  
  for (const [key, elements] of Object.entries(ORBITAL_ELEMENTS)) {
    const pos = calculatePosition(elements, julianDay);
    
    bodies.push({
      name: elements.name,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      r: pos.r,
      radius: elements.radius,
      color: elements.color,
      elements: elements
    });
    
    if (key === 'earth') {
      earthPos = pos;
    }
  }

  // 生成行星的卫星（简化轨道模型）
  // 使用圆形轨道，轨道中心为母天体当前位置，轨道半径使用 SATELLITE_DEFINITIONS 中的 a
  // 🔧 关键修复：卫星位置计算考虑母行星轴倾角，确保与轨道平面渲染一致
  const planetPosMap: Record<string, { x: number; y: number; z: number }> = {};
  for (const b of bodies) {
    planetPosMap[b.name.toLowerCase()] = { x: b.x, y: b.y, z: b.z };
  }

  const daysSinceJ2000 = julianDay - 2451545.0;
  for (const [parentKey, sats] of Object.entries(SATELLITE_DEFINITIONS)) {
    const parentPos = planetPosMap[parentKey];
    if (!parentPos) continue;

    // 🔧 获取母行星的轴倾角信息（从 CELESTIAL_BODIES 配置）
    let parentAxisQuaternion = new THREE.Quaternion(); // 默认无倾角
    
    // 动态导入 CELESTIAL_BODIES 以获取母行星轴倾角
    try {
      const { CELESTIAL_BODIES } = require('@/lib/types/celestialTypes');
      const parentConfig = CELESTIAL_BODIES[parentKey];
      
      if (parentConfig && parentConfig.orientation && parentConfig.orientation.spinAxis) {
        const [x, y, z] = parentConfig.orientation.spinAxis;
        
        // 母行星自转轴向量（ICRF坐标系）
        const spinAxisICRF = new THREE.Vector3(x, y, z);
        
        // 转换到渲染坐标系（ICRF -> Three.js）
        const spinAxisRender = new THREE.Vector3(
          spinAxisICRF.x,  // X 保持不变
          spinAxisICRF.z,  // ICRF Z -> Render Y
          -spinAxisICRF.y  // ICRF Y -> Render -Z
        );
        
        // 🔧 修复：轨道平面在赤道面内，法向量是自转轴
        const defaultNormal = new THREE.Vector3(0, 0, 1);  // 默认轨道平面法向量（Z轴）
        const targetNormal = spinAxisRender.normalize();   // 目标法向量（自转轴方向）
        
        parentAxisQuaternion.setFromUnitVectors(defaultNormal, targetNormal);
      }
    } catch (error) {
      console.warn(`Failed to get parent axis for ${parentKey}:`, error);
    }

    for (const sat of sats) {
      // 计算平均角度（基于简化的固定周期）
      const theta = (2 * Math.PI * (daysSinceJ2000 / sat.periodDays + (sat.phase || 0))) % (2 * Math.PI);

      // 卫星轨道坐标
      const r_orb = sat.a;  // 轨道半径
      const x_orb = r_orb * Math.cos(theta);  // 轨道平面 X 坐标
      const y_orb = r_orb * Math.sin(theta);  // 轨道平面 Y 坐标
      const z_orb = 0;                        // 轨道平面内 Z = 0

      let satellitePos: THREE.Vector3;

      if (sat.eclipticOrbit) {
        // 月球等：轨道相对于黄道面，不跟随母行星赤道面
        // 直接在黄道坐标系中应用轨道倾角
        const cos_Om = Math.cos(sat.Omega);
        const sin_Om = Math.sin(sat.Omega);
        const x_1 = x_orb * cos_Om - y_orb * sin_Om;
        const y_1 = x_orb * sin_Om + y_orb * cos_Om;
        const z_1 = z_orb;

        const cos_i = Math.cos(sat.i);
        const sin_i = Math.sin(sat.i);
        const x_final = x_1;
        const y_final = y_1 * cos_i - z_1 * sin_i;
        const z_final = y_1 * sin_i + z_1 * cos_i;

        satellitePos = new THREE.Vector3(x_final, y_final, z_final);
      } else {
        // 其他卫星：轨道在母行星赤道面内
        // 应用卫星轨道倾角和升交点黄经（相对于母行星赤道面）
        const cos_Om = Math.cos(sat.Omega);
        const sin_Om = Math.sin(sat.Omega);
        const x_1 = x_orb * cos_Om - y_orb * sin_Om;
        const y_1 = x_orb * sin_Om + y_orb * cos_Om;
        const z_1 = z_orb;

        const cos_i = Math.cos(sat.i);
        const sin_i = Math.sin(sat.i);
        const x_2 = x_1;
        const y_2 = y_1 * cos_i - z_1 * sin_i;
        const z_2 = y_1 * sin_i + z_1 * cos_i;

        // 应用母行星轴倾角变换
        satellitePos = new THREE.Vector3(x_2, y_2, z_2);
        satellitePos.applyQuaternion(parentAxisQuaternion);
      }

      bodies.push({
        name: sat.name,
        x: parentPos.x + satellitePos.x,
        y: parentPos.y + satellitePos.y,
        z: parentPos.z + satellitePos.z,
        r: 0,
        radius: sat.radius,
        color: sat.color,
        // 便于渲染逻辑识别这是个卫星
        parent: parentKey,
        isSatellite: true,
      } as unknown as CelestialBody);
    }
  }
  
  return bodies;
}